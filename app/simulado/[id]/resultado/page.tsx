"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import StudentNavbar from "@/app/(student)/estudante/StudentNavbar";
import { toast } from "sonner";
import {
  Zap,
  Medal,
  BrainCircuit,
  Sparkles,
  ArrowRight,
  Loader2,
  Lock,
  Trophy,
  Flame,
  Star,
  School,
  LayoutDashboard,
} from "lucide-react";

// --- TIPAGENS ---
type Alternativa = "a" | "b" | "c" | "d" | "e";

type NavbarSession = {
  name: string;
  email: string;
  role: string;
  nivel: number;
  pontos: number;
  streak: number;
  avatarUrl?: string | null;
};

type QuestaoDetalhe = {
  id: number;
  enunciado: string;
  alternativaA: string;
  alternativaB: string;
  alternativaC: string;
  alternativaD: string;
  alternativaE: string;
  dificuldade?: string | null;
  nivelCognitivo?: string | null;
  imagens?: { url: string }[];
};

type AcertadaItem = {
  questaoId: number;
  alternativaMarcada: Alternativa | null;
  tempoResposta: number | null;
  questao: QuestaoDetalhe;
};

type ErradaItem = {
  questaoId: number;
  status: "REVISAR";
  questaoErroId: number | null;
};

type ResultadoResponse = {
  ok: boolean;
  simulado: {
    id: number;
    tipo: string;
    status: "CONCLUIDO" | "ANULADO" | "ABANDONADO" | string;
    total: number;
    acertos: number;
    notaPercentual: number | null;
    tempoGastoMinutos: number | null;
    dataConclusao: string | null;
    strikesUsados: number;
    strikesMax: number;
    anuladoMotivo: string | null;
    agendamentoOrigem?: {
      id: number;
      turmaId: number;
      titulo: string;
    } | null;
  };
  detalhamento: {
    acertadas: AcertadaItem[];
    erradas: ErradaItem[];
  };
};

type ApiPerfilResponse = {
  perfil: { nome: string; email: string; fotoUrl?: string | null; role: string };
  progresso: { nivel: number; pontos: number; titulo: string; streak: number };
};

type AnaliseGetResponse = {
  ok: boolean;
  avaliacao?: {
    id: number;
    simuladoId: number;
    createdAt: string;
  };
};

// ============================
// Gamificação (Eventos/Toasts)
// ============================

type GamificationEvent =
  | { type: "XP_EARNED"; amount: number; label?: string }
  | { type: "LEVEL_UP"; from: number; to: number }
  | { type: "TITLE_UNLOCKED"; title: string }
  | { type: "ACHIEVEMENT_UNLOCKED"; name: string; rarity?: string; points?: number }
  | { type: "STREAK_UPDATED"; current: number; best?: number };

const GAMIF_STORAGE_KEYS = ["simmula:gamification:events", "gamification:events"];

// ============================
// Análise (anti-regeneração)
// ============================

const ANALISE_FLAG_PREFIX = "simmula:analise:exists:";

function getAnaliseFlag(simuladoId: number): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${ANALISE_FLAG_PREFIX}${simuladoId}`) === "1";
}

function setAnaliseFlag(simuladoId: number) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${ANALISE_FLAG_PREFIX}${simuladoId}`, "1");
}

function safeJsonParse<T = any>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function consumeStoredGamificationEvents(): GamificationEvent[] | null {
  if (typeof window === "undefined") return null;

  for (const k of GAMIF_STORAGE_KEYS) {
    const raw = sessionStorage.getItem(k);
    if (!raw) continue;

    sessionStorage.removeItem(k);

    const parsed = safeJsonParse<any>(raw);
    if (Array.isArray(parsed)) return parsed as GamificationEvent[];
    if (parsed?.events && Array.isArray(parsed.events)) return parsed.events as GamificationEvent[];
  }

  return null;
}

function normalizeLegacyFromQuery(): GamificationEvent[] {
  if (typeof window === "undefined") return [];

  const sp = new URLSearchParams(window.location.search);
  const xp = sp.get("xp");
  const titulo = sp.get("titulo");
  const conquistasRaw = sp.get("conquistas");

  const events: GamificationEvent[] = [];

  const xpN = xp ? Number(xp) : 0;
  if (Number.isFinite(xpN) && xpN > 0) {
    events.push({ type: "XP_EARNED", amount: xpN, label: "Simulado finalizado" });
  }

  if (titulo) {
    events.push({ type: "TITLE_UNLOCKED", title: titulo });
  }

  if (conquistasRaw) {
    // pode ser JSON ou lista simples
    const parsed = safeJsonParse<any>(conquistasRaw);

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string") {
          events.push({ type: "ACHIEVEMENT_UNLOCKED", name: item });
        } else if (item && typeof item === "object") {
          events.push({
            type: "ACHIEVEMENT_UNLOCKED",
            name: String(item.nome ?? item.name ?? "Conquista desbloqueada"),
            rarity: item.raridade ?? item.rarity,
            points: typeof item.pontos === "number" ? item.pontos : undefined,
          });
        }
      }
    } else if (typeof conquistasRaw === "string") {
      // seu código antigo serializava com "|" — mas aqui aceitamos "," também.
      const parts = conquistasRaw
        .split(/[|,]/g)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const p of parts) events.push({ type: "ACHIEVEMENT_UNLOCKED", name: p });
    }
  }

  // se havia query e virou evento, limpar URL
  if (events.length > 0) {
    const cleanUrl = window.location.pathname;
    window.history.replaceState(null, "", cleanUrl);
  }

  return events;
}

function emitGamificationToasts(events: GamificationEvent[]) {
  if (!events.length) return;

  const baseDelay = 450;
  const stepDelay = 750;

  events.forEach((ev, idx) => {
    const delay = baseDelay + idx * stepDelay;

    setTimeout(() => {
      switch (ev.type) {
        case "XP_EARNED": {
          toast.success("Recompensa recebida!", {
            description: `+${ev.amount} XP${ev.label ? ` • ${ev.label}` : ""}`,
            icon: <Zap className="text-yellow-500" size={20} />,
            className: "border-yellow-200 bg-yellow-50",
          });
          return;
        }

        case "LEVEL_UP": {
          toast.success("Level Up!", {
            description: `Você subiu do nível ${ev.from} para ${ev.to}.`,
            icon: <Trophy className="text-amber-600" size={22} />,
            className: "border-amber-200 bg-amber-50",
          });
          return;
        }

        case "TITLE_UNLOCKED": {
          toast.message("Novo título desbloqueado!", {
            description: `Parabéns! Você agora é "${ev.title}"`,
            icon: <Medal className="text-orange-500" size={22} />,
            className: "border-orange-200 bg-orange-50",
          });
          return;
        }

        case "ACHIEVEMENT_UNLOCKED": {
          const extra = [
            ev.rarity ? `Raridade: ${ev.rarity}` : null,
            typeof ev.points === "number" ? `+${ev.points} XP` : null,
          ].filter(Boolean);

          toast.message("Conquista desbloqueada!", {
            description: `${ev.name}${extra.length ? ` • ${extra.join(" • ")}` : ""}`,
            icon: <Star className="text-purple-600" size={20} />,
            className: "border-purple-200 bg-purple-50",
          });
          return;
        }

        case "STREAK_UPDATED": {
          toast.message("Streak atualizada!", {
            description: `Streak atual: ${ev.current}${typeof ev.best === "number" ? ` • Recorde: ${ev.best}` : ""}`,
            icon: <Flame className="text-red-500" size={20} />,
            className: "border-red-200 bg-red-50",
          });
          return;
        }

        default:
          return;
      }
    }, delay);
  });
}

function normalizeAlt(a: unknown): Alternativa | null {
  if (a == null) return null;
  const s = String(a).trim().toLowerCase();
  const m = s.match(/[abcde]/);
  return (m?.[0] as Alternativa) ?? null;
}

function formatTempo(min: number | null | undefined) {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return `${h}h ${r}min`;
}

function formatDateTimeBR(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

async function fetchCsrfToken(signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch("/api/csrf", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      signal,
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return (json?.csrfToken ?? json?.token ?? null) as string | null;
  } catch {
    return null;
  }
}

export default function ResultadoSimuladoPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams<{ id?: string }>();

// Estados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResultadoResponse | null>(null);
  const [session, setSession] = useState<NavbarSession | null>(null);

  // Estados da IA (Modal)
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // Estado da análise existente
  const [analise, setAnalise] = useState<{ id: number; createdAt: string } | null>(null);
  const [analiseChecked, setAnaliseChecked] = useState(false);

  // Flag local (anti-“Gerar novamente” em volta via history/cache)
  const [localAnaliseExists, setLocalAnaliseExists] = useState(false);

const simuladoId = useMemo(() => {
    const raw = params?.id;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params?.id]);

  // ✅ LÓGICA DE DIRECIONAMENTO DINÂMICO
  const infoTurma = useMemo(() => {
    if (!data?.simulado?.agendamentoOrigem) return null;
    return data.simulado.agendamentoOrigem;
  }, [data]);

  const handleVoltar = () => {
    if (infoTurma) {
      router.push(`/estudante/turmas/${infoTurma.turmaId}`);
    } else {
      router.push("/estudante");
    }
  };

  const loadingPhrases = [
    "Processando dados do simulado...",
    "Identificando padrões de erro...",
    "Consultando a base de conhecimento...",
    "Gerando feedback pedagógico...",
  ];

  // ✅ Efeito de Gamificação (Toasts) — robusto (storage + query legacy)
  const gamifRanRef = useRef(false);
  useEffect(() => {
    // Evita duplicar no StrictMode
    if (gamifRanRef.current) return;
    gamifRanRef.current = true;

    // 1) Preferência: eventos persistidos (sessionStorage)
    const stored = consumeStoredGamificationEvents();
    if (stored && stored.length) {
      emitGamificationToasts(stored);
      return;
    }

    // 2) Fallback: legado por query string (xp/titulo/conquistas)
    const legacyEvents = normalizeLegacyFromQuery();
    if (legacyEvents.length) emitGamificationToasts(legacyEvents);
  }, [searchParams]);

  // Mantém flag local sincronizada (ao carregar a página)
  useEffect(() => {
    if (!simuladoId) return;
    setLocalAnaliseExists(getAnaliseFlag(simuladoId));
  }, [simuladoId]);

  // Função: checar análise existente (DB) e atualizar estado/flag
  const refreshAnaliseStatus = useCallback(
    async (signal?: AbortSignal) => {
      if (!simuladoId) return;

      setAnaliseChecked(false);

      try {
        const resAnalise = await fetch(`/api/simulados/${simuladoId}/analise`, {
          method: "GET",
          signal,
          cache: "no-store",
          credentials: "include",
        });

        if (resAnalise.ok) {
          const json: AnaliseGetResponse = await resAnalise.json().catch(() => ({ ok: false }));
          if (json?.avaliacao?.id) {
            setAnalise({ id: json.avaliacao.id, createdAt: json.avaliacao.createdAt });
            setAnaliseFlag(simuladoId);
            setLocalAnaliseExists(true);
          } else {
            setAnalise(null);
          }
          return;
        }

        if (resAnalise.status === 404) {
          setAnalise(null);
          return;
        }

        // erro “não fatal”: não derruba UI, mas não assume que não existe.
        // Mantém o flag local se já era true.
        setAnalise(null);
      } catch {
        // erro “não fatal”: não assume inexistência
        setAnalise(null);
      } finally {
        setAnaliseChecked(true);
      }
    },
    [simuladoId]
  );

  // Carregar Dados Iniciais
useEffect(() => {
    if (!simuladoId) {
      setLoading(false);
      setError("ID do simulado inválido.");
      return;
    }

    const ac = new AbortController();

async function loadAllData() {
      try {
        setLoading(true);

        const resResultado = await fetch(`/api/simulados/${simuladoId}/resultado`, {
          method: "GET",
          credentials: "include",
          signal: ac.signal,
        });
        if (!resResultado.ok) throw new Error("Falha ao carregar resultado.");
        const jsonResultado: ResultadoResponse = await resResultado.json();
        setData(jsonResultado);

        // Navbar
        try {
          const resProfile = await fetch("/api/estudante/perfil", {
            method: "GET",
            credentials: "include",
            signal: ac.signal,
          });
          if (resProfile.ok) {
            const apiData: ApiPerfilResponse = await resProfile.json();
            setSession({
              name: apiData.perfil.nome,
              email: apiData.perfil.email,
              role: apiData.perfil.role || "ALUNO",
              avatarUrl: apiData.perfil.fotoUrl ?? null,
              nivel: apiData.progresso.nivel ?? 1,
              pontos: apiData.progresso.pontos ?? 0,
              streak: apiData.progresso.streak ?? 0,
            });
          }
        } catch {}

        // Checa se já existe análise no DB
        await refreshAnaliseStatus(ac.signal);
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e?.message ?? "Erro inesperado.");
      } finally {
        setLoading(false);
      }
    }

    loadAllData();
    return () => ac.abort();
  }, [simuladoId, refreshAnaliseStatus]);

  // 🔒 Fix do seu bug:
  // Quando voltar da tela de análise usando histórico (router.back), o Next pode restaurar o estado cacheado.
  // Então revalidamos a análise ao “reaparecer” via popstate/pageshow.
  useEffect(() => {
    if (!simuladoId) return;

    const run = () => {
      const ac = new AbortController();
      refreshAnaliseStatus(ac.signal);
    };

    window.addEventListener("popstate", run);
    window.addEventListener("pageshow", run);

    return () => {
      window.removeEventListener("popstate", run);
      window.removeEventListener("pageshow", run);
    };
  }, [simuladoId, refreshAnaliseStatus]);

  // Frases de Loading para o Modal
  useEffect(() => {
    if (!isGeneratingIA) return;
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % 4);
    }, 1500);
    return () => clearInterval(interval);
  }, [isGeneratingIA]);

  const goToAnalise = (id: number) => {
    router.push(`/estudante/simulado/${id}/analise`);
  };

  // Clique do card (gera se não existir; consulta se já existir)
  const handleAnaliseClick = async () => {
    if (!data) return;

    const { simulado } = data;

    if (simulado.status !== "CONCLUIDO") {
      toast.error("Análise indisponível", {
        description: "A análise completa só fica disponível para simulados concluídos.",
      });
      return;
    }

    // Enquanto ainda está checando, não deixa gerar por engano.
    if (!analiseChecked && !analise?.id && !localAnaliseExists) {
      toast.message("Verificando análise salva...", {
        description: "Aguarde um instante.",
      });
      return;
    }

    // Se já existe (DB) OU flag local, só consulta (não chama IA)
    if (analise?.id || localAnaliseExists) {
      setAnaliseFlag(simulado.id);
      setLocalAnaliseExists(true);
      goToAnalise(simulado.id);
      return;
    }

    if (isGeneratingIA) return;
    setIsGeneratingIA(true);

    try {
      const csrf = await fetchCsrfToken();
      if (!csrf) {
        throw new Error("Não foi possível obter token de segurança. Recarregue a página.");
      }

      const res = await fetch("/api/ai/analise-desempenho", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ simuladoId: simulado.id }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 429) {
          toast.error("Limite Diário Atingido", { description: json?.error ?? "Tente novamente amanhã." });
        } else if (res.status === 403) {
          toast.error("Sessão/CSRF expirado", { description: json?.error ?? "Recarregue a página e tente novamente." });
        } else {
          throw new Error(json?.error ?? "Falha ao gerar análise.");
        }
        setIsGeneratingIA(false);
        return;
      }

      // ✅ Sucesso: marca flag local para nunca oferecer “Gerar” novamente por cache/histórico
      setAnaliseFlag(simulado.id);
      setLocalAnaliseExists(true);

      // Redireciona para a análise (que vai ler do DB/cached)
      goToAnalise(simulado.id);
    } catch (err: any) {
      toast.error("Erro na Análise", { description: err?.message ?? "Erro inesperado." });
      setIsGeneratingIA(false);
    }
  };

  // Renders
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <StudentNavbar session={session} />
        <div className="h-96 flex items-center justify-center">
          <Loader2 className="animate-spin text-purple-600" size={48} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <StudentNavbar session={session} />
        <div className="p-8 text-center text-red-500 font-bold">{error}</div>
      </div>
    );
  }

  const { simulado, detalhamento } = data;
  const percentual = simulado.notaPercentual ?? 0;

  const scoreStyle =
    percentual >= 80
      ? "text-emerald-600 bg-emerald-50"
      : percentual >= 50
      ? "text-blue-600 bg-blue-50"
      : "text-amber-600 bg-amber-50";

  const podeAnalise = simulado.status === "CONCLUIDO";

  // ✅ nunca mais “perde” o estado salvo ao voltar via histórico:
  const temAnalise = Boolean(analise?.id) || localAnaliseExists;

  // Enquanto ainda não checou, não permite “Gerar” (evita gasto indevido)
  const bloqueadoPorCheck = podeAnalise && !temAnalise && !analiseChecked;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
      <StudentNavbar session={session} />

      <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        {/* MODAL DE PROCESSAMENTO (OVERLAY) */}
        {isGeneratingIA && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full text-center m-4 border border-purple-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 animate-pulse" />
              <div className="mb-6 flex justify-center relative">
                <div className="absolute inset-0 bg-purple-200 blur-xl opacity-30 rounded-full animate-pulse" />
                <BrainCircuit size={64} className="text-purple-600 animate-bounce relative z-10" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 font-oswald uppercase">Tutor IA Trabalhando</h3>
              <p className="text-purple-600 font-medium h-6 transition-all duration-300">{loadingPhrases[loadingStep]}</p>
              <p className="text-xs text-gray-400 mt-6">Isso pode levar alguns segundos...</p>
            </div>
          </div>
        )}

        {/* Cabeçalho Atualizado com Contexto de Turma */}
        <div className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl font-oswald uppercase">
                  {infoTurma ? "Resultado da Avaliação" : "Relatório de Desempenho"}
                </h1>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                    simulado.status === "CONCLUIDO" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {simulado.status}
                </span>
              </div>
              
              {/* ✅ EXIBIÇÃO DA TURMA NO SUBTÍTULO */}
              {infoTurma ? (
                <div className="mt-2 flex items-center gap-2 text-blue-600 font-bold text-sm uppercase">
                  <School size={16} />
                  <span>Turma: {infoTurma.titulo}</span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500 font-medium">
                  Simulado #{simulado.id} • {simulado.tipo}
                </p>
              )}
            </div>
            
            <div className="flex shrink-0 gap-3">
              <button
                onClick={() => router.push("/estudante/caderno-erros")}
                className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition"
              >
                Caderno de Erros
              </button>
              
              {/* ✅ BOTÃO VOLTAR INTELIGENTE */}
              <button
                onClick={handleVoltar}
                className="flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 transition"
              >
                {infoTurma ? <School size={16} /> : <LayoutDashboard size={16} />}
                {infoTurma ? "Voltar para Turma" : "Voltar"}
              </button>
            </div>
          </div>

          {/* Métricas */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Acertos" value={`${simulado.acertos} / ${simulado.total}`} color="emerald" />
            <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Aproveitamento</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-3xl font-bold text-zinc-900 font-oswald">{percentual}%</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${scoreStyle}`}>
                  {percentual >= 80 ? "Excelente" : percentual >= 50 ? "Bom" : "Atenção"}
                </span>
              </div>
            </div>
            <MetricCard label="Tempo Total" value={formatTempo(simulado.tempoGastoMinutos)} color="amber" />
            <MetricCard label="Revisão Pendente" value={detalhamento.erradas.length} color="red" />
          </div>
          
          {/* ✅ BANNER DE NOTA REGISTRADA (Apenas Turmas) */}
          {infoTurma && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-blue-50 p-4 border border-blue-100 text-blue-700">
              <Sparkles size={20} className="animate-pulse" />
              <p className="text-sm font-medium">
                Esta nota foi registrada oficialmente na sua turma. Seu professor já pode visualizar seu desempenho.
              </p>
            </div>
          )}
        </div>

        {/* --- CARD DE IA (gera ou consulta) --- */}
        <div
          className={[
            "mt-8 rounded-3xl p-8 shadow-lg relative overflow-hidden group",
            temAnalise
              ? "border border-emerald-200 bg-gradient-to-r from-emerald-900 to-teal-900 shadow-emerald-900/10"
              : podeAnalise
              ? "border border-purple-100 bg-gradient-to-r from-purple-900 to-indigo-900 shadow-purple-900/10"
              : "border border-zinc-200 bg-zinc-900 shadow-zinc-900/10",
          ].join(" ")}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all duration-700" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white/90 group-hover:scale-110 transition-all duration-300">
                {podeAnalise ? <BrainCircuit size={40} /> : <Lock size={40} />}
              </div>
              <div>
                <h2 className="text-2xl font-black text-white font-oswald uppercase tracking-wide flex items-center gap-3">
                  {temAnalise ? "Análise Completa Disponível" : "Tutor Inteligente"}
                  <span className="text-[10px] bg-white/15 text-white px-2 py-0.5 rounded border border-white/20">
                    {temAnalise ? "SALVO" : "BETA"}
                  </span>
                </h2>

                {!podeAnalise ? (
                  <p className="text-white/80 text-sm mt-1 max-w-lg font-light leading-relaxed">
                    A análise completa só fica disponível para simulados concluídos.
                  </p>
                ) : temAnalise ? (
                  <p className="text-white/80 text-sm mt-1 max-w-lg font-light leading-relaxed">
                    Você já tem uma análise gerada{" "}
                    <span className="font-semibold">
                      {analise?.createdAt ? `(${formatDateTimeBR(analise.createdAt)})` : ""}
                    </span>
                    . Consulte quando quiser — sem gastar tokens.
                  </p>
                ) : (
                  <p className="text-white/80 text-sm mt-1 max-w-lg font-light leading-relaxed">
                    Descubra padrões ocultos no seu desempenho. A IA analisa Bloom e seus erros para criar um plano de
                    estudo personalizado.
                  </p>
                )}

                {!temAnalise && podeAnalise && !analiseChecked && (
                  <p className="text-white/60 text-xs mt-2">Verificando se já existe análise salva...</p>
                )}
              </div>
            </div>

            <button
              onClick={handleAnaliseClick}
              disabled={!podeAnalise || isGeneratingIA || bloqueadoPorCheck}
              className={[
                "flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all shadow-xl active:scale-95 whitespace-nowrap",
                !podeAnalise || bloqueadoPorCheck
                  ? "bg-white/10 text-white/60 cursor-not-allowed"
                  : "bg-white text-purple-900 hover:bg-purple-50 hover:scale-105",
              ].join(" ")}
            >
              {bloqueadoPorCheck ? (
                <Loader2 size={18} className="animate-spin text-white/70" />
              ) : (
                <Sparkles size={20} className={podeAnalise ? "text-purple-600" : "text-white/70"} />
              )}

              <span>
                {temAnalise ? "Consultar análise" : bloqueadoPorCheck ? "Verificando análise..." : "Gerar Análise Completa"}
              </span>

              <ArrowRight size={18} className={podeAnalise ? "text-gray-400" : "text-white/60"} />
            </button>
          </div>
        </div>

        {/* Detalhamento das Questões */}
        {simulado.status === "CONCLUIDO" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 mt-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 font-oswald uppercase">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-700">
                    ✓
                  </span>{" "}
                  Acertos
                </h2>
                <span className="text-xs font-bold text-zinc-400 uppercase">{detalhamento.acertadas.length} Questões</span>
              </div>

              <div className="space-y-6">
                {detalhamento.acertadas.length === 0 ? (
                  <p className="text-zinc-500 text-center py-8">Nenhum acerto.</p>
                ) : (
                  detalhamento.acertadas.map((item, i) => <QuestaoCard key={item.questaoId} item={item} index={i + 1} />)
                )}
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="sticky top-24 space-y-4">
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 font-oswald uppercase">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs text-amber-700">
                    !
                  </span>{" "}
                  Revisão
                </h2>

                {detalhamento.erradas.map((item) => (
                  <div
                    key={item.questaoId}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm hover:border-amber-200 transition"
                  >
                    <p className="text-xs font-bold uppercase text-zinc-400">Questão {item.questaoId}</p>
                    <button
                      onClick={() => router.push(`/estudante/caderno-erros/revisar/${item.questaoId}`)}
                      className="w-full rounded-lg bg-zinc-900 py-2 text-xs font-bold text-white uppercase hover:bg-zinc-800 transition"
                    >
                      Revisar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Componentes Auxiliares
function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors = { emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className={`absolute left-0 top-0 h-full w-1.5 ${colors[color as keyof typeof colors] || "bg-zinc-500"}`} />
      <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-bold font-oswald text-zinc-900">{value}</p>
    </div>
  );
}

function QuestaoCard({ item, index }: { item: AcertadaItem; index: number }) {
  const marcada = normalizeAlt(item.alternativaMarcada);
  const alts = [
    { k: "a", t: item.questao.alternativaA },
    { k: "b", t: item.questao.alternativaB },
    { k: "c", t: item.questao.alternativaC },
    { k: "d", t: item.questao.alternativaD },
    { k: "e", t: item.questao.alternativaE },
  ] as const;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden hover:shadow-md transition">
      <div className="bg-zinc-50/50 px-6 py-3 border-b border-zinc-50">
        <span className="text-xs font-bold text-zinc-400 uppercase">Questão {index}</span>
      </div>

      <div className="p-6">
        <p className="mb-6 text-sm font-medium text-zinc-800">{item.questao.enunciado}</p>

        <div className="space-y-2">
          {alts.map((alt) => (
            <div
              key={alt.k}
              className={`flex gap-3 p-3 rounded-lg border text-sm ${
                marcada === alt.k ? "bg-emerald-50 border-emerald-200" : "bg-white border-transparent"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold border ${
                  marcada === alt.k
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-zinc-400 border-zinc-200"
                }`}
              >
                {alt.k.toUpperCase()}
              </span>
              <span className={marcada === alt.k ? "text-emerald-900 font-bold" : "text-zinc-600"}>{alt.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
