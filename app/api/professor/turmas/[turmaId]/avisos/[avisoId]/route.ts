import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { registrarLog, AuditAction } from "@/lib/audit";
import { verifyCSRFToken } from "@/lib/csrf"; // ✅ CSRF Obrigatório
import { adminContentRateLimit } from "@/lib/ratelimit";

// Schema para validar o Patch (Fixar/Desfixar)
const patchAvisoSchema = z.object({
  fixado: z.boolean(),
});

// --- DELETE: Remover Aviso ---
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; avisoId: string }> }
) {
  try {
    // 1. Autenticação & RBAC
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. 🛡️ CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "DELETE /api/professor/.../avisos/[id]",
      });
      return NextResponse.json({ error: "Sessão inválida (Token de Segurança)" }, { status: 403 });
    }

    const { turmaId, avisoId } = await params;
    const turmaIdInt = Number(turmaId);
    const avisoIdInt = Number(avisoId);
    const professorId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(avisoIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // 3. Validação de Propriedade da Turma
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId,
        },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // 4. Validação de Consistência (O aviso pertence a esta turma?)
    // Isso previne deletar avisos de outras turmas passando o ID na URL errada
    const aviso = await prisma.avisoTurma.findUnique({
      where: { id: avisoIdInt },
      select: { id: true, turmaId: true, titulo: true }
    });

    if (!aviso) {
      return NextResponse.json({ error: "Aviso não encontrado." }, { status: 404 });
    }

    if (aviso.turmaId !== turmaIdInt) {
      return NextResponse.json({ error: "Este aviso não pertence à turma informada." }, { status: 403 });
    }

    // 5. Executa Exclusão
    await prisma.avisoTurma.delete({
      where: { id: avisoIdInt },
    });

    // 6. Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_EDITAR, // Semanticamente uma edição na turma (remoção de conteúdo)
      usuarioId: professorId,
      usuarioNome: session.name,
      recurso: `Aviso: ${avisoIdInt}`,
      detalhes: {
        acao: "EXCLUSAO_AVISO",
        tituloAviso: aviso.titulo,
        turmaId: turmaIdInt
      },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    return safeApiError(error, "Erro ao deletar aviso.");
  }
}

// --- PATCH: Alternar Fixado (Pin/Unpin) ---
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; avisoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 1. 🛡️ CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId, avisoId } = await params;
    const turmaIdInt = Number(turmaId);
    const avisoIdInt = Number(avisoId);

    // 2. Rate Limit (Evitar flood de fixar/desfixar)
    const ip = await getClientIp(req);
    const { success } = await adminContentRateLimit.limit(`patch_aviso:${session.sub}:${ip}`);
    if (!success) return NextResponse.json({ error: "Calma lá! Muitas ações." }, { status: 429 });

    // 3. Validação de Propriedade
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: Number(session.sub),
        },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 4. Validação do Body
    const body = await req.json();
    const validation = patchAvisoSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // 5. Validação de Consistência (Cross-Check)
    const aviso = await prisma.avisoTurma.findUnique({
      where: { id: avisoIdInt },
    });

    if (!aviso || aviso.turmaId !== turmaIdInt) {
      return NextResponse.json({ error: "Aviso inválido para esta turma." }, { status: 403 });
    }

    // 6. Atualização
    const atualizado = await prisma.avisoTurma.update({
      where: { id: avisoIdInt },
      data: {
        fixado: validation.data.fixado
      },
    });

    // 7. Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_EDITAR,
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Aviso: ${avisoIdInt}`,
      detalhes: {
        acao: validation.data.fixado ? "FIXAR_AVISO" : "DESFIXAR_AVISO",
        turmaId: turmaIdInt
      }
    });

    return NextResponse.json(atualizado);

  } catch (error) {
    return safeApiError(error, "Erro ao atualizar aviso.");
  }
}