import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";
import { apiRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando o limitador de API

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação e RBAC
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. Rate Limit (Proteção contra Scraping / Sobrecarga de leitura)
    const rlKey = `tarefas_lista:${session.sub}`;
    const rl = await apiRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um momento antes de recarregar a página." },
        { status: 429 }
      );
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const alunoId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // 3. Validação de Membership (Anti-IDOR)
    // Verifica se o aluno está matriculado e ATIVO na turma
    const matricula = await prisma.turmaAluno.findUnique({
      where: {
        turmaId_alunoId: { turmaId: turmaIdInt, alunoId: alunoId },
      },
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Você não tem acesso a esta turma." }, { status: 403 });
    }

    // 4. Busca Tarefas + Entregas do Aluno
    // No seu schema, Tarefa não tem campo 'publicado', então removemos esse filtro.
    // O professor controla a visibilidade talvez por data ou excluindo a tarefa.
    const tarefas = await prisma.tarefa.findMany({
      where: {
        turmaId: turmaIdInt,
      },
      orderBy: {
        dataEntrega: "asc", // Prioriza prazos próximos
      },
      include: {
        // Relação 'entregas' definida no model Tarefa
        entregas: {
          where: { alunoId: alunoId }, // Filtra apenas a entrega deste aluno
          select: {
            id: true,
            status: true, // Enum StatusEntrega (PENDENTE, etc)
            nota: true,
            feedback: true,
            entregueEm: true, // Campo presente no schema EntregaTarefa
            corrigidoEm: true,
            // Opcional: trazer arquivos enviados para mostrar "Você enviou X arquivos"
            arquivos: {
              select: { nomeArquivo: true }
            }
          }
        },
        // Traz informações do criador se necessário (opcional)
        criadoPor: {
          select: { nome: true }
        }
      }
    });

    // 5. Processamento e Formatação
    const agora = new Date();

    const resultado = tarefas.map((t) => {
      // Como filtramos por alunoId no include, o array 'entregas' terá 0 ou 1 item
      const entrega = t.entregas[0];
      
      let statusCalculado = "PENDENTE";
      let labelStatus = "Pendente";
      let isAtrasado = false;

      if (entrega) {
        // Se existe entrega, usamos o status do banco
        // StatusEntrega (PENDENTE, ENTREGUE, CORRIGIDO - assumindo enum padrão)
        // Se o status for PENDENTE mas já tiver 'entregueEm', consideramos ENTREGUE (lógica de negócio)
        if (entrega.status === "PENDENTE" && entrega.entregueEm) {
            statusCalculado = "ENTREGUE";
            labelStatus = "Aguardando Correção";
        } else if (entrega.nota !== null) { // Ou status === 'CORRIGIDO'
            statusCalculado = "CORRIGIDO";
            labelStatus = `Nota: ${entrega.nota} / ${t.notaMaxima}`;
        } else {
            statusCalculado = entrega.status;
            labelStatus = entrega.status;
        }
      } else {
        // Sem entrega: Verifica atraso
        if (t.dataEntrega && agora > new Date(t.dataEntrega)) {
            statusCalculado = "ATRASADO";
            labelStatus = "Atrasado";
            isAtrasado = true;
        }
      }

      return {
        id: t.id,
        titulo: t.titulo,
        descricao: t.descricao,
        dataEntrega: t.dataEntrega,
        notaMaxima: t.notaMaxima,
        criadoPor: t.criadoPor?.nome,
        
        // Objeto de entrega personalizado para o frontend
        minhaEntrega: {
            id: entrega?.id || null,
            status: statusCalculado,
            label: labelStatus,
            entregueEm: entrega?.entregueEm || null,
            nota: entrega?.nota || null,
            feedback: entrega?.feedback || null,
            arquivosEnviados: entrega?.arquivos?.length || 0
        },
        
        // Flag útil para UI (cor vermelha se atrasado)
        isAtrasado
      };
    });

    return NextResponse.json(resultado);

  } catch (error) {
    return safeApiError(error, "Erro ao listar tarefas.");
  }
}