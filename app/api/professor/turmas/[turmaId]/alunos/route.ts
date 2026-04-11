import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf";
import { apiRateLimit, adminContentRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando os limitadores

// Schema local para validação da ação de gestão (PATCH)
const gerenciarAlunoSchema = z.object({
  alunoId: z.number().int().positive(),
  acao: z.enum(["APROVAR", "REJEITAR", "BANIR", "READMITIR"]),
});

// --- GET: Listar Alunos da Turma ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    // Permite SUPER_ADMIN para auditoria/suporte
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Leitura
    const rlKey = `prof_turma_alunos:${session.sub}`;
    const rl = await apiRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    
    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID de turma inválido" }, { status: 400 });
    }

    // 1. Validação de Propriedade (Anti-IDOR)
    const userId = Number(session.sub);
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: userId,
        },
      },
    });

    // Admin passa direto, Professor precisa ser dono
    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // 2. Busca alunos com projeção otimizada
    const alunos = await prisma.turmaAluno.findMany({
      where: { turmaId: turmaIdInt },
      orderBy: [
        { status: "asc" }, // Agrupa por status (ATIVO/PENDENTE)
        { entrouEm: "desc" }, // Mais recentes primeiro
      ],
      select: {
        status: true,
        entrouEm: true,
        aluno: {
          select: {
            id: true,
            nome: true,
            email: true,
            fotoUrl: true,
          },
        },
      },
    });

    return NextResponse.json(alunos);
  } catch (error) {
    return safeApiError(error, "Erro ao listar alunos da turma.");
  }
}

// --- PATCH: Gerenciar Status (Aprovar/Banir) ---
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Administração (Permite ações rápidas do professor, mas bloqueia robôs)
    const rlKey = `prof_turma_aluno_patch:${session.sub}`;
    const rl = await adminContentRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas ações em pouco tempo. Aguarde um minuto." }, { status: 429 });
    }

    // 1. 🛡️ Verificação CSRF
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "PATCH /api/professor/.../alunos",
      });
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const operadorId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID de turma inválido" }, { status: 400 });
    }

    // 2. Validação de Input
    const body = await req.json();
    const validation = gerenciarAlunoSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { alunoId, acao } = validation.data;

    // 3. Segurança: Verifica propriedade
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: operadorId,
        },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // 4. Lógica de Status
    let novoStatus: "ATIVO" | "REMOVIDO" | "BLOQUEADO";

    switch (acao) {
      case "APROVAR":
      case "READMITIR":
        novoStatus = "ATIVO";
        break;
      case "REJEITAR":
        novoStatus = "REMOVIDO"; // Soft delete (ou muda status para removido)
        break;
      case "BANIR":
        novoStatus = "BLOQUEADO";
        break;
      default:
        return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
    }

    // 5. Executa a atualização
    const atualizacao = await prisma.turmaAluno.update({
      where: {
        turmaId_alunoId: {
          turmaId: turmaIdInt,
          alunoId: alunoId,
        },
      },
      data: { status: novoStatus },
      include: {
        aluno: { select: { nome: true, email: true } },
      },
    });

    // 6. Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_MEMBRO_ATUALIZAR,
      usuarioId: operadorId,
      usuarioNome: session.name,
      recurso: `Turma: ${turmaIdInt} / Aluno: ${alunoId}`,
      detalhes: {
        acaoRealizada: acao,
        alunoAfetado: atualizacao.aluno.nome,
        novoStatus,
      },
    });

    return NextResponse.json({
      message: `Aluno ${acao.toLowerCase()} com sucesso.`,
      aluno: atualizacao,
    });

  } catch (error) {
    if ((error as any).code === "P2025") {
      return NextResponse.json({ error: "Aluno não encontrado nesta turma." }, { status: 404 });
    }
    return safeApiError(error, "Erro ao gerenciar aluno.");
  }
}

// --- DELETE: Remover Aluno (Hard Delete ou Rejeição via URL) ---
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Administração
    const rlKey = `prof_turma_aluno_delete:${session.sub}`;
    const rl = await adminContentRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas ações em pouco tempo. Aguarde um minuto." }, { status: 429 });
    }

    // 1. 🛡️ Verificação CSRF (Crítico para DELETE)
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "DELETE /api/professor/.../alunos",
      });
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const operadorId = Number(session.sub);

    // 2. Busca ID na URL (Query Param)
    const { searchParams } = new URL(req.url);
    const alunoIdParam = searchParams.get("alunoId");

    if (!alunoIdParam || isNaN(Number(alunoIdParam))) {
      return NextResponse.json({ error: "ID do aluno inválido." }, { status: 400 });
    }
    const alunoId = Number(alunoIdParam);

    // 3. Segurança: Verifica propriedade
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: operadorId,
        },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // 4. Executa a Remoção (Delete físico da relação)
    // Nota: Isso apaga o registro na tabela pivot `TurmaAluno`. O aluno continua existindo no sistema.
    const removido = await prisma.turmaAluno.delete({
      where: {
        turmaId_alunoId: {
          turmaId: turmaIdInt,
          alunoId: alunoId,
        },
      },
      include: {
        aluno: { select: { nome: true } } // Para o log
      }
    });

    // 5. Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_MEMBRO_REMOVER,
      usuarioId: operadorId,
      usuarioNome: session.name,
      recurso: `Turma: ${turmaIdInt} / AlunoRemovido: ${alunoId}`,
      detalhes: {
        alunoNome: removido.aluno.nome,
        metodo: "DELETE (Remoção da Turma)"
      }
    });

    return NextResponse.json({ success: true, message: "Aluno removido da turma." });

  } catch (error) {
    console.error("Erro ao remover aluno:", error);
    if ((error as any).code === "P2025") {
        return NextResponse.json({ error: "Aluno não encontrado ou já removido." }, { status: 404 });
    }
    return safeApiError(error, "Erro ao remover aluno.");
  }
}