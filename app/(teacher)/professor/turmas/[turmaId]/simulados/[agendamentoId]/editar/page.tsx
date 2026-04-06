"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  Search, Filter, Calendar as CalendarIcon, Clock, 
  ArrowLeft, PlusCircle, Trash2, CheckCircle2,
  BookOpen, Target, GraduationCap, Hash,
  ArrowRight, Eye, Sparkles, AlertCircle,
  BarChart3, Layers, TrendingUp, FileText,
  Pencil, Save, History
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

// --- SCHEMAS E TIPOS ---
const formSchema = z.object({
  titulo: z.string().min(3, "Título obrigatório"),
  descricao: z.string().optional(),
  dataInicio: z.date(),
  dataFim: z.date(),
  duracaoMinutos: z.number().min(10, "Mínimo 10 minutos"),
});

type FormValues = z.infer<typeof formSchema>;

interface QuestaoDetalhada {
  id: number;
  enunciado: string;
  dificuldade: string;
  nivelCognitivo: string;
  codigo: string | null;
  unidadeCurricular?: { nome: string };
  cursoTecnico?: { nome: string };
}

interface FiltroOpcao {
  id: number;
  nome: string;
}

type Step = 1 | 2 | 3;

interface PageProps {
  params: Promise<{ turmaId: string; agendamentoId: string }>;
}

export default function EditarSimuladoPage({ params }: PageProps) {
  const { turmaId, agendamentoId } = use(params);
  const router = useRouter();
  const secureFetch = useSecureFetch();
  
  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Estados de Montagem
  const [questoesDisponiveis, setQuestoesDisponiveis] = useState<QuestaoDetalhada[]>([]);
  const [questoesSelecionadas, setQuestoesSelecionadas] = useState<QuestaoDetalhada[]>([]);
  const [loadingQuestoes, setLoadingQuestoes] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [idBusca, setIdBusca] = useState("");

  // Estados dos Filtros
  const [filtros, setFiltros] = useState({
    cursoId: "",
    unidadeId: "",
    funcaoId: "",
    subfuncaoId: "",
    conhecimentoId: "",
    dificuldade: "",
    nivelCognitivo: ""
  });

  const [opcoes, setOpcoes] = useState({
    cursos: [] as FiltroOpcao[],
    unidades: [] as FiltroOpcao[],
    funcoes: [] as FiltroOpcao[],
    subfuncoes: [] as FiltroOpcao[],
    conhecimentos: [] as FiltroOpcao[]
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      dataInicio: new Date(),
      dataFim: new Date(),
      duracaoMinutos: 60,
    },
  });

  // --- CARREGAR DADOS INICIAIS (EDIÇÃO) ---
  useEffect(() => {
    async function loadSimuladoData() {
      try {
        const res = await secureFetch(`/api/professor/turmas/${turmaId}/agendamentos/${agendamentoId}`);
        if (!res.ok) throw new Error("Erro ao carregar simulado");
        
        const data = await res.json();
        
        // Popula o formulário
        form.reset({
          titulo: data.titulo,
          descricao: data.descricao || "",
          dataInicio: new Date(data.dataInicio),
          dataFim: new Date(data.dataFim),
          duracaoMinutos: data.duracaoMinutos,
        });

        // Popula as questões já selecionadas
        // (Assumindo que a API retorna 'questoes' com a estrutura correta)
        if (data.questoes) {
          const questoesFormatadas = data.questoes.map((q: any) => ({
            id: q.questao.id,
            enunciado: q.questao.enunciado,
            dificuldade: q.questao.dificuldade,
            nivelCognitivo: q.questao.nivelCognitivo,
            codigo: q.questao.codigo,
            unidadeCurricular: q.questao.unidadeCurricular,
            cursoTecnico: q.questao.cursoTecnico
          }));
          setQuestoesSelecionadas(questoesFormatadas);
        }

      } catch (error) {
        toast.error("Não foi possível carregar os dados do simulado.");
        router.push(`/professor/turmas/${turmaId}/simulados`);
      } finally {
        setLoadingData(false);
      }
    }

    loadSimuladoData();
  }, [agendamentoId, turmaId, secureFetch, form, router]);

  // --- CARREGAMENTO DE FILTROS ---
  const fetchFiltros = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtros.cursoId && filtros.cursoId !== "TODAS") params.set("cursoId", filtros.cursoId);
      if (filtros.unidadeId && filtros.unidadeId !== "TODAS") params.set("unidadeId", filtros.unidadeId);
      
      const res = await secureFetch(`/api/questoes/filtros-inteligentes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOpcoes(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error("Erro filtros", error);
    }
  }, [secureFetch, filtros.cursoId, filtros.unidadeId]);

  useEffect(() => {
    if (currentStep === 2) {
      fetchFiltros();
    }
  }, [fetchFiltros, currentStep]);

  // --- BUSCA DE QUESTÕES ---
  const fetchQuestoes = useCallback(async () => {
    setLoadingQuestoes(true);
    try {
      const params = new URLSearchParams();
      
      if (idBusca) {
        params.set("id", idBusca);
      } else {
        if (termoBusca) params.set("termo", termoBusca);
        Object.entries(filtros).forEach(([key, value]) => {
          if (value && value !== "TODAS") params.set(key, value);
        });
      }

      const res = await secureFetch(`/api/questoes/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQuestoesDisponiveis(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      toast.error("Erro ao buscar questões");
    } finally {
      setLoadingQuestoes(false);
    }
  }, [secureFetch, termoBusca, filtros, idBusca]);

  useEffect(() => {
    if (currentStep === 2) {
      const timer = setTimeout(fetchQuestoes, 500);
      return () => clearTimeout(timer);
    }
  }, [fetchQuestoes, currentStep]);

  // --- HANDLERS ---
  const handleFiltroChange = (key: string, value: string) => {
    setFiltros(prev => {
      const newFiltros = { ...prev, [key]: value };
      if (key === "cursoId") {
        newFiltros.unidadeId = "";
      }
      return newFiltros;
    });
  };

  const limparFiltros = () => {
    setFiltros({
      cursoId: "",
      unidadeId: "",
      funcaoId: "",
      subfuncaoId: "",
      conhecimentoId: "",
      dificuldade: "",
      nivelCognitivo: ""
    });
    setTermoBusca("");
    setIdBusca("");
  };

  const toggleQuestao = (questao: QuestaoDetalhada) => {
    setQuestoesSelecionadas(prev => {
      const exists = prev.find(q => q.id === questao.id);
      if (exists) {
        return prev.filter(q => q.id !== questao.id);
      }
      return [...prev, questao];
    });
  };

  const onSubmit = async (data: FormValues) => {
    if (questoesSelecionadas.length === 0) {
      toast.error("Selecione pelo menos uma questão");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...data,
        questaoIds: questoesSelecionadas.map(q => q.id),
      };

      // MUDANÇA: PATCH em vez de POST
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/agendamentos/${agendamentoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao atualizar simulado");
      }

      toast.success("Simulado atualizado com sucesso!");
      router.push(`/professor/turmas/${turmaId}/simulados`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar simulado");
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const stats = (() => {
    const s = {
      total: questoesSelecionadas.length,
      dificuldades: {} as Record<string, number>,
      niveis: {} as Record<string, number>,
      unidades: {} as Record<string, number>,
    };
    questoesSelecionadas.forEach(q => {
      s.dificuldades[q.dificuldade] = (s.dificuldades[q.dificuldade] || 0) + 1;
      s.niveis[q.nivelCognitivo] = (s.niveis[q.nivelCognitivo] || 0) + 1;
      const unidade = q.unidadeCurricular?.nome || "Sem Unidade";
      s.unidades[unidade] = (s.unidades[unidade] || 0) + 1;
    });
    return s;
  })();

  if (loadingData) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 animate-pulse">Carregando dados do simulado...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-slate-50">
      <div className="max-w-[1800px] mx-auto p-6 md:p-8 lg:p-10 space-y-6">
        
        {/* CARD DE ALERTA DE EDIÇÃO */}
        <div className="bg-amber-100/80 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-full text-white">
              <Pencil size={20} />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-lg">Modo de Edição</h3>
              <p className="text-amber-700 text-sm">
                Você está alterando um simulado existente. As mudanças podem afetar relatórios futuros.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 px-3 py-1">
            ID: {agendamentoId}
          </Badge>
        </div>

        {/* Header com Steps (Cor alterada para Amber/Orange) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 p-8 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-yellow-300 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  onClick={() => router.push(`/professor/turmas/${turmaId}/simulados`)}
                  className="text-white hover:bg-white/20 -ml-2 mb-2"
                >
                  <ArrowLeft size={18} className="mr-2" />
                  Cancelar Edição
                </Button>
                <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
                  <History className="h-8 w-8 text-white/80" />
                  Editar Simulado
                </h1>
                <p className="text-orange-50 text-base">
                  Atualize configurações, prazos e o banco de questões desta avaliação.
                </p>
              </div>
            </div>

            {/* Steps Indicator */}
            <div className="flex items-center gap-4">
              {[
                { num: 1, label: "Configuração" },
                { num: 2, label: "Seleção de Questões" },
                { num: 3, label: "Revisar e Salvar" }
              ].map((step, idx) => (
                <div key={step.num} className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg transition-all shadow-lg",
                      currentStep === step.num 
                        ? "bg-white text-orange-600 scale-110" 
                        : currentStep > step.num
                        ? "bg-amber-800 text-white border border-white/20"
                        : "bg-black/20 text-white/60"
                    )}>
                      {currentStep > step.num ? <CheckCircle2 size={24} /> : step.num}
                    </div>
                    <div className="hidden md:block">
                      <p className={cn(
                        "font-semibold transition-colors",
                        currentStep >= step.num ? "text-white" : "text-white/60"
                      )}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                  {idx < 2 && (
                    <div className={cn(
                      "hidden lg:block h-0.5 w-16 transition-colors",
                      currentStep > step.num ? "bg-amber-300" : "bg-white/20"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: Configuração */}
        {currentStep === 1 && (
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50/50 border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                Configuração Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <Form {...form}>
                <form className="space-y-6 max-w-3xl">
                  <FormField
                    control={form.control}
                    name="titulo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold text-slate-900">
                          Título do Simulado
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-12 text-base border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold text-slate-900">
                          Descrição
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            className="min-h-24 text-base resize-none border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="dataInicio"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-base font-semibold text-slate-900">
                            Início
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-12 pl-3 text-left font-normal text-base border-amber-200",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP 'às' HH:mm", { locale: ptBR })
                                  ) : (
                                    <span>Selecione a data</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                locale={ptBR}
                                initialFocus
                              />
                              <div className="p-3 border-t">
                                <Input
                                  type="time"
                                  value={field.value ? format(field.value, "HH:mm") : ""}
                                  onChange={(e) => {
                                    const [hours, minutes] = e.target.value.split(":");
                                    const newDate = new Date(field.value || new Date());
                                    newDate.setHours(parseInt(hours), parseInt(minutes));
                                    field.onChange(newDate);
                                  }}
                                  className="h-10"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dataFim"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-base font-semibold text-slate-900">
                            Término
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-12 pl-3 text-left font-normal text-base border-amber-200",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP 'às' HH:mm", { locale: ptBR })
                                  ) : (
                                    <span>Selecione a data</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                locale={ptBR}
                                disabled={(date) => date < (form.watch("dataInicio") || new Date())}
                                initialFocus
                              />
                              <div className="p-3 border-t">
                                <Input
                                  type="time"
                                  value={field.value ? format(field.value, "HH:mm") : ""}
                                  onChange={(e) => {
                                    const [hours, minutes] = e.target.value.split(":");
                                    const newDate = new Date(field.value || new Date());
                                    newDate.setHours(parseInt(hours), parseInt(minutes));
                                    field.onChange(newDate);
                                  }}
                                  className="h-10"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="duracaoMinutos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold text-slate-900">
                          Duração (minutos)
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <Input 
                              {...field} 
                              type="number"
                              min={10}
                              onChange={e => field.onChange(parseInt(e.target.value))}
                              className="h-12 pl-11 text-base border-amber-200"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-6">
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => {
                        form.trigger().then(isValid => {
                          if (isValid) setCurrentStep(2);
                        });
                      }}
                      className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 px-8 text-white"
                    >
                      Próximo: Revisar Questões
                      <ArrowRight size={18} />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Seleção de Questões */}
        {currentStep === 2 && (
          <div className="h-[calc(100vh-280px)] flex gap-6 overflow-hidden">
            {/* ... Sidebar de Filtros (Igual ao create) ... */}
            <Card className="w-80 flex-shrink-0 border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50/50 border-b pb-4">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter size={18} />
                    Filtros
                  </div>
                  <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-xs h-7 px-2">Limpar</Button>
                </CardTitle>
              </CardHeader>
              <ScrollArea className="h-[calc(100%-80px)]">
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Hash size={14}/> ID</label>
                    <Input type="number" value={idBusca} onChange={(e) => setIdBusca(e.target.value)} placeholder="Ex: 1234" className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Search size={14}/> Texto</label>
                    <Input value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} placeholder="Buscar..." disabled={!!idBusca} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Curso</label>
                    <Select value={filtros.cursoId} onValueChange={v => handleFiltroChange('cursoId', v)} disabled={!!idBusca}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Todos</SelectItem>
                        {opcoes.cursos.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Dificuldade</label>
                    <Select value={filtros.dificuldade} onValueChange={v => handleFiltroChange('dificuldade', v)} disabled={!!idBusca}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Qualquer</SelectItem>
                        <SelectItem value="MUITO_FACIL">Muito Fácil</SelectItem>
                        <SelectItem value="FACIL">Fácil</SelectItem>
                        <SelectItem value="MEDIO">Médio</SelectItem>
                        <SelectItem value="DIFICIL">Difícil</SelectItem>
                        <SelectItem value="MUITO_DIFICIL">Muito Difícil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </ScrollArea>
            </Card>

            {/* Área Central - Questões */}
            <Card className="flex-1 border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden flex flex-col">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-amber-50/50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen size={20} />
                    Banco de Questões
                  </CardTitle>
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {questoesDisponiveis.length} encontradas
                  </Badge>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 p-6">
                {loadingQuestoes ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="animate-spin text-4xl mb-4">🔄</div>
                    <p className="text-lg font-medium">Buscando questões...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {questoesDisponiveis.map(q => {
                      const isSelected = questoesSelecionadas.some(sel => sel.id === q.id);
                      return (
                        <Card
                          key={q.id}
                          onClick={() => toggleQuestao(q)}
                          className={cn(
                            "group cursor-pointer transition-all duration-300 hover:shadow-lg border-2",
                            isSelected 
                              ? "border-amber-500 bg-amber-50/50 shadow-md" 
                              : "border-slate-200 hover:border-amber-300"
                          )}
                        >
                          <CardContent className="p-5 space-y-3">
                            <div className="flex justify-between items-start">
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant="outline" className="font-mono">#{q.id}</Badge>
                                <Badge className={cn(isSelected ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-700")}>
                                  {q.dificuldade}
                                </Badge>
                              </div>
                              <div className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all", isSelected ? "bg-amber-600 border-amber-600" : "border-slate-300 group-hover:border-amber-400")}>
                                {isSelected && <CheckCircle2 size={16} className="text-white" />}
                              </div>
                            </div>
                            <p className="text-sm text-slate-700 line-clamp-3 leading-relaxed">{q.enunciado}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </Card>

            {/* Sidebar Resumo */}
            <Card className="w-96 flex-shrink-0 border-0 shadow-xl bg-white overflow-hidden flex flex-col">
              <CardHeader className="bg-gradient-to-r from-amber-100 to-orange-100/50 border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <GraduationCap size={20} />
                  Em Edição
                </CardTitle>
                <div className="flex justify-between text-sm text-amber-800 mt-2">
                  <span className="font-semibold">{questoesSelecionadas.length} questões</span>
                  <span>~{questoesSelecionadas.length * 3} min</span>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 bg-amber-50/30">
                <div className="p-4 space-y-2">
                  {questoesSelecionadas.map((q, idx) => (
                    <Card key={q.id} className="group hover:shadow-md transition-all border-amber-100">
                      <CardContent className="p-3 flex gap-3">
                        <span className="text-sm font-bold text-amber-400 pt-0.5">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 line-clamp-2 mb-2">{q.enunciado}</p>
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-amber-200 text-amber-700">{q.dificuldade}</Badge>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); toggleQuestao(q); }} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                          <Trash2 size={16} />
                        </button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 border-t bg-white space-y-2">
                <Button variant="outline" className="w-full" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft size={16} className="mr-2" /> Voltar
                </Button>
                <Button className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white" onClick={() => setCurrentStep(3)} disabled={questoesSelecionadas.length === 0}>
                  Continuar
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Step 3: Preview */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50/50 border-b">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl">
                    <Eye className="h-5 w-5 text-white" />
                  </div>
                  Revisar Alterações
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                
                {/* Dados do Simulado */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText size={20} className="text-amber-600" />
                    Dados Atualizados
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <InfoCard label="Título" value={form.watch("titulo")} />
                    <InfoCard label="Duração" value={`${form.watch("duracaoMinutos")} minutos`} />
                    <InfoCard label="Início" value={format(form.watch("dataInicio"), "PPP 'às' HH:mm", { locale: ptBR })} />
                    <InfoCard label="Término" value={format(form.watch("dataFim"), "PPP 'às' HH:mm", { locale: ptBR })} />
                  </div>
                </div>

                {/* Estatísticas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 size={20} className="text-amber-600" />
                    Nova Composição
                  </h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <StatCard title="Por Dificuldade" icon={Layers} data={stats.dificuldades} color="amber" />
                    <StatCard title="Por Nível Cognitivo" icon={TrendingUp} data={stats.niveis} color="orange" />
                    <StatCard title="Por Unidade" icon={BookOpen} data={stats.unidades} color="amber" />
                  </div>
                </div>

                {/* Resumo Total */}
                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-white rounded-2xl shadow-lg">
                        <Sparkles size={32} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Novo Total de Questões</p>
                        <p className="text-4xl font-bold text-amber-600">{stats.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ações */}
                <div className="flex gap-4 pt-4">
                  <Button variant="outline" size="lg" onClick={() => setCurrentStep(2)} className="flex-1">
                    <ArrowLeft size={18} className="mr-2" /> Voltar
                  </Button>
                  <Button size="lg" onClick={() => setShowConfirmDialog(true)} className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white">
                    <Save size={18} className="mr-2" />
                    Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Dialog de Confirmação */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md border-amber-200">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-amber-100 rounded-2xl">
                <AlertCircle className="h-12 w-12 text-amber-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl text-amber-900">
              Confirmar Edição?
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              Ao salvar, a configuração antiga será substituída. Alunos que ainda não iniciaram verão a nova versão.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={loading} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={loading} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white">
              {loading ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full" /> : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componentes Auxiliares
function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-200">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function StatCard({ title, icon: Icon, data, color }: { title: string; icon: any; data: Record<string, number>; color: 'amber' | 'orange' }) {
  const colors = {
    amber: "from-amber-500 to-yellow-500",
    orange: "from-orange-500 to-red-500"
  };
  const total = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    <Card className="border-slate-200">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-lg bg-gradient-to-br", colors[color])}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <h4 className="font-semibold text-sm text-slate-900">{title}</h4>
        </div>
        <div className="space-y-2">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center text-sm">
              <span className="text-slate-600 truncate">{key}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full bg-gradient-to-r", colors[color])} style={{ width: `${(value / total) * 100}%` }} />
                </div>
                <span className="font-semibold text-slate-900 w-8 text-right">{value}</span>
              </div>
            </div>
          ))}
        </div>
        {Object.keys(data).length === 0 && <p className="text-xs text-slate-400 text-center py-2">Sem dados</p>}
      </CardContent>
    </Card>
  );
}