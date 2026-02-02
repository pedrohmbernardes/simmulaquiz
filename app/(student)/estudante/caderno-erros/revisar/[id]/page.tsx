'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { useCsrf } from '@/lib/hooks/use-csrf';
import { sanitizeString } from '@/lib/sanitize';

type Imagem = { url?: string | null };

type QuestaoDetalhe = {
  id: number;
  enunciado: string;
  alternativaA: string;
  alternativaB: string;
  alternativaC: string;
  alternativaD: string;
  alternativaE: string;
  imagens?: Imagem[];
  unidadeCurricular?: { nome: string } | null;
  banca?: { sigla: string; nome?: string } | null;
  nivelCognitivo?: string | null;
};

type RevisarResponse =
  | { ok: true; correta: boolean; revisada?: boolean }
  | { ok?: false; error?: string; correta?: boolean };

const LETRAS = ['a', 'b', 'c', 'd', 'e'] as const;
type Letra = (typeof LETRAS)[number];

function toPositiveInt(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function safeImgUrl(u: unknown): string | null {
  if (!u || typeof u !== 'string') return null;
  const s = u.trim();
  if (!s) return null;
  // blocks dangerous schemes
  if (/^javascript:/i.test(s) || /^data:text\/html/i.test(s)) return null;
  return s;
}

export default function RevisarQuestaoCadernoErrosPage() {
  const router = useRouter();
  const params = useParams();
  const idParam = String(params?.id ?? '');
  const questaoId = useMemo(() => toPositiveInt(idParam), [idParam]);

  const csrfToken = useCsrf();

  const [questao, setQuestao] = useState<QuestaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);

  const [selecionada, setSelecionada] = useState<Letra | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resultado, setResultado] = useState<null | { correta: boolean }>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const alternativas = useMemo(() => {
    if (!questao) return [];
    return [
      { letra: 'a' as const, texto: questao.alternativaA },
      { letra: 'b' as const, texto: questao.alternativaB },
      { letra: 'c' as const, texto: questao.alternativaC },
      { letra: 'd' as const, texto: questao.alternativaD },
      { letra: 'e' as const, texto: questao.alternativaE },
    ];
  }, [questao]);

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
    if (!questaoId) {
      setLoading(false);
      setQuestao(null);
      setErroMsg('ID inválido.');
      return;
    }

    const ac = new AbortController();
    let alive = true;

    async function fetchDetalhes() {
      setLoading(true);
      setErroMsg(null);
      setResultado(null);
      setSelecionada(null);

      try {
        const res = await fetch(
          `/api/estudante/caderno-erros/detalhes/${encodeURIComponent(String(questaoId))}`,
          {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            credentials: 'include', // ✅ guarantees cookies (session)
            signal: ac.signal,
          }
        );

        // 🛡️ 2. ARMOR: Check for 401/403 on fetch
        if (res.status === 401 || res.status === 403) {
            router.push('/auth/login');
            return;
        }

        if (!res.ok) {
          // 404 -> back to list (avoids enumeration)
          router.replace('/estudante/caderno-erros');
          return;
        }

        const data = (await res.json()) as QuestaoDetalhe;
        if (!alive) return;

        setQuestao(data);
      } catch (e: any) {
        if (!alive) return;
        if (e?.name === 'AbortError') return;
        setErroMsg('Não foi possível carregar a questão. Tente novamente.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    fetchDetalhes();
    return () => {
      alive = false;
      ac.abort();
    };
  }, [questaoId, router]);

  async function handleEnviar() {
    if (!questao || !selecionada || submitting) return;

    // ✅ if CSRF hasn't loaded yet, avoid "mysterious" 403
    if (!csrfToken) {
      setErroMsg('Token de segurança ainda não carregou. Aguarde 1s e tente novamente.');
      return;
    }

    setSubmitting(true);
    setErroMsg(null);

    try {
      const res = await fetch('/api/estudante/caderno-erros/revisar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include', // ✅ guarantees cookies (session + csrf cookie)
        body: JSON.stringify({
          questaoId: questao.id,
          alternativaMarcada: selecionada,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as RevisarResponse;

      if (!res.ok) {
        // 401 -> login
        if (res.status === 401) {
          router.replace('/auth/login'); // ✅ Corrected path
          return;
        }
        // 403/404 -> back to list (IDOR / does not belong to user)
        if (res.status === 403 || res.status === 404) {
          router.replace('/estudante/caderno-erros');
          return;
        }

        setErroMsg((data as any)?.error || 'Não foi possível validar sua resposta.');
        return;
      }

      const correta = !!(data as any)?.correta;
      setResultado({ correta });

      if (correta) {
        setTimeout(() => {
          router.replace('/estudante/caderno-erros');
        }, 900);
      }
    } catch {
      setErroMsg('Falha de conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 font-bold">
        <Loader2 className="animate-spin mr-2" /> Carregando questão...
      </div>
    );
  }

  if (!questao) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 font-bold">
        Questão não encontrada.
      </div>
    );
  }

  const imgUrl = safeImgUrl(questao.imagens?.[0]?.url);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/estudante/caderno-erros"
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 font-bold text-sm transition"
        >
          <ArrowLeft size={16} /> Voltar ao Caderno
        </Link>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100 flex items-center gap-1">
                <BookOpen size={12} />
                Revisão (Caderno de Erros)
              </span>

              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                {questao.unidadeCurricular?.nome || 'Geral'}
              </span>

              {questao.banca?.sigla ? (
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-200">
                  {questao.banca.sigla}
                </span>
              ) : null}
            </div>

            {/* Image (if any) */}
            {imgUrl ? (
              <div className="mb-6 bg-gray-50 rounded-2xl p-4 border border-gray-100 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt="Imagem da questão"
                  className="max-h-80 object-contain rounded-xl"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : null}

            {/* Statement */}
            <div
              className="text-gray-800 text-base md:text-lg font-medium leading-relaxed mb-6 font-lato"
              dangerouslySetInnerHTML={{
                __html: sanitizeString(questao.enunciado),
              }}
            />

            {/* Alternatives */}
            <div className="space-y-3">
              {alternativas.map((alt) => {
                const isSelected = selecionada === alt.letra;
                const locked = submitting || resultado?.correta === true;

                return (
                  <button
                    key={alt.letra}
                    type="button"
                    disabled={locked}
                    onClick={() => setSelecionada(alt.letra)}
                    className={[
                      'w-full text-left rounded-2xl border p-4 transition flex items-start gap-3',
                      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50',
                      locked ? 'opacity-80 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-black uppercase text-sm font-oswald',
                        isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600',
                      ].join(' ')}
                    >
                      {alt.letra}
                    </div>

                    <div
                      className="text-gray-800 font-medium leading-relaxed font-lato"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeString(alt.texto),
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            <div className="mt-6">
              {erroMsg ? (
                <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-4 font-lato text-sm flex items-start gap-2">
                  <XCircle className="mt-0.5" size={18} />
                  <div>
                    <div className="font-bold">Ops…</div>
                    <div>{erroMsg}</div>
                  </div>
                </div>
              ) : null}

              {resultado?.correta === false ? (
                <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 rounded-2xl p-4 font-lato text-sm flex items-start gap-2 mt-3">
                  <RefreshCw className="mt-0.5" size={18} />
                  <div>
                    <div className="font-bold">Ainda não.</div>
                    <div>Resposta incorreta. Tente novamente — sem revelar a correta 😉</div>
                  </div>
                </div>
              ) : null}

              {resultado?.correta === true ? (
                <div className="bg-green-50 border border-green-100 text-green-800 rounded-2xl p-4 font-lato text-sm flex items-start gap-2 mt-3">
                  <CheckCircle2 className="mt-0.5" size={18} />
                  <div>
                    <div className="font-bold">Boa! Você acertou.</div>
                    <div>Essa questão será removida do seu caderno de erros.</div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleEnviar}
                disabled={!selecionada || submitting || resultado?.correta === true}
                className={[
                  'flex-1 rounded-2xl py-3 px-4 font-black uppercase tracking-tight font-oswald transition',
                  !selecionada || submitting || resultado?.correta === true
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-900 text-white hover:bg-blue-800 shadow-lg',
                ].join(' ')}
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={18} /> Validando...
                  </span>
                ) : (
                  'Confirmar resposta'
                )}
              </button>

              <button
                type="button"
                onClick={() => router.replace('/estudante/caderno-erros')}
                className="sm:w-56 rounded-2xl py-3 px-4 font-black uppercase tracking-tight font-oswald transition border border-gray-200 hover:bg-gray-50 text-gray-800"
              >
                Voltar ao caderno
              </button>
            </div>

            <p className="mt-5 text-[12px] text-gray-400 font-lato">
              * Nesta revisão não há cronômetro, anticheat nem pontuação — é um espaço de treino.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}