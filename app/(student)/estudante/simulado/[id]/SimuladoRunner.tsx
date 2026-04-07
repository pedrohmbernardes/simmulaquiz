"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, ChevronRight, Clock, CheckCircle2, 
  Save, AlertTriangle, Shield, ShieldAlert, ShieldX,
  Maximize, Eye, EyeOff
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

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════
// STRIKE OVERLAY COMPONENT
// ═══════════════════════════════════════════════════════

function StrikeOverlay({ 
  strikes, 
  showWarning, 
  onDismiss 
}: { 
  strikes: number; 
  showWarning: boolean; 
  onDismiss: () => void;
}) {
  if (!showWarning) return null;

  const isAnulado = strikes >= 3;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className={cn(
        "w-full max-w-md rounded-2xl p-6 md:p-8 text-center space-y-5 shadow-2xl border animate-in zoom-in-95 duration-300",
        isAnulado 
          ? "bg-gradient-to-b from-red-950 to-red-900 border-red-700/50" 
          : "bg-gradient-to-b from-amber-950 to-amber-900 border-amber-700/50"
      )}>
        {/* Icon */}
        <div className={cn(
          "mx-auto w-16 h-16 rounded-full flex items-center justify-center",
          isAnulado ? "bg-red-500/20" : "bg-amber-500/20"
        )}>
          {isAnulado 
            ? <ShieldX size={32} className="text-red-400" /> 
            : <ShieldAlert size={32} className="text-amber-400" />
          }
        </div>

        {/* Title */}
        <h2 className={cn(
          "text-xl md:text-2xl font-bold",
          isAnulado ? "text-red-200" : "text-amber-200"
        )}>
          {isAnulado ? "Simulado Anulado" : "Atenção — Strike Registrado!"}
        </h2>

        {/* Strike indicators */}
        <div className="flex justify-center gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all",
              i <= strikes 
                ? "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30" 
                : "bg-white/5 border-white/20 text-white/30"
            )}>
              {i <= strikes ? "✕" : i}
            </div>
          ))}
        </div>

        {/* Message */}
        <p className="text-white/70 text-sm leading-relaxed">
          {isAnulado 
            ? "Você atingiu 3 strikes por sair da tela do simulado. Sua prova foi anulada automaticamente e as respostas enviadas."
            : `Você saiu da tela do simulado. Este é o strike ${strikes} de 3. Ao atingir 3 strikes, sua prova será anulada automaticamente.`
          }
        </p>

        {/* Action */}
        {!isAnulado && (
          <Button 
            onClick={onDismiss}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl"
          >
            Entendi, voltar ao simulado
          </Button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FULLSCREEN GATE COMPONENT
// ═══════════════════════════════════════════════════════

function FullscreenGate({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
        {/* Shield icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <Shield size={40} className="text-indigo-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Modo Avaliação
          </h1>
          <p className="text-indigo-300/70 text-sm md:text-base max-w-sm mx-auto leading-relaxed">
            Para iniciar o simulado, é necessário entrar em tela cheia. 
            Isso garante a integridade da avaliação.
          </p>
        </div>

        {/* Rules */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3 text-left">
          <div className="flex items-start gap-3">
            <EyeOff size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-white/60 text-xs md:text-sm">Copiar e colar está desabilitado durante toda a prova</p>
          </div>
          <div className="flex items-start gap-3">
            <Maximize size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-white/60 text-xs md:text-sm">A prova será realizada em tela cheia obrigatória</p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldAlert size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-white/60 text-xs md:text-sm">Sair da tela gera um strike — 3 strikes anulam a prova</p>
          </div>
        </div>

        <Button 
          onClick={onEnter}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl text-base gap-2 shadow-lg shadow-indigo-600/30"
        >
          <Maximize size={18} />
          Entrar em Tela Cheia e Iniciar
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function SimuladoRunner({ simulado }: { simulado: SimuladoData }) {
  const router = useRouter();
  const secureFetch = useSecureFetch();
  
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [tempoRestante, setTempoRestante] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Security states
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [showStrikeWarning, setShowStrikeWarning] = useState(false);
  const isAnuladoRef = useRef(false);
  const isFinalizingRef = useRef(false);
  const strikesRef = useRef(0);

  // ─── Inicializa respostas (preservado) ───
  useEffect(() => {
    const map: Record<number, string> = {};
    simulado.questoes.forEach(q => {
      if (q.alternativaMarcada) map[q.questaoId] = q.alternativaMarcada;
    });
    setRespostas(map);
  }, [simulado]);

  // ─── Proteção contra saída acidental (preservado) ───
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (loading) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading]);

  // ═══════════════════════════════════════════════════
  // SEGURANÇA 1: Anti Copy/Paste/Cut/Select/Drag
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    if (!fullscreenActive) return;

    const blockEvent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const blockKeyboard = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+P, Ctrl+S, F12, PrintScreen
      if (
        (e.ctrlKey && ['c', 'v', 'x', 'a', 'p', 's', 'u'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        e.stopPropagation();
        toast.warning("Ação bloqueada durante o simulado", { duration: 1500 });
        return false;
      }
    };

    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('copy', blockEvent, true);
    document.addEventListener('cut', blockEvent, true);
    document.addEventListener('paste', blockEvent, true);
    document.addEventListener('selectstart', blockEvent, true);
    document.addEventListener('dragstart', blockEvent, true);
    document.addEventListener('keydown', blockKeyboard, true);
    document.addEventListener('contextmenu', blockContextMenu, true);

    return () => {
      document.removeEventListener('copy', blockEvent, true);
      document.removeEventListener('cut', blockEvent, true);
      document.removeEventListener('paste', blockEvent, true);
      document.removeEventListener('selectstart', blockEvent, true);
      document.removeEventListener('dragstart', blockEvent, true);
      document.removeEventListener('keydown', blockKeyboard, true);
      document.removeEventListener('contextmenu', blockContextMenu, true);
    };
  }, [fullscreenActive]);

  // ═══════════════════════════════════════════════════
  // SEGURANÇA 2: Fullscreen Management
  // ═══════════════════════════════════════════════════
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenActive(true);
    } catch {
      // Fallback: allow even without fullscreen API (some mobile browsers)
      setFullscreenActive(true);
      toast.info("Modo avaliação ativado");
    }
  }, []);

  // ═══════════════════════════════════════════════════
  // SEGURANÇA 3: Strike System (visibility + fullscreen exit)
  // ═══════════════════════════════════════════════════
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
        isFinalizingRef.current = true;
        window.onbeforeunload = null;
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
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

  const anularPorStrikes = useCallback(async () => {
    if (isAnuladoRef.current) return;
    isAnuladoRef.current = true;
    isFinalizingRef.current = true;

    try {
      await secureFetch("/api/estudante/simulado/finalizar", {
        method: "POST",
        body: { simuladoId: simulado.id, motivo: "ANULADO_STRIKES" }
      });
    } catch {}

    // Redirect after a moment so user reads the message
    setTimeout(() => {
      window.onbeforeunload = null;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      router.push(`/estudante/simulado/${simulado.id}/resultado?erro=anulado_strikes`);
      router.refresh();
    }, 4000);
  }, [simulado.id, secureFetch, router]);

  const registerStrike = useCallback(() => {
    if (isAnuladoRef.current || isFinalizingRef.current || !fullscreenActive) return;

    const newStrikes = strikesRef.current + 1;
    strikesRef.current = newStrikes;
    setStrikes(newStrikes);
    setShowStrikeWarning(true);

    if (newStrikes >= 3) {
      anularPorStrikes();
    }
  }, [fullscreenActive, anularPorStrikes]);

  // Listen to visibility change + fullscreen exit
  useEffect(() => {
    if (!fullscreenActive) return;

    const handleVisibility = () => {
      if (document.hidden) {
        registerStrike();
      }
    };

    const handleFullscreenChange = () => {
      // If user exits fullscreen while prova is active
      if (!document.fullscreenElement && fullscreenActive && !isAnuladoRef.current) {
        registerStrike();
        // Try to re-enter fullscreen
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [fullscreenActive, registerStrike]);

  // ─── CRONÔMETRO (preservado) ───
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
  const tempoUrgente = tempoRestante !== null && tempoRestante < 300;

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <>
      {/* Fullscreen gate */}
      {!fullscreenActive && <FullscreenGate onEnter={enterFullscreen} />}

      {/* Strike overlay */}
      <StrikeOverlay 
        strikes={strikes} 
        showWarning={showStrikeWarning} 
        onDismiss={() => {
          setShowStrikeWarning(false);
          // Re-enter fullscreen after dismissing
          document.documentElement.requestFullscreen().catch(() => {});
        }} 
      />

      <div 
        className={cn(
          "flex flex-col h-screen bg-slate-50 transition-opacity duration-300",
          !fullscreenActive && "opacity-0 pointer-events-none"
        )}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        
        {/* ═══ HEADER ═══ */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-3 md:px-5 py-2.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          {/* Left: title + progress */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-800 text-xs md:text-sm truncate max-w-[140px] md:max-w-[220px]">
                  {simulado.titulo}
                </h1>
                {simulado.prazoFinalAbsoluto && (
                  <Badge className="text-[9px] md:text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200/60 px-1.5 h-4 md:h-5 shrink-0">
                    Avaliação
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] md:text-xs text-slate-400 font-mono">
                  {indiceAtual + 1}/{totalQuestoes}
                </span>
                <div className="hidden md:block w-20">
                  <Progress value={progresso} className="h-1.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Center: timer */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 md:px-4 py-1 md:py-1.5 rounded-full font-mono font-bold text-sm md:text-lg tabular-nums border transition-all shrink-0",
            tempoUrgente 
              ? "bg-red-50 text-red-600 border-red-200 animate-pulse shadow-sm shadow-red-100" 
              : "bg-slate-50 text-slate-700 border-slate-200"
          )}>
            <Clock size={14} className="md:w-[18px] md:h-[18px]" />
            {formatTempo(tempoRestante)}
          </div>

          {/* Right: strikes + finalizar */}
          <div className="flex items-center gap-2 md:gap-3 flex-1 justify-end">
            {/* Strike indicator */}
            {strikes > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                {[1, 2, 3].map(i => (
                  <div key={i} className={cn(
                    "w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all",
                    i <= strikes ? "bg-red-500" : "bg-slate-200"
                  )} />
                ))}
              </div>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  disabled={loading} 
                  size="sm"
                  className={cn(
                    "font-bold gap-1.5 transition-all text-xs md:text-sm px-3 md:px-4 h-8 md:h-9 rounded-lg",
                    respondidasCount === totalQuestoes 
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200" 
                      : "bg-indigo-600 hover:bg-indigo-700"
                  )}
                >
                  {loading 
                    ? <Clock className="animate-spin" size={14} /> 
                    : respondidasCount === totalQuestoes 
                      ? <CheckCircle2 size={14} /> 
                      : <Save size={14} />
                  }
                  <span className="hidden sm:inline">
                    {respondidasCount === totalQuestoes ? "Entregar" : "Finalizar"}
                  </span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl max-w-sm mx-auto">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-lg">Finalizar Avaliação?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm">
                    Você respondeu <span className="font-bold text-slate-700">{respondidasCount}</span> de <span className="font-bold text-slate-700">{totalQuestoes}</span> questões. 
                    <br/><br/>
                    <span className="text-amber-600 font-medium">Atenção:</span> Ao confirmar, você não poderá alterar suas respostas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel disabled={loading} className="rounded-lg">Revisar</AlertDialogCancel>
                  <AlertDialogAction 
                    disabled={loading} 
                    onClick={() => finalizarSimulado(false)} 
                    className="bg-indigo-600 rounded-lg"
                  >
                    Confirmar Entrega
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>

        {/* ═══ BODY ═══ */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* SIDEBAR — desktop only */}
          <aside className="hidden lg:flex w-[240px] bg-white/80 backdrop-blur-sm border-r border-slate-200/60 flex-col">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mapa da Prova</h3>
                <span className="text-[10px] font-mono text-slate-400">{respondidasCount}/{totalQuestoes}</span>
              </div>
              <Progress value={progresso} className="h-1.5" />
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="grid grid-cols-5 gap-1.5">
                {simulado.questoes.map((q, idx) => {
                  const respondida = !!respostas[q.questaoId];
                  const atual = idx === indiceAtual;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setIndiceAtual(idx)}
                      className={cn(
                        "h-9 w-full rounded-lg text-xs font-bold border transition-all flex items-center justify-center",
                        atual 
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200/60 shadow-sm" 
                          : respondida 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                            : "bg-slate-50/50 border-slate-200/60 text-slate-400 hover:bg-slate-100"
                      )}
                    >
                      {idx + 1}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </aside>

          {/* QUESTION AREA */}
          <main className="flex-1 flex flex-col overflow-hidden relative">
            <ScrollArea className="flex-1 px-4 py-5 md:px-8 md:py-6">
              <div className="max-w-2xl mx-auto space-y-6 pb-24">
                
                {/* Question number badge */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-100">
                    Questão {indiceAtual + 1}
                  </span>
                  {respostas[questaoAtualObj.questaoId] && (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  )}
                </div>

                {/* Enunciado */}
                <div className="text-sm md:text-base text-slate-700 leading-relaxed font-medium">
                  {questaoAtualObj.enunciado}
                </div>

                {/* Alternativas */}
                <RadioGroup 
                  value={respostas[questaoAtualObj.questaoId] || ""} 
                  onValueChange={handleSelecionar}
                  className="space-y-2.5"
                >
                  {["A", "B", "C", "D", "E"].map((letra) => {
                    const texto = (questaoAtualObj.alternativas as any)[letra];
                    const selecionada = respostas[questaoAtualObj.questaoId] === letra;
                    
                    return (
                      <div 
                        key={letra} 
                        className={cn(
                          "flex items-start gap-3 p-3 md:p-4 rounded-xl border-2 transition-all cursor-pointer active:scale-[0.99]",
                          selecionada 
                            ? "border-indigo-500 bg-indigo-50/60 shadow-sm shadow-indigo-100" 
                            : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                        )}
                        onClick={() => handleSelecionar(letra)}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 transition-all mt-0.5",
                          selecionada 
                            ? "bg-indigo-600 border-indigo-600 text-white" 
                            : "bg-white border-slate-300 text-slate-400"
                        )}>
                          {letra}
                        </div>
                        <span className={cn(
                          "text-sm md:text-base leading-relaxed pt-0.5",
                          selecionada ? "text-slate-800 font-medium" : "text-slate-600"
                        )}>
                          {texto}
                        </span>
                      </div>
                    );
                  })}
                </RadioGroup>

              </div>
            </ScrollArea>

            {/* Bottom nav */}
            <div className="bg-white/95 backdrop-blur-sm border-t border-slate-200/60 p-3 md:p-4 flex justify-between items-center sticky bottom-0 z-10">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIndiceAtual(prev => Math.max(0, prev - 1))}
                disabled={indiceAtual === 0}
                className="gap-1.5 rounded-lg text-xs md:text-sm h-9"
              >
                <ChevronLeft size={14} /> Anterior
              </Button>

              {/* Mobile question dots */}
              <div className="flex lg:hidden items-center gap-1 max-w-[50%] overflow-hidden justify-center flex-wrap">
                {simulado.questoes.map((q, idx) => {
                  const respondida = !!respostas[q.questaoId];
                  const atual = idx === indiceAtual;
                  // Only show nearby dots on very small screens
                  const distance = Math.abs(idx - indiceAtual);
                  if (totalQuestoes > 15 && distance > 4 && !atual) return null;
                  return (
                    <button 
                      key={q.id} 
                      onClick={() => setIndiceAtual(idx)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        atual ? "w-5 bg-indigo-500" : respondida ? "bg-emerald-400" : "bg-slate-300"
                      )} 
                    />
                  );
                })}
              </div>

              <Button 
                size="sm"
                onClick={() => setIndiceAtual(prev => Math.min(totalQuestoes - 1, prev + 1))}
                disabled={indiceAtual === totalQuestoes - 1}
                className="gap-1.5 bg-slate-800 hover:bg-slate-900 rounded-lg text-xs md:text-sm h-9"
              >
                Próxima <ChevronRight size={14} />
              </Button>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
