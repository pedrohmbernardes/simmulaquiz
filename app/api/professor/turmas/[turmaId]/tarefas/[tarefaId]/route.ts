import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf";
import { z } from "zod";
import { sanitizeObject } from "@/lib/sanitize";
import { apiRateLimit, adminContentRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando os limitadores

// Schema para validação da edição
const editarTarefaSchema = z.object({
  titulo: z.string().min(3, "O título deve ter pelo menos 3 caracteres").max(150).optional(),
  descricao: z.string().optional(),
  // Aceita null para remover o prazo
  dataEntrega: z.coerce.date().optional().nullable(),
  notaMaxima: z.number().min(0).max(1000).optional(),
});

// --- DELETE: Excluir a Tarefa Inteira (JÁ EXISTENTE) ---
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; tarefaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Gestão de Conteúdo
    const rlKey = `prof_tarefa_delete:${session.sub}`;
    const rl = await adminContentRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas ações em pouco tempo. Aguarde um minuto." }, { status: 429 });
    }

    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId, tarefaId } = await params;
    const turmaIdInt = Number(turmaId);
    const tarefaIdInt = Number(tarefaId);
    const professorId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(tarefaIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: { turmaId: turmaIdInt, professorId: professorId },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não tem permissão nesta turma." }, { status: 403 });
    }

    const tarefa = await prisma.tarefa.findUnique({
      where: { id: tarefaIdInt, turmaId: turmaIdInt }
    });

    if (!tarefa) {
      return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.moduloItem.deleteMany({ where: { tarefaId: tarefaIdInt } });
      await tx.tarefa.delete({ where: { id: tarefaIdInt } });
    });

    await registrarLog({
      acao: (AuditAction as any).TAREFA_EXCLUIR || "TAREFA_EXCLUIR",
      usuarioId: professorId,
      usuarioNome: session.name,
      recurso: `Tarefa: ${tarefa.titulo} (ID: ${tarefaIdInt})`,
      detalhes: { turmaId: turmaIdInt }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    return safeApiError(error, "Erro ao excluir tarefa.");
  }
}

// --- GET: Buscar Detalhes (JÁ EXISTENTE) ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; tarefaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // ✅ Rate Limit de Leitura
    const rlKey = `prof_tarefa_detalhe:${session.sub}`;
    const rl = await apiRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
    }

    const { turmaId, tarefaId } = await params;
    const tarefa = await prisma.tarefa.findUnique({
      where: { id: Number(tarefaId), turmaId: Number(turmaId) }
    });

    if (!tarefa) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    return NextResponse.json(tarefa);
  } catch (error) {
    return safeApiError(error, "Erro ao buscar tarefa");
  }
}

// --- PATCH: Editar Tarefa (NOVO) ---
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; tarefaId: string }> }
) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Gestão de Conteúdo
    const rlKey = `prof_tarefa_editar:${session.sub}`;
    const rl = await adminContentRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas alterações em pouco tempo. Aguarde um minuto." }, { status: 429 });
    }

    // 2. CSRF
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId, tarefaId } = await params;
    const turmaIdInt = Number(turmaId);
    const tarefaIdInt = Number(tarefaId);
    const professorId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(tarefaIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // 3. Validação do Body
    const body = await req.json();
    const validation = editarTarefaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const dadosSanitizados = sanitizeObject(validation.data);

    // 4. Permissão e Existência
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: { turmaId: turmaIdInt, professorId: professorId },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const tarefaExiste = await prisma.tarefa.findUnique({
      where: { id: tarefaIdInt, turmaId: turmaIdInt }
    });

    if (!tarefaExiste) {
      return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    }

    // 5. Atualização (Transação para garantir sincronia com ModuloItem se o título mudar)
    const tarefaAtualizada = await prisma.$transaction(async (tx) => {
      // Atualiza a Tarefa
      const updated = await tx.tarefa.update({
        where: { id: tarefaIdInt },
        data: {
          titulo: dadosSanitizados.titulo,
          descricao: dadosSanitizados.descricao,
          dataEntrega: validation.data.dataEntrega, // Passa Date ou null direto (sem sanitizeObject que pode converter para string)
          notaMaxima: validation.data.notaMaxima,
        }
      });

      // Se o título mudou, atualiza também o ModuloItem correspondente (se existir)
      if (dadosSanitizados.titulo) {
        await tx.moduloItem.updateMany({
          where: { tarefaId: tarefaIdInt },
          data: { titulo: dadosSanitizados.titulo }
        });
      }

      return updated;
    });

    // 6. Auditoria
    await registrarLog({
      acao: (AuditAction as any).TAREFA_EDITAR || "TAREFA_EDITAR",
      usuarioId: professorId,
      usuarioNome: session.name,
      recurso: `Tarefa Editada: ${tarefaAtualizada.titulo} (ID: ${tarefaIdInt})`,
      detalhes: { 
        turmaId: turmaIdInt,
        mudancas: {
          ...dadosSanitizados,
          dataEntrega: dadosSanitizados.dataEntrega instanceof Date 
            ? dadosSanitizados.dataEntrega.toISOString() 
            : dadosSanitizados.dataEntrega
        } as any
      }
    });

    return NextResponse.json(tarefaAtualizada);

  } catch (error) {
    return safeApiError(error, "Erro ao editar tarefa.");
  }
}