'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { BookOpen, CheckCircle, XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function RevisaoQuestaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [questao, setQuestao] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [respondido, setRespondido] = useState(false);

  useEffect(() => {
    async function fetchQuestao() {
      try {
        // Usaremos uma rota de API de detalhes que você já deve ter ou criaremos
        const res = await fetch(`/api/estudante/caderno-erros/detalhes/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setQuestao(data);
      } catch {
        router.push('/estudante/caderno-erros');
      } finally {
        setLoading(false);
      }
    }
    fetchQuestao();
  }, [id, router]);

  const handleResponder = async (letra: string) => {
    if (respondido) return;
    setSelecionada(letra);
    setRespondido(true);

    const correta = letra.toLowerCase() === questao.alternativaCorreta.toLowerCase();

    if (correta) {
      // 🚀 Sincroniza com o Caderno de Erros: Se acertou, marca como revisada
      await fetch(`/api/estudante/caderno-erros/revisar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questaoId: questao.id })
      });
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-gray-400">Carregando questão...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/estudante/caderno-erros" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 font-bold text-sm transition">
          <ArrowLeft size={16} /> Voltar ao Caderno
        </Link>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-10">
            <div className="flex items-center gap-2 mb-6">
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                {questao.unidadeCurricular?.nome || 'Revisão'}
              </span>
            </div>

            {questao.imagens?.length > 0 && (
              <div className="mb-8 bg-gray-50 rounded-2xl p-4 border border-gray-100 flex justify-center">
                <img src={questao.imagens[0].url} alt="Questão" className="max-h-64 object-contain rounded-lg" />
              </div>
            )}

            <p className="text-lg text-gray-800 font-medium leading-relaxed mb-10">
              {questao.enunciado}
            </p>

            <div className="space-y-3">
              {['a', 'b', 'c', 'd', 'e'].map((letra) => {
                const texto = questao[`alternativa${letra.toUpperCase()}`];
                const isCorreta = letra.toLowerCase() === questao.alternativaCorreta.toLowerCase();
                const isSelecionada = selecionada === letra;

                let estilo = "border-gray-100 bg-white hover:border-blue-200";
                if (respondido) {
                  if (isCorreta) estilo = "border-green-500 bg-green-50 ring-1 ring-green-500";
                  else if (isSelecionada) estilo = "border-red-500 bg-red-50 ring-1 ring-red-500";
                  else estilo = "border-gray-50 bg-gray-50 opacity-50";
                }

                return (
                  <button
                    key={letra}
                    disabled={respondido}
                    onClick={() => handleResponder(letra)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 group ${estilo}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black uppercase transition-colors ${
                      respondido && isCorreta ? 'bg-green-500 text-white' : 
                      isSelecionada && !isCorreta ? 'bg-red-500 text-white' : 
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {respondido && isCorreta ? <CheckCircle size={20} /> : 
                       respondido && isSelecionada ? <XCircle size={20} /> : letra}
                    </div>
                    <span className="flex-1 font-medium text-gray-700">{texto}</span>
                  </button>
                );
              })}
            </div>

            {respondido && (
              <div className="mt-10 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className={`p-6 rounded-2xl border-2 ${selecionada?.toLowerCase() === questao.alternativaCorreta.toLowerCase() ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                  <h4 className={`font-black text-sm uppercase mb-2 ${selecionada?.toLowerCase() === questao.alternativaCorreta.toLowerCase() ? 'text-green-700' : 'text-red-700'}`}>
                    {selecionada?.toLowerCase() === questao.alternativaCorreta.toLowerCase() ? 'Excelente! Você superou este erro.' : 'Ainda não foi desta vez.'}
                  </h4>
                  <p className="text-gray-600 text-sm">
                    {selecionada?.toLowerCase() === questao.alternativaCorreta.toLowerCase() 
                      ? 'Esta questão foi removida do seu caderno de erros e não aparecerá mais lá até que você erre novamente em um simulado.' 
                      : 'Continue revisando os conceitos desta unidade para fixar o conhecimento.'}
                  </p>
                  <button 
                    onClick={() => { setRespondido(false); setSelecionada(null); }}
                    className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-800"
                  >
                    <RefreshCw size={14} /> Tentar Novamente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}