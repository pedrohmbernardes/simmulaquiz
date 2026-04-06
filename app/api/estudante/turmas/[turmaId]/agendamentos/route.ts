import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";

// --- GET: Listar Provas Agendadas da Turma ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const alunoId = Number(session.sub);
    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // 2. Validação de Membership (Aluno deve ser ATIVO na turma)
    const matricula = await prisma.turmaAluno.findUnique({
      where: {
        turmaId_alunoId: { turmaId: turmaIdInt, alunoId: alunoId },
      },
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json(
        { error: "Você não tem acesso aos agendamentos desta turma." },
        { status: 403 }
      );
    }

    // 3. Busca Agendamentos + Status do Aluno
    const agendamentos = await prisma.agendamentoSimulado.findMany({
      where: {
        turmaId: turmaIdInt,
        status: "PUBLICADO", // Aluno só vê o que foi publicado
      },
      orderBy: {
        dataFim: "asc", // Prazos mais próximos primeiro (urgência)
      },
      include: {
        // Traz apenas a entrega deste aluno para saber o status pessoal
        entregas: {
          where: { alunoId: alunoId },
          select: {
            status: true,
            notaPercentual: true,
            notaAcertos: true,
            simuladoId: true,
            finalizadoEm: true,
          },
        },
      },
    });

    // 4. Processamento de Status (Computed Fields)
    const agora = new Date();

    const resultado = agendamentos.map((ag) => {
      const entrega = ag.entregas[0]; // Como filtramos por alunoId, ou tem 1 ou tem 0
      
      let statusCalculado = "DISPONIVEL";
      let podeIniciar = false;
      let labelAcao = "Iniciar";
      let message = "";

      // Datas
      const inicio = new Date(ag.dataInicio);
      const fim = new Date(ag.dataFim);

      if (entrega) {
        // Se já existe registro, usamos o status real da entrega
        if (entrega.status === "EM_ANDAMENTO") {
          statusCalculado = "EM_ANDAMENTO";
          podeIniciar = true;
          labelAcao = "Continuar";
        } else if (entrega.status === "CONCLUIDO") {
          statusCalculado = "CONCLUIDO";
          podeIniciar = true; // Permite ver resultado
          labelAcao = "Ver Resultado";
        } else {
          statusCalculado = entrega.status; // PENDENTE, ABANDONADO, etc.
          podeIniciar = false;
        }
      } else {
        // Sem entrega: verifica janelas de tempo
        if (agora < inicio) {
          statusCalculado = "EM_BREVE";
          podeIniciar = false;
          labelAcao = "Aguarde";
          message = `Abre em ${inicio.toLocaleDateString()}`;
        } else if (agora > fim) {
          statusCalculado = "EXPIRADO";
          podeIniciar = false;
          labelAcao = "Encerrado";
          message = "Prazo encerrado";
        } else {
          statusCalculado = "DISPONIVEL";
          podeIniciar = true;
          labelAcao = "Iniciar";
        }
      }

      return {
        id: ag.id,
        titulo: ag.titulo,
        descricao: ag.descricao,
        dataInicio: ag.dataInicio,
        dataFim: ag.dataFim,
        qtdeQuestoes: ag.qtdeQuestoes,
        duracaoMinutos: ag.duracaoMinutos, // CORRIGIDO: nome da coluna no schema
        
        // Dados personalizados do aluno
        meuStatus: statusCalculado,
        minhaNota: entrega?.notaPercentual ?? null,
        simuladoId: entrega?.simuladoId ?? null,
        podeIniciar,
        labelAcao,
        message
      };
    });

    return NextResponse.json(resultado);

  } catch (error) {
    return safeApiError(error, "Erro ao listar agendamentos.");
  }
}