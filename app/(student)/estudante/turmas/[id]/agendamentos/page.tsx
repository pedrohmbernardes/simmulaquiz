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
      <div className="space-y-5 md:space-y-8 animate-in fade-in duration-700 p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto">

        {/* ── Hero ────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-5 md:p-10 shadow-2xl">
          {/* Blobs decorativos */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-48 md:w-96 h-48 md:h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-36 md:w-72 h-36 md:h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6">
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center gap-2.5 md:gap-3">
                <div className="p-2 md:p-2.5 bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl shadow-lg">
                  <PenTool className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 text-[10px] md:text-xs">
                  Avaliações
                </Badge>
              </div>
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white">
                Simulados & Provas
              </h1>
              <p className="text-indigo-100 text-sm md:text-lg max-w-2xl">
                Acompanhe suas avaliações agendadas, realize provas e confira seus resultados
              </p>
            </div>
          </div>

          {/* Quick Stats no Hero */}
          <div className="relative z-10 grid grid-cols-3 gap-2.5 md:gap-4 mt-4 md:mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
              <p className="text-indigo-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Total</p>
              <p className="text-white text-xl md:text-2xl font-bold">{agendamentos.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
              <p className="text-indigo-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Disponíveis</p>
              <p className="text-white text-xl md:text-2xl font-bold">{disponiveis}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
              <p className="text-indigo-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Concluídos</p>
              <p className="text-white text-xl md:text-2xl font-bold">{concluidos}</p>
            </div>
          </div>
        </div>

        {/* ── Stats Cards — hidden on mobile (hero has stats) ── */}
        <div className="hidden md:grid grid-cols-3 gap-6">
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
        <section className="space-y-3 md:space-y-4">
          <div className="flex items-center gap-2.5 md:gap-3">
            <div className="p-1.5 md:p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg md:rounded-xl shadow-lg">
              <FileText className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base md:text-xl font-bold text-slate-900">Suas Avaliações</h2>
              <p className="text-xs md:text-sm text-slate-500">
                {agendamentos.length} avaliação{agendamentos.length !== 1 ? "ões" : ""} na turma
              </p>
            </div>
          </div>

          {agendamentos.length === 0 ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="h-1 md:h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <CardContent className="py-14 md:py-20">
                <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 md:space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                    <div className="relative p-5 md:p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl md:rounded-3xl">
                      <PenTool className="h-12 w-12 md:h-16 md:w-16 text-indigo-600" />
                    </div>
                  </div>
                  <div className="space-y-2 md:space-y-3">
                    <h3 className="text-xl md:text-2xl font-bold text-slate-900">
                      Nenhuma avaliação disponível
                    </h3>
                    <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                      O professor ainda não agendou simulados para esta turma. Volte em breve!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
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
                    className="group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-sm md:hover:-translate-y-1"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    {/* Barra de status */}
                    <div
                      className={cn(
                        "h-1 md:h-1.5",
                        isConcluido
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : isActive && !isConcluido
                          ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                          : isClosed && !isConcluido
                          ? "bg-gradient-to-r from-slate-400 to-gray-400"
                          : "bg-gradient-to-r from-amber-400 to-orange-400"
                      )}
                    />

                    <CardContent className="p-4 md:p-8">
                      {/* Mobile: stacked layout / Desktop: row layout */}
                      <div className="flex flex-col md:flex-row gap-4 md:gap-6">

                        {/* Ícone — smaller on mobile */}
                        <div className="flex-shrink-0 flex md:block items-center gap-3">
                          <div
                            className={cn(
                              "h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl flex items-center justify-center border-2 shadow-lg transition-all duration-300",
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
                              <CheckCircle2 className="h-5 w-5 md:h-7 md:w-7" />
                            ) : isClosed ? (
                              <Lock className="h-5 w-5 md:h-7 md:w-7" />
                            ) : isFuture ? (
                              <Clock className="h-5 w-5 md:h-7 md:w-7" />
                            ) : (
                              <PenTool className="h-5 w-5 md:h-7 md:w-7" />
                            )}
                          </div>

                          {/* Mobile inline: title + badge next to icon */}
                          <div className="md:hidden flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap">
                              <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-700 transition-colors">
                                {agendamento.titulo}
                              </h3>
                              <StatusBadge
                                isConcluido={isConcluido}
                                isEmAndamento={isEmAndamento}
                                isActive={isActive}
                                isFuture={isFuture}
                                isClosed={isClosed}
                                compact
                              />
                            </div>
                          </div>
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0 space-y-3 md:space-y-4">
                          {/* Desktop title + badge */}
                          <div className="hidden md:flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-2 flex-1">
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
                            </div>
                          </div>

                          {/* Info Grid — compact on mobile */}
                          <div className="flex flex-wrap gap-x-4 md:gap-x-6 gap-y-2 md:gap-y-3 text-xs md:text-sm">
                            <div className="flex items-center gap-1.5 md:gap-2 text-slate-600">
                              <div className="p-1 md:p-1.5 bg-blue-50 rounded-md md:rounded-lg">
                                <Calendar size={12} className="text-blue-600 md:hidden" />
                                <Calendar size={14} className="text-blue-600 hidden md:block" />
                              </div>
                              <div>
                                <p className="text-[10px] md:text-xs text-slate-500 font-medium">Período</p>
                                <p className="font-semibold text-[11px] md:text-sm">
                                  {format(dataInicio, "dd/MM HH:mm", { locale: ptBR })} -{" "}
                                  {format(dataFim, "dd/MM HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 md:gap-2 text-slate-600">
                              <div className="p-1 md:p-1.5 bg-purple-50 rounded-md md:rounded-lg">
                                <Timer size={12} className="text-purple-600 md:hidden" />
                                <Timer size={14} className="text-purple-600 hidden md:block" />
                              </div>
                              <div>
                                <p className="text-[10px] md:text-xs text-slate-500 font-medium">Duração</p>
                                <p className="font-semibold text-[11px] md:text-sm">{agendamento.duracaoMinutos} min</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 md:gap-2 text-slate-600">
                              <div className="p-1 md:p-1.5 bg-indigo-50 rounded-md md:rounded-lg">
                                <FileText size={12} className="text-indigo-600 md:hidden" />
                                <FileText size={14} className="text-indigo-600 hidden md:block" />
                              </div>
                              <div>
                                <p className="text-[10px] md:text-xs text-slate-500 font-medium">Questões</p>
                                <p className="font-semibold text-[11px] md:text-sm">{agendamento.qtdeQuestoes}</p>
                              </div>
                            </div>

                            {/* Nota (se concluído) */}
                            {isConcluido && entrega.notaAcertos !== null && (
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <div
                                  className={cn(
                                    "px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl font-medium text-xs md:text-sm flex items-center gap-1.5 md:gap-2 border",
                                    "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  )}
                                >
                                  <CheckCircle2 size={12} className="md:hidden" />
                                  <CheckCircle2 size={14} className="hidden md:block" />
                                  <span className="font-bold">{entrega.notaAcertos}</span>
                                  <span className="text-[10px] md:text-xs opacity-70">acertos</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Botão de ação — full width on mobile */}
                          <div className="pt-1 md:pt-0">
                            {isConcluido && entrega.simuladoId ? (
                              <Button
                                asChild
                                size="sm"
                                className="w-full md:w-auto gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all text-xs md:text-sm h-9 md:h-10"
                              >
                                <Link href={`/estudante/simulado/${entrega.simuladoId}/resultado`}>
                                  <Eye size={14} />
                                  Ver Resultado
                                </Link>
                              </Button>
                            ) : isActive || isEmAndamento ? (
                              <Button
                                asChild
                                size="sm"
                                className="w-full md:w-auto gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all text-xs md:text-sm h-9 md:h-10"
                              >
                                <Link href={`/estudante/turmas/${id}/agendamentos/${agendamento.id}/inicio`}>
                                  <PlayCircle size={14} />
                                  {isEmAndamento ? "Retomar" : "Acessar Simulado"}
                                </Link>
                              </Button>
                            ) : isFuture ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="w-full md:w-auto gap-2 border-slate-300 text-slate-400 cursor-not-allowed text-xs md:text-sm h-9 md:h-10"
                              >
                                <Clock size={14} />
                                Aguardar
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="w-full md:w-auto gap-2 border-slate-300 text-slate-400 cursor-not-allowed text-xs md:text-sm h-9 md:h-10"
                              >
                                <Lock size={14} />
                                Encerrado
                              </Button>
                            )}
                          </div>

                          {/* Alerta em andamento */}
                          {isEmAndamento && isActive && (
                            <div className="flex items-center gap-2.5 md:gap-3 p-3 md:p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                              <div className="relative flex h-2 w-2 md:h-2.5 md:w-2.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 bg-amber-500" />
                              </div>
                              <p className="text-xs md:text-sm font-medium text-amber-900">
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
  compact = false,
}: {
  isConcluido: boolean;
  isEmAndamento: boolean;
  isActive: boolean;
  isFuture: boolean;
  isClosed: boolean;
  compact?: boolean;
}) {
  const sizeClasses = compact ? "px-2 py-0.5 text-[10px] gap-1" : "px-3 py-1 gap-1.5";
  const iconSize = compact ? 10 : 12;
  const dotSize = compact ? "h-1.5 w-1.5" : "h-2 w-2";
  const dotContainerSize = compact ? "h-1.5 w-1.5" : "h-2 w-2";

  if (isConcluido) {
    return (
      <Badge className={cn("bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 shadow-sm", sizeClasses)}>
        <CheckCircle2 size={iconSize} />
        Concluído
      </Badge>
    );
  }

  if (isEmAndamento) {
    return (
      <Badge className={cn("bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg", compact ? "pl-1.5 pr-2 py-0.5 text-[10px] gap-1" : "pl-2 pr-3 py-1 gap-1.5")}>
        <span className={cn("relative flex", dotContainerSize)}>
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75")} />
          <span className={cn("relative inline-flex rounded-full bg-white", dotSize)} />
        </span>
        Em Andamento
      </Badge>
    );
  }

  if (isActive) {
    return (
      <Badge className={cn("bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 shadow-lg", compact ? "pl-1.5 pr-2 py-0.5 text-[10px] gap-1" : "pl-2 pr-3 py-1 gap-1.5")}>
        <span className={cn("relative flex", dotContainerSize)}>
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-200 opacity-75")} />
          <span className={cn("relative inline-flex rounded-full bg-white", dotSize)} />
        </span>
        Disponível
      </Badge>
    );
  }

  if (isFuture) {
    return (
      <Badge className={cn("bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 shadow-sm", sizeClasses)}>
        <Calendar size={iconSize} />
        Agendado
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={cn("bg-slate-200 text-slate-600 border-slate-300", sizeClasses)}>
      <Lock size={iconSize} />
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
