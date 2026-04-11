import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";
import { apiRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando o limitador de API padrão

// --- GET: Detalhes da Turma (Dashboard do Aluno) ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação (Apenas Alunos)
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Leitura (Evita scraping dos detalhes da turma)
    const rlKey = `turma_dashboard:${session.sub}`;
    const rl = await apiRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const alunoId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    // 2. Busca Segura (Anti-IDOR)
    const turma = await prisma.turma.findFirst({
      where: {
        id: turmaIdInt,
        alunos: {
          some: {
            alunoId: alunoId,
            status: "ATIVO"
          }
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
        descricao: true,
        imagemUrl: true,
        // ✅ CORREÇÃO 1: Removido 'take: 1' e o filtro 'where' (se desnecessário)
        // Agora trazemos a lista completa de professores vinculados
        professores: {
          select: {
            professor: {
              select: { nome: true, email: true, fotoUrl: true }
            }
          }
        },
        _count: {
          select: { alunos: true }
        }
      }
    });

    if (!turma) {
      return NextResponse.json({ error: "Turma não encontrada ou acesso não autorizado." }, { status: 404 });
    }

    // 3. Formatação para o Frontend
    const respostaFormatada = {
      ...turma,
      totalAlunos: turma._count.alunos,
      // ✅ CORREÇÃO 2: Removemos o achatamento do professor único.
      // O campo 'professores' agora é enviado como array: [{ professor: {...} }, ...]
      // Isso combina perfeitamente com a interface TurmaDetalhes que criamos no Frontend.
      _count: undefined 
    };

    return NextResponse.json(respostaFormatada);

  } catch (error) {
    return safeApiError(error, "Erro ao buscar detalhes da turma.");
  }
}