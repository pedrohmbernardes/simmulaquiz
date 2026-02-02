'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock,
  CheckCircle,
  ChevronRight,
  AlertTriangle,
  XCircle,
  PauseCircle,
  ChevronLeft,
  TrendingUp,
  Target,
  Award,
} from 'lucide-react';

type StatusSimulado = 'EM_ANDAMENTO' | 'CONCLUIDO' | 'ABANDONADO' | 'ANULADO';

interface SimuladoHistorico {
  id: number;
  tipo: string;
  status: StatusSimulado;
  notaPercentual: number | null;
  qtdeQuestoes: number;
  createdAt: string;
}

type HistoricoResponse = {
  data: SimuladoHistorico[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
};

const PAGE_SIZE = 10;

function formatarTipo(tipo: string) {
  const mapa: Record<string, string> = {
    SAEP: 'Simulado Oficial SAEP',
    CUSTOM: 'Treino Personalizado',
    MULTI_UC: 'Treino Multidisciplinar',
  };
  return mapa[tipo] || tipo.replaceAll('_', ' ');
}

function statusUI(status: StatusSimulado) {
  switch (status) {
    case 'CONCLUIDO':
      return {
        label: 'CONCLUÍDO',
        badge: 'bg-gradient-to-br from-green-100 to-emerald-100 text-green-700 border-green-200',
        icon: <CheckCircle size={14} />,
      };
    case 'ABANDONADO':
      return {
        label: 'ABANDONADO',
        badge: 'bg-gradient-to-br from-yellow-100 to-amber-100 text-yellow-800 border-yellow-200',
        icon: <PauseCircle size={14} />,
      };
    case 'ANULADO':
      return {
        label: 'ANULADO',
        badge: 'bg-gradient-to-br from-red-100 to-rose-100 text-red-700 border-red-200',
        icon: <XCircle size={14} />,
      };
    case 'EM_ANDAMENTO':
    default:
      return {
        label: 'EM ANDAMENTO',
        badge: 'bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 border-blue-200',
        icon: <Clock size={14} />,
      };
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function HistoricoEstudante() {
  const router = useRouter();

  const [historico, setHistorico] = useState<SimuladoHistorico[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<HistoricoResponse['meta']>({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    pages: 1,
  });

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => {
        if (!res.ok) router.push('/login');
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/estudante/historico?page=${page}&limit=${PAGE_SIZE}`);

        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }

        if (!res.ok) {
          console.error('Falha ao carregar histórico:', await res.text());
          return;
        }

        const json: unknown = await res.json();
        const parsed = json as Partial<HistoricoResponse>;

        const data = Array.isArray(parsed?.data) ? parsed.data : [];
        const m = parsed?.meta;

        if (!alive) return;

        setHistorico(data);
        setMeta({
          total: Number(m?.total ?? 0),
          page: Number(m?.page ?? page),
          limit: Number(m?.limit ?? PAGE_SIZE),
          pages: Number(m?.pages ?? 1),
        });
      } catch (e) {
        console.error('Erro ao carregar histórico:', e);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [page, router]);

  useEffect(() => {
    if (page > meta.pages && meta.pages > 0) setPage(meta.pages);
  }, [meta.pages, page]);

  const pagesToShow = useMemo(() => {
    const totalPages = meta.pages || 1;
    const current = clamp(page, 1, totalPages);

    const set = new Set<number>();
    set.add(1);
    set.add(totalPages);
    set.add(current);
    if (current - 1 >= 1) set.add(current - 1);
    if (current + 1 <= totalPages) set.add(current + 1);

    const arr = Array.from(set).sort((a, b) => a - b);
    return arr;
  }, [meta.pages, page]);

  const irParaPagina = (pagina: number) => {
    setPage(pagina);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-4 py-8 md:px-8">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 h-32 w-32 rounded-full bg-white blur-2xl"></div>
          </div>
          <div className="relative mx-auto max-w-7xl">
            <div className="flex items-center justify-center gap-3">
              <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                Histórico de Simulados
              </h1>
            </div>
          </div>
        </div>
        
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-8">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-4 py-8 md:px-8">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 h-32 w-32 rounded-full bg-white blur-2xl"></div>
            <div className="absolute bottom-0 right-1/4 h-40 w-40 rounded-full bg-purple-200 blur-2xl"></div>
          </div>

          <div className="relative mx-auto max-w-7xl">
            <div className="flex items-center justify-center gap-3">
              <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
                <Clock className="h-6 w-6 text-white" />
              </div>
              
              <div className="text-center">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 drop-shadow-lg">
                  Histórico de Simulados
                </h1>
                <p className="text-white/90 text-sm">
                  Nenhum simulado realizado ainda
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Estado vazio */}
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-8">
          <div className="relative">
            <div className="rounded-2xl bg-white border-2 border-dashed border-blue-200 shadow-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50"></div>
              
              <div className="relative px-8 py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                  <Target className="h-8 w-8 text-blue-600" />
                </div>

                <h2 className="mb-2 text-xl font-bold text-gray-800">
                  Histórico Vazio
                </h2>
                
                <p className="mx-auto max-w-md text-sm text-gray-600 mb-6">
                  Você ainda não realizou nenhum simulado para registrar métricas.
                </p>

                <Link
                  href="/estudante/novo"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
                >
                  <Award className="h-5 w-5" />
                  Começar meu primeiro desafio
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header com gradiente */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-4 py-8 md:px-8">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 h-32 w-32 rounded-full bg-white blur-2xl"></div>
          <div className="absolute bottom-0 right-1/4 h-40 w-40 rounded-full bg-purple-200 blur-2xl"></div>
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
              <Clock className="h-6 w-6 text-white" />
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 drop-shadow-lg">
                Histórico de Simulados
              </h1>
              
              <p className="text-white/90 text-sm">
                {meta.total} {meta.total === 1 ? 'simulado realizado' : 'simulados realizados'}
              </p>
            </div>

            {/* Contador visual */}
            <div className="hidden md:block rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-sm text-white font-semibold border border-white/30">
              <TrendingUp className="inline h-4 w-4 mr-1" />
              {meta.total}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-8 pb-20">
        <div className="space-y-4 mb-8">
          {historico.map((s, index) => {
            const pct = s.notaPercentual ?? 0;
            const st = statusUI(s.status);
            const desempenhoOk = s.notaPercentual !== null && pct >= 70;

            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl border-2 border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
                style={{ 
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: 'backwards'
                }}
              >
                {/* Barra superior colorida baseada no desempenho */}
                <div className={`h-1.5 w-full ${
                  desempenhoOk 
                    ? 'bg-gradient-to-r from-green-400 to-emerald-400' 
                    : s.notaPercentual === null
                    ? 'bg-gradient-to-r from-gray-400 to-slate-400'
                    : 'bg-gradient-to-r from-orange-400 to-amber-400'
                }`}></div>

                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Lado esquerdo */}
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      {/* Ícone de desempenho */}
                      <div className={`p-3 rounded-xl transition-colors shrink-0 ${
                        desempenhoOk 
                          ? 'bg-green-50 text-green-600' 
                          : s.notaPercentual === null
                          ? 'bg-gray-50 text-gray-600'
                          : 'bg-orange-50 text-orange-600'
                      }`}>
                        {desempenhoOk ? (
                          <CheckCircle size={24} />
                        ) : s.notaPercentual === null ? (
                          <Clock size={24} />
                        ) : (
                          <AlertTriangle size={24} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Título e badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h4 className="font-bold text-gray-800 text-base">
                            {formatarTipo(s.tipo)}
                          </h4>

                          {/* Badge de status */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide ${st.badge}`}
                          >
                            {st.icon}
                            {st.label}
                          </span>
                        </div>

                        {/* Informações adicionais */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(s.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                            {' às '}
                            {new Date(s.createdAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target size={12} />
                            {s.qtdeQuestoes} questões
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Lado direito - Nota e botão */}
                    <div className="flex items-center gap-4 shrink-0">
                      {/* Nota percentual */}
                      <div className="text-right hidden md:block">
                        {s.notaPercentual !== null ? (
                          <>
                            <p className={`text-2xl font-black ${
                              desempenhoOk ? 'text-green-600' : 'text-orange-500'
                            }`}>
                              {pct}%
                            </p>
                            <p className="text-xs font-semibold text-gray-500">
                              Aproveitamento
                            </p>
                          </>
                        ) : (
                          <p className="text-xl font-bold text-gray-400">—</p>
                        )}
                      </div>

                      {/* Botão de ação */}
                      <Link
                        href={`/simulado/${s.id}/resultado`}
                        className="p-3 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl text-gray-600 group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white transition-all shadow-sm border border-gray-200 group-hover:border-transparent"
                        aria-label="Ver detalhes"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Efeito de brilho ao hover */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-gradient-to-br from-blue-200/20 to-indigo-200/20 blur-3xl"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Paginação */}
        {meta.pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => irParaPagina(page - 1)}
              disabled={page === 1}
              className={`rounded-xl p-2 transition-all ${
                page === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-2">
              {pagesToShow.map((p, idx) => {
                const prev = pagesToShow[idx - 1];
                const showEllipsis = prev !== undefined && p - prev > 1;

                return (
                  <div key={p} className="flex items-center gap-2">
                    {showEllipsis && (
                      <span className="text-gray-400 px-1">...</span>
                    )}
                    <button
                      onClick={() => irParaPagina(p)}
                      className={`min-w-[40px] h-10 rounded-xl font-semibold text-sm transition-all ${
                        p === page
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => irParaPagina(page + 1)}
              disabled={page === meta.pages}
              className={`rounded-xl p-2 transition-all ${
                page === meta.pages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Informação da página */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Mostrando página {page} de {meta.pages} • Total de {meta.total}{' '}
            {meta.total === 1 ? 'simulado' : 'simulados'}
          </p>
        </div>
      </div>
    </div>
  );
}
