"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation"; // ✅ useSearchParams adicionado
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
import { QuestaoPreviewModal, useQuestaoPreview } from "@/app/(admin)/admin/questoes/QuestaoPreviewModal";

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

export default function MesaMontagemSimuladoPage({ params }: { params: Promise<{ turmaId: string }> }) {
  const { turmaId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams(); // ✅ Hook para ler Query Params
  const secureFetch = useSecureFetch();

  const { previewData, previewOpen, openPreview, closePreview } = useQuestaoPreview();
  
  // ✅ Captura o moduloId da URL (se existir)
  const moduloId = searchParams.get("moduloId") ? parseInt(searchParams.get("moduloId")!) : undefined;

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Estados de Montagem
  const [questoesDisponiveis, setQuestoesDisponiveis] = useState<QuestaoDetalhada[]>([]);
  const [questoesSelecionadas, setQuestoesSelecionadas] = useState<QuestaoDetalhada[]>([]);
  const [loadingQuestoes, setLoadingQuestoes] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [idBusca, setIdBusca] = useState("");

  // Estados dos Filtros Inteligentes
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
    conhecimientos: [] as FiltroOpcao[]
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      dataInicio: new Date(),
      dataFim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 dias
      duracaoMinutos: 60,
    },
  });

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
        newFiltros.funcaoId = "";
        newFiltros.subfuncaoId = "";
        newFiltros.conhecimentoId = "";
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
        turmaId: parseInt(turmaId),
        questaoIds: questoesSelecionadas.map(q => q.id),
        moduloId: moduloId, // ✅ Inclui o moduloId no payload se existir
      };

      const res = await secureFetch(`/api/professor/turmas/${turmaId}/agendamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao criar simulado");
      }

      toast.success(moduloId ? "Simulado criado e vinculado ao módulo!" : "Simulado criado com sucesso!");
      
      // ✅ Redireciona para o local correto dependendo da origem
      if (moduloId) {
         router.push(`/professor/turmas/${turmaId}/conteudo`); // Volta para Módulos
      } else {
         router.push(`/professor/turmas/${turmaId}/simulados`); // Volta para Lista Geral
      }

    } catch (error: any) {
      toast.error(error.message || "Erro ao criar simulado");
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  // Cálculo de estatísticas para o preview
  const calcularEstatisticas = () => {
    const stats = {
      total: questoesSelecionadas.length,
      dificuldades: {} as Record<string, number>,
      niveis: {} as Record<string, number>,
      unidades: {} as Record<string, number>,
    };

    questoesSelecionadas.forEach(q => {
      stats.dificuldades[q.dificuldade] = (stats.dificuldades[q.dificuldade] || 0) + 1;
      stats.niveis[q.nivelCognitivo] = (stats.niveis[q.nivelCognitivo] || 0) + 1;
      
      const unidade = q.unidadeCurricular?.nome || "Sem Unidade";
      stats.unidades[unidade] = (stats.unidades[unidade] || 0) + 1;
    });

    return stats;
  };

  const stats = calcularEstatisticas();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 animate-in fade-in duration-500">
      <div className="max-w-[1800px] mx-auto p-6 md:p-8 lg:p-10 space-y-6">
        
        {/* Header com Steps */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-purple-300 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                     // ✅ Volta inteligente
                     if(moduloId) router.push(`/professor/turmas/${turmaId}/conteudo`);
                     else router.push(`/professor/turmas/${turmaId}/simulados`);
                  }}
                  className="text-white hover:bg-white/20 -ml-2 mb-2"
                >
                  <ArrowLeft size={18} className="mr-2" />
                  Voltar
                </Button>
                <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
                  Criar Novo Simulado
                  {moduloId && (
                     <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-sm font-normal backdrop-blur-sm">
                        Vinculado ao Módulo
                     </Badge>
                  )}
                </h1>
                <p className="text-blue-100 text-base">
                  Configure, monte e revise sua avaliação em 3 etapas simples
                </p>
              </div>
            </div>

            {/* Steps Indicator */}
            <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { num: 1, label: "Configuração" },
                { num: 2, label: "Seleção de Questões" },
                { num: 3, label: "Preview e Confirmação" }
              ].map((step, idx) => (
                <div key={step.num} className="flex items-center gap-4 min-w-fit">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg transition-all shadow-lg",
                      currentStep === step.num 
                        ? "bg-white text-indigo-600 scale-110" 
                        : currentStep > step.num
                        ? "bg-emerald-500 text-white"
                        : "bg-white/20 text-white/60"
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
                      <p className="text-xs text-blue-100">
                        {step.num === 1 && "Dados básicos"}
                        {step.num === 2 && "Monte sua prova"}
                        {step.num === 3 && "Revisar e criar"}
                      </p>
                    </div>
                  </div>
                  {idx < 2 && (
                    <div className={cn(
                      "hidden lg:block h-0.5 w-16 transition-colors",
                      currentStep > step.num ? "bg-emerald-400" : "bg-white/20"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: Configuração */}
        {currentStep === 1 && (
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                Configuração do Simulado
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
                          Título do Simulado *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Ex: Avaliação Final - Matemática Básica"
                            className="h-12 text-base"
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
                          Descrição (Opcional)
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Adicione instruções ou informações importantes para os alunos..."
                            className="min-h-24 text-base resize-none"
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
                            Data e Hora de Início *
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-12 pl-3 text-left font-normal text-base",
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
                                disabled={(date) => date < new Date()}
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
                            Data e Hora de Término *
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-12 pl-3 text-left font-normal text-base",
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
                          Duração da Prova (minutos) *
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <Input 
                              {...field} 
                              type="number"
                              min={10}
                              onChange={e => field.onChange(parseInt(e.target.value))}
                              className="h-12 pl-11 text-base"
                              placeholder="60"
                            />
                          </div>
                        </FormControl>
                        <p className="text-sm text-slate-500">
                          Tempo que cada aluno terá para completar o simulado
                        </p>
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
                      className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 transition-all hover:scale-105"
                    >
                      Próximo: Selecionar Questões
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
          <div className="h-[calc(100vh-280px)] flex gap-6 overflow-hidden animate-in fade-in slide-in-from-right-4">
            
            {/* Sidebar de Filtros */}
            <Card className="w-80 flex-shrink-0 border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden hidden xl:flex xl:flex-col">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50/50 border-b pb-4">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <Filter size={18} />
                    Filtros
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={limparFiltros}
                    className="text-xs h-7 px-2 hover:bg-indigo-100 text-indigo-600"
                  >
                    Limpar
                  </Button>
                </CardTitle>
              </CardHeader>
              <ScrollArea className="h-[calc(100%-80px)]">
                <div className="p-4 space-y-4">
                  {/* Busca por ID */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Hash size={14} />
                      Buscar por ID
                    </label>
                    <Input
                      type="number"
                      value={idBusca}
                      onChange={(e) => setIdBusca(e.target.value)}
                      placeholder="Ex: 1234"
                      className="h-10"
                    />
                  </div>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-500">ou use filtros</span>
                    </div>
                  </div>

                  {/* Busca por Texto */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Search size={14} />
                      Buscar Texto
                    </label>
                    <Input
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      placeholder="Digite para buscar..."
                      disabled={!!idBusca}
                      className="h-10"
                    />
                  </div>

                  {/* Curso */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Curso Técnico</label>
                    <Select 
                      value={filtros.cursoId} 
                      onValueChange={v => handleFiltroChange('cursoId', v)}
                      disabled={!!idBusca}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Todos os cursos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Todos</SelectItem>
                        {opcoes.cursos.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Unidade Curricular */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Unidade Curricular</label>
                    <Select 
                      value={filtros.unidadeId} 
                      onValueChange={v => handleFiltroChange('unidadeId', v)}
                      disabled={!filtros.cursoId || filtros.cursoId === "TODAS" || !!idBusca}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Todas</SelectItem>
                        {opcoes.unidades.map(u => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dificuldade */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Dificuldade</label>
                    <Select 
                      value={filtros.dificuldade} 
                      onValueChange={v => handleFiltroChange('dificuldade', v)}
                      disabled={!!idBusca}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Qualquer" />
                      </SelectTrigger>
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

                  {/* Nível Cognitivo */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Nível Cognitivo</label>
                    <Select 
                      value={filtros.nivelCognitivo} 
                      onValueChange={v => handleFiltroChange('nivelCognitivo', v)}
                      disabled={!!idBusca}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Qualquer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Qualquer</SelectItem>
                        <SelectItem value="LEMBRAR">Lembrar</SelectItem>
                        <SelectItem value="ENTENDER">Entender</SelectItem>
                        <SelectItem value="APLICAR">Aplicar</SelectItem>
                        <SelectItem value="ANALISAR">Analisar</SelectItem>
                        <SelectItem value="AVALIAR">Avaliar</SelectItem>
                        <SelectItem value="CRIAR">Criar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </ScrollArea>
            </Card>

            {/* Área Central - Questões */}
            <Card className="flex-1 border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden flex flex-col">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-indigo-700">
                    <BookOpen size={20} />
                    Banco de Questões
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm px-3 py-1 bg-white shadow-sm text-indigo-600">
                      {questoesDisponiveis.length} encontradas
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                      onClick={() => window.open("/admin/questoes", "_blank")}
                    >
                      <Eye size={14} />
                      <span className="hidden lg:inline">Ver Banco de Questões Completo</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 p-6">
                {loadingQuestoes ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="animate-spin text-4xl mb-4">🔄</div>
                    <p className="text-lg font-medium">Buscando questões...</p>
                  </div>
                ) : questoesDisponiveis.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="p-6 bg-gradient-to-br from-slate-100 to-blue-100/50 rounded-3xl mb-4">
                      <Search size={48} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">
                      Nenhuma questão encontrada
                    </h3>
                    <p className="text-slate-500 text-center max-w-md">
                      Tente ajustar os filtros ou buscar por outros termos
                    </p>
                    {idBusca && (
                      <p className="text-sm text-red-500 mt-2">
                        ID #{idBusca} não encontrado ou inativo
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                    {questoesDisponiveis.map(q => {
                      const isSelected = questoesSelecionadas.some(sel => sel.id === q.id);
                      return (
                        <Card
                          key={q.id}
                          onClick={() => toggleQuestao(q)}
                          className={cn(
                            "group cursor-pointer transition-all duration-300 hover:shadow-lg border-2 relative overflow-hidden",
                            isSelected 
                              ? "border-indigo-500 bg-indigo-50/30 shadow-md" 
                              : "border-slate-200 hover:border-indigo-300"
                          )}
                        >
                          {isSelected && (
                             <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500 rotate-45 translate-x-8 -translate-y-8 z-0"></div>
                          )}
                          <CardContent className="p-5 space-y-3 relative z-10">
                            <div className="flex justify-between items-start">
                              <div className="flex gap-2 flex-wrap items-center">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openPreview(q.id); }}
                                  className="p-1 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                                  title="Visualizar questão"
                                >
                                  <Eye size={14} />
                                </button>
                                <Badge variant="outline" className="font-mono text-slate-500">
                                  #{q.id}
                                </Badge>
                                <Badge 
                                  className={cn(
                                    isSelected 
                                      ? "bg-indigo-600 text-white" 
                                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  )}
                                >
                                  {q.dificuldade}
                                </Badge>
                              </div>
                              <div className={cn(
                                "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                                isSelected 
                                  ? "bg-indigo-600 border-indigo-600" 
                                  : "border-slate-300 group-hover:border-indigo-400"
                              )}>
                                {isSelected && <CheckCircle2 size={16} className="text-white" />}
                              </div>
                            </div>
                            
                            <p className="text-sm text-slate-700 line-clamp-3 leading-relaxed">
                              {q.enunciado}
                            </p>
                            
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-2">
                              {q.unidadeCurricular ? (
                                <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100">
                                  <BookOpen size={12} className="mr-1" />
                                  {q.unidadeCurricular.nome}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-amber-600 bg-amber-50 border-amber-200">
                                  <Target size={12} className="mr-1" />
                                  Sem Unidade
                                </Badge>
                              )}
                            </div>
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
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50/50 border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-emerald-800">
                  <GraduationCap size={20} />
                  Sua Prova
                </CardTitle>
                <div className="flex justify-between text-sm text-slate-600 mt-2">
                  <span className="font-semibold">{questoesSelecionadas.length} questões</span>
                  <span>~{questoesSelecionadas.length * 3} min estimado</span>
                </div>
              </CardHeader>
              
              <ScrollArea className="flex-1 bg-slate-50/50">
                <div className="p-4 space-y-2">
                  {questoesSelecionadas.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <div className="p-4 bg-gradient-to-br from-slate-100 to-blue-100/50 rounded-2xl inline-block mb-3">
                        <PlusCircle size={32} className="text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Clique nas questões ao lado para adicioná-las à prova
                      </p>
                    </div>
                  ) : (
                    questoesSelecionadas.map((q, idx) => (
                      <Card key={q.id} className="group hover:shadow-md transition-all border-slate-200 bg-white">
                        <CardContent className="p-3 flex gap-3">
                          <span className="text-sm font-bold text-slate-400 pt-0.5 w-6 text-center">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700 line-clamp-2 mb-2">
                              {q.enunciado}
                            </p>
                            <div className="flex gap-1 flex-wrap">
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-slate-200 text-slate-500">
                                {q.dificuldade}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-slate-100 text-slate-600">
                                #{q.id}
                              </Badge>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleQuestao(q);
                            }}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1 self-start"
                          >
                            <Trash2 size={16} />
                          </button>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-white space-y-2 shadow-[0_-5px_10px_rgba(0,0,0,0.05)] z-10">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setCurrentStep(1)}
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Voltar
                </Button>
                <Button
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200"
                  onClick={() => setCurrentStep(3)}
                  disabled={questoesSelecionadas.length === 0}
                >
                  Continuar para Preview
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Step 3: Preview */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
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
                
                {/* Dados do Simulado */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText size={20} className="text-indigo-600" />
                    Dados do Simulado
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <InfoCard label="Título" value={form.watch("titulo")} />
                    <InfoCard label="Duração" value={`${form.watch("duracaoMinutos")} minutos`} />
                    <InfoCard 
                      label="Início" 
                      value={format(form.watch("dataInicio"), "PPP 'às' HH:mm", { locale: ptBR })} 
                    />
                    <InfoCard 
                      label="Término" 
                      value={format(form.watch("dataFim"), "PPP 'às' HH:mm", { locale: ptBR })} 
                    />
                  </div>
                  {form.watch("descricao") && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Descrição:</p>
                      <p className="text-sm text-slate-600">{form.watch("descricao")}</p>
                    </div>
                  )}
                </div>

                {/* Estatísticas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 size={20} className="text-purple-600" />
                    Análise das Questões
                  </h3>
                  
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Dificuldades */}
                    <StatCard
                      title="Por Dificuldade"
                      icon={Layers}
                      data={stats.dificuldades}
                      color="blue"
                    />
                    
                    {/* Níveis Cognitivos */}
                    <StatCard
                      title="Por Nível Cognitivo"
                      icon={TrendingUp}
                      data={stats.niveis}
                      color="purple"
                    />
                    
                    {/* Unidades */}
                    <StatCard
                      title="Por Unidade"
                      icon={BookOpen}
                      data={stats.unidades}
                      color="emerald"
                    />
                  </div>
                </div>

                {/* Resumo Total */}
                <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 overflow-hidden relative">
                  <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-white/20 to-transparent"></div>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="p-4 bg-white rounded-2xl shadow-lg">
                        <Sparkles size={32} className="text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Total de Questões</p>
                        <p className="text-4xl font-bold text-indigo-600">{stats.total}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Tempo estimado: ~{stats.total * 3} minutos
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ações */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setCurrentStep(2)}
                    className="flex-1"
                  >
                    <ArrowLeft size={18} className="mr-2" />
                    Voltar para Edição
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => setShowConfirmDialog(true)}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200"
                  >
                    <CheckCircle2 size={18} className="mr-2" />
                    Criar Simulado
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <QuestaoPreviewModal questao={previewData} isOpen={previewOpen} onClose={closePreview}/>

      {/* Dialog de Confirmação */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">
              Confirmar Criação?
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              Você está prestes a criar um simulado com <strong>{questoesSelecionadas.length} questões</strong>.
              {moduloId && (
                 <span className="block mt-2 text-indigo-600 font-medium">
                    Ele será vinculado automaticamente ao módulo atual.
                 </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <CalendarIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900">Período</p>
                <p className="text-blue-700">
                  {format(form.watch("dataInicio"), "dd/MM/yyyy HH:mm")} - {format(form.watch("dataFim"), "dd/MM/yyyy HH:mm")}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <Clock className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-purple-900">Duração</p>
                <p className="text-purple-700">{form.watch("duracaoMinutos")} minutos por aluno</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={loading}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} className="mr-2" />
                  Confirmar e Criar
                </>
              )}
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
    <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-base font-semibold text-slate-900 line-clamp-1" title={value}>{value}</p>
    </div>
  );
}

function StatCard({ 
  title, 
  icon: Icon, 
  data, 
  color 
}: { 
  title: string; 
  icon: any; 
  data: Record<string, number>;
  color: 'blue' | 'purple' | 'emerald';
}) {
  const colors = {
    blue: "from-blue-500 to-cyan-500",
    purple: "from-purple-500 to-pink-500",
    emerald: "from-emerald-500 to-teal-500"
  };

  const total = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    <Card className="border-slate-200 shadow-sm">
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
              <span className="text-slate-600 truncate max-w-[120px]" title={key}>{key}</span>
              <div className="flex items-center gap-2 flex-1 justify-end">
                <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full bg-gradient-to-r", colors[color])}
                    style={{ width: `${(value / total) * 100}%` }}
                  />
                </div>
                <span className="font-semibold text-slate-900 w-6 text-right">{value}</span>
              </div>
            </div>
          ))}
        </div>
        
        {Object.keys(data).length === 0 && (
          <p className="text-xs text-slate-400 text-center py-2 italic">Sem dados disponíveis</p>
        )}
      </CardContent>
    </Card>
  );
}