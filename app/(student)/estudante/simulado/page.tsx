import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { 
  Clock, 
  Calendar, 
  ChevronRight, 
  AlertCircle, 
  PlayCircle,
  FileText,
  CheckCircle
} from "lucide-react";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Meus Simulados | SimmulaQuiz",
  description: "Gerencie suas provas e simulados pendentes.",
};

export default async function SimuladosIndexPage() {
  const session = await getSession();

  if (!session || session.role !== "ALUNO") {
    redirect("/login");
  }

  const alunoId = parseInt(session.sub);
  const agora = new Date();

  // 1. Buscar AGENDAMENTOS PENDENTES (Vindos das Turmas)
  // Correção: Nome do model 'agendamentoSimulado' e Status 'CONCLUIDO'
  const agendamentosPendentes = await prisma.agendamentoSimulado.findMany({
    where: {
      turma: {
        alunos: {
          some: {
            alunoId: alunoId,
            status: "ATIVO"
          }
        }
      },
      status: "PUBLICADO", // Apenas agendamentos publicados
      dataInicio: { lte: agora }, // Já começou
      dataFim: { gte: agora },    // Ainda não acabou
      entregas: {
        none: {
          alunoId: alunoId,
          // Se já concluiu ou abandonou, não mostra na lista de pendentes
          status: { in: ["CONCLUIDO", "ABANDONADO"] } 
        }
      }
    },
    include: {
      turma: {
        select: {
          id: true,
          nome: true
        }
      },
      entregas: {
        where: { alunoId: alunoId },
        select: { status: true }
      }
    },
    orderBy: {
      dataFim: 'asc' // Prioridade para o que vence primeiro
    }
  });

  // 2. Buscar SIMULADOS EM ANDAMENTO (Tanto de turma quanto avulsos)
  // Correção: OrderBy 'createdAt' (iniciadoEm não existe no Simulado)
  const simuladosEmAndamento = await prisma.simulado.findMany({
    where: {
      usuarioId: alunoId,
      status: "EM_ANDAMENTO",
    },
    include: {
      agendamentoOrigem: {
        select: {
          titulo: true,
          dataFim: true,
          duracaoMinutos: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc' // Data de criação é o início da tentativa
    }
  });

  // Helper para verificar se um agendamento já tem um simulado rodando
  // Correção: Tipagem explícita no filter
  const idsEmAndamento = simuladosEmAndamento
    .map(s => s.agendamentoId)
    .filter((id): id is number => id !== null);
  
  // Filtra agendamentos que já estão em execução para não duplicar na tela
  const agendamentosFiltrados = agendamentosPendentes.filter(a => !idsEmAndamento.includes(a.id));

  const temItens = agendamentosFiltrados.length > 0 || simuladosEmAndamento.length > 0;

  return (
    <div className="container py-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Central de Simulados</h1>
        <p className="text-muted-foreground mt-2">
          Visualize suas provas agendadas e continue de onde parou.
        </p>
      </div>

      {!temItens && (
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-white p-4 rounded-full mb-4 shadow-sm">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold">Tudo em dia!</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
              Você não possui simulados pendentes ou em andamento neste momento.
            </p>
            <div className="mt-6">
              <Link href="/estudante/novo">
                <Button variant="outline">Criar Simulado de Treino</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEÇÃO 1: CONTINUE DE ONDE PAROU */}
      {simuladosEmAndamento.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-600">
            <PlayCircle className="h-5 w-5" />
            Em Andamento
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {simuladosEmAndamento.map((simulado) => (
              <Card key={simulado.id} className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <Badge variant="secondary" className="w-fit mb-2 bg-amber-100 text-amber-700 hover:bg-amber-100">
                    Continuar
                  </Badge>
                  <CardTitle className="text-lg truncate">
                    {simulado.agendamentoOrigem?.titulo || `Simulado #${simulado.id}`}
                  </CardTitle>
                  <CardDescription>
                    Iniciado em {format(simulado.createdAt, "dd/MM 'às' HH:mm")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Tempo correndo...</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Link href={`/estudante/simulado/${simulado.id}`} className="w-full">
                    <Button className="w-full" variant="default">
                      Retomar Prova <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* SEÇÃO 2: AGENDADOS (PENDENTES) */}
      {agendamentosFiltrados.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Disponíveis Para Iniciar
            </h2>
            <Separator className="flex-1 ml-4" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agendamentosFiltrados.map((agendamento) => (
              <Card key={agendamento.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline">{agendamento.turma.nome}</Badge>
                    {getDataFimBadge(agendamento.dataFim)}
                  </div>
                  <CardTitle className="line-clamp-2 min-h-[3.5rem]">
                    {agendamento.titulo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{agendamento.duracaoMinutos} minutos de duração</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>Prova Avaliativa</span>
                  </div>
                </CardContent>
                <CardFooter>
                  {/* IMPORTANTE: Link leva para a página de INÍCIO do Agendamento, não direto pro simulado */}
                  <Link 
                    href={`/estudante/turmas/${agendamento.turmaId}/agendamentos/${agendamento.id}/inicio`} 
                    className="w-full"
                  >
                    <Button className="w-full" variant="secondary">
                      Ver Detalhes <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getDataFimBadge(dataFim: Date) {
  const horasRestantes = (dataFim.getTime() - new Date().getTime()) / (1000 * 60 * 60);
  
  if (horasRestantes < 24) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Fecha hoje
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      Até {format(dataFim, "dd/MM")}
    </Badge>
  );
}