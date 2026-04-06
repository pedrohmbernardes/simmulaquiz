import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { verifyCSRFToken } from "@/lib/csrf";
import { sanitizeObject } from "@/lib/sanitize";

// Schema de validação para Edição
const updateModuloSchema = z.object({
  titulo: z.string().min(2).max(100).optional(),
  descricao: z.string().max(500).optional(),
  publicado: z.boolean().optional(),
  ordem: z.number().int().optional(),
});

// Helper de validação de propriedade
async function validateOwnership(turmaId: number, userId: number) {
  const isOwner = await prisma.turmaProfessor.findUnique({
    where: {
      turmaId_professorId: { turmaId, professorId: userId },
    },
  });
  return !!isOwner;
}

// --- PATCH: Editar Módulo ---
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; moduloId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida (Token de Segurança)" }, { status: 403 });
    }

    const { turmaId, moduloId } = await params;
    const turmaIdInt = Number(turmaId);
    const moduloIdInt = Number(moduloId);
    const userId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(moduloIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // Rate Limit
    const { success } = await adminContentRateLimit.limit(`edit_mod:${userId}`);
    if (!success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde." }, { status: 429 });
    }

    // Validação de Propriedade
    if (!(await validateOwnership(turmaIdInt, userId)) && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // Validação do Body
    const body = await req.json();
    const validation = updateModuloSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const data = sanitizeObject(validation.data);

    // Atualização
    const moduloAtualizado = await prisma.moduloTurma.update({
      where: { 
        id: moduloIdInt,
        turmaId: turmaIdInt // Garante que o módulo pertence à turma
      },
      data: {
        titulo: data.titulo,
        descricao: data.descricao,
        publicado: data.publicado,
        ordem: data.ordem
      }
    });

    // Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_EDITAR, // Reutilizando ação ou criar MODULO_EDITAR
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Módulo: ${moduloIdInt}`,
      detalhes: { mudancas: data }
    });

    return NextResponse.json(moduloAtualizado);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao atualizar módulo." }, { status: 500 });
  }
}

// --- DELETE: Excluir Módulo ---
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; moduloId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida (Token de Segurança)" }, { status: 403 });
    }

    const { turmaId, moduloId } = await params;
    const turmaIdInt = Number(turmaId);
    const moduloIdInt = Number(moduloId);
    const userId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(moduloIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    if (!(await validateOwnership(turmaIdInt, userId)) && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // Exclusão (Cascade deletará itens do módulo, mas NÃO os materiais/provas originais, o que é seguro)
    await prisma.moduloTurma.delete({
      where: { 
        id: moduloIdInt,
        turmaId: turmaIdInt
      }
    });

    await registrarLog({
      acao: AuditAction.TURMA_EDITAR,
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Módulo Excluído: ${moduloIdInt}`,
      detalhes: { turmaId: turmaIdInt }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao excluir módulo." }, { status: 500 });
  }
}