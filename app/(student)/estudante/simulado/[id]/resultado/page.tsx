import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2, XCircle, Clock, Target,
  ArrowLeft, Layers, Award, FileText,
  RotateCcw, Timer, AlertTriangle,
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

export default async function ResultadoSimuladoPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session) redirect("/login");

  const simuladoId = parseInt(id);
  if (isNaN(simuladoId)) redirect("/estudante");

  const simulado = await prisma.simulado.findUnique({
    where: {
      id: simuladoId,
      usuarioId: parseInt(session.sub),
    },
    include: {
      agendamentoOrigem: {
        select: {
          turmaId: true,
          titulo: true,
          turma: { select: { nome: true } },
        },
      },
      simuladosQuestoes: {
        orderBy: { id: "asc" },
        include: {
          questao: {
            select: {
              enunciado: true,
              alternativaA: true,
              alternativaB: true,
              alternativaC: true,
              alternativaD: true,
              alternativaE: true,
              alternativaCorreta: true,
              dificuldade: true,
              unidadeCurricular: { select: { nome: true } },
            },
          },
        },
      },
    },
  });

  if (!simulado) redirect("/estudante");
  if (simulado.status !== "CONCLUIDO") redirect(`/estudante/simulado/${simuladoId}`);

  const formatTempo = (segundos: number | null) => {
    if (!segundos) return "--";
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
  };

  const acertos = simulado.acertos ?? 0;
  const erros = simulado.erros ?? 0;
  const total = simulado.qtdeQuestoes;
  const percentual = simulado.notaPercentual ?? 0;
  const isCritical = percentual < 50;

  const backUrl = simulado.agendamentoOrigem
    ? `/estudante/turmas/${simulado.agendamentoOrigem.turmaId}/agendamentos`
    : "/estudante/simulado";
  const backLabel = simulado.agendamentoOrigem ? "Voltar para Simulados" : "Meus Simulados";
  const tituloSimulado = simulado.agendamentoOrigem?.titulo || `Simulado #${simulado.id}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-8 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-5xl mx-auto">

        {/* ── Hero ────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-4">
            <Button asChild variant="ghost" className="text-white hover:bg-white/20 -ml-2">
              <Link href={backUrl}>
                <ArrowLeft size={18} className="mr-2" />
                {backLabel}
              </Link>
            </Button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                    Resultado
                  </Badge>
                  {simulado.agendamentoOrigem?.turma && (
                    <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                      {simulado.agendamentoOrigem.turma.nome}
                    </Badge>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                    {tituloSimulado}
                  </h1>
                  <p className="text-indigo-100 text-base md:text-lg mt-2">
                    {simulado.dataConclusao
                      ? `Finalizado em ${simulado.dataConclusao.toLocaleDateString("pt-BR")}`
                      : "Prova concluída"}
                  </p>
                </div>
              </div>

              {/* Nota destaque */}
              <div
                className={cn(
                  "flex-shrink-0 backdrop-blur-sm border rounded-2xl p-5 text-center shadow-lg min-w-[130px]",
                  isCritical
                    ? "bg-red-500/20 border-red-400/30"
                    : percentual >= 70
                    ? "bg-emerald-500/20 border-emerald-400/30"
                    : "bg-amber-500/20 border-amber-400/30"
                )}
              >
                <Award
                  className={cn(
                    "h-6 w-6 mx-auto mb-1",
                    isCritical ? "text-red-300" : percentual >= 70 ? "text-emerald-300" : "text-amber-300"
                  )}
                />
                <p className="text-white text-4xl font-bold">
                  {acertos}<span className="text-lg font-normal text-white/60">/{total}</span>
                </p>
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider mt-1">
                  Nota Final
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Acertos</p>
                <p className="text-emerald-300 text-2xl font-bold">{acertos}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Erros</p>
                <p className="text-red-300 text-2xl font-bold">{erros}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Respondidas</p>
                <p className="text-white text-2xl font-bold">{simulado.questoesRespondidas}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Tempo</p>
                <p className="text-white text-2xl font-bold">{formatTempo(simulado.tempoGastoSegundos)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatsCard
            icon={Target}
            label="Aproveitamento"
            value={`${percentual}%`}
            gradient={isCritical ? "from-red-500 to-rose-500" : percentual >= 70 ? "from-emerald-500 to-teal-500" : "from-amber-500 to-orange-500"}
            description="Percentual de acertos"
            highlight={isCritical}
          />
          <StatsCard
            icon={CheckCircle2}
            label="Acertos"
            value={String(acertos)}
            gradient="from-emerald-500 to-teal-500"
            description="Questões corretas"
          />
          <StatsCard
            icon={XCircle}
            label="Erros"
            value={String(erros)}
            gradient="from-red-500 to-rose-500"
            description="Questões incorretas"
            highlight={erros > acertos}
          />
          <StatsCard
            icon={Timer}
            label="Tempo"
            value={formatTempo(simulado.tempoGastoSegundos)}
            gradient="from-blue-500 to-cyan-500"
            description="Duração total da prova"
          />
        </div>

        {/* ── Gabarito Detalhado ───────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Gabarito Detalhado</h2>
              <p className="text-sm text-slate-500">
                {acertos} corretas e {erros} incorretas de {total} questões
              </p>
            </div>
          </div>

          <div className="space-y-4 pb-10">
            {simulado.simuladosQuestoes.map((sq, index) => {
              const acertou = sq.correta;
              const questao = sq.questao;
              const alternativasMap = {
                A: questao.alternativaA,
                B: questao.alternativaB,
                C: questao.alternativaC,
                D: questao.alternativaD,
                E: questao.alternativaE,
              };

              return (
                <Card
                  key={sq.id}
                  className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm"
                >
                  {/* Barra de status */}
                  <div
                    className={cn(
                      "h-1.5",
                      acertou
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                        : "bg-gradient-to-r from-red-500 to-rose-500"
                    )}
                  />

                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-2 items-center flex-wrap">
                        <Badge variant="outline" className="bg-white font-bold text-slate-700 border-slate-300">
                          Questão {index + 1}
                        </Badge>
                        {questao.unidadeCurricular && (
                          <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs">
                            {questao.unidadeCurricular.nome}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                          {questao.dificuldade?.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      {acertou ? (
                        <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1.5 px-3 py-1 shadow-sm">
                          <CheckCircle2 size={12} /> Correta
                        </Badge>
                      ) : (
                        <Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white border-0 gap-1.5 px-3 py-1 shadow-sm">
                          <XCircle size={12} /> Incorreta
                        </Badge>
                      )}
                    </div>

                    {/* Enunciado */}
                    <p className="text-slate-800 text-sm leading-relaxed mb-5 whitespace-pre-wrap">
                      {questao.enunciado}
                    </p>

                    {/* Alternativas */}
                    <div className="space-y-2">
                      {(Object.keys(alternativasMap) as Array<keyof typeof alternativasMap>).map(
                        (letra) => {
                          const texto = alternativasMap[letra];
                          const isGabarito = letra === questao.alternativaCorreta?.toUpperCase();
                          const isMarcada = letra === sq.alternativaMarcada;

                          let styleClass = "border-slate-200 bg-white opacity-50";
                          let icon = null;
                          let labelBadge = null;

                          if (isGabarito && isMarcada) {
                            styleClass =
                              "border-emerald-400 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-400 opacity-100";
                            icon = <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />;
                            labelBadge = (
                              <Badge className="bg-emerald-600 text-white text-[10px] uppercase ml-auto shrink-0">
                                Correta
                              </Badge>
                            );
                          } else if (isGabarito) {
                            styleClass =
                              "border-emerald-400 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-400 opacity-100";
                            icon = <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />;
                            labelBadge = (
                              <Badge variant="outline" className="border-emerald-400 text-emerald-600 bg-emerald-50 text-[10px] uppercase font-bold ml-auto shrink-0">
                                Gabarito
                              </Badge>
                            );
                          } else if (isMarcada) {
                            styleClass =
                              "border-red-400 bg-red-50 text-red-900 ring-1 ring-red-400 opacity-100";
                            icon = <XCircle size={16} className="text-red-600 shrink-0" />;
                            labelBadge = (
                              <Badge className="bg-red-500 text-white text-[10px] uppercase ml-auto shrink-0">
                                Sua Resposta
                              </Badge>
                            );
                          }

                          return (
                            <div
                              key={letra}
                              className={cn(
                                "flex items-start gap-3 p-3.5 rounded-xl border text-sm transition-all",
                                styleClass
                              )}
                            >
                              <span
                                className={cn(
                                  "font-bold w-6 shrink-0",
                                  isGabarito
                                    ? "text-emerald-700"
                                    : isMarcada
                                    ? "text-red-700"
                                    : "text-slate-400"
                                )}
                              >
                                {letra})
                              </span>
                              <span className="flex-1">{texto}</span>
                              {icon}
                              {labelBadge}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-center pb-8">
            <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold px-8 py-6">
              <Link href={backUrl}>
                <RotateCcw size={18} />
                {backLabel}
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
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
  value: string;
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-bold text-slate-900 group-hover:scale-105 transition-transform duration-300">
            {value}
          </p>
          <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{label}</p>
          <p className={cn("text-xs font-medium bg-gradient-to-r bg-clip-text text-transparent", gradient)}>
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
