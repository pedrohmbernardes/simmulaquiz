import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SimuladoRunner } from "./SimuladoRunner";
import { getShuffleMap } from "@/lib/utils"; // Importando a nossa função mágica

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RealizarSimuladoPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  // 1. Segurança Básica
  if (!session || session.role !== "ALUNO") redirect("/login");

  const simuladoId = parseInt(id);
  if (isNaN(simuladoId)) redirect("/estudante");

  // 2. Busca Simulado + Dados do Agendamento Pai
  const simulado = await prisma.simulado.findUnique({
    where: { 
      id: simuladoId,
      usuarioId: parseInt(session.sub) // Garante que o aluno é dono da prova
    },
    include: {
      simuladosQuestoes: {
        orderBy: { id: 'asc' }, // Mantém a ordem de inserção (AgendamentoQuestao)
        include: {
          questao: {
            select: {
              id: true,
              enunciado: true,
              alternativaA: true,
              alternativaB: true,
              alternativaC: true,
              alternativaD: true,
              alternativaE: true,
              // SEGURANÇA MÁXIMA: A alternativaCorreta NUNCA sai do servidor
            }
          }
        }
      },
      agendamentoOrigem: {
        select: { 
          titulo: true,
          dataFim: true,
          status: true,
          duracaoMinutos: true
        } 
      }
    }
  });

  // 3. Validações de Negócio
  if (!simulado) {
    redirect("/estudante"); 
  }

  // Se já finalizou ou foi anulado, não pode continuar
  if (["CONCLUIDO", "ANULADO", "ABANDONADO"].includes(simulado.status)) {
    redirect(`/estudante/simulado/${simuladoId}/resultado`);
  }

  // Se o professor CANCELOU o agendamento (prova da turma)
  if (simulado.agendamentoOrigem?.status === "CANCELADO") {
    redirect("/estudante?erro=prova_cancelada");
  }

  // Verifica se a JANELA DE TEMPO já fechou (Data Fim absoluta do Agendamento)
  if (simulado.agendamentoOrigem?.dataFim && new Date() > simulado.agendamentoOrigem.dataFim) {
     redirect(`/estudante/simulado/${simuladoId}/resultado?erro=prazo_encerrado`);
  }

  // 4. Preparação de Dados para o Client (Sanitize + Randomização)
  const dataInicioReal = simulado.dataInicio || simulado.createdAt;
  const duracao = simulado.tempoLimiteMinutos || simulado.agendamentoOrigem?.duracaoMinutos || 60;

  const clientData = {
    id: simulado.id,
    titulo: simulado.agendamentoOrigem?.titulo || `Simulado #${simulado.id}`,
    
    // Datas e Tempos
    dataInicio: dataInicioReal.toISOString(),
    tempoLimiteMinutos: duracao,
    prazoFinalAbsoluto: simulado.agendamentoOrigem?.dataFim?.toISOString() || null,
    
    // Questões Mapeadas e Embaralhadas
    questoes: simulado.simuladosQuestoes.map(sq => {
      // ── MÁGICA ACONTECENDO AQUI ──
      // Pega o mapa de embaralhamento fixo para essa prova/questão
      const mapa = getShuffleMap(simulado.id, sq.questao.id);

      // Função auxiliar para puxar o texto correto da tabela original baseado no mapa
      const getTextoAlternativa = (letraReal: string) => {
        switch (letraReal) {
          case 'A': return sq.questao.alternativaA;
          case 'B': return sq.questao.alternativaB;
          case 'C': return sq.questao.alternativaC;
          case 'D': return sq.questao.alternativaD;
          case 'E': return sq.questao.alternativaE;
          default: return "";
        }
      };

      return {
        id: sq.id, 
        questaoId: sq.questao.id,
        enunciado: sq.questao.enunciado,
        alternativas: {
          A: getTextoAlternativa(mapa["A"]), // Ex: Se mapa["A"] for "C", exibe o texto da C original
          B: getTextoAlternativa(mapa["B"]),
          C: getTextoAlternativa(mapa["C"]),
          D: getTextoAlternativa(mapa["D"]),
          E: getTextoAlternativa(mapa["E"]),
        },
        // O que está no banco salvo como "Marcada" é exatamente o que o aluno viu na tela (ex: "A" embaralhada)
        alternativaMarcada: sq.alternativaMarcada 
      };
    })
  };

  return <SimuladoRunner simulado={clientData} />;
}