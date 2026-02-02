'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation'; // ✅ Import Router
import {
  ArrowLeft,
  BrainCircuit,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  BarChart3,
  Clock,
  Printer,
  BookOpen,
  Target,
} from 'lucide-react';

// --- DATA TYPING (Reflecting Backend) ---
interface ItemMetrica {
  chave: string;
  total: number;
  acertos: number;
  acuracia: number;
  erros: number;
  naoRespondidas: number;
  // backend pode mandar também:
  respondidas?: number;
  tempoMedioSeg?: number | null;
}

interface AnaliseData {
  id: number;
  feedbackGeral: string;
  pontosFortes: string;
  pontosFracos: string;
  recomendacoes: string;
  createdAt: string;
  metricasResumo: {
    simulado: {
      // ✅ Compatibilidade: alguns backends retornam "nota", outros "notaPercentual"
      tipo?: string | null;

      // formato antigo (se existir)
      acuraciaGeral?: number | null;
      notaPercentual?: number | null;
      tempoMedioSeg?: number | null;

      // formato novo (se existir)
      nota?: number | null; // <-- seu backend antigo usa isso
      percentualCru?: number | null;
      scorePonderado?: number | null;
      tempoMedioGlobalSeg?: number | null;

      total: number;
      acertos: number;
    };

    // Full lists
    bloom: ItemMetrica[];
    dificuldade: ItemMetrica[];

    // Top/Bottom for hierarchies
    uc: { top: ItemMetrica[]; bottom: ItemMetrica[] };
    capacidades: { top: ItemMetrica[]; bottom: ItemMetrica[] };
    objetos: { top: ItemMetrica[]; bottom: ItemMetrica[] };
    funcoes: { top: ItemMetrica[]; bottom: ItemMetrica[] };
    cursoTecnico: { top: ItemMetrica[]; bottom: ItemMetrica[] };
  };
}

export default function AnaliseInteligentePage() {
  const params = useParams();
  const router = useRouter(); // ✅ Router initialized

  // Normalize id from useParams (can be string | string[])
  const simuladoId = useMemo(() => {
    const raw = (params as any)?.id as string | string[] | undefined;
    const v = Array.isArray(raw) ? raw[0] : raw;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params]);

  const [analise, setAnalise] = useState<AnaliseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 🛡️ 1. ARMOR: Initial Session Validation
  useEffect(() => {
    fetch('/api/csrf')
      .then(res => {
        if (!res.ok) {
          router.push('/auth/login');
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!simuladoId) {
      setLoading(false);
      setError('ID do simulado inválido.');
      return;
    }

    const ac = new AbortController();

    async function fetchAnalise() {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`/api/simulados/${simuladoId}/analise`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: ac.signal,
        });

        if (!res.ok) {
          // 🛡️ 2. ARMOR: Specific Handling
          if (res.status === 401) {
            router.push('/auth/login');
            return;
          }
          if (res.status === 403) {
            // IDOR Attempt or unauthorized access to resource
            router.push('/estudante/historico');
            return;
          }
          if (res.status === 404) {
            // ✅ Correct result route (as per your project/prints)
            router.replace(`/simulado/${simuladoId}/resultado`);
            return;
          }
          throw new Error('Falha ao carregar análise.');
        }

        const json: any = await res.json().catch(() => null);
        if (!json) throw new Error('Resposta vazia do servidor.');

        // Accepts formats:
        // 1) { ok: true, avaliacao: {...} }
        // 2) { avaliacao: {...} }
        // 3) { id: ..., metricasResumo: ... } (direct object)
        const payload =
          (json.ok && json.avaliacao) ? json.avaliacao :
          (json.avaliacao) ? json.avaliacao :
          (json.id) ? json :
          null;

        if (!payload?.id) {
          throw new Error('Formato de dados inesperado.');
        }

        setAnalise(payload as AnaliseData);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error(err);
        setError('Não foi possível carregar os dados da análise.');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalise();
    return () => ac.abort();
  }, [simuladoId, router]);

  const goBackToResultado = () => {
    if (!simuladoId) {
      router.push('/estudante');
      return;
    }
    // ✅ avoid router.back() (might restore cache with old state)
    router.push(`/simulado/${simuladoId}/resultado`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-gray-700 animate-pulse">Carregando Inteligência...</h2>
        <p className="text-gray-500 text-sm mt-2">Interpretando seus resultados.</p>
      </div>
    );
  }

  if (error || !analise) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Ops! Algo deu errado.</h2>
          <p className="text-gray-600 mb-6">{error || 'Análise não encontrada.'}</p>
          <button
            onClick={goBackToResultado}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition"
          >
            Voltar para Resultados
          </button>
        </div>
      </div>
    );
  }

  const renderText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <p key={i} className={`mb-2 ${line.trim().startsWith('•') || line.trim().startsWith('-') ? 'pl-4' : ''}`}>
        {line}
      </p>
    ));
  };

  const createdAtLabel = (() => {
    try {
      return new Date(analise.createdAt).toLocaleDateString('pt-BR');
    } catch {
      return '';
    }
  })();

  const sim = analise.metricasResumo?.simulado;

  // ✅ FIX: score robusto (evita "0%" por mismatch de chave)
  // Prioridade: score ponderado > notaPercentual > nota > percentualCru > 0
  const score = Number(
    sim?.scorePonderado ??
    sim?.notaPercentual ??
    sim?.nota ??
    sim?.percentualCru ??
    0
  );

  const scoreColor = score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = score >= 70 ? 'bg-green-50' : score >= 50 ? 'bg-yellow-50' : 'bg-red-50';

  // ✅ FIX: tempo médio robusto (evita "0s" quando o backend envia fallback global)
  const tempoMedioSeg = sim?.tempoMedioSeg ?? sim?.tempoMedioGlobalSeg ?? null;

  // Reusable Progress Bar Component
  const StatBar = ({ label, item }: { label?: string; item: ItemMetrica }) => (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-bold text-gray-700 capitalize truncate pr-4" title={label || item.chave}>
          {label || item.chave.replace(/_/g, ' ').toLowerCase()}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            {item.acertos}/{item.total}
          </span>
          <span
            className={`text-xs font-bold ${
              item.acuracia >= 0.7 ? 'text-green-600' : item.acuracia >= 0.5 ? 'text-yellow-600' : 'text-red-600'
            }`}
          >
            {(item.acuracia * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            item.acuracia >= 0.7 ? 'bg-green-500' : item.acuracia >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
          }`}
          style={{ width: `${Math.max(0, Math.min(1, item.acuracia)) * 100}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-gray-900 via-purple-900 to-indigo-900 text-white pb-24 pt-10 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={goBackToResultado}
            className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6 font-medium text-sm"
          >
            <ArrowLeft size={18} /> Voltar para Resultados
          </button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-bold border border-white/20 backdrop-blur-sm">
                  IA GENERATIVA v2
                </span>
                <span className="text-white/50 text-xs font-medium">{createdAtLabel}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black font-oswald uppercase tracking-tight mb-2">
                Análise de Desempenho
              </h1>
              <p className="text-indigo-200 text-lg max-w-2xl">
                Relatório técnico detalhado gerado por inteligência artificial.
              </p>
            </div>

            <button
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-md transition text-white"
              title="Imprimir"
              onClick={() => window.print()}
            >
              <Printer size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-16 space-y-8">
        {/* GENERAL SUMMARY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 rounded-xl text-purple-700">
                <BrainCircuit size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Diagnóstico Pedagógico</h2>
            </div>
            <div className="prose prose-gray text-gray-600 leading-relaxed text-sm md:text-base">
              {renderText(analise.feedbackGeral)}
            </div>
          </div>

          <div
            className={`rounded-3xl p-8 border ${scoreBg.replace('bg-', 'border-').replace('50', '200')} ${scoreBg} flex flex-col justify-center items-center text-center shadow-lg`}
          >
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Desempenho Geral</span>
            <div className={`text-6xl font-black mb-2 ${scoreColor}`}>{Number(score).toFixed(0)}%</div>
            <div className="text-sm font-medium text-gray-600 mb-6">
              {(sim?.acertos ?? 0)} acertos de {(sim?.total ?? 0)} questões
            </div>

            <div className="flex items-center gap-2 text-gray-700 bg-white/60 px-4 py-2 rounded-full text-sm font-bold">
              <Clock size={16} />
              Tempo Médio:{' '}
              {tempoMedioSeg == null ? '—' : `${Number(tempoMedioSeg).toFixed(0)}s`}
            </div>
          </div>
        </div>

        {/* TECHNICAL DETAIL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* BLOOM */}
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 size={20} className="text-gray-400" />
              <h3 className="text-lg font-bold text-gray-800">Taxonomia de Bloom</h3>
            </div>
            <div className="space-y-1">
              {(analise.metricasResumo?.bloom ?? []).map((item, i) => (
                <StatBar key={i} item={item} />
              ))}
            </div>
          </section>

          {/* DIFFICULTY */}
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp size={20} className="text-gray-400" />
              <h3 className="text-lg font-bold text-gray-800">Nível de Dificuldade</h3>
            </div>
            <div className="space-y-1">
              {(analise.metricasResumo?.dificuldade ?? []).map((item, i) => (
                <StatBar key={i} item={item} />
              ))}
            </div>
          </section>
        </div>

        {/* CURRICULAR ANALYSIS */}
        <section className="bg-white rounded-3xl shadow-sm border border-blue-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-4">
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Análise Curricular</h3>
              <p className="text-xs text-gray-500">Desempenho por Unidades e Conhecimentos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" /> Pontos Fortes (Top Desempenho)
              </h4>
              {(analise.metricasResumo?.objetos?.top ?? []).length > 0 ? (
                (analise.metricasResumo?.objetos?.top ?? []).map((item, i) => <StatBar key={i} item={item} />)
              ) : (
                <p className="text-sm text-gray-400 italic">Sem dados suficientes.</p>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500" /> Pontos de Atenção (Revisar)
              </h4>
              {(analise.metricasResumo?.objetos?.bottom ?? []).filter((x) => x.acuracia < 1).length > 0 ? (
                (analise.metricasResumo?.objetos?.bottom ?? [])
                  .filter((x) => x.acuracia < 1)
                  .map((item, i) => <StatBar key={i} item={item} />)
              ) : (
                <p className="text-sm text-gray-400 italic">Nenhum ponto crítico identificado.</p>
              )}
            </div>
          </div>
        </section>

        {/* TECHNOLOGICAL AXIS */}
        <section className="bg-white rounded-3xl shadow-sm border border-indigo-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-4">
            <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
              <Target size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Eixo Tecnológico & Competências</h3>
              <p className="text-xs text-gray-500">Capacidades Técnicas e Funções</p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-4">Capacidades Técnicas Avaliadas</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                {(analise.metricasResumo?.capacidades?.top ?? []).map((item, i) => (
                  <StatBar key={`cap-top-${i}`} item={item} />
                ))}
                {(analise.metricasResumo?.capacidades?.bottom ?? []).map((item, i) => (
                  <StatBar key={`cap-bot-${i}`} item={item} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ACTION PLAN & RECOMMENDATIONS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl shadow-xl text-white p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
              <Lightbulb size={180} />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Lightbulb className="text-yellow-300" /> Recomendações de Estudo
              </h3>
              <div className="text-indigo-50 text-sm leading-relaxed space-y-2">
                {renderText(analise.recomendacoes)}
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="bg-green-50 border border-green-100 rounded-3xl p-6 h-full">
              <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">
                <TrendingUp size={20} /> O que você dominou
              </h3>
              <div className="text-green-700 text-sm leading-relaxed">{renderText(analise.pontosFortes)}</div>
            </section>

            <section className="bg-red-50 border border-red-100 rounded-3xl p-6 h-full">
              <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={20} /> O que precisa rever
              </h3>
              <div className="text-red-700 text-sm leading-relaxed">{renderText(analise.pontosFracos)}</div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
