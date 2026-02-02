'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Filter, AlertCircle, ChevronRight, School, RefreshCw, Layers, ChevronLeft, XCircle } from 'lucide-react';
import Link from 'next/link';
import { sanitizeString } from '@/lib/sanitize';

interface Banca {
  id: number;
  sigla: string;
  nome?: string;
}

interface UnidadeCurricular {
  id: number;
  nome: string;
}

interface QuestaoListItem {
  id: number;
  enunciado: string;
  banca?: Banca | null;
  unidadeCurricular?: UnidadeCurricular | null;
  imagens?: { url?: string | null; filename?: string | null; width?: number | null; height?: number | null }[];
  dificuldade?: string | null;
  nivelCognitivo?: string | null;
}

interface RegistroErro {
  id: number;
  questaoId?: number;
  vezesErrada: number;
  revisada: boolean;
  ultimoErro?: string | null;
  proximaRevisao?: string | null;
  questao: QuestaoListItem;
}

interface FiltroUC {
  id: number;
  nome: string;
}

function safeHtml(html: string) {
  return sanitizeString(html);
}

const ITEMS_POR_PAGINA = 10;

export default function CadernoErros() {
  const router = useRouter();
  const [questoesErradas, setQuestoesErradas] = useState<RegistroErro[]>([]);
  const [unidades, setUnidades] = useState<FiltroUC[]>([]);
  const [filtroUc, setFiltroUc] = useState('');
  const [loading, setLoading] = useState(true);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);

  // debounce state
  const [filtroUcDebounced, setFiltroUcDebounced] = useState('');

  // abort + controle de corrida
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const pendentesCount = questoesErradas.length;
  const totalPaginas = Math.ceil(pendentesCount / ITEMS_POR_PAGINA);
  
  const questoesPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITEMS_POR_PAGINA;
    const fim = inicio + ITEMS_POR_PAGINA;
    return questoesErradas.slice(inicio, fim);
  }, [questoesErradas, paginaAtual]);

  const filtroLabel = useMemo(() => {
    if (!filtroUc) return 'Todas';
    const found = unidades.find((u) => String(u.id) === String(filtroUc));
    return found?.nome ?? 'Filtrando...';
  }, [filtroUc, unidades]);

  // Validação de Sessão Inicial
  useEffect(() => {
    fetch('/api/csrf')
      .then(res => {
        if (!res.ok) {
           router.push('/auth/login');
        }
      })
      .catch(() => {});
  }, [router]);

  // Busca as UCs para o filtro
  useEffect(() => {
    let alive = true;
    setErroMsg(null);

    fetch('/api/unidades', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
            router.push('/auth/login');
            return Promise.reject('Auth Error');
        }
        return res.ok ? res.json() : Promise.reject(new Error('Falha ao carregar unidades'));
      })
      .then((data) => {
        if (!alive) return;
        setUnidades(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (err === 'Auth Error') return;
        if (!alive) return;
        setUnidades([]);
      });

    return () => {
      alive = false;
    };
  }, [router]);

  // debounce do filtro
  useEffect(() => {
    const t = setTimeout(() => setFiltroUcDebounced(filtroUc), 250);
    return () => clearTimeout(t);
  }, [filtroUc]);

  const fetchErros = useCallback(async (ucId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const mySeq = ++requestSeqRef.current;
    setLoading(true);
    setErroMsg(null);
    setPaginaAtual(1); // Reset página ao filtrar

    try {
      const qs: string[] = [];
      if (ucId) qs.push(`ucId=${encodeURIComponent(ucId)}`);

      const url = `/api/estudante/caderno-erros${qs.length ? `?${qs.join('&')}` : ''}`;

      const res = await fetch(url, {
        cache: 'no-store',
        credentials: 'include',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (mySeq !== requestSeqRef.current) return;

      if (res.status === 401 || res.status === 403) {
          router.push('/auth/login');
          return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErroMsg((data as any)?.error || 'Não foi possível carregar seu caderno agora.');
        setQuestoesErradas([]);
        return;
      }

      const items = Array.isArray(data) ? data : (data.items ?? []);
      setQuestoesErradas(items);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      setErroMsg('Falha de conexão. Verifique sua internet e tente novamente.');
      setQuestoesErradas([]);
    } finally {
      if (mySeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [router]);

  // dispara ao mudar filtro
  useEffect(() => {
    fetchErros(filtroUcDebounced);
    return () => {
      abortRef.current?.abort();
    };
  }, [filtroUcDebounced, fetchErros]);

  const handleRetry = () => fetchErros(filtroUcDebounced);

  const irParaPagina = (pagina: number) => {
    setPaginaAtual(pagina);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
      {/* Header com gradiente */}
      <div className="relative overflow-hidden bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 px-4 py-8 md:px-8">
        {/* Padrão decorativo de fundo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 h-32 w-32 rounded-full bg-white blur-2xl"></div>
          <div className="absolute bottom-0 right-1/4 h-40 w-40 rounded-full bg-orange-200 blur-2xl"></div>
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 drop-shadow-lg">
                Caderno de Erros
              </h1>
              
              <p className="text-white/90 text-sm">
                {pendentesCount === 0 
                  ? "Nenhuma questão para revisar"
                  : `${pendentesCount} ${pendentesCount === 1 ? 'questão' : 'questões'} para revisar`
                }
              </p>
            </div>

            {/* Contador visual compacto */}
            {pendentesCount > 0 && (
              <div className="hidden md:block rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-sm text-white font-semibold border border-white/30">
                <XCircle className="inline h-4 w-4 mr-1" />
                {pendentesCount}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-8 pb-20">
        {/* Barra de filtros */}
        <div className="mb-6 rounded-2xl bg-white border border-gray-100 shadow-md overflow-hidden">
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
                <Filter size={16} className="text-gray-400" />
                <select
                  aria-label="Filtrar por unidade curricular"
                  className="text-sm font-medium outline-none bg-transparent text-gray-700 cursor-pointer"
                  value={filtroUc}
                  onChange={(e) => setFiltroUc(e.target.value)}
                >
                  <option value="">Todas as Unidades</option>
                  {unidades.map((uc) => (
                    <option key={uc.id} value={uc.id}>
                      {uc.nome}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-xs font-semibold px-3 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
                {filtroLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={16} /> Atualizar
            </button>
          </div>

          {erroMsg && (
            <div className="border-t border-red-100 bg-red-50 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1">
                  <AlertCircle className="mt-0.5 text-red-600" size={18} />
                  <span className="text-sm text-red-800">{erroMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div className="grid gap-5 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-40 bg-white rounded-2xl border border-gray-100" />
            ))}
          </div>
        ) : questoesErradas.length > 0 ? (
          <>
            {/* Grid de questões */}
            <div className="grid gap-5 mb-8">
              {questoesPaginadas.map((registro, index) => (
                <div
                  key={registro.id}
                  className="bg-white rounded-2xl border-2 border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    animationFillMode: 'backwards'
                  }}
                >
                  {/* Barra superior colorida */}
                  <div className="h-1.5 w-full bg-gradient-to-r from-red-400 to-rose-400"></div>
                  
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4 gap-3 flex-wrap">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-1.5 bg-gradient-to-br from-slate-100 to-gray-100 text-slate-700 rounded-full border border-slate-200">
                          <BookOpen size={12} />
                          {registro.questao.unidadeCurricular?.nome || 'Geral'}
                        </span>

                        {registro.questao.banca?.sigla && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-1.5 bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 rounded-full border border-blue-200">
                            <School size={12} />
                            {registro.questao.banca.sigla}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 border border-red-200">
                        <XCircle size={14} className="text-red-600" />
                        <span className="text-xs font-bold text-red-700">
                          {registro.vezesErrada}x errada
                        </span>
                      </div>
                    </div>

                    <div
                      className="text-gray-700 text-sm leading-relaxed line-clamp-3 mb-5"
                      dangerouslySetInnerHTML={{ __html: safeHtml(registro.questao.enunciado) }}
                    />

                    <div className="flex justify-end border-t border-gray-100 pt-4">
                      <Link
                        href={`/estudante/caderno-erros/revisar/${registro.questao.id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg group/btn"
                      >
                        Revisar agora 
                        <ChevronRight size={18} className="transition-transform group-hover/btn:translate-x-1" />
                      </Link>
                    </div>
                  </div>

                  {/* Efeito de brilho ao hover */}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-gradient-to-br from-red-200/20 to-rose-200/20 blur-3xl"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => irParaPagina(paginaAtual - 1)}
                  disabled={paginaAtual === 1}
                  className={`rounded-xl p-2 transition-all ${
                    paginaAtual === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pagina) => {
                    // Mostra apenas algumas páginas por vez
                    if (
                      pagina === 1 ||
                      pagina === totalPaginas ||
                      (pagina >= paginaAtual - 1 && pagina <= paginaAtual + 1)
                    ) {
                      return (
                        <button
                          key={pagina}
                          onClick={() => irParaPagina(pagina)}
                          className={`min-w-[40px] h-10 rounded-xl font-semibold text-sm transition-all ${
                            pagina === paginaAtual
                              ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                          }`}
                        >
                          {pagina}
                        </button>
                      );
                    } else if (
                      pagina === paginaAtual - 2 ||
                      pagina === paginaAtual + 2
                    ) {
                      return (
                        <span key={pagina} className="text-gray-400 px-1">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => irParaPagina(paginaAtual + 1)}
                  disabled={paginaAtual === totalPaginas}
                  className={`rounded-xl p-2 transition-all ${
                    paginaAtual === totalPaginas
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
                Mostrando {(paginaAtual - 1) * ITEMS_POR_PAGINA + 1} a{' '}
                {Math.min(paginaAtual * ITEMS_POR_PAGINA, pendentesCount)} de{' '}
                {pendentesCount} {pendentesCount === 1 ? 'questão' : 'questões'}
              </p>
            </div>
          </>
        ) : (
          <div className="relative">
            <div className="rounded-2xl bg-white border-2 border-dashed border-red-200 shadow-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-rose-50/50"></div>
              
              <div className="relative px-8 py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-emerald-100">
                  <span className="text-3xl">🎯</span>
                </div>

                <h2 className="mb-2 text-xl font-bold text-gray-800">
                  Tudo limpo por aqui!
                </h2>
                
                <p className="mx-auto max-w-md text-sm text-gray-600">
                  Você não possui questões pendentes para revisão {filtroUc ? 'nesta unidade' : ''}.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
