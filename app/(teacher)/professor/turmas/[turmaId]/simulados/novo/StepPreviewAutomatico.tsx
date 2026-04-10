"use client";

import { useState, useMemo } from "react";
import {
  ArrowLeft, CheckCircle2, Trash2, Eye, RefreshCw,
  Sparkles, BarChart3, Layers, TrendingUp, BookOpen,
  FileText, AlertCircle, Loader2, Search, PlusCircle,
  GraduationCap, Target, Settings2, Hash, X, Filter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";
import { toast } from "sonner";

import type { QuestaoGerada, FiltrosAutoState } from "./StepFiltrosAutomaticos";

// ── Props ────────────────────────────────────────────────────────
interface StepPreviewAutomaticoProps {
  questoes: QuestaoGerada[];
  filtrosUsados: FiltrosAutoState;
  formData: {
    titulo: string;
    descricao?: string;
    dataInicio: Date;
    dataFim: Date;
    duracaoMinutos: number;
    qtdeQuestoes: number;
  };
  onVoltar: () => void;
  onConfirmar: (questoesFinais: QuestaoGerada[]) => void;
  onQuestoesChange: (questoes: QuestaoGerada[]) => void;
  openPreview?: (id: number) => void;
}

// ── Labels de Filtro ─────────────────────────────────────────────
const DIFICULDADE_LABELS: Record<string, string> = {
  MUITO_FACIL: "Muito Fácil", FACIL: "Fácil", MEDIO: "Médio",
  DIFICIL: "Difícil", MUITO_DIFICIL: "Muito Difícil",
};
const BLOOM_LABELS: Record<string, string> = {
  LEMBRAR: "Lembrar", ENTENDER: "Entender", APLICAR: "Aplicar",
  ANALISAR: "Analisar", AVALIAR: "Avaliar", CRIAR: "Criar",
};

// ── Componente ───────────────────────────────────────────────────
export function StepPreviewAutomatico({
  questoes,
  filtrosUsados,
  formData,
  onVoltar,
  onConfirmar,
  onQuestoesChange,
  openPreview,
}: StepPreviewAutomaticoProps) {
  const secureFetch = useSecureFetch();

  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [regenerando, setRegenerando] = useState(false);
  const [idsExcluidos, setIdsExcluidos] = useState<Set<number>>(new Set());

  // ── Mini buscador manual ───────────────────────────────────────
  const [buscaManualAberta, setBuscaManualAberta] = useState(false);
  const [termoBuscaManual, setTermoBuscaManual] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<QuestaoGerada[]>([]);
  const [buscandoManual, setBuscandoManual] = useState(false);

  // ── Estatísticas ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = {
      total: questoes.length,
      dificuldades: {} as Record<string, number>,
      niveis: {} as Record<string, number>,
      unidades: {} as Record<string, number>,
      cursos: {} as Record<string, number>,
    };
    questoes.forEach(q => {
      const dif = q.dificuldade || "Não definida";
      s.dificuldades[dif] = (s.dificuldades[dif] || 0) + 1;

      const niv = q.nivelCognitivo || "Não definido";
      s.niveis[niv] = (s.niveis[niv] || 0) + 1;

      const uc = q.unidadeCurricular?.nome || "Sem Unidade";
      s.unidades[uc] = (s.unidades[uc] || 0) + 1;

      const curso = q.cursoTecnico?.nome || "Sem Curso";
      s.cursos[curso] = (s.cursos[curso] || 0) + 1;
    });
    return s;
  }, [questoes]);

  // ── Filtros ativos (para exibição com suporte a Multi-Select) ──
  const filtrosAtivosDisplay = useMemo(() => {
    const items: { label: string; valor: string }[] = [];
    
    if (filtrosUsados.dificuldades?.length) {
      filtrosUsados.dificuldades.forEach(d => {
        items.push({ label: "Dificuldade", valor: DIFICULDADE_LABELS[d] || d });
      });
    }

    if (filtrosUsados.niveisCognitivos?.length) {
      filtrosUsados.niveisCognitivos.forEach(n => {
        items.push({ label: "Nível Cognitivo", valor: BLOOM_LABELS[n] || n });
      });
    }

    if (filtrosUsados.cursoIds?.length) {
      filtrosUsados.cursoIds.forEach(idStr => {
        const id = parseInt(idStr);
        const q = questoes.find(q => q.cursoTecnico?.id === id);
        items.push({ label: "Curso", valor: q?.cursoTecnico?.nome || `ID ${id}` });
      });
    }

    if (filtrosUsados.unidadeIds?.length) {
      filtrosUsados.unidadeIds.forEach(idStr => {
        const id = parseInt(idStr);
        const q = questoes.find(q => q.unidadeCurricular?.id === id);
        items.push({ label: "Unidade", valor: q?.unidadeCurricular?.nome || `ID ${id}` });
      });
    }

    if (filtrosUsados.funcaoIds?.length) {
      filtrosUsados.funcaoIds.forEach(idStr => {
        const id = parseInt(idStr);
        const q = questoes.find(q => q.funcao?.id === id);
        items.push({ label: "Função", valor: q?.funcao?.nome || `ID ${id}` });
      });
    }

    if (filtrosUsados.conhecimentoIds?.length) {
      filtrosUsados.conhecimentoIds.forEach(idStr => {
        const id = parseInt(idStr);
        const q = questoes.find(q => q.conhecimento?.id === id);
        items.push({ label: "Conhecimento", valor: q?.conhecimento?.nome || `ID ${id}` });
      });
    }

    return items;
  }, [filtrosUsados, questoes]);

  // ── Toggle seleção ─────────────────────────────────────────────
  const toggleSelecionada = (id: number) => {
    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodas = () => {
    if (selecionadas.size === questoes.length) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(questoes.map(q => q.id)));
    }
  };

  // ── Remover Questões ───────────────────────────────────────────
  const removerQuestao = (id: number) => {
    setIdsExcluidos(prev => new Set(prev).add(id));
    setSelecionadas(prev => { const n = new Set(prev); n.delete(id); return n; });
    onQuestoesChange(questoes.filter(q => q.id !== id));
  };

  const removerSelecionadas = () => {
    if (selecionadas.size === 0) return;
    const novosExcluidos = new Set(idsExcluidos);
    selecionadas.forEach(id => novosExcluidos.add(id));
    setIdsExcluidos(novosExcluidos);
    onQuestoesChange(questoes.filter(q => !selecionadas.has(q.id)));
    setSelecionadas(new Set());
  };

  // ── Regenerar Questões (Multi-select format) ───────────────────
  const qtdeFaltando = formData.qtdeQuestoes - questoes.length;

  const handleRegenerar = async (quantidade?: number) => {
    const qtde = quantidade || qtdeFaltando;
    if (qtde <= 0) return;

    setRegenerando(true);
    try {
      const todosExcluidos = [
        ...questoes.map(q => q.id),
        ...Array.from(idsExcluidos),
      ];

      const payload = {
        quantidade: qtde,
        filtros: {
          cursoIds: filtrosUsados.cursoIds.map(Number),
          unidadeIds: filtrosUsados.unidadeIds.map(Number),
          funcaoIds: filtrosUsados.funcaoIds.map(Number),
          subfuncaoIds: filtrosUsados.subfuncaoIds.map(Number),
          conhecimentoIds: filtrosUsados.conhecimentoIds.map(Number),
          subConhecimentoIds: filtrosUsados.subConhecimentoIds.map(Number),
          capacidadeIds: filtrosUsados.capacidadeIds.map(Number),
          dificuldades: filtrosUsados.dificuldades,
          niveisCognitivos: filtrosUsados.niveisCognitivos,
        },
        excluirIds: todosExcluidos,
      };

      const res = await secureFetch("/api/questoes/gerar-automatico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao regenerar questões");
      }

      const data = await res.json();

      if (data.questoes.length === 0) {
        toast.error("Não há mais questões disponíveis com esses filtros.");
        return;
      }

      const novasQuestoes = [...questoes, ...data.questoes];
      onQuestoesChange(novasQuestoes);

      if (data.meta.insuficiente) {
        toast.warning(
          `Apenas ${data.meta.retornadas} de ${qtde} questões extras encontradas.`,
          { description: "O banco não possui mais questões com esses filtros." }
        );
      } else {
        toast.success(`${data.meta.retornadas} novas questões adicionadas!`);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao regenerar questões.");
    } finally {
      setRegenerando(false);
    }
  };

  // ── Busca Manual ───────────────────────────────────────────────
  const buscarManual = async () => {
    if (!termoBuscaManual.trim()) return;
    setBuscandoManual(true);
    try {
      const params = new URLSearchParams({ termo: termoBuscaManual });
      const res = await secureFetch(`/api/questoes/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data.data || [];
        const idsAtuais = new Set(questoes.map(q => q.id));
        setResultadosBusca(arr.filter((q: any) => !idsAtuais.has(q.id)));
      }
    } catch {
      toast.error("Erro ao buscar questões");
    } finally {
      setBuscandoManual(false);
    }
  };

  const adicionarManual = (q: QuestaoGerada) => {
    onQuestoesChange([...questoes, q]);
    setResultadosBusca(prev => prev.filter(r => r.id !== q.id));
    toast.success(`Questão #${q.id} adicionada!`);
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">

      {/* ── Resumo dos Filtros Usados ──────────────────────────── */}
      {filtrosAtivosDisplay.length > 0 && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-50 via-purple-50/30 to-pink-50/20 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-indigo-100 rounded-lg">
                <Filter size={14} className="text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Filtros Aplicados</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {filtrosAtivosDisplay.map((f, i) => (
                <Badge key={i} className="bg-white border border-indigo-200 text-indigo-700 text-xs px-3 py-1.5 shadow-sm">
                  <span className="text-indigo-400 mr-1.5">{f.label}:</span>
                  {f.valor}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Dados do Simulado ──────────────────────────────────── */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50/50 border-b">
          <CardTitle className="flex items-center gap-3 text-purple-800">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Eye className="h-5 w-5 text-white" />
            </div>
            Preview e Confirmação
          </CardTitle>
        </CardHeader>

        <CardContent className="p-8 space-y-8">

          {/* Info Cards */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText size={20} className="text-indigo-600" />
              Dados do Simulado
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoCard label="Título" value={formData.titulo} />
              <InfoCard label="Duração" value={`${formData.duracaoMinutos} minutos`} />
              <InfoCard label="Questões" value={`${questoes.length} / ${formData.qtdeQuestoes}`} />
              <InfoCard
                label="Status"
                value={questoes.length >= formData.qtdeQuestoes ? "Completo" : `Faltam ${qtdeFaltando}`}
                alert={questoes.length < formData.qtdeQuestoes}
              />
            </div>
          </div>

          {/* ── Análise das Questões ───────────────────────────── */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 size={20} className="text-purple-600" />
              Análise da Composição
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Por Dificuldade" icon={Layers} data={stats.dificuldades} color="blue" />
              <StatCard title="Por Nível Cognitivo" icon={TrendingUp} data={stats.niveis} color="purple" />
              <StatCard title="Por Unidade" icon={BookOpen} data={stats.unidades} color="emerald" />
              <StatCard title="Por Curso" icon={GraduationCap} data={stats.cursos} color="pink" />
            </div>
          </div>

          {/* ── Barra de Ações de Questões ─────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles size={20} className="text-indigo-600" />
                Questões Geradas
                <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-200 ml-2">
                  {questoes.length}
                </Badge>
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleTodas}
                  className="text-xs"
                >
                  {selecionadas.size === questoes.length ? "Desmarcar Todas" : "Selecionar Todas"}
                </Button>

                {selecionadas.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={removerSelecionadas}
                    className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 size={14} className="mr-1" />
                    Remover {selecionadas.size} selecionada{selecionadas.size > 1 ? "s" : ""}
                  </Button>
                )}

                {qtdeFaltando > 0 && (
                  <Button
                    size="sm"
                    onClick={() => handleRegenerar()}
                    disabled={regenerando}
                    className="text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  >
                    {regenerando ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : (
                      <RefreshCw size={14} className="mr-1" />
                    )}
                    Gerar +{qtdeFaltando} questões
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBuscaManualAberta(!buscaManualAberta)}
                  className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <PlusCircle size={14} className="mr-1" />
                  Adicionar Manual
                </Button>
              </div>
            </div>

            {/* ── Mini Buscador Manual ─────────────────────────── */}
            {buscaManualAberta && (
              <Card className="border border-emerald-200 bg-emerald-50/30 animate-in fade-in slide-in-from-top-2">
                <CardContent className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={termoBuscaManual}
                      onChange={e => setTermoBuscaManual(e.target.value)}
                      placeholder="Buscar questão por texto ou enunciado..."
                      className="flex-1"
                      onKeyDown={e => e.key === "Enter" && buscarManual()}
                    />
                    <Button onClick={buscarManual} disabled={buscandoManual} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                      {buscandoManual ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setBuscaManualAberta(false); setResultadosBusca([]); setTermoBuscaManual(""); }}>
                      <X size={14} />
                    </Button>
                  </div>

                  {resultadosBusca.length > 0 && (
                    <ScrollArea className="max-h-48">
                      <div className="space-y-2">
                        {resultadosBusca.map(q => (
                          <div key={q.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-emerald-300 transition-all">
                            <div className="flex-1 min-w-0">
                              <div className="flex gap-2 items-center mb-1">
                                <Badge variant="outline" className="text-[10px] font-mono">#{q.id}</Badge>
                                <Badge className="text-[10px] bg-slate-100 text-slate-600">{q.dificuldade}</Badge>
                              </div>
                              <p className="text-xs text-slate-700 line-clamp-2">{q.enunciado}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => adicionarManual(q)} className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex-shrink-0">
                              <PlusCircle size={12} className="mr-1" /> Adicionar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  {resultadosBusca.length === 0 && termoBuscaManual && !buscandoManual && (
                    <p className="text-xs text-slate-500 text-center py-2">Nenhuma questão encontrada</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Lista de Questões ────────────────────────────── */}
            <div className="space-y-3">
              {questoes.map((q, idx) => (
                <Card
                  key={q.id}
                  className={cn(
                    "overflow-hidden border transition-all",
                    selecionadas.has(q.id)
                      ? "border-indigo-300 bg-indigo-50/30 shadow-md"
                      : "border-slate-200 bg-white/80 shadow-sm hover:shadow-md"
                  )}
                >
                  <div className={cn(
                    "h-1",
                    q.dificuldade === "MUITO_FACIL" || q.dificuldade === "FACIL"
                      ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                      : q.dificuldade === "MEDIO"
                      ? "bg-gradient-to-r from-amber-400 to-yellow-400"
                      : "bg-gradient-to-r from-red-400 to-rose-400"
                  )} />

                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="pt-1">
                        <Checkbox
                          checked={selecionadas.has(q.id)}
                          onCheckedChange={() => toggleSelecionada(q.id)}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-400 pt-0.5 w-6 text-center flex-shrink-0">
                        {idx + 1}.
                      </span>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-slate-500 text-[10px]">#{q.id}</Badge>
                          <Badge className={cn("text-[10px] border", getDificuldadeStyle(q.dificuldade))}>
                            {DIFICULDADE_LABELS[q.dificuldade] || q.dificuldade}
                          </Badge>
                          <Badge className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
                            {BLOOM_LABELS[q.nivelCognitivo] || q.nivelCognitivo}
                          </Badge>
                          {q.unidadeCurricular && (
                            <Badge className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                              {q.unidadeCurricular.nome}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">
                          {q.enunciado}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {openPreview && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => openPreview(q.id)}>
                            <Eye size={14} />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => removerQuestao(q.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {questoes.length === 0 && (
              <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50">
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <h4 className="text-lg font-bold text-slate-700">Nenhuma questão</h4>
                  <p className="text-sm text-slate-500 mt-1">
                    Todas as questões foram removidas. Use "Gerar" ou "Adicionar Manual" para continuar.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Resumo Total ───────────────────────────────────── */}
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 overflow-hidden relative">
            <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-white/20 to-transparent" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-4 bg-white rounded-2xl shadow-lg">
                  <Sparkles size={32} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Total de Questões</p>
                  <p className="text-4xl font-bold text-indigo-600">
                    {questoes.length}
                    {questoes.length !== formData.qtdeQuestoes && (
                      <span className="text-lg text-slate-400 ml-2">/ {formData.qtdeQuestoes}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Tempo estimado: ~{questoes.length * 3} minutos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Ações Finais ───────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
            <Button variant="outline" size="lg" onClick={onVoltar} className="flex-1">
              <ArrowLeft size={18} className="mr-2" />
              Voltar para Filtros
            </Button>
            <Button
              size="lg"
              onClick={() => onConfirmar(questoes)}
              disabled={questoes.length === 0}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200"
            >
              <CheckCircle2 size={18} className="mr-2" />
              Criar Simulado ({questoes.length} questões)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────
function getDificuldadeStyle(d: string): string {
  switch (d) {
    case "MUITO_FACIL": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "FACIL": return "bg-green-50 text-green-700 border-green-200";
    case "MEDIO": return "bg-amber-50 text-amber-700 border-amber-200";
    case "DIFICIL": return "bg-orange-50 text-orange-700 border-orange-200";
    case "MUITO_DIFICIL": return "bg-red-50 text-red-700 border-red-200";
    default: return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function InfoCard({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={cn(
      "p-4 rounded-xl border",
      alert
        ? "bg-amber-50 border-amber-200"
        : "bg-gradient-to-br from-slate-50 to-blue-50/30 border-slate-200"
    )}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={cn("text-base font-semibold line-clamp-1", alert ? "text-amber-700" : "text-slate-900")} title={value}>
        {value}
      </p>
    </div>
  );
}

function StatCard({
  title, icon: Icon, data, color,
}: {
  title: string; icon: any; data: Record<string, number>;
  color: "blue" | "purple" | "emerald" | "pink";
}) {
  const colors = {
    blue: "from-blue-500 to-cyan-500",
    purple: "from-purple-500 to-pink-500",
    emerald: "from-emerald-500 to-teal-500",
    pink: "from-pink-500 to-rose-500",
  };

  const total = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg bg-gradient-to-br", colors[color])}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <h4 className="font-semibold text-xs text-slate-900">{title}</h4>
        </div>
        <div className="space-y-1.5">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center text-xs">
              <span className="text-slate-600 truncate max-w-[100px]" title={key}>{key}</span>
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                <div className="h-1.5 w-12 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full bg-gradient-to-r", colors[color])}
                    style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}
                  />
                </div>
                <span className="font-semibold text-slate-900 w-5 text-right">{value}</span>
              </div>
            </div>
          ))}
        </div>
        {Object.keys(data).length === 0 && (
          <p className="text-[10px] text-slate-400 text-center py-1 italic">Sem dados</p>
        )}
      </CardContent>
    </Card>
  );
}