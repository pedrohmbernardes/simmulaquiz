import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";
import { apiRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando limitador de API

// --- GET: Listar Conteúdo da Turma (Visão do Aluno) ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação Rigorosa
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // ✅ Rate Limit de Leitura (Impede raspagem veloz do conteúdo da turma)
    const rlKey = `turma_conteudo:${session.sub}`;
    const rl = await apiRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const alunoId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID da turma inválido" }, { status: 400 });
    }

    // 2. Autorização (RBAC) - Segurança Inegociável
    const matricula = await prisma.turmaAluno.findUnique({
      where: {
        turmaId_alunoId: {
          turmaId: turmaIdInt,
          alunoId: alunoId,
        },
      },
    });

    if (!matricula || matricula.status !== 'ATIVO') {
      return NextResponse.json({ error: "Acesso negado à turma." }, { status: 403 });
    }

    // 3. Buscar Conteúdo (Apenas Publicado)
    const modulos = await prisma.moduloTurma.findMany({
      where: {
        turmaId: turmaIdInt,
        publicado: true,
      },
      include: {
        itens: {
          orderBy: { ordem: 'asc' },
          include: {
            // Select Otimizado: Traz apenas o necessário para o card
            material: {
              select: { id: true, titulo: true, tipo: true, url: true, descricao: true }
            },
            tarefa: {
              select: { id: true, titulo: true, dataEntrega: true, notaMaxima: true }
            },
            agendamento: {
              select: { id: true, titulo: true, dataInicio: true, dataFim: true, duracaoMinutos: true }
            },
          },
        },
      },
      orderBy: { ordem: 'asc' },
    });

    // 4. Otimização de Performance (Batching)
    const tarefaIds: number[] = [];
    const agendamentoIds: number[] = [];

    modulos.forEach((mod) => {
      mod.itens.forEach((item) => {
        if (item.tarefaId) tarefaIds.push(item.tarefaId);
        if (item.agendamentoId) agendamentoIds.push(item.agendamentoId);
      });
    });

    // 5. Cruzamento de Dados (Status de Progresso do Aluno)
    const [entregasTarefa, entregasAgendamento] = await Promise.all([
      // Verifica tarefas entregues
      prisma.entregaTarefa.findMany({
        where: {
          alunoId: alunoId,
          tarefaId: { in: tarefaIds },
        },
        select: {
          tarefaId: true,
          status: true,
          nota: true,
          entregueEm: true,
          feedback: true,
        },
      }),
      // Verifica agendamentos iniciados/concluídos
      prisma.agendamentoEntrega.findMany({
        where: {
          alunoId: alunoId,
          agendamentoId: { in: agendamentoIds },
        },
        select: {
          agendamentoId: true,
          status: true,
          notaPercentual: true,
          finalizadoEm: true,
        },
      }),
    ]);

    const tarefaMap = new Map(entregasTarefa.map((e) => [e.tarefaId, e]));
    const agendamentoMap = new Map(entregasAgendamento.map((e) => [e.agendamentoId, e]));

    // 6. Montagem da Resposta (DTO Seguro)
    const trilha = modulos.map((mod) => ({
      id: mod.id,
      titulo: mod.titulo,
      descricao: mod.descricao,
      itens: mod.itens.map((item) => {
        const baseItem = {
          id: item.id,
          tipo: item.tipo, // Mantém o enum do banco (MATERIAL, TAREFA, AGENDAMENTO_SIMULADO)
        };

        // --- Material ---
        if (item.material) {
          return {
            ...baseItem,
            titulo: item.material.titulo,
            recurso: item.material,
            status: 'DISPONIVEL', 
          };
        }

        // --- Tarefa ---
        if (item.tarefa) {
          const entrega = tarefaMap.get(item.tarefa.id);
          return {
            ...baseItem,
            titulo: item.tarefa.titulo,
            recurso: item.tarefa,
            status: entrega?.status || 'PENDENTE',
            nota: entrega?.nota ?? null,
            dataEntrega: entrega?.entregueEm ?? null,
            temFeedback: !!entrega?.feedback,
          };
        }

        // --- Agendamento (Simulado) ---
        if (item.agendamento) {
          const progresso = agendamentoMap.get(item.agendamento.id);
          const agora = new Date();
          
          const dataInicio = new Date(item.agendamento.dataInicio);
          const dataFim = new Date(item.agendamento.dataFim);
          
          const isAberto = agora >= dataInicio && agora <= dataFim;

          return {
            ...baseItem,
            titulo: item.agendamento.titulo || 'Simulado Agendado',
            recurso: item.agendamento,
            status: progresso?.status || 'PENDENTE',
            nota: progresso?.notaPercentual ?? null,
            isAberto: isAberto,
            disponivelDe: dataInicio, 
            disponivelAte: dataFim    
          };
        }

        return baseItem;
      }),
    }));

    return NextResponse.json(trilha);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar conteúdo da turma.");
  }
}