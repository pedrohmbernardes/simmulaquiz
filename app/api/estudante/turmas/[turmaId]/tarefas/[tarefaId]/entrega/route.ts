import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { safeApiError } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf";
import { registrarLog, AuditAction } from "@/lib/audit";
import { expensiveOpsRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando limitador para operações de escrita

// Schema de validação do envio
const entregaSchema = z.object({
  textoResposta: z.string().optional(),
  arquivos: z.array(z.object({
    url: z.string().url(),
    nome: z.string(),
    tamanhoBytes: z.number().optional(),
    mimeType: z.string().optional(),
    storagePath: z.string().optional(),
  })).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; tarefaId: string }> }
) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. Rate Limit (Evita spam de entregas / sobrecarga)
    const rlKey = `tarefa_entrega_post:${session.sub}`;
    const rl = await expensiveOpsRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Muitas tentativas de envio. Por favor, aguarde alguns minutos." },
        { status: 429 }
      );
    }

    // 3. 🛡️ CSRF Check (Obrigatório para envio)
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida (CSRF)" }, { status: 403 });
    }

    const { turmaId, tarefaId } = await params;
    const turmaIdInt = Number(turmaId);
    const tarefaIdInt = Number(tarefaId);
    const alunoId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(tarefaIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // 4. Validação do Body
    const body = await req.json();
    const validation = entregaSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { textoResposta, arquivos } = validation.data;

    // 5. Verifica Acesso e Existência da Tarefa
    // Busca a tarefa e verifica se o aluno faz parte da turma num único round-trip se possível,
    // mas aqui separamos para clareza de erro (404 vs 403).
    
    // A) Verifica Tarefa
    const tarefa = await prisma.tarefa.findUnique({
      where: { id: tarefaIdInt, turmaId: turmaIdInt }, // Garante que tarefa é da turma
      select: { 
        id: true, 
        titulo: true, 
        dataEntrega: true,
        notaMaxima: true 
      }
    });

    if (!tarefa) {
      return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    }

    // B) Verifica Matrícula Ativa
    const matricula = await prisma.turmaAluno.findUnique({
      where: { turmaId_alunoId: { turmaId: turmaIdInt, alunoId: alunoId } }
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Você não é membro ativo desta turma." }, { status: 403 });
    }

    // C) Validação de Prazo (Opcional: Bloquear atraso)
    const agora = new Date();
    // Se quiser bloquear envios atrasados, descomente abaixo:
    /*
    if (tarefa.dataEntrega && agora > tarefa.dataEntrega) {
       return NextResponse.json({ error: "O prazo de entrega já encerrou." }, { status: 403 });
    }
    */

    // 6. Transação de Entrega (Upsert)
    // Se já existe, atualiza. Se não, cria.
    const entrega = await prisma.$transaction(async (tx) => {
      
      // Se for reenvio, precisamos limpar os arquivos antigos antes de salvar os novos
      // Verificamos se já existe entrega
      const entregaExistente = await tx.entregaTarefa.findUnique({
        where: { tarefaId_alunoId: { tarefaId: tarefaIdInt, alunoId: alunoId } }
      });

      if (entregaExistente) {
        // Se já foi corrigida, não pode alterar
        // Ajuste conforme sua regra: às vezes professor permite reenvio mesmo após nota.
        // Aqui bloqueamos se já tiver nota para evitar confusão.
        if (entregaExistente.nota !== null || entregaExistente.status === "CORRIGIDO") {
           throw new Error("BLOCK_CORRIGIDO");
        }

        // Remove arquivos antigos para substituir pelos novos
        await tx.entregaTarefaArquivo.deleteMany({
          where: { entregaTarefaId: entregaExistente.id }
        });
      }

      // Cria ou Atualiza a Entrega Principal
      const entregaSalva = await tx.entregaTarefa.upsert({
        where: {
          tarefaId_alunoId: { tarefaId: tarefaIdInt, alunoId: alunoId }
        },
        create: {
          turmaId: turmaIdInt,
          tarefaId: tarefaIdInt,
          alunoId: alunoId,
          textoResposta: textoResposta,
          status: "ENTREGUE",
          entregueEm: agora,
          // Criação dos arquivos aninhada
          arquivos: {
            create: arquivos?.map(a => ({
              url: a.url,
              nomeArquivo: a.nome,
              tamanhoBytes: a.tamanhoBytes,
              mimeType: a.mimeType,
              storagePath: a.storagePath
            }))
          }
        },
        update: {
          textoResposta: textoResposta, // Atualiza texto
          status: "ENTREGUE",
          entregueEm: agora, // Atualiza data para a do último envio
          // Recriação dos arquivos (os antigos foram deletados acima)
          arquivos: {
            create: arquivos?.map(a => ({
              url: a.url,
              nomeArquivo: a.nome,
              tamanhoBytes: a.tamanhoBytes,
              mimeType: a.mimeType,
              storagePath: a.storagePath
            }))
          }
        }
      });

      return entregaSalva;
    });

    // 7. Auditoria
    await registrarLog({
      acao: AuditAction.TAREFA_ENTREGAR, // Certifique-se de ter essa action ou use genérica
      usuarioId: alunoId,
      usuarioNome: session.name,
      recurso: `Entrega Tarefa: ${tarefaIdInt}`,
      detalhes: {
        arquivosCount: arquivos?.length || 0,
        textoSize: textoResposta?.length || 0
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Tarefa entregue com sucesso!",
      entregaId: entrega.id 
    });

  } catch (error: any) {
    if (error.message === "BLOCK_CORRIGIDO") {
      return NextResponse.json({ error: "Esta tarefa já foi corrigida e não aceita alterações." }, { status: 403 });
    }
    return safeApiError(error, "Erro ao enviar tarefa.");
  }
}