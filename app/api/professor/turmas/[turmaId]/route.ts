import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError } from "@/lib/server-utils";
import { z } from "zod";
import { verifyCSRFToken } from "@/lib/csrf"; 
import { sanitizeObject } from "@/lib/sanitize"; 
import { apiRateLimit, adminContentRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando os limitadores

// Schema de validação para atualização
const updateTurmaSchema = z.object({
  nome: z.string().min(3).max(50).optional(),
  descricao: z.string().max(200).optional(),
  imagemUrl: z.string().url().optional().or(z.literal("")),
  ativo: z.boolean().optional(),
});

// --- GET: Detalhes da Turma ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    // ✅ Permite Admin
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Leitura
    const rlKey = `prof_turma_detalhe:${session.sub}`;
    const rl = await apiRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const userId = Number(session.sub);
    const isSuperAdmin = session.role === "SUPER_ADMIN";

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // ✅ Query Dinâmica para ignorar pivot caso seja Admin
    // Se for admin, busca pelo ID da turma.
    // Se for professor, busca pelo ID da turma APENAS SE ele estiver vinculado a ela na tabela pivot.
    let turma;
    if (isSuperAdmin) {
        turma = await prisma.turma.findUnique({
            where: { id: turmaIdInt },
            include: {
              _count: {
                select: { 
                  alunos: true,
                  agendamentos: true 
                }
              }
            }
        });
    } else {
         turma = await prisma.turma.findFirst({
            where: {
                id: turmaIdInt,
                professores: {
                    some: { professorId: userId }
                }
            },
            include: {
              _count: {
                select: { 
                  alunos: true,
                  agendamentos: true 
                }
              }
            }
        });
    }

    if (!turma) {
      return NextResponse.json({ error: "Turma não encontrada ou acesso negado." }, { status: 404 });
    }

    return NextResponse.json(turma);
  } catch (error) {
    return safeApiError(error, "Erro ao buscar turma.");
  }
}

// --- PATCH: Atualizar Turma ---
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Gestão de Conteúdo
    const rlKey = `prof_turma_editar:${session.sub}`;
    const rl = await adminContentRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas alterações em pouco tempo. Aguarde um minuto." }, { status: 429 });
    }

    // 2. 🛡️ CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "PATCH /api/professor/turmas/[id]",
      });
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const userId = Number(session.sub);
    const isSuperAdmin = session.role === "SUPER_ADMIN";

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // 3. Verifica Propriedade (IDOR)
    if (!isSuperAdmin) {
      const isOwner = await prisma.turmaProfessor.findUnique({
        where: {
          turmaId_professorId: { turmaId: turmaIdInt, professorId: userId },
        },
      });

      if (!isOwner) {
        return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
      }
    }

    // 4. Valida e Sanitiza Body
    const body = await req.json();
    const validation = updateTurmaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }

    const data = sanitizeObject(validation.data);

    // 5. Atualiza
    const turmaAtualizada = await prisma.turma.update({
      where: { id: turmaIdInt },
      data: data,
    });

    // 6. Log
    await registrarLog({
      acao: AuditAction.TURMA_EDITAR,
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Turma: ${turmaIdInt}`,
      detalhes: { changes: data },
    });

    return NextResponse.json(turmaAtualizada);

  } catch (error) {
    return safeApiError(error, "Erro ao atualizar turma.");
  }
}

// --- DELETE: Arquivar/Excluir Turma ---
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Gestão de Conteúdo
    const rlKey = `prof_turma_excluir:${session.sub}`;
    const rl = await adminContentRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas ações em pouco tempo. Aguarde um minuto." }, { status: 429 });
    }

    // 1. 🛡️ CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const userId = Number(session.sub);
    const isSuperAdmin = session.role === "SUPER_ADMIN";

    // 2. Verifica Propriedade
    if (!isSuperAdmin) {
      const isOwner = await prisma.turmaProfessor.findUnique({
        where: {
          turmaId_professorId: { turmaId: turmaIdInt, professorId: userId },
        },
      });

      if (!isOwner) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
    }

    // 3. Soft Delete (Arquivamento)
    const turmaArquivada = await prisma.turma.update({
      where: { id: turmaIdInt },
      data: { ativo: false },
    });

    // 4. Log
    await registrarLog({
      acao: AuditAction.TURMA_EXCLUIR, 
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Turma: ${turmaIdInt}`,
      detalhes: { tipo: "ARQUIVAMENTO_SOFT_DELETE" },
    });

    return NextResponse.json({ message: "Turma arquivada com sucesso.", turma: turmaArquivada });

  } catch (error) {
    return safeApiError(error, "Erro ao arquivar turma.");
  }
}