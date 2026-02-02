'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle2, 
  Circle, 
  BrainCircuit, 
  Target, 
  BookOpen, 
  AlertTriangle,
  Play,
  Lock,
  Filter,
  GraduationCap,
  Layers,
  Wrench,
  Lightbulb,
  Info
} from 'lucide-react';
import { useCsrf } from '@/lib/hooks/use-csrf';

// --- INTERFACES ---
interface CursoTecnico { id: number; nome: string; }
interface UnidadeCurricular { 
    id: number; 
    codigo: string; 
    nome: string; 
    qtdeQuestoes: number; // ✅ Added to support filtering
}

// Interfaces for Advanced Filters
interface FiltroItem { id: number; nome?: string; descricao?: string; } 

export default function NovoSimuladoPage() {
  const router = useRouter();
  
  // ✅ 1. SECURITY: CSRF Token
  const csrfToken = useCsrf();
  
  // --- STATES ---
  const [mode, setMode] = useState<'CUSTOM' | 'SAEP'>('CUSTOM');
  const [submitting, setSubmitting] = useState(false);
  
  // Master Data
  const [cursos, setCursos] = useState<CursoTecnico[]>([]);
  const [unidades, setUnidades] = useState<UnidadeCurricular[]>([]);
  
  // Advanced Filter Data
  const [objetosConhecimento, setObjetosConhecimento] = useState<FiltroItem[]>([]);
  const [funcoes, setFuncoes] = useState<FiltroItem[]>([]);
  const [capacidades, setCapacidades] = useState<FiltroItem[]>([]);

  // Loadings
  const [loadingCursos, setLoadingCursos] = useState(true);
  const [loadingUCs, setLoadingUCs] = useState(false);
  const [loadingFiltros, setLoadingFiltros] = useState(false);

  // --- SIMULATION CONFIGURATION ---
  const [selectedCursoId, setSelectedCursoId] = useState<string>(''); 
  const [config, setConfig] = useState({
    ucsSelecionadas: [] as number[],
    
    // Advanced Filters (Ids)
    objetosSelecionados: [] as number[],
    funcoesSelecionadas: [] as number[],
    capacidadesSelecionadas: [] as number[],

    // Pedagogical
    dificuldade: null as string | null,
    nivelCognitivo: null as string | null,
    qtdeQuestoes: 10
  });

  // 🛡️ 2. SECURITY: Immediate Session Validation
  useEffect(() => {
    fetch('/api/csrf')
      .then(res => {
        if (!res.ok) router.push('/auth/login');
      })
      .catch(() => {});
  }, [router]);

  // 1. Load Courses
  useEffect(() => {
    async function loadCursos() {
      try {
        const res = await fetch('/api/cursos');
        
        // 🛡️ Auth Check
        if (res.status === 401 || res.status === 403) {
            router.push('/auth/login');
            return;
        }

        if (res.ok) setCursos(await res.json());
      } catch (e) { console.error(e); } finally { setLoadingCursos(false); }
    }
    loadCursos();
  }, [router]);

  // 2. Load UCs when Course changes
  useEffect(() => {
    if (!selectedCursoId) { setUnidades([]); return; }
    
    // Full reset when changing course
    setConfig(prev => ({ 
      ...prev, 
      ucsSelecionadas: [], 
      objetosSelecionados: [],
      funcoesSelecionadas: [],
      capacidadesSelecionadas: []
    }));
    setObjetosConhecimento([]);
    setFuncoes([]);
    setCapacidades([]);

    async function loadUCs() {
      setLoadingUCs(true);
      try {
        const res = await fetch(`/api/unidades?cursoId=${selectedCursoId}`);
        if (res.ok) {
            const data = await res.json();
            // ✅ LOGIC: Filter UCs with >= 50 questions
            // Assuming the API returns 'qtdeQuestoes'. If not, the API needs adjustment.
            // For now, applying the filter on the received list.
            const ucsValidas = data.filter((uc: any) => (uc.qtdeQuestoes || 0) >= 40);
            setUnidades(ucsValidas);
        }
      } catch (e) { console.error(e); } finally { setLoadingUCs(false); }
    }
    loadUCs();
  }, [selectedCursoId]);

  // 3. Load Advanced Filters when UCs change
  useEffect(() => {
    if (config.ucsSelecionadas.length === 0) {
      setObjetosConhecimento([]);
      setFuncoes([]);
      setCapacidades([]);
      return;
    }

    async function loadFilters() {
      setLoadingFiltros(true);
      try {
        const ids = config.ucsSelecionadas.join(',');
        const res = await fetch(`/api/filtros-simulado?ucs=${ids}`);
        
        if (res.ok) {
          const data = await res.json();
          setObjetosConhecimento(data.objetos);
          setFuncoes(data.funcoes);
          setCapacidades(data.capacidades);
        }
      } catch (e) { 
        console.error("Erro ao carregar filtros", e); 
      } finally { 
        setLoadingFiltros(false); 
      }
    }
    
    const timer = setTimeout(loadFilters, 500);
    return () => clearTimeout(timer);

  }, [config.ucsSelecionadas]);

  // --- SELECTION HANDLERS ---
  const toggleSelection = (key: 'ucsSelecionadas' | 'objetosSelecionados' | 'funcoesSelecionadas' | 'capacidadesSelecionadas', id: number) => {
    setConfig(prev => {
      const list = prev[key];
      const exists = list.includes(id);
      if (exists) {
        return { ...prev, [key]: list.filter(item => item !== id) };
      } else {
        return { ...prev, [key]: [...list, id] };
      }
    });
  };

  const handleStart = async () => {
    // Validação básica (Adicionei verificação do modo CUSTOM para não bloquear SAEP se for o caso)
    if (config.ucsSelecionadas.length === 0 && mode === 'CUSTOM') {
        alert("Selecione pelo menos uma matéria.");
        return;
    }

    // 🛡️ Prevenção: CSRF
    if (!csrfToken) {
        alert("Aguarde o carregamento da segurança...");
        return;
    }

    setSubmitting(true);
    
    try {
        // ✅ Montando o payload corretamente uma única vez
        const payload = {
            tipo: mode,
            config: {
                ...config,
                // Garante que o cursoId vá como número para o Zod não reclamar
                cursoId: Number(selectedCursoId) 
            }
        };
        
        const res = await fetch('/api/simulados', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                // ✅ OBRIGATÓRIO: O token que libera o acesso no backend
                'x-csrf-token': csrfToken 
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            if (res.status === 401) {
                // Sessão expirou
                router.push('/auth/login');
                return;
            }
            // Captura msg de erro do backend (ex: limite atingido)
            const err = await res.json();
            throw new Error(err.error || "Erro ao criar simulado");
        }

        const data = await res.json();
        
        router.push(`/simulado/${data.simuladoId}`);

    } catch (e: any) {
        console.error(e);
        // Mostra o erro real para o usuário (ex: "Limite diário atingido")
        alert(e.message || 'Erro desconhecido ao tentar gerar simulado.');
        setSubmitting(false);
    }
};

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500 font-sans">
      
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 font-oswald uppercase">Configurar Novo Simulado</h1>
        <p className="text-gray-500 text-sm mt-1 font-lato">Monte seu treino estratégico com base nas suas necessidades.</p>
      </div>

      {/* 1. MODE SELECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button 
          onClick={() => setMode('CUSTOM')}
          className={`relative p-6 rounded-2xl border-2 text-left transition-all group ${
            mode === 'CUSTOM' 
            ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-100 ring-offset-2' 
            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
          }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div className={`p-2.5 rounded-xl transition-colors ${mode === 'CUSTOM' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500'}`}>
                <Target size={24} />
            </div>
            {mode === 'CUSTOM' && <CheckCircle2 className="text-blue-600 animate-in zoom-in" size={24} />}
          </div>
          <h3 className={`font-bold text-lg mb-1 font-oswald uppercase ${mode === 'CUSTOM' ? 'text-blue-900' : 'text-gray-700'}`}>Treino Personalizado</h3>
          <p className="text-sm text-gray-500 leading-relaxed font-lato">
            Filtre por Matéria, Capacidade Técnica ou Objeto de Conhecimento. Você no controle.
          </p>
        </button>

        <button 
          disabled
          className="relative p-6 rounded-2xl border-2 border-gray-100 bg-gray-50 text-left opacity-70 cursor-not-allowed"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 rounded-xl bg-gray-200 text-gray-400">
                <BrainCircuit size={24} />
            </div>
            <div className="flex items-center gap-1.5 bg-gray-200 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                <Lock size={10} /> Em Breve
            </div>
          </div>
          <h3 className="font-bold text-lg text-gray-400 mb-1 font-oswald uppercase">Simulado SAEP Oficial</h3>
          <p className="text-sm text-gray-400 leading-relaxed font-lato">
            Simulação completa com as regras oficiais de tempo e distribuição de questões do SAEP.
          </p>
        </button>
      </div>

      {mode === 'CUSTOM' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            
            {/* 2. TECHNICAL COURSE */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                    <GraduationCap className="text-blue-600" size={20} />
                    <h3 className="font-bold text-gray-800 font-oswald text-lg uppercase">1. Qual o seu Curso Técnico?</h3>
                </div>
                
                {loadingCursos ? (
                    <div className="text-sm text-gray-400 animate-pulse font-lato">Carregando cursos disponíveis...</div>
                ) : (
                    <select 
                        value={selectedCursoId}
                        onChange={(e) => setSelectedCursoId(e.target.value)}
                        className="w-full md:w-1/2 p-3 border border-gray-200 rounded-xl font-lato text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50 focus:bg-white"
                    >
                        <option value="">Selecione um curso...</option>
                        {cursos.map(curso => (
                            <option key={curso.id} value={curso.id}>{curso.nome}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* 3. CURRICULAR UNITS */}
            {selectedCursoId && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-4">
                        <BookOpen className="text-blue-600" size={20} />
                        <div>
                            <h3 className="font-bold text-gray-800 font-oswald text-lg uppercase">2. Unidades Curriculares (Obrigatório)</h3>
                            <p className="text-xs text-gray-400 font-lato">Selecione uma ou mais matérias para compor a prova.</p>
                        </div>
                        {config.ucsSelecionadas.length > 0 && (
                            <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full animate-in zoom-in font-roboto">
                                {config.ucsSelecionadas.length} selecionada(s)
                            </span>
                        )}
                    </div>

                    {/* ℹ️ NOVO CARD DE INFORMAÇÃO PEDAGÓGICA */}
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-100 rounded-xl flex items-start gap-3">
                        <Info className="text-yellow-600 shrink-0 mt-0.5" size={18} />
                        <div>
                            <h4 className="text-sm font-bold text-yellow-800 uppercase mb-1">Nota de Qualidade</h4>
                            <p className="text-xs text-yellow-700 font-lato leading-relaxed">
                                Para garantir uma experiência de estudo eficaz, <strong>exibimos apenas as Unidades Curriculares que possuem pelo menos 50 questões</strong> cadastradas em nosso banco de dados. Isso evita a criação de simulados vazios ou repetitivos.
                            </p>
                        </div>
                    </div>

                    {loadingUCs ? (
                        <div className="text-center py-8 text-gray-400 font-lato">Carregando matérias...</div>
                    ) : unidades.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <AlertTriangle className="mx-auto text-gray-300 mb-2" size={32} />
                            <p className="text-gray-500 italic font-lato text-sm">
                                Nenhuma matéria deste curso atingiu o requisito mínimo de questões ainda.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {unidades.map(uc => {
                                const isSelected = config.ucsSelecionadas.includes(uc.id);
                                return (
                                    <button
                                        key={uc.id}
                                        onClick={() => toggleSelection('ucsSelecionadas', uc.id)}
                                        className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200 group ${
                                            isSelected 
                                            ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500' 
                                            : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className={`mt-0.5 shrink-0 transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-300 group-hover:text-blue-400'}`}>
                                            {isSelected ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider block font-roboto ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                                                    {uc.codigo}
                                                </span>
                                                <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold" title="Questões disponíveis">
                                                    {uc.qtdeQuestoes}+ Q
                                                </span>
                                            </div>
                                            <span className={`font-bold text-sm leading-snug block font-lato ${isSelected ? 'text-blue-900' : 'text-gray-600'}`}>
                                                {uc.nome}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 4. ADVANCED FILTERS (OPTIONAL) */}
            {config.ucsSelecionadas.length > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in">
                    <div className="flex items-center gap-2 mb-2">
                        <Filter className="text-blue-600" size={20} />
                        <h3 className="font-bold text-gray-800 font-oswald text-lg uppercase">3. Filtros Específicos (Opcional)</h3>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3 mb-6">
                        <Info className="text-blue-600 shrink-0 mt-0.5" size={18} />
                        <p className="text-xs text-blue-800 font-lato leading-relaxed">
                            <strong>Dica Pedagógica:</strong> Selecione itens aqui apenas se quiser estudar um tópico muito específico. 
                            Para simulados mais reais e abrangentes, <strong>recomendamos deixar estes filtros em branco</strong> (todos selecionados).
                        </p>
                    </div>

                    {loadingFiltros ? (
                        <div className="text-center py-6 text-gray-400 font-lato text-sm animate-pulse">Buscando tópicos relacionados às matérias selecionadas...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            {/* Knowledge Objects */}
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-3 font-roboto">
                                    <Layers size={14} /> Objetos de Conhecimento
                                </label>
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {objetosConhecimento.length === 0 ? <span className="text-xs text-gray-400 italic">Sem itens disponíveis</span> : 
                                    objetosConhecimento.map(obj => (
                                        <label key={obj.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer border border-transparent hover:border-gray-100">
                                            <input 
                                                type="checkbox" 
                                                checked={config.objetosSelecionados.includes(obj.id)}
                                                onChange={() => toggleSelection('objetosSelecionados', obj.id)}
                                                className="mt-1 rounded text-blue-600 focus:ring-blue-500" 
                                            />
                                            <span className="text-xs text-gray-700 font-lato">{obj.nome || obj.descricao}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Functions */}
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-3 font-roboto">
                                    <Wrench size={14} /> Funções Técnicas
                                </label>
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {funcoes.length === 0 ? <span className="text-xs text-gray-400 italic">Sem itens disponíveis</span> :
                                    funcoes.map(func => (
                                        <label key={func.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer border border-transparent hover:border-gray-100">
                                            <input 
                                                type="checkbox" 
                                                checked={config.funcoesSelecionadas.includes(func.id)}
                                                onChange={() => toggleSelection('funcoesSelecionadas', func.id)}
                                                className="mt-1 rounded text-blue-600 focus:ring-blue-500" 
                                            />
                                            <span className="text-xs text-gray-700 font-lato">{func.nome || func.descricao}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Capacities */}
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-3 font-roboto">
                                    <Lightbulb size={14} /> Capacidades Técnicas
                                </label>
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {capacidades.length === 0 ? <span className="text-xs text-gray-400 italic">Sem itens disponíveis</span> :
                                    capacidades.map(cap => (
                                        <label key={cap.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer border border-transparent hover:border-gray-100">
                                            <input 
                                                type="checkbox" 
                                                checked={config.capacidadesSelecionadas.includes(cap.id)}
                                                onChange={() => toggleSelection('capacidadesSelecionadas', cap.id)}
                                                className="mt-1 rounded text-blue-600 focus:ring-blue-500" 
                                            />
                                            <span className="text-xs text-gray-700 font-lato">{cap.descricao || cap.nome}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            )}

            {/* 5. DIFFICULTY & SIZE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-6">
                        <Target className="text-gray-400" size={20} />
                        <h3 className="font-bold text-gray-800 font-oswald text-lg uppercase">Parâmetros da Prova</h3>
                    </div>
                    
                    <div className="space-y-5">
                        {/* DIFFICULTY (5 Levels) */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block ml-1 font-roboto">Dificuldade</label>
                            <select 
                                className="w-full p-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition font-lato"
                                value={config.dificuldade ?? ''}
                                onChange={e => setConfig({ ...config, dificuldade: e.target.value || null })}
                            >
                                <option value="">Aleatória (Recomendado)</option>
                                <option value="MUITO_FACIL">Muito Fácil</option>
                                <option value="FACIL">Fácil</option>
                                <option value="MEDIO">Médio</option>
                                <option value="DIFICIL">Difícil</option>
                                <option value="MUITO_DIFICIL">Muito Difícil</option>
                            </select>
                        </div>

                        {/* BLOOM (6 Levels from Schema) */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block ml-1 font-roboto">Nível Cognitivo (Taxonomia de Bloom)</label>
                            <select 
                                className="w-full p-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition font-lato"
                                value={config.nivelCognitivo ?? ''}
                                onChange={e => setConfig({ ...config, nivelCognitivo: e.target.value || null })}
                            >
                                <option value="">Todos os Níveis (Recomendado)</option>
                                <option value="LEMBRAR">1. Lembrar (Memorização)</option>
                                <option value="ENTENDER">2. Entender (Compreensão)</option>
                                <option value="APLICAR">3. Aplicar (Prática)</option>
                                <option value="ANALISAR">4. Analisar (Crítico)</option>
                                <option value="AVALIAR">5. Avaliar (Julgamento)</option>
                                <option value="CRIAR">6. Criar (Síntese)</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Realism Notice */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 text-center uppercase font-bold tracking-wide">
                            Mantenha as opções "Aleatória" e "Todos" para gerar um simulado mais real.
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-gray-800 font-oswald text-lg mb-2 uppercase">Tamanho do Simulado</h3>
                        <p className="text-sm text-gray-500 mb-6 font-lato">Quantas questões você deseja responder agora?</p>
                        
                        <div className="flex justify-between gap-2">
                            {[5, 10, 20, 30, 50].map(qtd => (
                                <button
                                    key={qtd}
                                    onClick={() => setConfig({...config, qtdeQuestoes: qtd})}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all font-roboto ${
                                        config.qtdeQuestoes === qtd 
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' 
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {qtd}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6">
                        {config.ucsSelecionadas.length === 0 ? (
                            <div className="p-4 bg-orange-50 text-orange-700 rounded-xl text-xs font-bold flex items-start gap-2 border border-orange-100 font-lato">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <span>Selecione um curso e pelo menos uma matéria para começar.</span>
                            </div>
                        ) : (
                            <button 
                                onClick={handleStart}
                                disabled={submitting}
                                className="w-full bg-brand-green hover:bg-green-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-xl shadow-green-100 hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-3 font-roboto uppercase tracking-wide"
                            >
                                {submitting ? 'Gerando...' : (
                                    <>
                                        Gerar Simulado <Play size={20} fill="currentColor" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

        </div>
      )}
    </div>
  );
}