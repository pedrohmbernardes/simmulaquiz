"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock,
  Calendar, Award, User, FileText, Target,
  Loader2, Layers,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface QuestaoResultado {
  questaoId: number;
  enunciado: string;
  alternativas: { A: string; B: string; C: string; D: string; E: string };
  suaResposta: string;
  gabarito: string;
  acertou: boolean;
  disciplina: string;
  dificuldade: string;
}

interface SimuladoDetalhado {
  id: number;
  titulo: string;
  aluno: string;
  email: string;
  dataConclusao: string;
  status: string;
  desempenho: {
    nota: number;
    acertos: number;
    erros: number;
    totalQuestoes: number;
    tempoGasto: number;
    aproveitamento: number;
  };
  questoes: QuestaoResultado[];
}

export default function ResultadoAlunoPage({
  params,
}: {
  params: Promise<{ turmaId: string; agendamentoId: string; simuladoId: string }>;
}) {
  const { turmaId, agendamentoId, simuladoId } = use(params);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  const [data, setData] = useState<SimuladoDetalhado | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await secureFetch(
          `/api/professor/turmas/${turmaId}/agendamentos/${agendamentoId}/resultados/${simuladoId}`
        );
        if (!res.ok) throw new Error("Erro ao buscar prova");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error(error);
        toast.error("Não foi possível carregar a prova do aluno.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [secureFetch, turmaId, agendamentoId, simuladoId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
          <div className="relative p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
            <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" />
          </div>
        </div>
        <p className="text-slate-500 mt-6 font-medium">Carregando espelho da prova...</p>
      </div>
    );
  }

  if (!data) return null;

  const formatTempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    return `${min}m ${sec}s`;
  };

  const aproveitamento = data.desempenho.aproveitamento;
  const isCritical = aproveitamento < 50;

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
            <Button
              variant="ghost"
              onClick={() => router.push(`/professor/turmas/${turmaId}/simulados/${agendamentoId}/relatorio`)}
              className="text-white hover:bg-white/20 -ml-2"
            >
              <ArrowLeft size={18} className="mr-2" />
              Voltar para Relatório
            </Button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                    Espelho da Prova
                  </Badge>
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white">{data.titulo}</h1>
                  <div className="flex items-center gap-3 mt-2 text-indigo-100">
                    <span className="flex items-center gap-1.5">
                      <User size={14} /> {data.aluno}
                    </span>
                    <span className="text-white/40">•</span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} /> {formatTempo(data.desempenho.tempoGasto)}
                    </span>
                    {data.dataConclusao && (
                      <>
                        <span className="text-white/40">•</span>
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          {format(new Date(data.dataConclusao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Nota destaque */}
              <div
                className={cn(
                  "flex-shrink-0 backdrop-blur-sm border rounded-2xl p-5 text-center shadow-lg min-w-[130px]",
                  isCritical
                    ? "bg-red-500/20 border-red-400/30"
                    : aproveitamento >= 70
                    ? "bg-emerald-500/20 border-emerald-400/30"
                    : "bg-amber-500/20 border-amber-400/30"
                )}
              >
                <Award
                  className={cn(
                    "h-6 w-6 mx-auto mb-1",
                    isCritical ? "text-red-300" : aproveitamento >= 70 ? "text-emerald-300" : "text-amber-300"
                  )}
                />
                <p className="text-white text-3xl font-bold">{aproveitamento}%</p>
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider mt-1">Aproveitamento</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Acertos</p>
                <p className="text-emerald-300 text-2xl font-bold">{data.desempenho.acertos}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Erros</p>
                <p className="text-red-300 text-2xl font-bold">{data.desempenho.erros}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Total</p>
                <p className="text-white text-2xl font-bold">{data.desempenho.totalQuestoes}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Nota</p>
                <p className="text-white text-2xl font-bold">{data.desempenho.nota}<span className="text-sm text-indigo-200 ml-1">/100</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Lista de Questões ───────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Questões da Prova</h2>
              <p className="text-sm text-slate-500">
                {data.desempenho.acertos} corretas e {data.desempenho.erros} incorretas de {data.desempenho.totalQuestoes}
              </p>
            </div>
          </div>

          <div className="space-y-4 pb-10">
            {data.questoes.map((q, idx) => (
              <Card
                key={q.questaoId}
                className={cn(
                  "overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm"
                )}
              >
                {/* Barra de status */}
                <div
                  className={cn(
                    "h-1.5",
                    q.acertou
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : "bg-gradient-to-r from-red-500 to-rose-500"
                  )}
                />

                <CardContent className="p-6">
                  {/* Header da questão */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Badge variant="outline" className="bg-white font-bold text-slate-700 border-slate-300">
                        Questão {idx + 1}
                      </Badge>
                      <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs">
                        {q.disciplina}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                        {q.dificuldade.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    {q.acertou ? (
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
                    {q.enunciado}
                  </p>

                  {/* Alternativas */}
                  <div className="space-y-2">
                    {Object.entries(q.alternativas).map(([letra, texto]) => {
                      const isGabarito = letra === q.gabarito;
                      const isMarcada = letra === q.suaResposta;

                      let styleClass = "border-slate-200 bg-white opacity-50";
                      let icon = null;

                      if (isGabarito) {
                        styleClass =
                          "border-emerald-400 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-400 opacity-100";
                        icon = <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />;
                      } else if (isMarcada) {
                        styleClass =
                          "border-red-400 bg-red-50 text-red-900 ring-1 ring-red-400 opacity-100";
                        icon = <XCircle size={16} className="text-red-600 shrink-0" />;
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
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
