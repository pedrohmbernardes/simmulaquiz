"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Users, Target, Clock, TrendingUp, AlertTriangle,
  CheckCircle2, Award, BarChart3, Brain, Layers, Eye,
  Loader2, FileText, XCircle, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface KPIItem {
  label: string;
  percentual: number;
  totalQuestoes: number;
}

interface AlunoResultado {
  id: number;
  simuladoId: number;
  nome: string;
  email: string;
  fotoUrl: string | null;
  nota: number;
  percentual: number;
  tempo: number;
  dataEntrega: string;
}

interface RelatorioData {
  resumo: {
    mediaAcertos: number;
    mediaPercentual: number;
    totalEntregues: number;
    totalIniciaram: number;
    questoesProva: number;
    melhorNota: number;
    piorNota: number;
  };
  kpis: {
    dificuldade: KPIItem[];
    bloom: KPIItem[];
    unidade: KPIItem[];
  };
  alunos: AlunoResultado[];
}

export default function RelatorioSimuladoPage({
  params,
}: {
  params: Promise<{ turmaId: string; agendamentoId: string }>;
}) {
  const { turmaId, agendamentoId } = use(params);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  const [data, setData] = useState<RelatorioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await secureFetch(
          `/api/professor/turmas/${turmaId}/agendamentos/${agendamentoId}/relatorio`
        );
        if (!res.ok) throw new Error("Falha ao carregar dados");
        const json = await res.json();
        setData(json);
      } catch (error) {
        toast.error("Erro ao carregar relatório.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [secureFetch, turmaId, agendamentoId]);

  const formatTempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    return `${min} min`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
          <div className="relative p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
            <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" />
          </div>
        </div>
        <p className="text-slate-500 mt-6 font-medium">Compilando estatísticas da turma...</p>
      </div>
    );
  }

  if (!data) return null;

  const pontosAtencao = data.kpis.unidade.filter((u) => u.percentual < 60);
  const pontosGraves = data.kpis.unidade.filter((u) => u.percentual < 40);
  const mediaEhCritica = data.resumo.mediaPercentual < 50;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-8 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">

        {/* ── Hero ────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-4">
            <Button
              variant="ghost"
              onClick={() => router.push(`/professor/turmas/${turmaId}/simulados`)}
              className="text-white hover:bg-white/20 -ml-2"
            >
              <ArrowLeft size={18} className="mr-2" />
              Voltar para Simulados
            </Button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                    Relatório
                  </Badge>
                  {mediaEhCritica && data.resumo.totalEntregues > 0 && (
                    <Badge className="bg-red-500/80 backdrop-blur-sm text-white border-red-400/30 gap-1.5 pl-2">
                      <AlertTriangle size={12} />
                      Atenção Crítica
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                  Relatório de Desempenho
                </h1>
                <p className="text-indigo-100 text-base md:text-lg max-w-2xl">
                  Análise detalhada da turma com indicadores de desempenho em tempo real
                </p>
              </div>

              {/* Média destaque */}
              <div
                className={cn(
                  "flex-shrink-0 backdrop-blur-sm border rounded-2xl p-5 text-center shadow-lg min-w-[130px]",
                  mediaEhCritica && data.resumo.totalEntregues > 0
                    ? "bg-red-500/20 border-red-400/30"
                    : "bg-white/15 border-white/25"
                )}
              >
                <p
                  className={cn(
                    "text-4xl font-bold",
                    mediaEhCritica && data.resumo.totalEntregues > 0 ? "text-red-200" : "text-white"
                  )}
                >
                  {data.resumo.mediaPercentual}%
                </p>
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider mt-1">
                  Média Geral
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Entregues</p>
                <p className="text-white text-2xl font-bold">{data.resumo.totalEntregues}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Iniciaram</p>
                <p className="text-white text-2xl font-bold">{data.resumo.totalIniciaram}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Média Acertos</p>
                <p className="text-white text-2xl font-bold">
                  {data.resumo.mediaAcertos}
                  <span className="text-sm font-normal text-indigo-200 ml-1">/{data.resumo.questoesProva}</span>
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Melhor Nota</p>
                <p className="text-emerald-300 text-2xl font-bold">{data.resumo.melhorNota}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Pior Nota</p>
                <p className={cn("text-2xl font-bold", data.resumo.piorNota < data.resumo.questoesProva * 0.5 ? "text-red-300" : "text-white")}>
                  {data.resumo.piorNota}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatsCard
            icon={TrendingUp}
            label="Média da Turma"
            value={`${data.resumo.mediaPercentual}%`}
            gradient="from-indigo-500 to-purple-500"
            description="Aproveitamento geral"
            highlight={mediaEhCritica && data.resumo.totalEntregues > 0}
          />
          <StatsCard
            icon={Users}
            label="Entregues"
            value={String(data.resumo.totalEntregues)}
            gradient="from-emerald-500 to-teal-500"
            description="Alunos finalizaram"
          />
          <StatsCard
            icon={CheckCircle2}
            label="Média Acertos"
            value={`${data.resumo.mediaAcertos}/${data.resumo.questoesProva}`}
            gradient="from-blue-500 to-cyan-500"
            description="Questões corretas por aluno"
          />
          <StatsCard
            icon={AlertTriangle}
            label="Pontos de Atenção"
            value={String(pontosAtencao.length)}
            gradient="from-amber-500 to-orange-500"
            description="Competências abaixo de 60%"
            highlight={pontosGraves.length > 0}
          />
        </div>

        {/* ── Alerta Severo (se aplicável) ─────────────────── */}
        {pontosGraves.length > 0 && data.resumo.totalEntregues > 0 && (
          <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <div className="h-1.5 bg-gradient-to-r from-red-500 to-rose-500" />
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-red-500 to-rose-500 rounded-2xl shadow-lg flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Alerta de Desempenho Crítico</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {pontosGraves.length} competência{pontosGraves.length !== 1 ? "s" : ""} com aproveitamento
                      abaixo de 40%. Considere revisão urgente desses tópicos.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pontosGraves.map((ponto, i) => (
                      <Badge
                        key={i}
                        className="bg-red-50 text-red-700 border border-red-200 gap-1.5 px-3 py-1"
                      >
                        <XCircle size={12} />
                        {ponto.label} ({ponto.percentual}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Grid Principal ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Desempenho por Unidade Curricular (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Desempenho por Unidade Curricular</h2>
                    <p className="text-sm text-slate-500">Identifique quais matérias precisam de reforço</p>
                  </div>
                </div>

                {data.kpis.unidade.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">Dados insuficientes para análise.</p>
                ) : (
                  <div className="space-y-5">
                    {data.kpis.unidade.map((item, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700 truncate max-w-[300px]" title={item.label}>
                              {item.label}
                            </span>
                            {item.percentual < 40 && (
                              <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px] px-1.5 py-0 gap-1">
                                <AlertTriangle size={10} /> Crítico
                              </Badge>
                            )}
                            {item.percentual >= 40 && item.percentual < 60 && (
                              <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] px-1.5 py-0">
                                Atenção
                              </Badge>
                            )}
                          </div>
                          <span
                            className={cn(
                              "font-bold text-sm",
                              item.percentual < 40
                                ? "text-red-600"
                                : item.percentual < 60
                                ? "text-amber-600"
                                : "text-emerald-600"
                            )}
                          >
                            {item.percentual}%
                          </span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              item.percentual < 40
                                ? "bg-gradient-to-r from-red-500 to-rose-500"
                                : item.percentual < 60
                                ? "bg-gradient-to-r from-amber-400 to-orange-400"
                                : item.percentual < 80
                                ? "bg-gradient-to-r from-blue-400 to-indigo-400"
                                : "bg-gradient-to-r from-emerald-500 to-teal-500"
                            )}
                            style={{ width: `${item.percentual}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Baseado em {item.totalQuestoes} questões
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dificuldade + Bloom lado a lado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <KPICard
                icon={Layers}
                title="Por Dificuldade"
                gradient="from-blue-500 to-cyan-500"
                items={data.kpis.dificuldade}
              />
              <KPICard
                icon={Brain}
                title="Nível Cognitivo (Bloom)"
                gradient="from-purple-500 to-pink-500"
                items={data.kpis.bloom}
              />
            </div>
          </div>

          {/* Ranking de Alunos (1/3) */}
          <div className="lg:col-span-1">
            <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm h-full">
              <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-400 rounded-xl shadow-lg">
                    <Award className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Ranking</h2>
                    <p className="text-sm text-slate-500">{data.alunos.length} aluno{data.alunos.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                {data.alunos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full blur-2xl opacity-20 animate-pulse" />
                      <div className="relative p-5 bg-gradient-to-br from-amber-100 to-orange-100 rounded-3xl">
                        <Users className="h-10 w-10 text-amber-600" />
                      </div>
                    </div>
                    <p className="text-slate-500 text-sm">Nenhum aluno finalizou ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.alunos.map((aluno, idx) => {
                      const isMedal = idx < 3;
                      const medalColors = [
                        "from-amber-400 to-yellow-500 text-amber-900",
                        "from-slate-300 to-gray-400 text-slate-700",
                        "from-amber-600 to-orange-700 text-amber-100",
                      ];

                      return (
                        <Link
                          key={aluno.id}
                          href={`/professor/turmas/${turmaId}/simulados/${agendamentoId}/resultados/${aluno.simuladoId}`}
                          className="block group"
                        >
                          <div
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group-hover:bg-slate-50 group-hover:shadow-sm",
                              aluno.percentual < 40 && "bg-red-50/50"
                            )}
                          >
                            {/* Posição */}
                            <div className="w-8 flex justify-center flex-shrink-0">
                              {isMedal ? (
                                <div
                                  className={cn(
                                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br shadow-sm",
                                    medalColors[idx]
                                  )}
                                >
                                  {idx + 1}
                                </div>
                              ) : (
                                <span className="text-sm font-bold text-slate-400">{idx + 1}º</span>
                              )}
                            </div>

                            {/* Avatar */}
                            <Avatar className="h-9 w-9 ring-2 ring-slate-100 flex-shrink-0">
                              <AvatarImage src={aluno.fotoUrl || ""} />
                              <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-xs font-bold">
                                {aluno.nome.charAt(0)}
                              </AvatarFallback>
                            </Avatar>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                                {aluno.nome}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <Clock size={10} /> {formatTempo(aluno.tempo)}
                              </div>
                            </div>

                            {/* Nota */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-xs font-bold",
                                  aluno.percentual >= 70
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : aluno.percentual >= 50
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-red-50 text-red-700 border border-red-200"
                                )}
                              >
                                {aluno.nota}/{data.resumo.questoesProva}
                              </div>
                              <ChevronRight
                                size={14}
                                className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all"
                              />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
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

// ── KPICard ──────────────────────────────────────────────────
function KPICard({
  icon: Icon,
  title,
  gradient,
  items,
}: {
  icon: React.ElementType;
  title: string;
  gradient: string;
  items: KPIItem[];
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <div className={cn("h-1.5 bg-gradient-to-r", gradient)} />
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className={cn("p-2 bg-gradient-to-br rounded-xl shadow-lg", gradient)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
        </div>

        {items.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">Sem dados.</p>
        ) : (
          <div className="space-y-4">
            {items.map((kpi, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm gap-3">
                <span className="text-slate-600 truncate flex-1">{kpi.label}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        kpi.percentual < 50
                          ? "bg-red-400"
                          : kpi.percentual < 75
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                      )}
                      style={{ width: `${kpi.percentual}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "font-bold w-10 text-right",
                      kpi.percentual < 50 ? "text-red-600" : kpi.percentual < 75 ? "text-amber-600" : "text-emerald-600"
                    )}
                  >
                    {kpi.percentual}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
