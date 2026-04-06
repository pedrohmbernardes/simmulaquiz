import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";

// --- GET: Listar Avisos (Visão do Aluno) ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação (Apenas Aluno)
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const alunoId = Number(session.sub);
    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID de turma inválido" }, { status: 400 });
    }

    // 2. Validação de Membership (Aluno deve ser ATIVO na turma)
    // Se o aluno foi removido ou ainda está pendente, ele não vê os avisos.
    const matricula = await prisma.turmaAluno.findUnique({
      where: {
        turmaId_alunoId: { turmaId: turmaIdInt, alunoId: alunoId },
      },
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json(
        { error: "Você não tem acesso ao mural desta turma." },
        { status: 403 }
      );
    }

    // 3. Busca Avisos da Turma
    const avisos = await prisma.avisoTurma.findMany({
      where: { turmaId: turmaIdInt },
      orderBy: [
        { fixado: "desc" },    // Fixados no topo
        { createdAt: "desc" }, // Mais recentes depois
      ],
      include: {
        anexos: true,
        autor: { // Traz dados do professor para o cabeçalho do card
          select: {
            nome: true,
            fotoUrl: true,
            tipo: true, // Útil para mostrar tag "Professor" ou "Monitor" no front
          },
        },
        _count: {
          select: { comentarios: true },
        },
      },
    });

    return NextResponse.json(avisos);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar avisos.");
  }
}