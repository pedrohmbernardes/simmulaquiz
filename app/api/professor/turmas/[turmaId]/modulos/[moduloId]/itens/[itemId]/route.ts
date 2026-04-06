import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarLog, AuditAction } from "@/lib/audit";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { verifyCSRFToken } from "@/lib/csrf";

// --- DELETE: Remover Item do Módulo ---
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; moduloId: string; itemId: string }> }
) {
  try {
    // 1. Segurança Básica
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. Proteção CSRF (Mutação)
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida (Token de Segurança)" }, { status: 403 });
    }

    // 3. Parse dos IDs
    const { turmaId, moduloId, itemId } = await params;
    const turmaIdInt = Number(turmaId);
    const moduloIdInt = Number(moduloId);
    const itemIdInt = Number(itemId);
    const userId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(moduloIdInt) || isNaN(itemIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // 4. Rate Limit
    const { success } = await adminContentRateLimit.limit(`del_item:${userId}`);
    if (!success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde." }, { status: 429 });
    }

    // 5. Validação de Propriedade (O usuário é dono da turma?)
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: { turmaId: turmaIdInt, professorId: userId },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // 6. Verifica se o Item pertence ao Módulo e à Turma (Segurança em Profundidade)
    // Isso impede que alguém delete um item de outra turma manipulando a URL
    const itemExistente = await prisma.moduloItem.findFirst({
      where: {
        id: itemIdInt,
        moduloId: moduloIdInt,
        modulo: {
          turmaId: turmaIdInt // Garante que o módulo é desta turma
        }
      }
    });

    if (!itemExistente) {
      return NextResponse.json({ error: "Item não encontrado ou acesso negado." }, { status: 404 });
    }

    // 7. Executa a Exclusão
    // NOTA: Isso deleta apenas o VÍNCULO (ModuloItem). 
    // O recurso original (Material/Simulado/Tarefa) permanece no banco como "órfão" por segurança.
    await prisma.moduloItem.delete({
      where: { id: itemIdInt }
    });

    // 8. Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_EDITAR, // Ou criar MODULO_ITEM_REMOVER
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Item Removido: ${itemIdInt}`,
      detalhes: {
        turmaId: turmaIdInt,
        moduloId: moduloIdInt,
        tipoItem: itemExistente.tipo
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Erro ao deletar item do módulo:", error);
    return NextResponse.json({ error: "Erro interno ao processar exclusão." }, { status: 500 });
  }
}