import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf";
import { sanitizeObject } from "@/lib/sanitize";

// Schema de Validação do Envio
const entregaSchema = z.object({
  textoResposta: z.string().optional(),
  arquivos: z.array(z.object({
    url: z.string().url(),
    nome: z.string().min(1),
    tipo: z.string().optional(), // mime-type
  })).optional(),
});

// --- GET: Buscar Detalhes da Tarefa + Minha Entrega ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; tarefaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { turmaId, tarefaId } = await params;
    const turmaIdInt = Number(turmaId);
    const tarefaIdInt = Number(tarefaId);
    const alunoId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(tarefaIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // 1. Validar Acesso (Aluno ATIVO na Turma)
    const matricula = await prisma.turmaAluno.findUnique({
      where: {
        turmaId_alunoId: { turmaId: turmaIdInt, alunoId },
      },
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Você não tem acesso a esta turma." }, { status: 403 });
    }

    // 2. Buscar Tarefa + Entrega do Aluno
    const tarefa = await prisma.tarefa.findUnique({
      where: {
        id_turmaId: { id: tarefaIdInt, turmaId: turmaIdInt }, // Garante que tarefa pertence à turma
      },
      include: {
        entregas: {
          where: { alunoId },
          include: { arquivos: true }, // Inclui arquivos anexados
          take: 1,
        },
        criadoPor: {
          select: { nome: true, fotoUrl: true }
        }
      },
    });

    if (!tarefa) {
      return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    }

    // Formata retorno para o frontend
    const entrega = tarefa.entregas[0] || null;

    return NextResponse.json({
      tarefa: {
        id: tarefa.id,
        titulo: tarefa.titulo,
        descricao: tarefa.descricao,
        dataEntrega: tarefa.dataEntrega,
        notaMaxima: tarefa.notaMaxima,
        criadoPor: tarefa.criadoPor,
        createdAt: tarefa.createdAt
      },
      entrega: entrega ? {
        id: entrega.id,
        status: entrega.status,
        textoResposta: entrega.textoResposta,
        arquivos: entrega.arquivos,
        nota: entrega.nota,
        feedback: entrega.feedback,
        entregueEm: entrega.entregueEm,
        corrigidoEm: entrega.corrigidoEm
      } : null
    });

  } catch (error) {
    return safeApiError(error, "Erro ao carregar tarefa.");
  }
}

// --- POST: Enviar ou Editar Entrega ---
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; tarefaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // 1. CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida (CSRF)" }, { status: 403 });
    }

    const { turmaId, tarefaId } = await params;
    const turmaIdInt = Number(turmaId);
    const tarefaIdInt = Number(tarefaId);
    const alunoId = Number(session.sub);

    // 2. Validar Acesso à Turma
    const matricula = await prisma.turmaAluno.findUnique({
      where: { turmaId_alunoId: { turmaId: turmaIdInt, alunoId } },
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // 3. Validar Body
    const body = await req.json();
    const validation = entregaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }

    const data = sanitizeObject(validation.data);

    // 4. Upsert da Entrega (Cria ou Atualiza)
    // Transação para garantir consistência dos arquivos
    const entrega = await prisma.$transaction(async (tx) => {
      
      // Verifica se a tarefa existe e pertence à turma
      const tarefaExists = await tx.tarefa.findUnique({
        where: { id_turmaId: { id: tarefaIdInt, turmaId: turmaIdInt } }
      });
      if (!tarefaExists) throw new Error("Tarefa não encontrada.");

      // Lógica de Upsert manual para lidar com arquivos
      const existingEntrega = await tx.entregaTarefa.findUnique({
        where: { tarefaId_alunoId: { tarefaId: tarefaIdInt, alunoId } }
      });

      if (existingEntrega) {
        // Se já foi corrigida, não pode editar!
        if (existingEntrega.status === 'CORRIGIDO') {
           throw new Error("Tarefa já corrigida. Não é possível editar.");
        }

        // Remove arquivos antigos para substituir pelos novos (estratégia simples)
        if (data.arquivos && data.arquivos.length > 0) {
           await tx.entregaTarefaArquivo.deleteMany({
             where: { entregaTarefaId: existingEntrega.id }
           });
        }

        return tx.entregaTarefa.update({
          where: { id: existingEntrega.id },
          data: {
            textoResposta: data.textoResposta,
            status: 'ENTREGUE',
            entregueEm: new Date(), // Atualiza data de entrega
            arquivos: data.arquivos ? {
              create: data.arquivos.map(arq => ({
                url: arq.url,
                nomeArquivo: arq.nome,
                mimeType: arq.tipo
              }))
            } : undefined
          },
          include: { arquivos: true }
        });

      } else {
        // Criar nova entrega
        return tx.entregaTarefa.create({
          data: {
            turmaId: turmaIdInt,
            tarefaId: tarefaIdInt,
            alunoId,
            textoResposta: data.textoResposta,
            status: 'ENTREGUE',
            entregueEm: new Date(),
            arquivos: data.arquivos ? {
              create: data.arquivos.map(arq => ({
                url: arq.url,
                nomeArquivo: arq.nome,
                mimeType: arq.tipo
              }))
            } : undefined
          },
          include: { arquivos: true }
        });
      }
    });

    // 5. Auditoria e Retorno
    await registrarLog({
      acao: AuditAction.TAREFA_ENTREGAR,
      usuarioId: alunoId,
      usuarioNome: session.name,
      recurso: `Tarefa: ${tarefaIdInt}`,
      detalhes: { entregaId: entrega.id, arquivos: data.arquivos?.length || 0 }
    });

    return NextResponse.json(entrega);

  } catch (error) {
    return safeApiError(error, "Erro ao enviar tarefa.");
  }
}