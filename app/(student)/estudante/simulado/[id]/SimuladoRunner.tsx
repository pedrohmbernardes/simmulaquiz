"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, ChevronRight, Clock, CheckCircle2, 
  AlertTriangle, Shield, ShieldAlert, ShieldX,
  Maximize, EyeOff, Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";
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
// MOBILE DETECTION HELPER
// ═══════════════════════════════════════════════════════

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

// ═══════════════════════════════════════════════════════
// STRIKE OVERLAY COMPONENT
// ═══════════════════════════════════════════════════════

function StrikeOverlay({ 
  strikes, showWarning, onDismiss 
}: { 
  strikes: number; showWarning: boolean; onDismiss: () => void;
}) {
  if (!showWarning) return null;
  const isAnulado = strikes >= 3;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className={cn(
        "w-full max-w-md rounded-2xl p-5 md:p-8 text-center space-y-4 md:space-y-5 shadow-2xl border animate-in zoom-in-95 duration-300",
        isAnulado 
          ? "bg-gradient-to-b from-red-950 to-red-900 border-red-700/50" 
          : "bg-gradient-to-b from-amber-950 to-amber-900 border-amber-700/50"
      )}>
        <div className={cn(
          "mx-auto w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center",
          isAnulado ? "bg-red-500/20" : "bg-amber-500/20"
        )}>
          {isAnulado 
            ? <ShieldX className="h-7 w-7 md:h-8 md:w-8 text-red-400" /> 
            : <ShieldAlert className="h-7 w-7 md:h-8 md:w-8 text-amber-400" />
          }
        </div>

        <h2 className={cn(
          "text-lg md:text-2xl font-bold",
          isAnulado ? "text-red-200" : "text-amber-200"
        )}>
          {isAnulado ? "Simulado Anulado" : "Strike Registrado!"}
        </h2>

        <div className="flex justify-center gap-2.5 md:gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className={cn(
              "w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all",
              i <= strikes 
                ? "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30" 
                : "bg-white/5 border-white/20 text-white/30"
            )}>
              {i <= strikes ? "✕" : i}
            </div>
          ))}
        </div>

        <p className="text-white/70 text-xs md:text-sm leading-relaxed">
          {isAnulado 
            ? "Você atingiu 3 strikes por sair da tela do simulado. Sua prova foi anulada e as respostas enviadas."
            : `Você saiu da tela do simulado. Strike ${strikes}/3. Ao atingir 3, sua prova será anulada.`
          }
        </p>

        {!isAnulado && (
          <Button 
            onClick={onDismiss}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-sm"
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

function FullscreenGate({ onEnter, isMobile }: { onEnter: () => void; isMobile: boolean }) {
  return (
    <div className="fixed inset-0 z-[90] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-5 md:p-6">
      <div className="w-full max-w-lg text-center space-y-5 md:space-y-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="mx-auto w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <Shield className="h-8 w-8 md:h-10 md:w-10 text-indigo-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl md:text-3xl font-bold text-white">
            Modo Avaliação
          </h1>
          <p className="text-indigo-300/70 text-xs md:text-base max-w-sm mx-auto leading-relaxed">
            {isMobile 
              ? "Para garantir a integridade da avaliação, o modo prova será ativado. Não saia do aplicativo durante o simulado."
              : "Para iniciar o simulado, é necessário entrar em tela cheia. Isso garante a integridade da avaliação."
            }
          </p>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-3 md:p-4 space-y-2.5 md:space-y-3 text-left">
          <div className="flex items-start gap-2.5 md:gap-3">
            <EyeOff size={14} className="text-amber-400 mt-0.5 shrink-0 md:w-4 md:h-4" />
            <p className="text-white/60 text-[11px] md:text-sm">Copiar e colar está desabilitado durante toda a prova</p>
          </div>
          {!isMobile && (
            <div className="flex items-start gap-2.5 md:gap-3">
              <Maximize size={14} className="text-amber-400 mt-0.5 shrink-0 md:w-4 md:h-4" />
              <p className="text-white/60 text-[11px] md:text-sm">A prova será realizada em tela cheia obrigatória</p>
            </div>
          )}
          <div className="flex items-start gap-2.5 md:gap-3">
            <ShieldAlert size={14} className="text-amber-400 mt-0.5 shrink-0 md:w-4 md:h-4" />
            <p className="text-white/60 text-[11px] md:text-sm">
              {isMobile 
                ? "Sair do app ou trocar de aba gera um strike — 3 strikes anulam a prova"
                : "Sair da tela gera um strike — 3 strikes anulam a prova"
              }
            </p>
          </div>
        </div>

        <Button 
          onClick={onEnter}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl text-sm md:text-base gap-2 shadow-lg shadow-indigo-600/30"
        >
          {isMobile ? <Shield size={18} /> : <Maximize size={18} />}
          {isMobile ? "Ativar Modo Prova e Iniciar" : "Entrar em Tela Cheia e Iniciar"}
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
  const isMobile = useIsMobile();
  
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [tempoRestante, setTempoRestante] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Status visual para modal de confirmação
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);

  // Security states
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [showStrikeWarning, setShowStrikeWarning] = useState(false);
  const isAnuladoRef = useRef(false);
  const isFinalizingRef = useRef(false);
  const strikesRef = useRef(0);

  // ─── Inicializa respostas ───
  useEffect(() => {
    const map: Record<number, string> = {};
    simulado.questoes.forEach(q => {
      if (q.alternativaMarcada) map[q.questaoId] = q.alternativaMarcada;
    });
    setRespostas(map);
  }, [simulado]);

  // ─── Proteção contra saída acidental ───
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
      setFullscreenActive(true);
      if (isMobile) {
        toast.info("Modo avaliação ativado");
      }
    }
  }, [isMobile]);

  // ═══════════════════════════════════════════════════
  // SEGURANÇA 3: Strike System
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
      setShowConfirmFinish(false); // Fecha o modal se houver erro
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

  useEffect(() => {
    if (!fullscreenActive) return;

    const handleVisibility = () => {
      if (document.hidden) {
        registerStrike();
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && fullscreenActive && !isAnuladoRef.current) {
        registerStrike();
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

  // ─── CRONÔMETRO ───
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
      {!fullscreenActive && <FullscreenGate onEnter={enterFullscreen} isMobile={isMobile} />}

      <StrikeOverlay 
        strikes={strikes} 
        showWarning={showStrikeWarning} 
        onDismiss={() => {
          setShowStrikeWarning(false);
          document.documentElement.requestFullscreen().catch(() => {});
        }} 
      />

      <div 
        className={cn(
          "fixed inset-0 z-[55] flex flex-col bg-slate-50 transition-opacity duration-300",
          !fullscreenActive && "opacity-0 pointer-events-none"
        )}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        
        {/* ═══ HEADER ═══ */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-3 md:px-5 py-2 md:py-2.5 flex items-center justify-between sticky top-0 z-20 shadow-sm shrink-0">
          
          {/* Esquerda: Info */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 md:gap-2">
                <h1 className="font-bold text-slate-800 text-[11px] md:text-sm truncate max-w-[100px] md:max-w-[220px]">
                  {simulado.titulo}
                </h1>
                {simulado.prazoFinalAbsoluto && (
                  <Badge className="text-[8px] md:text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200/60 px-1 md:px-1.5 h-3.5 md:h-5 shrink-0 hidden sm:inline-flex">
                    Avaliação
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 mt-0.5">
                <span className="text-[9px] md:text-xs text-slate-400 font-mono">
                  {indiceAtual + 1}/{totalQuestoes}
                </span>
                <div className="w-12 md:w-20">
                  <Progress value={progresso} className="h-1 md:h-1.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Centro: Cronômetro */}
          <div className={cn(
            "flex items-center gap-1 md:gap-1.5 px-2.5 md:px-4 py-0.5 md:py-1.5 rounded-full font-mono font-bold text-xs md:text-lg tabular-nums border transition-all shrink-0",
            tempoUrgente 
              ? "bg-red-50 text-red-600 border-red-200 animate-pulse shadow-sm shadow-red-100" 
              : "bg-slate-50 text-slate-700 border-slate-200"
          )}>
            <Clock size={12} className="md:w-[18px] md:h-[18px]" />
            {formatTempo(tempoRestante)}
          </div>

          {/* Direita: Ação Finalizar */}
          <div className="flex items-center gap-1.5 md:gap-3 flex-1 justify-end">
            {strikes > 0 && (
              <div className="hidden sm:flex items-center gap-0.5 md:gap-1 shrink-0 px-2 py-1 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle size={12} className="text-amber-500" />
                <span className="text-[10px] md:text-xs font-bold text-amber-600">Strikes: {strikes}/3</span>
              </div>
            )}

            <Button 
              onClick={() => setShowConfirmFinish(true)}
              disabled={loading} 
              size="sm"
              className={cn(
                "font-bold gap-1.5 transition-all text-[10px] md:text-sm px-3 md:px-5 h-7 md:h-9 rounded-lg shadow-md",
                respondidasCount === totalQuestoes 
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" 
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
              )}
            >
              {loading 
                ? <Clock className="animate-spin h-3.5 w-3.5" /> 
                : respondidasCount === totalQuestoes 
                  ? <CheckCircle2 className="h-3.5 w-3.5" /> 
                  : <Send className="h-3.5 w-3.5" />
              }
              <span className="hidden sm:inline">
                {respondidasCount === totalQuestoes ? "Entregar Prova" : "Finalizar Prova"}
              </span>
              <span className="sm:hidden">
                {respondidasCount === totalQuestoes ? "Entregar" : "Finalizar"}
              </span>
            </Button>
          </div>
        </header>

        {/* ═══ BODY ═══ */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* SIDEBAR — desktop only */}
          <aside className="hidden lg:flex w-[240px] bg-white/80 backdrop-blur-sm border-r border-slate-200/60 flex-col shrink-0">
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
            <ScrollArea className="flex-1 px-4 py-4 md:px-8 md:py-6">
              <div className="max-w-2xl mx-auto space-y-4 md:space-y-6 pb-20 md:pb-24">
                
                {/* Question badge */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] md:text-xs font-bold border border-indigo-100">
                    Questão {indiceAtual + 1}
                  </span>
                  {respostas[questaoAtualObj.questaoId] && (
                    <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      <CheckCircle2 size={12} className="md:w-[14px] md:h-[14px]" />
                      <span className="text-[10px] md:text-xs font-semibold">Salva</span>
                    </div>
                  )}
                </div>

                {/* Enunciado */}
                <div className="text-[13px] md:text-base text-slate-700 leading-relaxed font-medium">
                  {questaoAtualObj.enunciado}
                </div>

                {/* Alternativas */}
                <RadioGroup 
                  value={respostas[questaoAtualObj.questaoId] || ""} 
                  onValueChange={handleSelecionar}
                  className="space-y-2 md:space-y-2.5"
                >
                  {["A", "B", "C", "D", "E"].map((letra) => {
                    const texto = (questaoAtualObj.alternativas as any)[letra];
                    const selecionada = respostas[questaoAtualObj.questaoId] === letra;
                    
                    return (
                      <div 
                        key={letra} 
                        className={cn(
                          "flex items-start gap-2.5 md:gap-3 p-3 md:p-4 rounded-xl border-2 transition-all cursor-pointer active:scale-[0.99]",
                          selecionada 
                            ? "border-indigo-500 bg-indigo-50/60 shadow-sm shadow-indigo-100" 
                            : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                        )}
                        onClick={() => handleSelecionar(letra)}
                      >
                        <div className={cn(
                          "w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[11px] md:text-xs font-bold shrink-0 border-2 transition-all mt-0.5",
                          selecionada 
                            ? "bg-indigo-600 border-indigo-600 text-white" 
                            : "bg-white border-slate-300 text-slate-400"
                        )}>
                          {letra}
                        </div>
                        <span className={cn(
                          "text-[13px] md:text-base leading-relaxed pt-0.5",
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
            <div className="bg-white/95 backdrop-blur-sm border-t border-slate-200/60 p-2.5 md:p-4 flex justify-between items-center sticky bottom-0 z-10 shrink-0 safe-area-bottom">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIndiceAtual(prev => Math.max(0, prev - 1))}
                disabled={indiceAtual === 0}
                className="gap-1 md:gap-1.5 rounded-lg text-[11px] md:text-sm h-8 md:h-9 px-2.5 md:px-3"
              >
                <ChevronLeft size={13} className="md:w-[14px] md:h-[14px]" /> <span className="hidden sm:inline">Anterior</span><span className="sm:hidden">Ant.</span>
              </Button>

              <div className="flex lg:hidden items-center gap-[3px] md:gap-1 max-w-[55%] overflow-hidden justify-center flex-wrap">
                {simulado.questoes.map((q, idx) => {
                  const respondida = !!respostas[q.questaoId];
                  const atual = idx === indiceAtual;
                  const distance = Math.abs(idx - indiceAtual);
                  if (totalQuestoes > 15 && distance > 4 && !atual) return null;
                  return (
                    <button 
                      key={q.id} 
                      onClick={() => setIndiceAtual(idx)}
                      className={cn(
                        "h-2 rounded-full transition-all",
                        atual ? "w-5 bg-indigo-500" : respondida ? "w-2 bg-emerald-400" : "w-2 bg-slate-300"
                      )} 
                    />
                  );
                })}
              </div>

              <Button 
                size="sm"
                onClick={() => setIndiceAtual(prev => Math.min(totalQuestoes - 1, prev + 1))}
                disabled={indiceAtual === totalQuestoes - 1}
                className="gap-1 md:gap-1.5 bg-slate-800 hover:bg-slate-900 rounded-lg text-[11px] md:text-sm h-8 md:h-9 px-2.5 md:px-3"
              >
                <span className="hidden sm:inline">Próxima</span><span className="sm:hidden">Próx.</span> <ChevronRight size={13} className="md:w-[14px] md:h-[14px]" />
              </Button>
            </div>
          </main>
        </div>

        {/* ═══ MODAL CUSTOMIZADO DE FINALIZAÇÃO ═══ */}
        {showConfirmFinish && (
          <div className="absolute inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[1.5rem] p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
              <div className="mx-auto w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <Send className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-slate-900 mb-2">Finalizar Avaliação?</h3>
              
              <div className="bg-slate-50 rounded-xl p-4 mb-6 text-center border border-slate-100">
                <p className="text-sm text-slate-600">
                  Você respondeu <span className="font-bold text-slate-900">{respondidasCount}</span> de <span className="font-bold text-slate-900">{totalQuestoes}</span> questões.
                </p>
                {respondidasCount < totalQuestoes && (
                  <p className="text-xs text-amber-600 font-semibold mt-2">
                    Ainda faltam {totalQuestoes - respondidasCount} questões em branco!
                  </p>
                )}
              </div>

              <p className="text-xs text-center text-slate-500 mb-6 px-2">
                Ao confirmar, suas respostas serão enviadas e você não poderá alterá-las.
              </p>

              <div className="flex flex-col gap-2.5">
                <Button 
                  onClick={() => finalizarSimulado(false)} 
                  disabled={loading} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-base font-bold shadow-md shadow-indigo-200"
                >
                  {loading ? <Clock className="animate-spin h-5 w-5 mr-2" /> : "Confirmar Entrega"}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowConfirmFinish(false)} 
                  disabled={loading}
                  className="w-full h-11 text-slate-500 hover:text-slate-700"
                >
                  Voltar e Revisar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}