'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CheckCircle,
  Clock,
  PlayCircle,
  ShieldAlert,
  Maximize,
  XCircle,
  LogOut,
  Star,
  Zap,
  Loader2,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Target,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { sanitizeString } from '@/lib/sanitize';
import { useCsrf } from '@/lib/hooks/use-csrf';
import { toast } from 'sonner';
import Image from 'next/image';

// --- CONFIGURAÇÃO ---
const DEFAULT_MAX_INFRACOES = 3;
const STRIKE_DEBOUNCE_MS = 1200;

type Alternativa = 'a' | 'b' | 'c' | 'd' | 'e';

// ✅ Eventos de gamificação
type GamificationEvent =
  | { type: 'XP_EARNED'; amount: number; label?: string }
  | { type: 'LEVEL_UP'; from: number; to: number }
  | { type: 'TITLE_UNLOCKED'; title: string }
  | { type: 'ACHIEVEMENT_UNLOCKED'; name: string; rarity?: string; points?: number }
  | { type: 'STREAK_UPDATED'; current: number; best?: number };

const GAMIF_STORAGE_KEY = 'simmula:gamification:events';

function extractGamificationEventsFromFinalize(data: any): GamificationEvent[] {
  if (Array.isArray(data?.events)) return data.events as GamificationEvent[];
  if (Array.isArray(data?.gamificacao?.events)) return data.gamificacao.events as GamificationEvent[];

  const g = data?.gamificacao;
  if (!g || typeof g !== 'object') return [];

  const events: GamificationEvent[] = [];

  const xp = Number(g?.xpGanhoTotal ?? g?.xpConcedido ?? 0);
  if (Number.isFinite(xp) && xp > 0) {
    events.push({ type: 'XP_EARNED', amount: xp, label: 'Simulado finalizado' });
  }

  if (typeof g?.tituloNovo === 'string' && g.tituloNovo.trim()) {
    events.push({ type: 'TITLE_UNLOCKED', title: g.tituloNovo });
  }

  if (Array.isArray(g?.conquistas)) {
    for (const c of g.conquistas) {
      if (!c) continue;
      const name = String(c?.nome ?? c?.name ?? 'Conquista desbloqueada');
      const rarity = typeof c?.raridade === 'string' ? c.raridade : typeof c?.rarity === 'string' ? c.rarity : undefined;
      const points = typeof c?.pontosReais === 'number' ? c.pontosReais : typeof c?.points === 'number' ? c.points : undefined;
      events.push({ type: 'ACHIEVEMENT_UNLOCKED', name, rarity, points });
    }
  }
  return events;
}

function persistGamificationEvents(events: GamificationEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    if (events?.length) {
      sessionStorage.setItem(GAMIF_STORAGE_KEY, JSON.stringify(events));
    } else {
      sessionStorage.removeItem(GAMIF_STORAGE_KEY);
    }
  } catch { }
}

// --- TIPAGEM ---
interface Imagem { url: string; }

interface Questao {
  id: number;
  enunciado: string;
  alternativaA: string;
  alternativaB: string;
  alternativaC: string;
  alternativaD: string;
  alternativaE: string;
  imagens: Imagem[];
  unidadeCurricular?: { nome: string };
  nivelCognitivo?: string;
  favoritada?: boolean;
}

interface ItemSimulado {
  id: number;
  questaoId: number;
  questao: Questao;
}

interface Simulado {
  id: number;
  tipo: string;
  qtdeQuestoes: number;
  tempoLimiteMinutos: number;
  status: string;
  simuladosQuestoes: ItemSimulado[];
  dataInicio?: string;
  strikesUsados?: number;
  strikesMax?: number;
  anuladoMotivo?: string | null;
}

// --- UI: Confirm Modal (Refinado) ---
const ConfirmSubmitModal = ({ total, respondidas, onClose, onConfirm }: any) => {
  const emBranco = total - respondidas;
  return (
    <div className="fixed inset-0 bg-indigo-950/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 ring-1 ring-black/5">
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-3 w-full"></div>
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-5 shadow-inner">
            <AlertTriangle size={40} strokeWidth={2} />
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-2 font-oswald uppercase tracking-wide">
            Finalizar Prova?
          </h3>
          
          <p className="text-gray-500 mb-6 text-sm font-lato leading-relaxed">
            Ao entregar, você não poderá alterar suas respostas. O cálculo da pontuação é definitivo.
          </p>

          {emBranco > 0 ? (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl w-full mb-6 flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-full text-red-600">
                <XCircle size={20} />
              </div>
              <div className="text-left">
                <p className="text-xs text-red-600 font-bold uppercase">Atenção</p>
                <p className="text-sm text-red-800">
                  <span className="font-black">{emBranco}</span> {emBranco === 1 ? 'questão' : 'questões'} sem resposta.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl w-full mb-6 flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                <CheckCircle size={20} />
              </div>
              <div className="text-left">
                <p className="text-xs text-emerald-600 font-bold uppercase">Tudo certo</p>
                <p className="text-sm text-emerald-800 font-medium">Todas as questões respondidas!</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <button 
              onClick={onClose} 
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-95 text-sm uppercase font-oswald tracking-wide"
            >
              Revisar
            </button>
            <button 
              onClick={onConfirm} 
              className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-200 transition-all active:scale-95 text-sm uppercase font-oswald tracking-wide"
            >
              Entregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- UI: Security Blocker (Estilo Alerta Vermelho) ---
const SecurityBlocker = ({ onResume, onAbandon, motivo }: { onResume: () => void, onAbandon: () => void, motivo: string }) => (
  <div className="fixed inset-0 bg-red-950 z-[999] flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-300">
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
    <div className="relative z-10 max-w-lg w-full">
      <div className="w-24 h-24 bg-red-900/50 text-red-500 rounded-full flex items-center justify-center mb-8 mx-auto ring-4 ring-red-900/30 animate-pulse">
        <ShieldAlert size={48} strokeWidth={1.5} />
      </div>
      
      <h1 className="text-4xl md:text-5xl font-black text-white mb-2 uppercase tracking-tight font-oswald">
        Bloqueio de Segurança
      </h1>
      <p className="text-red-400 font-bold uppercase tracking-widest text-sm mb-8 bg-red-900/30 inline-block px-4 py-1 rounded-full">
        {motivo}
      </p>
      
      <p className="text-red-100/80 text-lg mb-10 leading-relaxed font-lato max-w-md mx-auto">
        O sistema detectou uma violação do ambiente seguro. Retorne imediatamente ou sua prova será anulada permanentemente.
      </p>

      <div className="flex flex-col gap-4">
        <button 
          onClick={onResume} 
          className="w-full bg-white text-red-900 px-6 py-4 rounded-2xl font-black text-lg hover:bg-red-50 hover:scale-[1.02] transition-all shadow-[0_0_30px_-10px_rgba(255,255,255,0.5)] flex items-center justify-center gap-3 font-oswald uppercase"
        >
          <Maximize size={24} /> Retornar à Prova
        </button>
        <button 
          onClick={onAbandon} 
          className="w-full bg-transparent text-red-400 px-6 py-3 rounded-2xl font-bold text-sm hover:text-white transition-colors flex items-center justify-center gap-2 font-oswald uppercase tracking-wider"
        >
          <XCircle size={18} /> Desistir e Sair
        </button>
      </div>
    </div>
  </div>
);

export default function SimuladoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const csrfToken = useCsrf();

  // DADOS
  const [simulado, setSimulado] = useState<Simulado | null>(null);
  const [loading, setLoading] = useState(true);
  const [favoritosIds, setFavoritosIds] = useState<Set<number>>(new Set());

  // ESTADOS
  const [started, setStarted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // SEGURANÇA
  const [infracoes, setInfracoes] = useState(0);
  const [bloqueioAtivo, setBloqueioAtivo] = useState<string | null>(null);
  const ignorarSecurity = useRef(false);
  const lastStrikeAtRef = useRef<number>(0);

  // EXECUÇÃO
  const [respostas, setRespostas] = useState<Record<string, Alternativa>>({});
  const [questaoAtual, setQuestaoAtual] = useState(0);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [finalizando, setFinalizando] = useState(false);
  const [erroSubmit, setErroSubmit] = useState<string | null>(null);

  // MANIPULAÇÃO DE ARRAY
  const shuffleArray = (array: Alternativa[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const ordemRef = useRef<Record<number, Alternativa[]>>({});

  const safeConfirm = (msg: string) => {
    ignorarSecurity.current = true;
    const res = window.confirm(msg);
    setTimeout(() => { ignorarSecurity.current = false; }, 500);
    return res;
  };

  const getMaxInfracoes = useCallback(() => {
    return simulado?.strikesMax ?? DEFAULT_MAX_INFRACOES;
  }, [simulado?.strikesMax]);

  // --- LOGICA DE STRIKES ---
  const registrarStrike = useCallback(async (motivo: string) => {
    if (!started || finalizando) return;
    if (ignorarSecurity.current) return;

    const now = Date.now();
    if (now - lastStrikeAtRef.current < STRIKE_DEBOUNCE_MS) return;
    lastStrikeAtRef.current = now;

    const max = getMaxInfracoes();

    setInfracoes((prev) => Math.min(prev + 1, max));
    setBloqueioAtivo(motivo);

    try {
      const res = await fetch(`/api/simulados/${id}/strike`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({ motivo })
      });

      if (res.status === 404) return;
      const data = await res.json().catch(() => null);

      if (data && typeof data.strikesUsados === 'number') {
        setInfracoes(data.strikesUsados);
      }

      if (data?.status === 'ANULADO') {
        ignorarSecurity.current = true;
        setBloqueioAtivo(null);
        localStorage.removeItem(`simulado-${id}-backup`);
        if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
        router.replace(`/simulado/${id}/resultado`);
      }
    } catch { }

    setInfracoes((prev) => {
      if (prev >= max) {
        ignorarSecurity.current = true;
        setTimeout(() => {
          setBloqueioAtivo(null);
          localStorage.removeItem(`simulado-${id}-backup`);
          if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
          router.replace(`/simulado/${id}/resultado`);
        }, 50);
      }
      return prev;
    });
  }, [started, finalizando, id, csrfToken, router, getMaxInfracoes]);

  const handleToggleFavorito = async (questaoId: number) => {
    const jaFavorito = favoritosIds.has(questaoId);
    setFavoritosIds(prev => {
      const novo = new Set(prev);
      if (jaFavorito) novo.delete(questaoId);
      else novo.add(questaoId);
      return novo;
    });

    try {
      const res = await fetch('/api/estudante/favoritos/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({ questaoId })
      });

      if (!res.ok) {
        setFavoritosIds(prev => {
          const novo = new Set(prev);
          if (jaFavorito) novo.add(questaoId);
          else novo.delete(questaoId);
          return novo;
        });
      }
    } catch (e) {
      setFavoritosIds(prev => {
        const novo = new Set(prev);
        if (jaFavorito) novo.add(questaoId);
        else novo.delete(questaoId);
        return novo;
      });
    }
  };

  const handleAbandonar = useCallback(async (motivo: string) => {
    try {
      const res = await fetch(`/api/simulados/${id}/abandonar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({ motivo })
      });

      if (res.status === 401) {
        localStorage.removeItem(`simulado-${id}-backup`);
        if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
        router.replace('/login');
        return;
      }

      localStorage.removeItem(`simulado-${id}-backup`);
      if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
      router.replace('/estudante');
    } catch {
      localStorage.removeItem(`simulado-${id}-backup`);
      if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
      router.replace('/estudante');
    }
  }, [id, router, csrfToken]);

  const handleFinalizar = useCallback(async () => {
    if (!id || finalizando) return;

    setErroSubmit(null);
    setFinalizando(true);
    setShowConfirm(false);

    try {
      const res = await fetch(`/api/simulados/${id}/finalizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({ respostas })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        setErroSubmit(data?.error || 'Erro ao finalizar.');
        setFinalizando(false);
        return;
      }

      const events = extractGamificationEventsFromFinalize(data);
      persistGamificationEvents(events);

      toast.success('Prova entregue!', {
        description: 'Computando pontuação...',
        duration: 2000,
      });

      localStorage.removeItem(`simulado-${id}-backup`);
      if (document.exitFullscreen) document.exitFullscreen().catch(() => { });

      setTimeout(() => {
        router.replace(`/simulado/${id}/resultado`);
      }, 900);

    } catch (error) {
      setErroSubmit('Erro de conexão.');
      setFinalizando(false);
    }
  }, [id, respostas, router, csrfToken, finalizando]);

  useEffect(() => {
    if (id && Object.keys(respostas).length > 0) {
      localStorage.setItem(`simulado-${id}-backup`, JSON.stringify({
        respostas,
        questaoAtual,
        tempoRestante,
        timestamp: Date.now()
      }));
    }
  }, [respostas, questaoAtual, tempoRestante, id]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();

    async function fetchSimulado() {
      try {
        const res = await fetch(`/api/simulados/${id}`, { credentials: 'include', signal: controller.signal });
        if (!res.ok) {
          if (res.status === 401) router.push('/login');
          else router.push('/estudante');
          return;
        }

        const data: Simulado = await res.json();

        if (data.status === 'CONCLUIDO' || data.status === 'ANULADO' || data.status === 'ABANDONADO') {
          router.replace(`/simulado/${id}/resultado`);
          return;
        }

        data.simuladosQuestoes.forEach((sq) => {
          if (!ordemRef.current[sq.questaoId]) {
            ordemRef.current[sq.questaoId] = shuffleArray(['a', 'b', 'c', 'd', 'e']);
          }
        });

        setSimulado(data);

        if (typeof data.strikesUsados === 'number') setInfracoes(data.strikesUsados);

        const limiteSeg = (data.tempoLimiteMinutos || 0) * 60;
        let restante = limiteSeg;

        if (data.dataInicio) {
          const inicioMs = new Date(data.dataInicio).getTime();
          if (Number.isFinite(inicioMs)) {
            const elapsed = Math.floor((Date.now() - inicioMs) / 1000);
            restante = Math.max(0, limiteSeg - Math.max(0, elapsed));
          }
        }
        setTempoRestante(restante);

        const temFavoritadaNoPayload = data.simuladosQuestoes?.some((sq) => typeof sq.questao?.favoritada === 'boolean') ?? false;
        if (temFavoritadaNoPayload) {
          const fav = new Set<number>();
          data.simuladosQuestoes.forEach((sq) => {
            if (sq.questao?.favoritada) fav.add(sq.questaoId);
          });
          setFavoritosIds(fav);
        } else {
          fetch('/api/estudante/favoritos/ids', { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then((ids: number[]) => setFavoritosIds(new Set(ids)))
            .catch(() => { });
        }

        const backup = localStorage.getItem(`simulado-${id}-backup`);
        if (backup) {
          const bd = JSON.parse(backup);
          if (bd?.respostas && typeof bd.respostas === 'object') setRespostas(bd.respostas);
          if (typeof bd?.questaoAtual === 'number' && bd.questaoAtual >= 0) setQuestaoAtual(bd.questaoAtual);
          if (typeof bd?.tempoRestante === 'number' && bd.tempoRestante > 0 && bd.tempoRestante <= restante) {
            setTempoRestante(bd.tempoRestante);
          }
        }
      } catch {
        if (!controller.signal.aborted) router.push('/estudante');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchSimulado();
    return () => controller.abort();
  }, [id, router]);

  // --- MONITOREO DE SEGURANÇA ---
  useEffect(() => {
    if (!started || finalizando) return;

    const handleVis = () => { if (document.hidden) registrarStrike('Aba oculta'); };
    const handleBlur = () => { setTimeout(() => { if (!document.hasFocus()) registrarStrike('Foco perdido'); }, 100); };
    const handleFullscreen = () => { if (!document.fullscreenElement) registrarStrike('Saiu da tela cheia'); };

    const handleKeydown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase?.() || '';
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const block = key === 'f12' || (ctrl && shift && (key === 'i' || key === 'j' || key === 'c')) || (ctrl && (key === 'p' || key === 's' || key === 'u')) || key === 'printscreen';

      if (block) {
        e.preventDefault();
        registrarStrike('Atalho proibido');
      }
    };

    const handleClipboard = (e: ClipboardEvent) => { e.preventDefault(); registrarStrike('Clipboard bloqueado'); };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };

    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreen);
    window.addEventListener('keydown', handleKeydown, { capture: true });
    document.addEventListener('copy', handleClipboard);
    document.addEventListener('cut', handleClipboard);
    document.addEventListener('paste', handleClipboard);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      window.removeEventListener('keydown', handleKeydown, { capture: true } as any);
      document.removeEventListener('copy', handleClipboard);
      document.removeEventListener('cut', handleClipboard);
      document.removeEventListener('paste', handleClipboard);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [started, finalizando, registrarStrike]);

  useEffect(() => {
    if (!started) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, [started]);

  const enterFullscreen = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      setStarted(true);
    } catch {
      setStarted(true);
    }
  };

  useEffect(() => {
    if (!started || finalizando || tempoRestante <= 0) return;
    const timer = setInterval(() => setTempoRestante(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [started, finalizando, tempoRestante]);

  useEffect(() => {
    if (tempoRestante === 0 && started && !finalizando) handleFinalizar();
  }, [tempoRestante, started, finalizando, handleFinalizar]);

  const formatarTempo = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-gray-500 font-oswald uppercase tracking-widest text-sm">Carregando Prova...</p>
        </div>
      </div>
    );
  }
  if (!simulado) return null;

  const maxInfracoes = getMaxInfracoes();

  // --- TELA INICIAL (Lobby) ---
  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 select-none font-sans relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-10 right-10 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 p-8 md:p-12 rounded-3xl shadow-2xl max-w-md w-full text-center animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg rotate-3 hover:rotate-6 transition-transform">
            <PlayCircle size={48} className="text-white" strokeWidth={1.5} />
          </div>
          
          <h1 className="text-3xl font-black text-white mb-2 font-oswald uppercase tracking-wide">
            {simulado.tipo === 'SAEP' ? 'Simulado Oficial' : 'Treino Prático'}
          </h1>
          
          <div className="flex justify-center gap-4 mb-8">
            <span className="bg-indigo-900/50 text-indigo-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
              {simulado.qtdeQuestoes} Questões
            </span>
            <span className="bg-indigo-900/50 text-indigo-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
              {simulado.tempoLimiteMinutos} Minutos
            </span>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 text-left">
            <p className="text-red-200 text-sm font-lato leading-relaxed flex gap-3">
              <ShieldAlert className="shrink-0 text-red-400" size={20} />
              <span>
                Ambiente monitorado. <br/>
                <strong className="text-white">Limite de {maxInfracoes} infrações</strong> (sair da tela, atalhos, etc).
              </span>
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={enterFullscreen}
              className="w-full bg-white text-indigo-950 py-4 rounded-xl font-black text-lg hover:bg-indigo-50 hover:scale-[1.02] shadow-[0_0_20px_-5px_rgba(255,255,255,0.4)] transition-all font-oswald uppercase tracking-widest flex items-center justify-center gap-2 group"
            >
              Iniciar Prova <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => router.push('/estudante')}
              className="w-full text-indigo-300 font-bold py-3 hover:text-white text-sm font-oswald uppercase tracking-wider transition-colors"
            >
              Cancelar e Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (bloqueioAtivo) {
    return (
      <SecurityBlocker
        motivo={bloqueioAtivo}
        onResume={() => { setBloqueioAtivo(null); document.documentElement.requestFullscreen().catch(() => { }); }}
        onAbandon={() => { if (safeConfirm('Tem certeza?')) handleAbandonar('Desistência'); }}
      />
    );
  }

  const itemAtual = simulado.simuladosQuestoes[questaoAtual];
  const qData = itemAtual.questao;
  const qId = itemAtual.questaoId;
  const qKey = String(qId);
  const ordem = ordemRef.current[qId] || ['a', 'b', 'c', 'd', 'e'];
  const respondidasCount = Object.keys(respostas).length;
  const isFavorito = favoritosIds.has(qId);
  const totalQuestoes = simulado.simuladosQuestoes.length;
  const percentual = Math.round((respondidasCount / totalQuestoes) * 100);

  // --- DRAWER MOBILE ---
  const DrawerContent = () => (
    <>
      {drawerOpen && (
        <div className="fixed inset-0 bg-indigo-950/60 z-40 lg:hidden backdrop-blur-sm animate-in fade-in" onClick={() => setDrawerOpen(false)} />
      )}
      <div className={`fixed top-0 right-0 h-full w-[85%] max-w-sm bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out lg:hidden ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col bg-gray-50/50">
          <div className="bg-white p-5 flex items-center justify-between border-b border-gray-100 shadow-sm sticky top-0 z-10">
            <div>
              <h3 className="font-bold text-gray-900 font-oswald uppercase text-lg">Mapa da Prova</h3>
              <p className="text-xs text-gray-500 font-medium">Navegue pelas questões</p>
            </div>
            <button onClick={() => setDrawerOpen(false)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition text-gray-600">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Stats Mobile */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                <Target className="text-indigo-500 mb-2" size={24} />
                <span className="text-2xl font-bold text-gray-900">{respondidasCount}</span>
                <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Respondidas</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                <BarChart3 className="text-emerald-500 mb-2" size={24} />
                <span className="text-2xl font-bold text-gray-900">{percentual}%</span>
                <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Concluído</span>
              </div>
            </div>

            {/* Grid Map */}
            <div>
              <h4 className="font-bold text-gray-400 text-xs uppercase tracking-widest mb-3 font-oswald">Questões</h4>
              <div className="grid grid-cols-5 gap-2">
                {simulado.simuladosQuestoes.map((sq, index) => {
                  const isRespondida = !!respostas[String(sq.questaoId)];
                  const isAtual = index === questaoAtual;
                  return (
                    <button
                      key={sq.id}
                      onClick={() => { setQuestaoAtual(index); setDrawerOpen(false); }}
                      className={`
                        aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all relative
                        ${isAtual ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2 scale-105 z-10' 
                        : isRespondida ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                        : 'bg-white text-gray-400 border border-gray-200 hover:border-indigo-300'}
                      `}
                    >
                      {index + 1}
                      {isRespondida && !isAtual && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Strikes Mobile */}
            {maxInfracoes > 0 && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <div className="flex items-center gap-2 mb-3 text-red-700">
                  <ShieldAlert size={16} />
                  <span className="font-bold text-xs uppercase font-oswald">Infrações de Segurança</span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: maxInfracoes }).map((_, i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${i < infracoes ? 'bg-red-500' : 'bg-red-200/50'}`} />
                  ))}
                </div>
                <p className="text-[10px] text-red-500 mt-2 text-right font-bold">{infracoes}/{maxInfracoes}</p>
              </div>
            )}
          </div>

          <div className="p-5 bg-white border-t border-gray-100">
            <button
              onClick={() => { if (safeConfirm('Deseja realmente desistir da prova?')) handleAbandonar('Desistência'); }}
              className="w-full py-3.5 border-2 border-red-100 text-red-500 rounded-xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 font-oswald uppercase text-sm tracking-wide"
            >
              <LogOut size={16} /> Desistir da Prova
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col select-none font-sans overflow-hidden text-gray-900 pb-[80px] lg:pb-0">
      
      {/* BACKGROUND MESH (Subtle) */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-200/40 blur-[100px]" />
        <div className="absolute top-[30%] -right-[10%] w-[40%] h-[40%] rounded-full bg-purple-200/40 blur-[100px]" />
      </div>

      {/* MONITORAMENTO STATUS BAR */}
      {maxInfracoes > 0 && (
        <div className={`h-1 w-full flex absolute top-0 z-50 ${infracoes > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}>
          <div className="flex-1 bg-transparent" />
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200/60 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Esquerda: Info da Questão */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-oswald">Questão</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-indigo-900 font-oswald">{questaoAtual + 1}</span>
                <span className="text-xs text-gray-400 font-medium">/ {totalQuestoes}</span>
              </div>
            </div>
            
            {/* Barra de progresso linear (Mobile) */}
            <div className="hidden md:block w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" 
                style={{ width: `${percentual}%` }}
              />
            </div>
          </div>

          {/* Centro: Timer (Desktop) */}
          <div className="hidden md:flex items-center gap-2 bg-gray-100/50 px-4 py-1.5 rounded-full border border-gray-200/50">
             <Clock size={16} className={tempoRestante < 300 ? 'text-red-500 animate-pulse' : 'text-indigo-500'} />
             <span className={`font-mono font-bold text-lg ${tempoRestante < 300 ? 'text-red-600' : 'text-gray-700'}`}>
               {formatarTempo(tempoRestante)}
             </span>
          </div>

          {/* Direita: Ações */}
          <div className="flex items-center gap-3">
             {/* Timer Mobile (Compacto) */}
             <div className="md:hidden flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-lg">
                <Clock size={14} className={tempoRestante < 300 ? 'text-red-500' : 'text-gray-500'} />
                <span className={`font-mono font-bold text-sm ${tempoRestante < 300 ? 'text-red-600' : 'text-gray-700'}`}>
                  {formatarTempo(tempoRestante)}
                </span>
             </div>

             <button 
               onClick={() => setDrawerOpen(true)}
               className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 active:scale-95 transition shadow-sm"
             >
               <Menu size={20} />
             </button>
          </div>
        </div>

        {/* Loading Bar Global */}
        <div className="absolute bottom-0 left-0 h-[2px] bg-indigo-600 transition-all duration-300" style={{ width: `${percentual}%` }} />
      </header>

      {/* LAYOUT PRINCIPAL */}
      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        
        <DrawerContent />

        {/* COLUNA ESQUERDA: QUESTÃO (Ocupa 8 colunas no desktop) */}
        <div className="lg:col-span-8 space-y-6 pb-20 lg:pb-0">
          
          {/* Header da Questão */}
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
               <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wide border border-indigo-100">
                 <BookOpen size={12} /> {qData.unidadeCurricular?.nome || 'Geral'}
               </span>
               {qData.nivelCognitivo && (
                 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wide border border-purple-100">
                   <BrainCircuit size={12} /> {qData.nivelCognitivo}
                 </span>
               )}
            </div>

            <button
              onClick={() => handleToggleFavorito(qId)}
              className={`group flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors ${isFavorito ? 'text-amber-500' : 'text-gray-400 hover:text-amber-400'}`}
            >
              <Star size={18} fill={isFavorito ? 'currentColor' : 'none'} className="transition-transform group-active:scale-125" />
              <span className="hidden sm:inline">{isFavorito ? 'Salvo' : 'Salvar'}</span>
            </button>
          </div>

          {/* CARD DA QUESTÃO */}
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-white ring-1 ring-gray-100 overflow-hidden">
             
             {/* Enunciado Area */}
             <div className="p-6 md:p-8">
               <div 
                 className="prose prose-indigo prose-lg max-w-none text-gray-700 leading-relaxed font-lato"
                 dangerouslySetInnerHTML={{ __html: sanitizeString(qData.enunciado) }}
               />

              {/* Imagem */}
              {qData.imagens && qData.imagens.length > 0 && (
                <div className="mt-8 relative group">
                  <div className="absolute inset-0 bg-gray-900/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none z-10" />
                  <Image
                    src={qData.imagens[0].url}
                    alt="Figura auxiliar"
                    width={0}
                    height={0}
                    sizes="100vw"
                    className="w-full h-auto max-h-[400px] object-contain bg-gray-50 border border-gray-100 rounded-2xl"
                  />
                </div>
               )}
             </div>

             {/* Alternativas Area */}
             <div className="bg-gray-50/50 p-4 md:p-8 space-y-3 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2 block font-oswald">Alternativas</span>
                
                {ordem.map((letra, idx) => {
                  const labelVisual = ['A', 'B', 'C', 'D', 'E'][idx];
                  const texto = (qData as any)[`alternativa${letra.toUpperCase()}`];
                  const selecionada = respostas[qKey] === letra;

                  return (
                    <button
                      key={letra}
                      onClick={() => setRespostas(p => ({ ...p, [qKey]: letra }))}
                      className={`
                        w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-start gap-4 group relative overflow-hidden
                        ${selecionada 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 transform scale-[1.01]' 
                          : 'bg-white border-transparent shadow-sm hover:border-indigo-200 hover:shadow-md text-gray-700'
                        }
                      `}
                    >
                      {/* Efeito Glow quando selecionado */}
                      {selecionada && (
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 blur-2xl rounded-full pointer-events-none" />
                      )}

                      <div className={`
                        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm font-oswald transition-colors
                        ${selecionada ? 'bg-white text-indigo-600' : 'bg-gray-100 text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}
                      `}>
                        {labelVisual}
                      </div>

                      <div 
                        className={`pt-1 text-sm md:text-base leading-relaxed ${selecionada ? 'font-medium text-indigo-50' : 'font-normal'}`}
                        dangerouslySetInnerHTML={{ __html: sanitizeString(texto) }} 
                      />
                      
                      {selecionada && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300"><CheckCircle size={20} /></div>}
                    </button>
                  );
                })}

                {/* --- 1. BOTÃO PRÓXIMA QUESTÃO (INSERIDO AQUI) --- */}
                <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
                   {questaoAtual < totalQuestoes - 1 ? (
                     <button
                       onClick={() => {
                         setQuestaoAtual((p) => Math.min(totalQuestoes - 1, p + 1));
                         window.scrollTo({ top: 0, behavior: 'smooth' });
                       }}
                       className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold font-oswald uppercase tracking-wide flex items-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
                     >
                       Próxima Questão <ArrowRight size={18} />
                     </button>
                   ) : (
                     <button
                        onClick={() => setShowConfirm(true)}
                        className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold font-oswald uppercase tracking-wide flex items-center gap-2 shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
                     >
                        Finalizar Prova <CheckCircle size={18} />
                     </button>
                   )}
                </div>
                {/* ----------------------------------------------- */}

             </div>
          </div>
        </div>

        {/* COLUNA DIREITA: SIDEBAR (Desktop Only) */}
        <div className="hidden lg:block lg:col-span-4 space-y-6">
           <div className="sticky top-24">
              
              {/* Card Resumo */}
              <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100">
                 <h3 className="font-bold text-gray-900 font-oswald uppercase text-sm mb-6 flex items-center gap-2">
                   <Target className="text-indigo-600" size={18} />
                   Mapa da Prova
                 </h3>

                 {/* Grid de Navegação Desktop */}
                 <div className="grid grid-cols-5 gap-2.5 mb-8">
                    {simulado.simuladosQuestoes.map((sq, index) => {
                      const isRespondida = !!respostas[String(sq.questaoId)];
                      const isAtual = index === questaoAtual;
                      return (
                        <button
                          key={sq.id}
                          onClick={() => setQuestaoAtual(index)}
                          className={`
                            aspect-square rounded-xl flex items-center justify-center text-xs font-bold transition-all
                            ${isAtual ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300 scale-110 ring-2 ring-offset-2 ring-indigo-600 z-10' 
                            : isRespondida ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100' 
                            : 'bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100 hover:text-gray-600'}
                          `}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                 </div>

                 {/* Legenda */}
                 <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wide border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Feito</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-600" /> Atual</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-gray-200" /> Pendente</div>
                 </div>
              </div>

              {/* Botão Finalizar Desktop */}
              <button
                onClick={() => setShowConfirm(true)}
                disabled={finalizando}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-800 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-oswald"
              >
                {finalizando ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} className="fill-yellow-400 text-yellow-400" />}
                {finalizando ? 'Processando...' : 'Finalizar Prova'}
              </button>

              {/* --- 2. BOTÃO DESISTIR (INSERIDO AQUI) --- */}
              <button
                onClick={() => {
                   if (safeConfirm('Tem certeza que deseja abandonar a prova? Todo o progresso será perdido e uma penalidade será aplicada.')) {
                      handleAbandonar('Desistência');
                   }
                }}
                className="w-full py-3 mt-3 text-red-400 font-bold text-xs uppercase tracking-widest hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={14} /> Desistir / Sair
              </button>
              {/* ------------------------------------------ */}
              
           </div>
        </div>

      </main>

      {/* FOOTER NAVEGAÇÃO (Mobile Fixed) */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-3 z-30 lg:hidden safe-area-bottom shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 max-w-md mx-auto">
           <button
             onClick={() => setQuestaoAtual(p => Math.max(0, p - 1))}
             disabled={questaoAtual === 0}
             className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-transform"
           >
             <ChevronLeft size={24} />
           </button>

           {questaoAtual < totalQuestoes - 1 ? (
             <button
               onClick={() => setQuestaoAtual(p => p + 1)}
               className="flex-1 h-12 bg-indigo-600 text-white rounded-xl font-bold font-oswald uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all"
             >
               Próxima <ChevronRight size={18} />
             </button>
           ) : (
             <button
               onClick={() => setShowConfirm(true)}
               disabled={finalizando}
               className="flex-1 h-12 bg-emerald-600 text-white rounded-xl font-bold font-oswald uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-[0.98] transition-all"
             >
               {finalizando ? <Loader2 className="animate-spin" /> : <CheckCircle size={18} />}
               Entregar
             </button>
           )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO */}
      {showConfirm && (
        <ConfirmSubmitModal
          total={totalQuestoes}
          respondidas={respondidasCount}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleFinalizar}
        />
      )}

      {/* OVERLAY LOADING FINAL */}
      {finalizando && (
        <div className="fixed inset-0 bg-white/80 z-[200] flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in cursor-wait">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap size={24} className="text-indigo-600 fill-indigo-600 animate-pulse" />
            </div>
          </div>
          <h3 className="font-bold text-gray-900 text-xl font-oswald uppercase mt-6 mb-1">
            Salvando Respostas
          </h3>
          <p className="text-gray-500 text-sm font-medium">Não feche a página...</p>
        </div>
      )}

      {/* ESTILOS GLOBAIS EXTRAS */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;700&family=Lato:wght@400;700&display=swap');
        
        body { 
          overscroll-behavior: none;
          -webkit-tap-highlight-color: transparent;
        }
        
        /* Fontes customizadas (se não estiverem no layout root) */
        .font-oswald { font-family: 'Oswald', sans-serif; }
        .font-lato { font-family: 'Lato', sans-serif; }

        /* Animação Blob */
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }

        /* Safe Area para Mobile (iPhone X+) */
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
      `}</style>
    </div>
  );
}