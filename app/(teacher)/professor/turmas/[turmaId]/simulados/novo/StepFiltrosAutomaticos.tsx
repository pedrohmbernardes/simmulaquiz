"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Filter, Sparkles, Loader2, GraduationCap,
  BookOpen, Layers, TrendingUp, ArrowLeft,
  ArrowRight, AlertCircle, Settings2, Zap,
  Target, ChevronDown, Check, CheckSquare
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";
import { toast } from "sonner";

// ── Tipos ────────────────────────────────────────────────────────
interface FiltroOpcao {
  id: number | string;
  nome: string;
}

interface QuestaoGerada {
  id: number;
  codigo: string | null;
  enunciado: string;
  dificuldade: string;
  nivelCognitivo: string;
  cursoTecnico?: { id: number; nome: string } | null;
  unidadeCurricular?: { id: number; nome: string } | null;
  funcao?: { id: number; nome: string } | null;
  subfuncao?: { id: number; nome: string } | null;
  conhecimento?: { id: number; nome: string } | null;
  subConhecimento?: { id: number; nome: string } | null;
  capacidade?: { id: number; nome: string } | null;
}

// ATUALIZADO: Agora todos os filtros são arrays (multi-select)
interface FiltrosAutoState {
  cursoIds: string[];
  unidadeIds: string[];
  funcaoIds: string[];
  subfuncaoIds: string[];
  conhecimentoIds: string[];
  subConhecimentoIds: string[];
  capacidadeIds: string[];
  dificuldades: string[];
  niveisCognitivos: string[];
}

interface StepFiltrosAutomaticosProps {
  qtdeQuestoes: number;
  onVoltar: () => void;
  onAvancar: (questoes: QuestaoGerada[], filtrosUsados: FiltrosAutoState) => void;
}

export type { QuestaoGerada, FiltrosAutoState };

// Constantes estáticas para Enums
const OPCOES_DIFICULDADE: FiltroOpcao[] = [
  { id: "MUITO_FACIL", nome: "Muito Fácil" },
  { id: "FACIL", nome: "Fácil" },
  { id: "MEDIO", nome: "Médio" },
  { id: "DIFICIL", nome: "Difícil" },
  { id: "MUITO_DIFICIL", nome: "Muito Difícil" },
];

const OPCOES_BLOOM: FiltroOpcao[] = [
  { id: "LEMBRAR", nome: "Lembrar" },
  { id: "ENTENDER", nome: "Entender" },
  { id: "APLICAR", nome: "Aplicar" },
  { id: "ANALISAR", nome: "Analisar" },
  { id: "AVALIAR", nome: "Avaliar" },
  { id: "CRIAR", nome: "Criar" },
];

// ── Componente Principal ─────────────────────────────────────────
export function StepFiltrosAutomaticos({
  qtdeQuestoes,
  onVoltar,
  onAvancar,
}: StepFiltrosAutomaticosProps) {
  const secureFetch = useSecureFetch();

  const [filtros, setFiltros] = useState<FiltrosAutoState>({
    cursoIds: [],
    unidadeIds: [],
    funcaoIds: [],
    subfuncaoIds: [],
    conhecimentoIds: [],
    subConhecimentoIds: [],
    capacidadeIds: [],
    dificuldades: [],
    niveisCognitivos: [],
  });

  const [opcoes, setOpcoes] = useState({
    cursos: [] as FiltroOpcao[],
    unidades: [] as FiltroOpcao[],
    funcoes: [] as FiltroOpcao[],
    subfuncoes: [] as FiltroOpcao[],
    conhecimentos: [] as FiltroOpcao[],
    subConhecimentos: [] as FiltroOpcao[],
    capacidades: [] as FiltroOpcao[],
  });

  const [totalDisponiveis, setTotalDisponiveis] = useState<number | null>(null);
  const [gerando, setGerando] = useState(false);

  // ── Carrega Filtros Cascata (Nova API Multi) ───────────────────
  const fetchFiltros = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtros.cursoIds.length) params.set("cursoIds", filtros.cursoIds.join(","));
      if (filtros.unidadeIds.length) params.set("unidadeIds", filtros.unidadeIds.join(","));
      if (filtros.funcaoIds.length) params.set("funcaoIds", filtros.funcaoIds.join(","));
      if (filtros.subfuncaoIds.length) params.set("subfuncaoIds", filtros.subfuncaoIds.join(","));
      if (filtros.conhecimentoIds.length) params.set("conhecimentoIds", filtros.conhecimentoIds.join(","));
      if (filtros.dificuldades.length) params.set("dificuldades", filtros.dificuldades.join(","));
      if (filtros.niveisCognitivos.length) params.set("niveisCognitivos", filtros.niveisCognitivos.join(","));

      const res = await secureFetch(`/api/questoes/filtros-inteligentes-multi?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOpcoes({
          cursos: data.cursos || [],
          unidades: data.unidades || [],
          funcoes: data.funcoes || [],
          subfuncoes: data.subfuncoes || [],
          conhecimentos: data.conhecimentos || [],
          subConhecimentos: data.subConhecimentos || [],
          capacidades: data.capacidades || [],
        });
        setTotalDisponiveis(data.totalDisponiveis);
      }
    } catch (error) {
      console.error("Erro ao carregar filtros inteligentes", error);
    }
  }, [
    secureFetch,
    filtros.cursoIds,
    filtros.unidadeIds,
    filtros.funcaoIds,
    filtros.subfuncaoIds,
    filtros.conhecimentoIds,
    filtros.dificuldades,
    filtros.niveisCognitivos
  ]);

  useEffect(() => {
    fetchFiltros();
  }, [fetchFiltros]);

  // ── Handlers ───────────────────────────────────────────────────
  const handleFiltroChange = (key: keyof FiltrosAutoState, values: string[]) => {
    setFiltros(prev => {
      const n = { ...prev, [key]: values };

      // Cascata de reset rigorosa
      if (key === "cursoIds") {
        n.unidadeIds = []; n.funcaoIds = []; n.subfuncaoIds = []; n.conhecimentoIds = []; n.subConhecimentoIds = []; n.capacidadeIds = [];
      } else if (key === "unidadeIds") {
        n.funcaoIds = []; n.subfuncaoIds = []; n.conhecimentoIds = []; n.subConhecimentoIds = []; n.capacidadeIds = [];
      } else if (key === "funcaoIds") {
        n.subfuncaoIds = []; n.conhecimentoIds = []; n.subConhecimentoIds = []; n.capacidadeIds = [];
      } else if (key === "subfuncaoIds") {
        n.conhecimentoIds = []; n.subConhecimentoIds = []; n.capacidadeIds = [];
      } else if (key === "conhecimentoIds") {
        n.subConhecimentoIds = []; n.capacidadeIds = [];
      }

      return n;
    });
  };

  const limparFiltros = () => {
    setFiltros({
      cursoIds: [], unidadeIds: [], funcaoIds: [], subfuncaoIds: [],
      conhecimentoIds: [], subConhecimentoIds: [], capacidadeIds: [],
      dificuldades: [], niveisCognitivos: [],
    });
  };

  // Conta filtros ativos verificando se os arrays têm itens
  const filtrosAtivos = Object.values(filtros).reduce((acc, arr) => acc + (arr.length > 0 ? 1 : 0), 0);

  // ── Gerar Questões ─────────────────────────────────────────────
  const handleGerar = async () => {
    setGerando(true);
    try {
      const payload = {
        quantidade: qtdeQuestoes,
        filtros: {
          cursoIds: filtros.cursoIds.map(Number),
          unidadeIds: filtros.unidadeIds.map(Number),
          funcaoIds: filtros.funcaoIds.map(Number),
          subfuncaoIds: filtros.subfuncaoIds.map(Number),
          conhecimentoIds: filtros.conhecimentoIds.map(Number),
          subConhecimentoIds: filtros.subConhecimentoIds.map(Number),
          capacidadeIds: filtros.capacidadeIds.map(Number),
          dificuldades: filtros.dificuldades,
          niveisCognitivos: filtros.niveisCognitivos,
        },
        excluirIds: [],
      };

      const res = await secureFetch("/api/questoes/gerar-automatico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao gerar questões");
      }

      const data = await res.json();

      if (data.questoes.length === 0) {
        toast.error("Nenhuma questão encontrada com esses filtros.", {
          description: "Tente remover algumas restrições.",
        });
        return;
      }

      if (data.meta.insuficiente) {
        toast.warning(
          `Geradas ${data.meta.retornadas} de ${data.meta.solicitadas} questões solicitadas.`,
          { description: "O banco de questões não possui o suficiente para os filtros aplicados." }
        );
      } else {
        toast.success(`${data.meta.retornadas} questões geradas com sucesso!`);
      }

      onAvancar(data.questoes, filtros);
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar questões.");
    } finally {
      setGerando(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      {/* Header de contexto */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-50 via-purple-50/50 to-pink-50/30 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Geração Automática Inteligente</h2>
                <p className="text-sm text-slate-600">
                  Defina os filtros. O sistema distribuirá as <strong className="text-indigo-600">{qtdeQuestoes} questões</strong> proporcionalmente.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {totalDisponiveis !== null && (
                <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-700 text-sm px-4 py-2 shadow-sm">
                  <Layers size={14} className="mr-2 text-indigo-500" />
                  {totalDisponiveis} disponíveis no banco
                </Badge>
              )}
              <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 text-sm px-4 py-2 shadow-md">
                <Target size={14} className="mr-2" />
                Alvo: {qtdeQuestoes} questões
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Painel de Filtros */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50/50 border-b">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
                <Filter className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-slate-900">Filtros Pedagógicos (Múltipla Seleção)</span>
                {filtrosAtivos > 0 && (
                  <Badge className="ml-3 bg-indigo-600 text-white text-xs">
                    {filtrosAtivos} eixo{filtrosAtivos > 1 ? "s" : ""} ativo{filtrosAtivos > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={limparFiltros}
              className="text-xs hover:bg-indigo-100 text-indigo-600"
            >
              Limpar Todos
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 md:p-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

            <MultiSelect
              label="Cursos Técnicos"
              icon={GraduationCap}
              values={filtros.cursoIds}
              onChange={(v) => handleFiltroChange("cursoIds", v)}
              options={opcoes.cursos}
              placeholder="Selecionar Cursos..."
            />

            <MultiSelect
              label="Unidades Curriculares"
              icon={BookOpen}
              values={filtros.unidadeIds}
              onChange={(v) => handleFiltroChange("unidadeIds", v)}
              options={opcoes.unidades}
              placeholder="Selecionar UCs..."
              disabled={filtros.cursoIds.length === 0}
            />

            <MultiSelect
              label="Funções"
              icon={Settings2}
              values={filtros.funcaoIds}
              onChange={(v) => handleFiltroChange("funcaoIds", v)}
              options={opcoes.funcoes}
              placeholder="Selecionar Funções..."
              disabled={filtros.unidadeIds.length === 0}
            />

            <MultiSelect
              label="Subfunções"
              icon={Settings2}
              values={filtros.subfuncaoIds}
              onChange={(v) => handleFiltroChange("subfuncaoIds", v)}
              options={opcoes.subfuncoes}
              placeholder="Selecionar Subfunções..."
              disabled={filtros.funcaoIds.length === 0}
            />

            <MultiSelect
              label="Objetos de Conhecimento"
              icon={Layers}
              values={filtros.conhecimentoIds}
              onChange={(v) => handleFiltroChange("conhecimentoIds", v)}
              options={opcoes.conhecimentos}
              placeholder="Selecionar Objetos..."
              disabled={filtros.subfuncaoIds.length === 0}
            />

            <MultiSelect
              label="Dificuldades"
              icon={Target}
              values={filtros.dificuldades}
              onChange={(v) => handleFiltroChange("dificuldades", v)}
              options={OPCOES_DIFICULDADE}
              placeholder="Qualquer dificuldade"
            />

            <MultiSelect
              label="Níveis Cognitivos (Bloom)"
              icon={TrendingUp}
              values={filtros.niveisCognitivos}
              onChange={(v) => handleFiltroChange("niveisCognitivos", v)}
              options={OPCOES_BLOOM}
              placeholder="Qualquer nível"
            />
          </div>

          {/* Nota informativa */}
          {filtrosAtivos === 0 && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Nenhum filtro selecionado</p>
                  <p className="text-xs text-amber-700 leading-relaxed mt-1">
                    O sistema buscará em todo o banco. Para uma prova distribuída proporcionalmente, selecione Múltiplas Unidades Curriculares e/ou Múltiplas Dificuldades.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t">
            <Button variant="outline" size="lg" onClick={onVoltar} className="flex-1 sm:flex-none">
              <ArrowLeft size={18} className="mr-2" /> Voltar
            </Button>

            <Button
              size="lg"
              onClick={handleGerar}
              disabled={gerando || totalDisponiveis === 0}
              className="flex-1 gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all text-base font-semibold"
            >
              {gerando ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Processando distribuição...</>
              ) : (
                <><Sparkles size={20} /> Gerar {qtdeQuestoes} Questões <ArrowRight size={18} /></>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Componente Customizado: MultiSelect ──────────────────────────
function MultiSelect({
  label,
  icon: Icon,
  values,
  onChange,
  placeholder,
  options,
  disabled = false,
}: {
  label: string;
  icon: any;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  options: FiltroOpcao[];
  disabled?: boolean;
}) {
  const toggleItem = (id: string) => {
    if (values.includes(id)) {
      onChange(values.filter((v) => v !== id));
    } else {
      onChange([...values, id]);
    }
  };

  const selectAll = () => {
    if (values.length === options.length) {
      onChange([]); // Unselect all
    } else {
      onChange(options.map(o => String(o.id))); // Select all
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Icon size={14} className="text-slate-500" />
        {label}
      </label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled || options.length === 0}
            className={cn(
              "w-full justify-between h-11 bg-white border-slate-200 hover:bg-slate-50 font-normal transition-all",
              values.length === 0 ? "text-slate-500" : "text-slate-900 border-indigo-300 ring-1 ring-indigo-50/50"
            )}
          >
            <span className="truncate mr-2">
              {values.length === 0
                ? options.length === 0 ? "Indisponível" : placeholder
                : values.length === 1
                  ? options.find((o) => String(o.id) === values[0])?.nome
                  : `${values.length} itens selecionados`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 shadow-xl border-slate-200" align="start">
          <div className="p-2 border-b bg-slate-50/50 flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-500 px-2 uppercase tracking-wide">
              {options.length} opções
            </span>
            <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2">
               {values.length === options.length ? "Desmarcar Todos" : "Selecionar Todos"}
            </Button>
          </div>
          <ScrollArea className="max-h-[280px]">
            <div className="p-1">
              {options.map((opcao) => {
                const isSelected = values.includes(String(opcao.id));
                return (
                  <div
                    key={opcao.id}
                    onClick={() => toggleItem(String(opcao.id))}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors text-sm",
                      isSelected ? "bg-indigo-50 text-indigo-900 font-medium" : "hover:bg-slate-100 text-slate-700"
                    )}
                  >
                    <Checkbox 
                       checked={isSelected} 
                       className={cn(isSelected && "border-indigo-600 bg-indigo-600 text-white")}
                    />
                    <span className="line-clamp-2">{opcao.nome}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}