'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // ✅ Import router
import { BadgeCard } from '@/components/gamificacao/BadgeCard';
import { 
  Trophy, Star, Lock, Zap, BookOpen, Target, Crown, EyeOff, 
  ChevronLeft, ChevronRight, AlertTriangle 
} from 'lucide-react';

const ITEMS_PER_PAGE = 12;

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  INICIO_ENGAJAMENTO: { label: 'Início & Engajamento', icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  PERFORMANCE_VELOCIDADE: { label: 'Performance & Velocidade', icon: Target, color: 'text-red-600', bg: 'bg-red-50' },
  MAESTRIA_UC: { label: 'Maestria Técnica', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
  OBJETO_CONHECIMENTO: { label: 'Conhecimentos Específicos', icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' },
  DESEMPENHO_AVANCADO: { label: 'Desempenho Avançado', icon: Trophy, color: 'text-orange-600', bg: 'bg-orange-50' },
  OCULTA: { label: 'Conquistas Secretas', icon: EyeOff, color: 'text-slate-600', bg: 'bg-slate-50' },
  IMPOSSIVEL: { label: 'Lendárias & Impossíveis', icon: Crown, color: 'text-rose-600', bg: 'bg-rose-50' },
};

export default function ConquistasPage() {
  const router = useRouter(); // ✅ Router initialized
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState('INICIO_ENGAJAMENTO');
  const [currentPage, setCurrentPage] = useState(1);

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
    async function loadConquistas() {
      try {
        const res = await fetch('/api/estudante/conquistas');
        
        // 🛡️ 2. ARMOR: Handling 401/429
        if (res.status === 401 || res.status === 403) {
          router.push('/auth/login'); // Redirect instead of just showing error
          return;
        }
        if (res.status === 429) {
          setError('Muitas requisições. Aguarde um momento.');
          setLoading(false);
          return;
        }

        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          setError('Erro ao carregar dados.');
        }
      } catch (e) {
        console.error("Erro seguro:", e);
        setError('Erro de conexão.');
      } finally {
        setLoading(false);
      }
    }
    loadConquistas();
  }, [router]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    document.getElementById('grid-topo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (error) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2">
          <AlertTriangle className="text-red-500" size={32} />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Atenção</h3>
        <p className="text-gray-500 max-w-md">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 animate-pulse">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Polindo os troféus...</p>
      </div>
    );
  }

  if (!data) return null;

  const { resumo, categorias } = data;
  const todasDaCategoria = categorias[activeTab] || [];
  const progressoGeral = resumo.total > 0 ? Math.round((resumo.desbloqueadas / resumo.total) * 100) : 0;

  const totalPages = Math.ceil(todasDaCategoria.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentConquistas = todasDaCategoria.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500 px-4 md:px-8 font-sans">
      
      {/* 1. HEADER */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden mt-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none"></div>
        
        <div className="relative shrink-0">
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-200">
            <Trophy size={48} className="text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-white px-3 py-1 rounded-full text-xs font-black text-orange-600 shadow-sm border border-orange-100">
            {resumo.pontosConquistados.toLocaleString('pt-BR')} XP
          </div>
        </div>

        <div className="flex-1 w-full text-center md:text-left z-10">
          <h1 className="text-2xl md:text-3xl font-black text-gray-800 font-oswald uppercase mb-2">
            Sala de Troféus
          </h1>
          <p className="text-gray-500 mb-4 max-w-xl font-lato">
            Colecione conquistas para subir de nível e mostrar sua autoridade técnica.
            Você já desbloqueou <strong className="text-gray-800">{resumo.desbloqueadas}</strong> de <strong className="text-gray-800">{resumo.total}</strong> medalhas.
          </p>
          
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden border border-gray-200">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              style={{ width: `${progressoGeral}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Iniciante</span>
            <span>{progressoGeral}% Completo</span>
            <span>Lenda</span>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION GRID */}
      <div className="w-full">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Categorias</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.keys(categorias).map((catKey) => {
            if (categorias[catKey].length === 0) return null;
            
            const isActive = activeTab === catKey;
            const config = CATEGORY_MAP[catKey] || { label: catKey, icon: Star, color: 'text-gray-500', bg: 'bg-gray-50' };
            const Icon = config.icon;

            return (
              <button
                key={catKey}
                onClick={() => setActiveTab(catKey)}
                className={`
                  relative flex flex-col items-center justify-center p-3 h-28 rounded-2xl border transition-all duration-200
                  ${isActive 
                    ? `
                        bg-gradient-to-br from-blue-50 via-white to-blue-100
                        border-blue-200
                        text-blue-700
                        shadow-lg
                        ring-2 ring-blue-700
                        z-10 scale-[1.06]
                    `
                    : `
                        bg-white
                        border-gray-200
                        text-gray-500
                        hover:bg-gray-50
                        hover:border-gray-300
                    `
                  }
                `}
              >
                <div className={`
                  mb-2 p-2 rounded-full 
                  ${isActive ? config.bg : 'bg-gray-100'}
                `}>
                  <Icon size={20} className={isActive ? config.color : 'text-gray-400'} />
                </div>

                <span className={`
                  text-[10px] sm:text-xs font-bold uppercase tracking-wide text-center leading-tight max-w-[90%]
                  ${isActive ? 'text-gray-800' : 'text-gray-400'}
                `}>
                  {config.label}
                </span>

                <span className={`
                  absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded-md
                  ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}
                `}>
                  {categorias[catKey].length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. BADGE GRID */}
      <div id="grid-topo" className="min-h-[400px]">
        {currentConquistas.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            {currentConquistas.map((conquista: any) => (
              <BadgeCard 
                key={conquista.id}
                conquista={conquista}
                desbloqueada={conquista.desbloqueada}
                progresso={conquista.progresso}
                dataConquista={conquista.dataConquista}
              />
            ))}
          </div>
        ) : (
          <div className="col-span-full py-20 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
            <Lock size={48} className="mx-auto mb-4 opacity-20" />
            <p>Nenhuma conquista nesta categoria ainda.</p>
          </div>
        )}
      </div>

      {/* 4. PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-6 border-t border-gray-100">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          
          <span className="text-sm font-bold text-gray-500 font-oswald uppercase tracking-wider">
            Página <span className="text-blue-600 text-base mx-1">{currentPage}</span> de {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      <style jsx global>{`
        /* Removed global scrollbar style as it is no longer used in navigation */
      `}</style>
    </div>
  );
}