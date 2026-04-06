import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf";
import { sanitizeObject } from "@/lib/sanitize";

// Schema para correção
const corrigirEntregaSchema = z.object({
  nota: z.number().min(0, "Nota não pode ser negativa"),
  feedback: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; tarefaId: string; entregaId: string }> }
) {
  try {
    // 1. Segurança Básica
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId, tarefaId, entregaId } = await params;
    const turmaIdInt = Number(turmaId);
    const tarefaIdInt = Number(tarefaId);
    const entregaIdInt = Number(entregaId);

    if (isNaN(turmaIdInt) || isNaN(tarefaIdInt) || isNaN(entregaIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // 3. Validação do Body
    const body = await req.json();
    const validation = corrigirEntregaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }

    const { nota, feedback } = sanitizeObject(validation.data);

    // 4. Validação de Propriedade & Nota Máxima (Cruzamento de dados)
    // Buscamos a Tarefa para saber a nota máxima e verificar se o professor é dono
    const tarefa = await prisma.tarefa.findUnique({
      where: { 
        id: tarefaIdInt, 
        turmaId: turmaIdInt,
        // Verifica propriedade direto na query (se não achar, ou não existe ou não é dono)
        criadoPorId: session.role === "SUPER_ADMIN" ? undefined : Number(session.sub)
      },
      select: { notaMaxima: true }
    });

    if (!tarefa) {
      return NextResponse.json({ error: "Tarefa não encontrada ou acesso negado." }, { status: 404 });
    }

    // ✅ REGRA DE OURO DO SEU CÓDIGO ANTIGO
    if (nota > tarefa.notaMaxima) {
      return NextResponse.json({ 
        error: `A nota (${nota}) não pode ser maior que o valor máximo da tarefa (${tarefa.notaMaxima}).` 
      }, { status: 400 });
    }

    // 5. Atualização (Correção)
    const entregaAtualizada = await prisma.entregaTarefa.update({
      where: {
        id: entregaIdInt,
        tarefaId: tarefaIdInt, // Garante integridade da hierarquia
      },
      data: {
        nota: nota,
        feedback: feedback || null,
        status: "CORRIGIDO",
        corrigidoEm: new Date(),
      },
      include: {
        aluno: {
          select: { nome: true, email: true }
        }
      }
    });

    // 6. Log de Auditoria
    await registrarLog({
      acao: AuditAction.TAREFA_CORRIGIR, // Usei a action correta sugerida no seu código
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Entrega Corrigida: ${entregaIdInt}`,
      detalhes: {
        turmaId: turmaIdInt,
        tarefaId: tarefaIdInt,
        notaLancada: nota,
        aluno: entregaAtualizada.aluno.email
      }
    });

    return NextResponse.json(entregaAtualizada);

  } catch (error) {
    return safeApiError(error, "Erro ao corrigir entrega.");
  }
}