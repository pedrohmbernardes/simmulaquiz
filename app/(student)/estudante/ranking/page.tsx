'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation'; // ✅ Import Router
import Image from 'next/image';
import { z } from 'zod';
import { 
  Trophy, Flame, Medal, Crown, Shield, Star, ChevronDown, User, Sparkles
} from 'lucide-react';

// --- SCHEMAS (payload hardening) ---
const RankingItemSchema = z.object({
  posicao: z.number().int().positive(),
  usuarioId: z.number().int().positive(),
  nome: z.string().min(1).max(120),
  fotoUrl: z.string().url().nullable().optional().catch(null),
  valor: z.number().finite().nonnegative(),
  valorLabel: z.enum(['XP', 'dias']),
  nivel: z.number().int().positive().catch(1),
  titulo: z.string().min(1).max(120).catch('Iniciante'),
  xpTotal: z.number().finite().nonnegative().optional(),
  percentil: z.number().finite().min(0).max(100).nullable().optional(),
  isMe: z.boolean(),
  _foraTop50: z.boolean().optional(),
});

const RankingResponseSchema = z.array(RankingItemSchema);

type RankingItem = z.infer<typeof RankingItemSchema>;

// --- VISUAL CONFIG ---
const ELITE_CONFIG = [
  { posicao: 1, titulo: 'Antimatéria', cor: 'from-purple-500 via-fuchsia-500 to-indigo-600', badgeColor: 'bg-yellow-400 text-yellow-900 ring-4 ring-purple-500/30 shadow-[0_0_15px_rgba(234,179,8,0.6)]', icone: Crown },
  { posicao: 2, titulo: 'Desafiante', cor: 'from-red-500 to-rose-700', badgeColor: 'bg-gray-200 text-gray-800 border-2 border-gray-300', icone: Shield },
  { posicao: 3, titulo: 'Mestre', cor: 'from-orange-400 to-amber-600', badgeColor: 'bg-orange-400 text-orange-900 border-2 border-orange-300', icone: Star },
  { posicao: 4, titulo: 'Diamante', cor: 'from-cyan-400 to-blue-600', badgeColor: 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30', icone: Medal },
  { posicao: 5, titulo: 'Platina', cor: 'from-slate-400 to-slate-600', badgeColor: 'bg-slate-500 text-white shadow-lg shadow-slate-500/30', icone: Medal },
  { posicao: 6, titulo: 'Ouro', cor: 'from-yellow-400 to-yellow-600', badgeColor: 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/30', icone: Medal, border: 'border-yellow-400' },
  { posicao: 7, titulo: 'Bronze', cor: 'from-amber-700 to-amber-900', badgeColor: 'bg-amber-700 text-white shadow-lg shadow-amber-700/30', icone: Medal, border: 'border-amber-700' },
];

function getTop5Order(index: number) {
  switch (index) {
    case 0: return 'md:order-3 z-30'; 
    case 1: return 'md:order-2 z-20'; 
    case 2: return 'md:order-4 z-20'; 
    case 3: return 'md:order-1 z-10'; 
    case 4: return 'md:order-5 z-10'; 
    default: return 'order-last';
  }
}

function getTop5Transform(index: number) {
  if (index === 0) return "md:scale-125 md:-translate-y-10"; 
  if (index === 1 || index === 2) return "md:scale-110 md:-translate-y-2"; 
  return "md:scale-100 md:translate-y-6"; 
}

export default function RankingPage() {
  const router = useRouter(); // ✅ Router initialized
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('all'); 
  const [tipo, setTipo] = useState('XP'); 

  const xpLabel = useMemo(() => {
    if (tipo !== 'XP') return 'XP';
    return periodo === 'all' ? 'XP Total' : 'XP Ganho';
  }, [tipo, periodo]);

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
    const ctrl = new AbortController();

    async function fetchRanking() {
      setLoading(true);
      setErrorMsg(null);

      const qs = new URLSearchParams({ periodo, tipo });

      try {
        const res = await fetch(`/api/ranking?${qs.toString()}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: ctrl.signal,
        });

        // 🛡️ 2. ARMOR: Auth Check
        if (res.status === 401 || res.status === 403) {
            router.push('/auth/login');
            return;
        }

        if (!res.ok) {
          const msg = res.status === 429
              ? 'Muitas requisições. Aguarde um instante e tente novamente.'
              : 'Não foi possível carregar o ranking.';

          setRanking([]);
          setErrorMsg(msg);
          return;
        }

        const json = await res.json().catch(() => null);
        const parsed = RankingResponseSchema.safeParse(json);

        if (!parsed.success) {
          setRanking([]);
          setErrorMsg('Resposta inválida do servidor.');
          return;
        }

        setRanking(parsed.data);
      } catch (error) {
        if ((error as any)?.name === 'AbortError') return;
        console.error('Erro ranking:', error);
        setRanking([]);
        setErrorMsg('Erro de rede ao carregar o ranking.');
      } finally {
        setLoading(false);
      }
    }

    fetchRanking();
    return () => ctrl.abort();
  }, [periodo, tipo, router]);

  // Data Slicing
  const meForaTop50 = ranking.find((x) => x._foraTop50);
  const top50 = meForaTop50 ? ranking.filter((x) => !x._foraTop50) : ranking;
  const top5 = top50.slice(0, 5);
  const subElite = top50.slice(5, 7);
  const listaGeral = top50.slice(7);

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-700 pb-20 font-sans px-4 md:px-8">
      
      {/* FILTER HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8 mt-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 font-oswald uppercase flex items-center gap-3 tracking-wide">
            <Trophy className="text-yellow-500 fill-yellow-400 drop-shadow-sm" size={32} /> 
            Hall da Fama
          </h1>
          <p className="text-sm text-gray-500 font-lato font-medium">Os operadores de elite do sistema.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="bg-gray-100/80 p-1 rounded-xl flex font-oswald tracking-wider">
            <button
              onClick={() => setTipo('XP')}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all uppercase ${tipo === 'XP' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              aria-pressed={tipo === 'XP'}
            >
              {xpLabel}
            </button>
            <button onClick={() => setTipo('STREAK')} className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all uppercase flex items-center gap-1.5 ${tipo === 'STREAK' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}><Flame size={14} fill="currentColor"/> Ofensiva</button>
          </div>
          <div className="relative group font-oswald tracking-wider">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              disabled={tipo === 'STREAK'}
              className={`appearance-none bg-blue-50 border-2 border-blue-100 text-blue-800 py-3 pl-5 pr-12 rounded-xl text-xs font-bold outline-none cursor-pointer transition-colors uppercase ${tipo === 'STREAK' ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-100'}`}
            >
              <option value="all">Desde o Início</option>
              <option value="7d">Últimos 7 Dias</option>
              <option value="30d">Últimos 30 Dias</option>
              <option value="1y">Este Ano</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={18} />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
          <p className="text-sm font-bold font-oswald uppercase">Atenção</p>
          <p className="text-sm font-lato mt-1">{errorMsg}</p>
        </div>
      )}

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin blur-[1px]"></div>
          <p className="text-blue-600 font-bold animate-pulse text-sm font-oswald uppercase">Carregando Dados...</p>
        </div>
      ) : (
        <>
          {/* 1. ELITE AREA (TOP 5) */}
          {top5.length > 0 && (
            <div className="relative mb-12">
               {/* Podium Background */}
               <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-purple-900 to-gray-900 rounded-[3rem] shadow-2xl shadow-purple-900/40 overflow-visible">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2/3 bg-purple-600/30 blur-[120px] rounded-full opacity-60 pointer-events-none"></div>
                  <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5 pointer-events-none"></div>
               </div>

              <div className="relative z-10 px-4 pt-16 pb-12 md:px-12 md:pt-24 md:pb-32">
                <div className="text-center mb-16 md:mb-20">
                  <h2 className="text-2xl md:text-5xl font-black text-white font-oswald uppercase inline-flex items-center gap-4 drop-shadow-lg">
                    <Sparkles className="text-purple-300 w-6 h-6 md:w-8 md:h-8 animate-pulse" /> Elite do Sistema <Sparkles className="text-purple-300 w-6 h-6 md:w-8 md:h-8 animate-pulse" />
                  </h2>
                  <p className="text-purple-200/80 text-xs md:text-sm mt-3 font-lato uppercase tracking-widest font-bold">Os 5 Supremos</p>
                </div>

                {/* TOP 5 FLEXBOX */}
                <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-10 md:gap-4 min-h-[450px]">
                  {ELITE_CONFIG.slice(0, 5).map((conf, idx) => {
                    const user = top5[idx];
                    if (!user) return null;

                    const flexOrder = getTop5Order(idx);
                    const transform = getTop5Transform(idx);
                    const Icone = conf.icone;

                    return (
                      <div key={user.usuarioId} className={`relative flex-shrink-0 w-[200px] md:w-[180px] transition-all duration-700 ${flexOrder} ${transform}`}>
                        <div className="relative group">
                          {/* BADGE NUMBER */}
                          <div className={`absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-xl rotate-45 border-4 border-gray-900 flex items-center justify-center shadow-2xl z-50 ${conf.badgeColor}`}>
                             <div className="-rotate-45 font-black text-xl font-oswald">{conf.posicao}</div>
                          </div>

                          {/* MAIN CARD */}
                          <div className={`w-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col items-center pt-10 pb-6 transition-all duration-500 hover:bg-white/10 hover:border-white/30 ${idx === 0 ? 'ring-2 ring-purple-500/50 shadow-purple-500/20' : ''}`}>
                            <div className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b ${conf.cor} opacity-20 blur-xl`}></div>

                            {/* Avatar */}
                            <div className="relative mb-4">
                              <div className={`w-20 h-20 rounded-full p-1 border-2 ${idx === 0 ? 'border-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.6)]' : 'border-white/20'} bg-gray-900`}>
                                {user.fotoUrl ? (
                                  <Image src={user.fotoUrl} alt={user.nome} width={80} height={80} className="rounded-full object-cover w-full h-full"/>
                                ) : <User size={30} className="text-white/50 w-full h-full p-4"/>}
                              </div>
                              <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br ${conf.cor} flex items-center justify-center border-2 border-gray-900 shadow-md`}>
                                <Icone size={14} className="text-white fill-white"/>
                              </div>
                            </div>

                            {/* Info */}
                            <h3 className={`text-sm font-bold text-white truncate w-full text-center px-2 mb-1 ${user.isMe ? 'text-purple-300' : ''}`}>
                              {user.nome.split(' ')[0]}
                            </h3>
                            
                            <div className="w-full px-2 mb-4 flex justify-center">
                                <div className="bg-white/10 px-3 py-1.5 rounded-xl text-[9px] font-bold text-white/80 uppercase tracking-wide border border-white/5 text-center min-h-[36px] flex items-center justify-center w-full leading-tight">
                                  {user.titulo}
                                </div>
                            </div>

                            {/* Points */}
                            <div className="bg-black/30 w-full py-3 mt-auto border-t border-white/5 text-center">
                              <span className={`block text-2xl font-black font-oswald text-transparent bg-clip-text bg-gradient-to-r ${conf.cor}`}>
                                {user.valor.toLocaleString('pt-BR')}
                              </span>
                              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.2em]">{user.valorLabel}</span>
                            </div>
                            
                            {/* Position Name */}
                            <div className="px-4 mt-2">
                                <div className={`py-1 px-4 rounded-full border bg-gradient-to-r ${conf.cor} bg-opacity-10 border-white/10 text-[9px] font-black uppercase text-white tracking-widest text-center shadow-lg`}>
                                  {conf.titulo}
                                </div>
                            </div>

                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. INTERMEDIATE AREA (6th and 7th) */}
          {subElite.length > 0 && (
            <div className="flex flex-col md:flex-row justify-center gap-6 mb-12 px-4 max-w-5xl mx-auto">
              {subElite.map((user, idx) => {
                const realIdx = idx + 5; 
                const conf = ELITE_CONFIG[realIdx];
                if (!conf) return null;
                const Icone = conf.icone;

                const cardStyle = idx === 0 
                  ? "bg-gradient-to-br from-yellow-300 to-amber-400 border-yellow-200 shadow-yellow-100" 
                  : "bg-gradient-to-br from-orange-300 to-stone-500 border-orange-200 shadow-orange-100";

                const textHighlight = idx === 0 ? "text-yellow-700" : "text-orange-800";

                return (
                  <div key={user.usuarioId} className="w-full md:w-1/2 bg-white rounded-[24px] p-2 shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-1">
                    <div className={`rounded-[18px] border ${cardStyle} p-5 relative overflow-hidden h-full flex items-center gap-5`}>
                      
                      <div className="flex flex-col items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-sm border border-gray-100 z-10 shrink-0">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Pos</span>
                        <span className={`text-2xl font-black font-oswald ${textHighlight}`}>{conf.posicao}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                           <div>
                              <h3 className={`font-bold text-gray-800 text-lg truncate ${user.isMe ? 'text-blue-600' : ''}`}>
                                {user.nome}
                              </h3>
                              <p className={`text-[10px] font-bold uppercase tracking-wider ${textHighlight} leading-tight`}>
                                {user.titulo}
                              </p>
                           </div>
                           
                           <div className="relative">
                              <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden">
                                {user.fotoUrl ? (
                                    <Image src={user.fotoUrl} alt={user.nome} width={40} height={40} className="object-cover"/>
                                ) : <User size={16} className="text-gray-300 m-auto mt-2"/>}
                              </div>
                              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] bg-white shadow border border-gray-100`}>
                                <Icone size={8} className={textHighlight} />
                              </div>
                           </div>
                        </div>

                        <div className="flex items-end justify-between mt-3 pt-3 border-t border-gray-200/50">
                           <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Score Total</span>
                              <span className={`text-xl font-black font-oswald ${textHighlight}`}>{user.valor.toLocaleString('pt-BR')}</span>
                           </div>
                           <div className={`px-3 py-1 rounded-lg bg-white border border-gray-100 shadow-sm text-[9px] font-black uppercase tracking-widest ${textHighlight}`}>
                              {conf.titulo}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. GENERAL LIST (8th to 50th) */}
          {listaGeral.length > 0 && (
            <div className="bg-white mx-4 md:mx-8 rounded-[2rem] shadow-sm border border-gray-200 overflow-hidden mb-16">
              <div className="p-6 bg-gray-50/50 border-b border-gray-200 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-gray-100 rounded-lg text-gray-500"><Medal size={20} /></div>
                   <h3 className="text-lg font-bold text-gray-800 font-oswald uppercase tracking-wide">Ranking Geral</h3>
                 </div>
                 <span className="text-xs font-bold text-gray-500 uppercase bg-gray-100 px-3 py-1 rounded-full border border-gray-200">Top 50</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest font-oswald w-16 text-center">#</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest font-oswald">Aluno</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest font-oswald text-center hidden sm:table-cell w-1/3">Título Atual</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest font-oswald text-right whitespace-nowrap">{tipo === 'STREAK' ? 'Ofensiva' : 'Pontuação'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {listaGeral.map((user) => (
                      <tr key={user.usuarioId} className={`group hover:bg-blue-50/40 transition-colors ${user.isMe ? 'bg-blue-50/60 border-l-4 border-blue-500' : ''}`}>
                        
                        <td className="px-6 py-4 text-center">
                           <span className={`font-mono font-bold text-sm ${user.isMe ? 'text-blue-700' : 'text-gray-500'}`}>
                             {user.posicao}
                           </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 relative">
                               {user.fotoUrl ? (
                                 <Image src={user.fotoUrl} alt={user.nome} width={36} height={36} className="object-cover"/>
                               ) : <User size={16} className="text-gray-400"/>}
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-sm font-bold truncate max-w-[150px] md:max-w-xs ${user.isMe ? 'text-blue-700' : 'text-gray-700'} group-hover:text-blue-700 transition-colors`}>
                                  {user.nome} 
                                  {user.isMe && <span className="ml-2 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black uppercase align-middle">Você</span>}
                                </span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide sm:hidden mt-0.5">
                                   {user.titulo}
                                </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-center hidden sm:table-cell align-middle">
                          <div className="inline-block bg-white border border-gray-200 rounded-lg px-4 py-1.5 max-w-[280px] shadow-sm group-hover:border-blue-200 group-hover:shadow-md transition-all">
                             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight block group-hover:text-blue-600 transition-colors">
                               {user.titulo}
                             </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right whitespace-nowrap">
                           <div className="flex flex-col items-end justify-center h-full">
                             <span className="font-oswald font-bold text-gray-800 text-base leading-none block">{user.valor.toLocaleString('pt-BR')}</span>
                             <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1 block">{user.valorLabel}</span>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ranking.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 mt-8">
              <Trophy size={40} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-700">Ranking Vazio</h3>
              <p className="text-gray-400 text-sm">Nenhum dado para este período.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}