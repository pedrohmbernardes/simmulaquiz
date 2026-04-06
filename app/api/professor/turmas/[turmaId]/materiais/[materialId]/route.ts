import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { registrarLog, AuditAction } from "@/lib/audit";
import { verifyCSRFToken } from "@/lib/csrf";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { sanitizeObject } from "@/lib/sanitize";

// Schema de validação para edição
const updateMaterialSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(150).optional(),
  descricao: z.string().max(500).optional(),
  url: z.string().url("URL inválida").optional(),
});

// --- GET: Buscar Material (Para edição) ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; materialId: string }> }
) {
  try {
    const { turmaId, materialId } = await params;
    const turmaIdInt = Number(turmaId);
    const materialIdInt = Number(materialId);

    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    if (isNaN(turmaIdInt) || isNaN(materialIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // Validação de Propriedade
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: Number(session.sub),
        },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    const material = await prisma.materialTurma.findUnique({
      where: { id: materialIdInt },
    });

    if (!material) return NextResponse.json({ error: "Material não encontrado." }, { status: 404 });
    if (material.turmaId !== turmaIdInt) return NextResponse.json({ error: "Material de outra turma." }, { status: 403 });

    return NextResponse.json(material);

  } catch (error) {
    return safeApiError(error, "Erro ao buscar material.");
  }
}

// --- PATCH: Editar Material ---
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; materialId: string }> }
) {
  try {
    // 0. Resolve Params Primeiro (Next.js 15)
    const { turmaId, materialId } = await params;
    const turmaIdInt = Number(turmaId);
    const materialIdInt = Number(materialId);

    // 1. Auth Check
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida (CSRF)" }, { status: 403 });
    }

    const professorId = Number(session.sub);

    // 3. Rate Limit
    const ip = await getClientIp(req);
    const { success } = await adminContentRateLimit.limit(`edit_material:${professorId}:${ip}`);
    if (!success) return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });

    // 4. Validação de Propriedade (IDOR)
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: { 
        turmaId_professorId: { 
          turmaId: turmaIdInt, 
          professorId 
        } 
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    // 5. Validação de Pertencimento
    const materialAtual = await prisma.materialTurma.findUnique({
      where: { id: materialIdInt },
      select: { id: true, turmaId: true }
    });

    if (!materialAtual || materialAtual.turmaId !== turmaIdInt) {
      return NextResponse.json({ error: "Material não encontrado nesta turma." }, { status: 404 });
    }

    // 6. Validação e Sanitização do Body
    const body = await req.json();
    const validation = updateMaterialSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }

    const data = sanitizeObject(validation.data);

    // 7. Atualização Transacional (CRUCIAL: Atualiza Material E Item do Módulo)
    // Usamos transaction para garantir consistência
    const [materialAtualizado] = await prisma.$transaction([
      // A. Atualiza o Material em si
      prisma.materialTurma.update({
        where: { id: materialIdInt },
        data: {
          titulo: data.titulo,
          descricao: data.descricao,
          url: data.url,
        },
      }),

      // B. Atualiza o Título no "Envelope" (ModuloItem) se o título mudou
      // updateMany garante que se o material estiver em múltiplos lugares (raro mas possível), todos atualizam
      ...(data.titulo ? [
        prisma.moduloItem.updateMany({
          where: { materialId: materialIdInt },
          data: { titulo: data.titulo }
        })
      ] : [])
    ]);

    // 8. Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_EDITAR, 
      usuarioId: professorId,
      usuarioNome: session.name,
      recurso: `Material: ${materialIdInt}`,
      detalhes: { 
        changes: data,
        titulo: materialAtualizado.titulo,
        propagatedToItem: !!data.titulo
      },
    });

    return NextResponse.json(materialAtualizado);

  } catch (error) {
    return safeApiError(error, "Erro ao atualizar material.");
  }
}

// --- DELETE: Excluir Material ---
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; materialId: string }> }
) {
  try {
    const { turmaId, materialId } = await params;
    const turmaIdInt = Number(turmaId);
    const materialIdInt = Number(materialId);

    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "DELETE /api/professor/.../materiais/[id]",
      });
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const professorId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(materialIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const ip = await getClientIp(req);
    const { success } = await adminContentRateLimit.limit(`delete_material:${professorId}:${ip}`);
    if (!success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde." }, { status: 429 });
    }

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

    const material = await prisma.materialTurma.findUnique({
      where: { id: materialIdInt },
      select: { id: true, turmaId: true, titulo: true, storagePath: true }
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado." }, { status: 404 });
    }

    if (material.turmaId !== turmaIdInt) {
      return NextResponse.json({ error: "Este material não pertence à turma informada." }, { status: 403 });
    }

    // Transaction para garantir limpeza completa
    await prisma.$transaction([
      // Remove referência nos itens de módulo (Cascade geralmente faz isso, mas é bom ser explícito ou garantir integridade)
      prisma.moduloItem.deleteMany({
        where: { materialId: materialIdInt }
      }),
      // Remove o material
      prisma.materialTurma.delete({
        where: { id: materialIdInt },
      })
    ]);

    await registrarLog({
      acao: AuditAction.MATERIAL_EXCLUIR,
      usuarioId: professorId,
      usuarioNome: session.name,
      recurso: `Material: ${materialId}`,
      detalhes: {
        turmaId: turmaIdInt,
        titulo: material.titulo,
        path: material.storagePath 
      },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    return safeApiError(error, "Erro ao deletar material.");
  }
}