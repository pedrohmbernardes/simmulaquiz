import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SimuladoRunner } from "./SimuladoRunner";

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
  // Nota: Isso bloqueia o acesso mesmo que o aluno ainda tivesse tempo de cronômetro
  if (simulado.agendamentoOrigem?.dataFim && new Date() > simulado.agendamentoOrigem.dataFim) {
     // Redireciona para resultado para processar o encerramento se necessário
     redirect(`/estudante/simulado/${simuladoId}/resultado?erro=prazo_encerrado`);
  }

  // 4. Preparação de Dados para o Client (Sanitize)
  const dataInicioReal = simulado.dataInicio || simulado.createdAt;
  const duracao = simulado.tempoLimiteMinutos || simulado.agendamentoOrigem?.duracaoMinutos || 60;

  const clientData = {
    id: simulado.id,
    titulo: simulado.agendamentoOrigem?.titulo || `Simulado #${simulado.id}`,
    
    // Datas e Tempos
    dataInicio: dataInicioReal.toISOString(),
    tempoLimiteMinutos: duracao,
    prazoFinalAbsoluto: simulado.agendamentoOrigem?.dataFim?.toISOString() || null,
    
    // Questões Mapeadas
    questoes: simulado.simuladosQuestoes.map(sq => ({
      id: sq.id, // ID da tabela pivot (usado para salvar a resposta)
      questaoId: sq.questao.id,
      enunciado: sq.questao.enunciado,
      alternativas: {
        A: sq.questao.alternativaA,
        B: sq.questao.alternativaB,
        C: sq.questao.alternativaC,
        D: sq.questao.alternativaD,
        E: sq.questao.alternativaE,
      },
      alternativaMarcada: sq.alternativaMarcada // Permite retomar prova (Persistência)
    }))
  };

  return <SimuladoRunner simulado={clientData} />;
}