import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  PenTool,
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
  Timer,
  FileText,
  PlayCircle,
  Eye,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AgendamentosAlunoPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session || session.role !== "ALUNO") redirect("/login");

  const turmaId = parseInt(id);
  const alunoId = parseInt(session.sub);

  if (isNaN(turmaId)) redirect("/estudante/turmas");

  // 1. Valida matrícula ativa
  const matricula = await prisma.turmaAluno.findUnique({
    where: {
      turmaId_alunoId: { turmaId, alunoId },
    },
  });

  if (!matricula || matricula.status !== "ATIVO") {
    redirect("/estudante/turmas");
  }

  // 2. Busca agendamentos da turma + entregas do aluno
  const agendamentos = await prisma.agendamentoSimulado.findMany({
    where: {
      turmaId,
      status: { not: "CANCELADO" },
    },
    orderBy: { dataInicio: "desc" },
    include: {
      entregas: {
        where: { alunoId },
        select: {
          status: true,
          simuladoId: true,
          notaAcertos: true,
        },
      },
    },
  });

  // 3. Estatísticas
  const now = new Date();

  const disponiveis = agendamentos.filter((a) => {
    const inicio = new Date(a.dataInicio);
    const fim = new Date(a.dataFim);
    const entrega = a.entregas[0];
    return now >= inicio && now <= fim && entrega?.status !== "CONCLUIDO";
  }).length;

  const concluidos = agendamentos.filter((a) => {
    const entrega = a.entregas[0];
    return entrega?.status === "CONCLUIDO";
  }).length;

  const agendadosFuturos = agendamentos.filter((a) => {
    return now < new Date(a.dataInicio);
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-8 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">

        {/* ── Hero ────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          {/* Blobs decorativos */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                  <PenTool className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                  Avaliações
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                Simulados & Provas
              </h1>
              <p className="text-indigo-100 text-base md:text-lg max-w-2xl">
                Acompanhe suas avaliações agendadas, realize provas e confira seus resultados
              </p>
            </div>
          </div>

          {/* Quick Stats no Hero */}
          <div className="relative z-10 grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <p className="text-indigo-100 text-xs font-medium mb-1">Total</p>
              <p className="text-white text-2xl font-bold">{agendamentos.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <p className="text-indigo-100 text-xs font-medium mb-1">Disponíveis</p>
              <p className="text-white text-2xl font-bold">{disponiveis}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <p className="text-indigo-100 text-xs font-medium mb-1">Concluídos</p>
              <p className="text-white text-2xl font-bold">{concluidos}</p>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            icon={Calendar}
            label="Agendados"
            value={agendadosFuturos}
            gradient="from-blue-500 to-cyan-500"
            description="Provas futuras"
          />
          <StatsCard
            icon={TrendingUp}
            label="Disponíveis"
            value={disponiveis}
            gradient="from-emerald-500 to-teal-500"
            description="Prontas para iniciar"
            highlight={disponiveis > 0}
          />
          <StatsCard
            icon={CheckCircle2}
            label="Concluídos"
            value={concluidos}
            gradient="from-purple-500 to-pink-500"
            description="Avaliações finalizadas"
          />
        </div>

        {/* ── Lista de Simulados ──────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Suas Avaliações</h2>
              <p className="text-sm text-slate-500">
                {agendamentos.length} avaliação{agendamentos.length !== 1 ? "ões" : ""} na turma
              </p>
            </div>
          </div>

          {agendamentos.length === 0 ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <CardContent className="py-20">
                <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                    <div className="relative p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
                      <PenTool className="h-16 w-16 text-indigo-600" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-slate-900">
                      Nenhuma avaliação disponível
                    </h3>
                    <p className="text-slate-600 text-base leading-relaxed">
                      O professor ainda não agendou simulados para esta turma. Volte em breve!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {agendamentos.map((agendamento, index) => {
                const dataInicio = new Date(agendamento.dataInicio);
                const dataFim = new Date(agendamento.dataFim);
                const entrega = agendamento.entregas[0];

                const isActive = now >= dataInicio && now <= dataFim;
                const isFuture = now < dataInicio;
                const isClosed = now > dataFim;
                const isConcluido = entrega?.status === "CONCLUIDO";
                const isEmAndamento = entrega?.status === "EM_ANDAMENTO";

                return (
                  <Card
                    key={agendamento.id}
                    className="group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-sm hover:-translate-y-1"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    {/* Barra de status */}
                    <div
                      className={cn(
                        "h-1.5",
                        isConcluido
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : isActive && !isConcluido
                          ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                          : isClosed && !isConcluido
                          ? "bg-gradient-to-r from-slate-400 to-gray-400"
                          : "bg-gradient-to-r from-amber-400 to-orange-400"
                      )}
                    />

                    <CardContent className="p-6 md:p-8">
                      <div className="flex flex-col lg:flex-row gap-6">

                        {/* Ícone */}
                        <div className="flex-shrink-0">
                          <div
                            className={cn(
                              "h-16 w-16 rounded-2xl flex items-center justify-center border-2 shadow-lg transition-all duration-300",
                              isConcluido
                                ? "bg-gradient-to-br from-emerald-500 to-teal-500 border-emerald-200 text-white"
                                : isActive
                                ? "bg-gradient-to-br from-indigo-500 to-purple-500 border-indigo-200 text-white group-hover:scale-110"
                                : isClosed
                                ? "bg-slate-100 border-slate-200 text-slate-400"
                                : "bg-gradient-to-br from-amber-400 to-orange-400 border-amber-200 text-white"
                            )}
                          >
                            {isConcluido ? (
                              <CheckCircle2 size={28} />
                            ) : isClosed ? (
                              <Lock size={28} />
                            ) : isFuture ? (
                              <Clock size={28} />
                            ) : (
                              <PenTool size={28} />
                            )}
                          </div>
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-2 flex-1">
                              {/* Título + Badge */}
                              <div className="flex items-start gap-3 flex-wrap">
                                <h3 className="font-bold text-xl text-slate-900 group-hover:text-indigo-700 transition-colors">
                                  {agendamento.titulo}
                                </h3>
                                <StatusBadge
                                  isConcluido={isConcluido}
                                  isEmAndamento={isEmAndamento}
                                  isActive={isActive}
                                  isFuture={isFuture}
                                  isClosed={isClosed}
                                />
                              </div>

                              {/* Info Grid */}
                              <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
                                <div className="flex items-center gap-2 text-slate-600">
                                  <div className="p-1.5 bg-blue-50 rounded-lg">
                                    <Calendar size={14} className="text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 font-medium">Período</p>
                                    <p className="font-semibold">
                                      {format(dataInicio, "dd/MM HH:mm", { locale: ptBR })} -{" "}
                                      {format(dataFim, "dd/MM HH:mm", { locale: ptBR })}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-slate-600">
                                  <div className="p-1.5 bg-purple-50 rounded-lg">
                                    <Timer size={14} className="text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 font-medium">Duração</p>
                                    <p className="font-semibold">{agendamento.duracaoMinutos} minutos</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-slate-600">
                                  <div className="p-1.5 bg-indigo-50 rounded-lg">
                                    <FileText size={14} className="text-indigo-600" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 font-medium">Questões</p>
                                    <p className="font-semibold">{agendamento.qtdeQuestoes}</p>
                                  </div>
                                </div>

                                {/* Nota (se concluído) */}
                                {isConcluido && entrega.notaAcertos !== null && (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "px-3 py-1.5 rounded-xl font-medium text-sm flex items-center gap-2 border",
                                        "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      )}
                                    >
                                      <CheckCircle2 size={14} />
                                      <span className="font-bold">{entrega.notaAcertos}</span>
                                      <span className="text-xs opacity-70">acertos</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Botão de ação */}
                            <div className="flex-shrink-0">
                              {isConcluido && entrega.simuladoId ? (
                                <Button
                                  asChild
                                  className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all"
                                >
                                  <Link href={`/estudante/simulado/${entrega.simuladoId}/resultado`}>
                                    <Eye size={16} />
                                    Ver Resultado
                                  </Link>
                                </Button>
                              ) : isActive || isEmAndamento ? (
                                <Button
                                  asChild
                                  className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all"
                                >
                                  <Link href={`/estudante/turmas/${id}/agendamentos/${agendamento.id}/inicio`}>
                                    <PlayCircle size={16} />
                                    {isEmAndamento ? "Retomar" : "Iniciar Prova"}
                                  </Link>
                                </Button>
                              ) : isFuture ? (
                                <Button
                                  variant="outline"
                                  disabled
                                  className="gap-2 border-slate-300 text-slate-400 cursor-not-allowed"
                                >
                                  <Clock size={16} />
                                  Aguardar
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  disabled
                                  className="gap-2 border-slate-300 text-slate-400 cursor-not-allowed"
                                >
                                  <Lock size={16} />
                                  Encerrado
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Alerta em andamento */}
                          {isEmAndamento && isActive && (
                            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                              <div className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                              </div>
                              <p className="text-sm font-medium text-amber-900">
                                Você tem uma tentativa em andamento. Clique para retomar.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── StatusBadge ──────────────────────────────────────────────
function StatusBadge({
  isConcluido,
  isEmAndamento,
  isActive,
  isFuture,
  isClosed,
}: {
  isConcluido: boolean;
  isEmAndamento: boolean;
  isActive: boolean;
  isFuture: boolean;
  isClosed: boolean;
}) {
  if (isConcluido) {
    return (
      <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1.5 px-3 py-1 shadow-sm">
        <CheckCircle2 size={12} />
        Concluído
      </Badge>
    );
  }

  if (isEmAndamento) {
    return (
      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1.5 pl-2 pr-3 py-1 shadow-lg">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        Em Andamento
      </Badge>
    );
  }

  if (isActive) {
    return (
      <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 gap-1.5 pl-2 pr-3 py-1 shadow-lg">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-200 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        Disponível
      </Badge>
    );
  }

  if (isFuture) {
    return (
      <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 gap-1.5 px-3 py-1 shadow-sm">
        <Calendar size={12} />
        Agendado
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-slate-200 text-slate-600 border-slate-300 gap-1.5 px-3 py-1">
      <Lock size={12} />
      Encerrado
    </Badge>
  );
}

// ── StatsCard ────────────────────────────────────────────────
function StatsCard({
  icon: Icon,
  label,
  value,
  gradient,
  description,
  highlight = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  gradient: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 bg-white/80 backdrop-blur-sm group hover:-translate-y-1">
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br",
          gradient
        )}
      />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              "p-3 rounded-2xl shadow-lg bg-gradient-to-br transform group-hover:scale-110 transition-transform duration-500",
              gradient
            )}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
          {highlight && (
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-bold text-slate-900 group-hover:scale-105 transition-transform duration-300">
            {value}
          </p>
          <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            {label}
          </p>
          <p
            className={cn(
              "text-xs font-medium bg-gradient-to-r bg-clip-text text-transparent",
              gradient
            )}
          >
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
