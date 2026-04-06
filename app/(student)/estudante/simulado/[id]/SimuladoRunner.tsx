"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, ChevronRight, Clock, CheckCircle2, 
  Save, AlertTriangle 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface Alternativas {
  A: string;
  B: string;
  C: string;
  D: string;
  E: string;
}

interface QuestaoRunner {
  id: number;          
  questaoId: number;   
  enunciado: string;
  alternativas: Alternativas;
  alternativaMarcada: string | null;
}

interface SimuladoData {
  id: number;
  titulo: string;
  dataInicio: string;
  tempoLimiteMinutos: number;
  questoes: QuestaoRunner[]; 
  prazoFinalAbsoluto?: string | null;
}

export function SimuladoRunner({ simulado }: { simulado: SimuladoData }) {
  const router = useRouter();
  const secureFetch = useSecureFetch();
  
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [tempoRestante, setTempoRestante] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Inicializa respostas
  useEffect(() => {
    const map: Record<number, string> = {};
    simulado.questoes.forEach(q => {
      if (q.alternativaMarcada) map[q.questaoId] = q.alternativaMarcada;
    });
    setRespostas(map);
  }, [simulado]);

  // ✅ Proteção contra saída acidental (Atualizar/Fechar aba)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (loading) return; // Se já está enviando, não bloqueia
      e.preventDefault();
      e.returnValue = ''; // Mensagem padrão do navegador
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading]);

  const finalizarSimulado = useCallback(async (forcado = false) => {
    if (loading) return;
    setLoading(true);
    
    if (forcado) toast.warning("Tempo esgotado! Enviando respostas...");
    else toast.info("Finalizando prova...");

    try {
      const res = await secureFetch("/api/estudante/simulado/finalizar", {
        method: "POST",
        body: { simuladoId: simulado.id }
      });

      if (res.ok) {
        // Remove listener antes de redirecionar para não alertar
        window.onbeforeunload = null;
        router.push(`/estudante/simulado/${simulado.id}/resultado`);
        router.refresh();
      } else {
        throw new Error("Falha ao finalizar");
      }
    } catch (error) {
      toast.error("Erro ao finalizar. Tente novamente.");
      setLoading(false);
    }
  }, [loading, router, simulado.id, secureFetch]);

  // CRONÔMETRO
  useEffect(() => {
    const inicioMs = new Date(simulado.dataInicio).getTime();
    const duracaoMs = simulado.tempoLimiteMinutos * 60 * 1000;
    let fimAbsolutoMs = inicioMs + duracaoMs;

    if (simulado.prazoFinalAbsoluto) {
      const prazoTurmaMs = new Date(simulado.prazoFinalAbsoluto).getTime();
      if (prazoTurmaMs < fimAbsolutoMs) {
        fimAbsolutoMs = prazoTurmaMs;
      }
    }

    const tick = () => {
      const agora = Date.now();
      const diffSegundos = Math.floor((fimAbsolutoMs - agora) / 1000);

      if (diffSegundos <= 0) {
        setTempoRestante(0);
        finalizarSimulado(true);
        return true;
      } else {
        setTempoRestante(diffSegundos);
        return false;
      }
    };

    if (tick()) return;

    const interval = setInterval(() => {
      const deveParar = tick();
      if (deveParar) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [simulado, finalizarSimulado]);

  const formatTempo = (segundos: number | null) => {
    if (segundos === null) return "--:--";
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const questaoAtualObj = simulado.questoes[indiceAtual];

  const handleSelecionar = async (alternativa: string) => {
    setRespostas(prev => ({ ...prev, [questaoAtualObj.questaoId]: alternativa }));

    try {
      await secureFetch("/api/estudante/simulado/resposta", {
        method: "POST",
        body: {
          simuladoId: simulado.id,
          questaoId: questaoAtualObj.questaoId,
          alternativa
        }
      });
    } catch (error) {
      console.error("Erro ao salvar resposta silenciosamente");
    }
  };

  const totalQuestoes = simulado.questoes.length;
  const respondidasCount = Object.keys(respostas).length;
  const progresso = (respondidasCount / totalQuestoes) * 100;

  return (
    <div className="flex flex-col h-screen bg-slate-50 select-none">
      
      {/* HEADER FIXO */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm h-16">
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{simulado.titulo}</h1>
              {simulado.prazoFinalAbsoluto && (
                <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 h-5">
                  Avaliação
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="font-mono">Questão {indiceAtual + 1} de {totalQuestoes}</span>
            </div>
          </div>
          <div className="md:hidden w-24">
             <Progress value={progresso} className="h-2" />
          </div>
        </div>

        <div className={cn(
          "flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-bold text-lg tabular-nums border shadow-sm transition-colors",
          (tempoRestante !== null && tempoRestante < 300) ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-slate-100 text-slate-700 border-slate-200"
        )}>
          <Clock size={18} />
          {formatTempo(tempoRestante)}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={loading} className={cn("font-bold gap-2 transition-colors", respondidasCount === totalQuestoes ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700")}>
              {loading ? <Clock className="animate-spin" /> : (respondidasCount === totalQuestoes ? <CheckCircle2 size={18} /> : <Save size={18} />)}
              <span className="hidden md:inline">{respondidasCount === totalQuestoes ? "Entregar Prova" : "Finalizar"}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalizar Avaliação?</AlertDialogTitle>
              <AlertDialogDescription>
                Você respondeu {respondidasCount} de {totalQuestoes} questões. 
                <br/>
                <span className="font-bold text-slate-700">Atenção:</span> Ao confirmar, você não poderá alterar suas respostas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Revisar</AlertDialogCancel>
              <AlertDialogAction disabled={loading} onClick={() => finalizarSimulado(false)} className="bg-indigo-600">
                Confirmar Entrega
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      {/* RESTO DO LAYOUT (MANTIDO IGUAL) */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR DE NAVEGAÇÃO */}
        <aside className="hidden md:flex w-[280px] bg-white border-r flex-col">
          <div className="p-4 border-b">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mapa da Prova</h3>
            <Progress value={progresso} className="h-2" />
            <p className="text-right text-xs text-slate-500 mt-1">{respondidasCount}/{totalQuestoes} respondidas</p>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-4 gap-2">
              {simulado.questoes.map((q, idx) => {
                const respondida = !!respostas[q.questaoId];
                const atual = idx === indiceAtual;
                return (
                  <button
                    key={q.id}
                    onClick={() => setIndiceAtual(idx)}
                    className={cn(
                      "h-10 w-full rounded-md text-sm font-bold border transition-all flex items-center justify-center",
                      atual 
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200" 
                        : respondida 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* ÁREA DA QUESTÃO */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <ScrollArea className="flex-1 p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-8 pb-20">
              
              <div className="space-y-4">
                <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                  Questão {indiceAtual + 1}
                </span>
                <div className="prose prose-lg prose-slate max-w-none text-slate-800 leading-relaxed font-medium">
                  {questaoAtualObj.enunciado}
                </div>
              </div>

              <RadioGroup 
                value={respostas[questaoAtualObj.questaoId] || ""} 
                onValueChange={handleSelecionar}
                className="space-y-3"
              >
                {["A", "B", "C", "D", "E"].map((letra) => {
                  const texto = (questaoAtualObj.alternativas as any)[letra];
                  const selecionada = respostas[questaoAtualObj.questaoId] === letra;
                  
                  return (
                    <div 
                      key={letra} 
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer hover:bg-slate-50",
                        selecionada ? "border-indigo-600 bg-indigo-50/50 shadow-sm" : "border-slate-200 bg-white"
                      )}
                      onClick={() => handleSelecionar(letra)}
                    >
                      <RadioGroupItem value={letra} id={`opt-${letra}`} className="mt-1" />
                      <div className="flex-1 cursor-pointer">
                        <Label htmlFor={`opt-${letra}`} className="font-bold text-slate-500 mr-2 cursor-pointer">{letra})</Label>
                        <Label htmlFor={`opt-${letra}`} className="text-slate-700 cursor-pointer leading-relaxed">{texto}</Label>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>

            </div>
          </ScrollArea>

          <div className="bg-white border-t p-4 flex justify-between items-center sticky bottom-0 z-10">
            <Button 
              variant="outline" 
              onClick={() => setIndiceAtual(prev => Math.max(0, prev - 1))}
              disabled={indiceAtual === 0}
              className="gap-2"
            >
              <ChevronLeft size={16} /> Anterior
            </Button>

            <span className="md:hidden text-xs font-bold text-slate-400">
              {indiceAtual + 1} / {totalQuestoes}
            </span>

            <Button 
              onClick={() => setIndiceAtual(prev => Math.min(totalQuestoes - 1, prev + 1))}
              disabled={indiceAtual === totalQuestoes - 1}
              className="gap-2 bg-slate-800 hover:bg-slate-900"
            >
              Próxima <ChevronRight size={16} />
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}