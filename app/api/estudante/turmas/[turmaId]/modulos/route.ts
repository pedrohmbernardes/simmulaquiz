import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";

// --- GET: Listar Módulos e Itens (Visão do Estudante) ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const alunoId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // 2. Validação de Acesso (Anti-IDOR)
    // O aluno precisa estar ATIVO na turma para ver o conteúdo
    const matricula = await prisma.turmaAluno.findUnique({
      where: {
        turmaId_alunoId: {
          turmaId: turmaIdInt,
          alunoId: alunoId
        }
      }
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Você não tem acesso ao conteúdo desta turma." }, { status: 403 });
    }

    // 3. Busca Conteúdo (Apenas Publicados)
    const modulos = await prisma.moduloTurma.findMany({
      where: { 
        turmaId: turmaIdInt,
        publicado: true // ✅ Oculta rascunhos do professor
      },
      orderBy: { ordem: "asc" },
      include: {
        itens: {
          orderBy: { ordem: "asc" },
          include: {
            // Polimorfismo na projeção: traz apenas o necessário
            material: {
              select: {
                id: true,
                titulo: true,
                tipo: true,
                url: true
              }
            },
            agendamento: {
              select: {
                id: true,
                titulo: true,
                dataInicio: true,
                dataFim: true,
                duracaoMinutos: true,
                status: true // Importante para saber se está CANCELADO
                // 🚫 Questões ocultas propositalmente
              }
            },
            tarefa: {
              select: {
                id: true,
                titulo: true,
                dataEntrega: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(modulos);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar módulos.");
  }
}