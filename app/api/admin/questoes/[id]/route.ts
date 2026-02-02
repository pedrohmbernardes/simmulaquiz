import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { registrarLog, AuditAction } from '@/lib/audit';
import { csrfRateLimit, adminContentRateLimit } from '@/lib/ratelimit';
import { verifyCSRFToken } from '@/lib/csrf';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

// --- SANITIZAÇÃO ---
const sanitizeHtml = (val: string) => DOMPurify.sanitize(val.trim());

// --- HELPER DE VALIDAÇÃO ---
// Transforma "", "0" ou 0 em null para permitir limpar campos opcionais
const optionalId = z.preprocess(
  (val) => (val === '' || val === '0' || val === 0) ? null : val,
  z.coerce.number().int().positive().nullable().optional()
);

// --- SCHEMA DE ATUALIZAÇÃO V2.4 ---
const questaoUpdateSchema = z.object({
  // Conteúdo
  enunciado: z.string().transform(sanitizeHtml).refine(val => val.length >= 5, "Enunciado muito curto").optional(),
  alternativaA: z.string().transform(sanitizeHtml).optional(),
  alternativaB: z.string().transform(sanitizeHtml).optional(),
  alternativaC: z.string().transform(sanitizeHtml).optional(),
  alternativaD: z.string().transform(sanitizeHtml).optional(),
  alternativaE: z.string().transform(sanitizeHtml).optional(),
  alternativaCorreta: z.string().regex(/^[a-e]$/i).optional(),
  ativa: z.boolean().optional(),
  
  // Metadados
  dificuldade: z.enum(['MUITO_FACIL', 'FACIL', 'MEDIO', 'DIFICIL', 'MUITO_DIFICIL']).optional(),
  nivelCognitivo: z.enum(['LEMBRAR', 'ENTENDER', 'APLICAR', 'ANALISAR', 'AVALIAR', 'CRIAR']).optional(),
  
  // Origem
  categoriaOrigem: z.enum([
    'INSTITUCIONAL_INTERNA', 'CONCURSO_PUBLICO', 'CONCURSO_MILITAR', 
    'VESTIBULAR', 'CERTIFICACAO', 'OUTRO'
  ]).optional(),
  ano: z.coerce.number().optional(),
  prova: z.string().optional(),
  observacoes: z.string().optional(),

  // Relacionamentos (IDs) - Corrigido com optionalId
  instituicaoId: optionalId,
  bancaId: optionalId,
  
  // Currículo
  cursoTecnicoId: optionalId,
  unidadeCurricularId: optionalId,
  // O front pode mandar como objetoConhecimentoId ou conhecimentoId
  objetoConhecimentoId: optionalId, 
  conhecimentoId: optionalId,
  subConhecimentoId: optionalId,

  // Competências
  funcaoId: optionalId,
  subfuncaoId: optionalId,
  capacidadeId: optionalId,

  // Imagem
  imagem: z.object({
    url: z.string().url(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number()
  }).nullable().optional()
});

// GET: Buscar UMA questão (Detalhes Completos)
export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'PROFESSOR')) {
    return NextResponse.json({ error: 'Acesso Negado' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const questaoId = Number(id);
    
    if (isNaN(questaoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const questao = await prisma.questao.findUnique({
      where: { id: questaoId },
      include: {
        // Traz apenas os campos necessários para os Selects funcionarem
        cursoTecnico: { select: { id: true, nome: true } },
        unidadeCurricular: { select: { id: true, nome: true } },
        funcao: { select: { id: true, nome: true } },
        subfuncao: { select: { id: true, nome: true } },
        capacidade: { select: { id: true, sigla: true, descricao: true } },
        conhecimento: { select: { id: true, nome: true, codigo: true } },
        subConhecimento: { select: { id: true, nome: true, codigo: true } },
        instituicao: { select: { id: true, nome: true, sigla: true } },
        banca: { select: { id: true, nome: true, sigla: true } },
        imagens: true
      }
    });

    if (!questao) return NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 });

    return NextResponse.json(questao);
  } catch (error) {
    console.error(`Erro GET admin/questoes/[id]: ${error}`);
    return NextResponse.json({ error: 'Erro ao buscar questão' }, { status: 500 });
  }
}

// PUT: Atualizar UMA questão
export async function PUT(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'PROFESSOR')) {
      return NextResponse.json({ error: 'Acesso Negado' }, { status: 403 });
    }

    const { id } = await params;
    const questaoId = Number(id);
    if (isNaN(questaoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    // 🛡️ 2. CSRF
    const csrfHeader = req.headers.get('x-csrf-token');
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        usuarioNome: session.name,
        detalhes: { erro: 'CSRF update', rota: `/api/admin/questoes/${id}` }
      });
      return NextResponse.json({ error: 'Token de segurança inválido.' }, { status: 403 });
    }

    // 🛡️ 3. RATE LIMITING
    if (adminContentRateLimit) {
        const ip = (await headers()).get("x-forwarded-for") ?? "127.0.0.1";
        const { success } = await adminContentRateLimit.limit(`admin-questoes-edit:${ip}`);
        if (!success) {
          return NextResponse.json({ error: "Muitas requisições. Aguarde." }, { status: 429 });
        }
    }

    // 4. Validação Zod
    const bodyRaw = await req.json();
    const validacao = questaoUpdateSchema.safeParse(bodyRaw);

    if (!validacao.success) {
      // Retorna erro detalhado para debug no frontend se necessário
      console.error("Erro validação Zod:", validacao.error.flatten().fieldErrors);
      return NextResponse.json({ error: 'Dados inválidos', details: validacao.error.flatten().fieldErrors }, { status: 400 });
    }

    const data = validacao.data;

    // Normalização para Prisma
    const dadosParaAtualizar: any = { ...data };
    
    // Tratamento específico
    if (data.alternativaCorreta) dadosParaAtualizar.alternativaCorreta = data.alternativaCorreta.toLowerCase();
    
    // Unificação do campo Conhecimento (ID)
    if (data.objetoConhecimentoId !== undefined) {
        dadosParaAtualizar.conhecimentoId = data.objetoConhecimentoId;
        delete dadosParaAtualizar.objetoConhecimentoId;
    }
    
    // Remove auxiliar de imagem do update direto
    delete dadosParaAtualizar.imagem;

    const questaoAtualizada = await prisma.$transaction(async (tx) => {
        // Atualiza dados escalares e relacionamentos
        const q = await tx.questao.update({
            where: { id: questaoId },
            data: dadosParaAtualizar,
        });

        // Atualiza imagem se foi enviada no payload (undefined = ignora, null = deleta, obj = cria)
        if (data.imagem !== undefined) {
            await tx.imagemQuestao.deleteMany({ where: { questaoId: questaoId } });
            
            if (data.imagem && data.imagem.url) {
                await tx.imagemQuestao.create({
                    data: {
                        url: data.imagem.url,
                        filename: data.imagem.filename,
                        mimeType: data.imagem.mimeType,
                        size: data.imagem.size,
                        questaoId: questaoId
                    }
                });
            }
        }
        return q;
    });

    // 📝 5. AUDITORIA
    await registrarLog({
      acao: AuditAction.QUESTAO_EDITAR,
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Questao:${questaoId}`,
      detalhes: { mudancas: Object.keys(dadosParaAtualizar) }
    });

    return NextResponse.json(questaoAtualizada);

  } catch (error) {
    console.error("Erro em admin/questoes/[id]:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro ao atualizar questão.' }, { status: 500 });
  }
}

// DELETE: Excluir UMA questão
export async function DELETE(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'PROFESSOR')) {
      return NextResponse.json({ error: 'Acesso Negado' }, { status: 403 });
    }

    const { id } = await params;
    const questaoId = Number(id);
    if (isNaN(questaoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    // 🛡️ CSRF
    const csrfHeader = req.headers.get('x-csrf-token');
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        detalhes: { erro: 'CSRF delete', rota: `/api/admin/questoes/${id}` }
      });
      return NextResponse.json({ error: 'Token de segurança inválido.' }, { status: 403 });
    }

    // 🛡️ Rate Limit
    if (csrfRateLimit) {
        const ip = (await headers()).get("x-forwarded-for") ?? "127.0.0.1";
        const { success } = await csrfRateLimit.limit(`admin-questoes-delete:${ip}`);
        if (!success) return NextResponse.json({ error: "Muitas exclusões. Aguarde." }, { status: 429 });
    }
    
    await prisma.$transaction(async (tx) => {
        await tx.imagemQuestao.deleteMany({ where: { questaoId: questaoId } });
        await tx.questao.delete({ where: { id: questaoId } });
    });

    await registrarLog({
      acao: AuditAction.QUESTAO_EXCLUIR,
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Questao:${questaoId}`
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    if (error.code === 'P2003') {
        return NextResponse.json({ 
            error: 'Esta questão possui histórico e não pode ser excluída. Inative-a.' 
        }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao excluir questão.' }, { status: 500 });
  }
}