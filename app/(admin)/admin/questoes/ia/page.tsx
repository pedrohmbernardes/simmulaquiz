'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCsrf } from '@/lib/hooks/use-csrf';
import { 
  ArrowLeft, BrainCircuit, Sparkles, Target, GraduationCap, AlertCircle, Wand2,
  CheckCircle, Trash2, Save, Edit3, ChevronRight, Loader2, Lock
} from 'lucide-react';
import { toast } from 'sonner';

// --- TIPOS ---
interface ConfigIA {
  cursoTecnicoId: string;
  unidadeCurricularId: string;
  objetoConhecimentoId: string;
  subConhecimentoId: string;
  funcaoId: string;
  subfuncaoId: string;
  capacidadeId: string;
  dificuldade: string;
  nivelCognitivo: string;
  quantidade: number;
  palavrasChave: string;
}

export default function GeradorIAPage() {
  const router = useRouter();
  const csrfToken = useCsrf();
  
  // --- ESTADOS ---
  const [options, setOptions] = useState<any>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progressText, setProgressText] = useState(""); 
  const [limitReached, setLimitReached] = useState(false); // NOVO ESTADO
  
  // Estado do Wizard (1=Config, 2=Preview)
  const [step, setStep] = useState(1);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  // Formulário de Configuração
  const [config, setConfig] = useState<ConfigIA>({
    cursoTecnicoId: '',
    unidadeCurricularId: '',
    objetoConhecimentoId: '',
    subConhecimentoId: '',
    funcaoId: '',
    subfuncaoId: '',
    capacidadeId: '',
    dificuldade: 'MEDIO',
    nivelCognitivo: 'APLICAR',
    quantidade: 2,
    palavrasChave: ''
  });

  // 🛡️ 1. BLINDAGEM: Carregar Opções com Verificação de Auth
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/options');
        
        // Se a API retornar erro de auth, expulsa o usuário
        if (res.status === 401 || res.status === 403) {
            router.push('/auth/login');
            return;
        }

        if (res.ok) {
            setOptions(await res.json());
        } else {
            toast.error("Erro ao carregar opções.");
        }
      } catch (e) { 
          console.error(e); 
          toast.error("Erro de conexão.");
      } finally { 
          setLoadingOptions(false); 
      }
    }
    load();
  }, [router]);

  // --- LÓGICA DE CASCATA (Estado) ---
  const handleChange = (field: keyof ConfigIA, value: any) => {
    setConfig(prev => {
      const next = { ...prev, [field]: value };
      
      // Limpeza em cascata ao mudar o pai
      if (field === 'cursoTecnicoId') { 
        next.unidadeCurricularId = ''; 
        next.objetoConhecimentoId = ''; 
        next.subConhecimentoId = ''; 
      }
      if (field === 'unidadeCurricularId') { 
        next.objetoConhecimentoId = ''; 
        next.subConhecimentoId = ''; 
      }
      if (field === 'objetoConhecimentoId') { 
        next.subConhecimentoId = ''; 
      }
      if (field === 'funcaoId') { 
        next.subfuncaoId = ''; 
        next.capacidadeId = ''; 
      }
      if (field === 'subfuncaoId') { 
        next.capacidadeId = ''; 
      }
      return next;
    });
  };

  // --- FILTROS DE RELACIONAMENTO ---
  const ucsFiltradas = options.ucs?.filter((uc: any) => 
    !config.cursoTecnicoId || uc.cursoTecnicoId === Number(config.cursoTecnicoId)
  );
  
  const objetosFiltrados = options.objetos?.filter((obj: any) => 
    !config.unidadeCurricularId || 
    (obj.ucsIds && obj.ucsIds.includes(Number(config.unidadeCurricularId)))
  );

  const subConhecimentosFiltrados = options.subconhecimentos?.filter((sub: any) => 
    !config.objetoConhecimentoId || sub.conhecimentoId === Number(config.objetoConhecimentoId)
  );

  const funcoesFiltradas = options.funcoes?.filter((f: any) => 
    !config.cursoTecnicoId || 
    (f.cursosIds && f.cursosIds.includes(Number(config.cursoTecnicoId)))
  );

  const subfuncoesFiltradas = options.subfuncoes?.filter((sub: any) => 
    !config.funcaoId || sub.funcaoId === Number(config.funcaoId)
  );

  const capacidadesFiltradas = options.capacidades?.filter((cap: any) => 
    !config.subfuncaoId || 
    (cap.subfuncoesIds && cap.subfuncoesIds.includes(Number(config.subfuncaoId)))
  );

  const canGenerate = config.cursoTecnicoId && config.unidadeCurricularId && config.objetoConhecimentoId && config.funcaoId && config.subfuncaoId && config.capacidadeId;

  // --- AÇÃO: GERAR (MODO LOOP) ---
  const handleGenerate = async () => {
    if (limitReached) {
        toast.error("Limite diário já atingido. Tente amanhã.");
        return;
    }

    if (!csrfToken) {
        toast.error("Sessão instável. Recarregue a página.");
        return;
    }

    setGenerating(true);
    setGeneratedQuestions([]); 
    setProgressText("Iniciando análise da Matriz..."); 
    
    const qtdSolicitada = config.quantidade;
    const novasQuestoes: any[] = [];
    
    const payloadBase = {
        ...config,
        subConhecimentoId: config.subConhecimentoId ? config.subConhecimentoId : null,
        quantidade: 1 
    };

    try {
      for (let i = 1; i <= qtdSolicitada; i++) {
        setProgressText(`Criando questão ${i} de ${qtdSolicitada}...`);
        
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify(payloadBase) 
            });

            if (!res.ok) {
                // Se a sessão cair no meio do processo
                if (res.status === 401 || res.status === 403) {
                    toast.error("Sessão expirada.");
                    router.push('/auth/login');
                    break;
                }
                if (res.status === 429) {
                    const err = await res.json().catch(() => ({}));
                    setLimitReached(true); // Bloqueia UI
                    toast.warning(`Limite diário atingido na questão ${i}.`);
                    break; // Para o loop
                }
                console.error(`Erro na iteração ${i}`, res.statusText);
                continue; 
            }

            const data = await res.json();
            
            if (data.data && data.data.length > 0) {
                const qGerada = data.data[0];
                novasQuestoes.push(qGerada);
                setGeneratedQuestions(prev => [...prev, qGerada]);
            }

        } catch (innerError) {
            console.error(`Falha de conexão na iteração ${i}`, innerError);
        }
      }

      if (novasQuestoes.length > 0) {
          setProgressText("Finalizando...");
          setTimeout(() => {
              setStep(2);
          }, 600);
      } else if (limitReached) {
          // Se não gerou nada pq bateu no limite logo de cara
          setGenerating(false);
      } else {
          alert("Não foi possível gerar as questões. Tente novamente.");
          setGenerating(false);
      }

    } catch (e) {
      alert('Erro crítico no processo de geração.');
      setGenerating(false);
    }
  };

  // ... (Resto das funções: handleUpdateQuestion, handleDiscard, handleSaveQuestion - SEM MUDANÇAS) ...
  const handleUpdateQuestion = (index: number, field: string, value: string) => {
    const updated = [...generatedQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setGeneratedQuestions(updated);
  };

  const handleDiscard = (index: number) => {
    if (!confirm('Descartar esta questão?')) return;
    const updated = generatedQuestions.filter((_, i) => i !== index);
    setGeneratedQuestions(updated);
    if (updated.length === 0) setStep(3);
  };

  const handleSaveQuestion = async (index: number) => {
    setSavingIndex(index);
    const questao = generatedQuestions[index];

    try {
      const payload = {
        ...config,
        subConhecimentoId: config.subConhecimentoId ? Number(config.subConhecimentoId) : null,
        enunciado: questao.enunciado,
        alternativaA: questao.alternativaA,
        alternativaB: questao.alternativaB,
        alternativaC: questao.alternativaC,
        alternativaD: questao.alternativaD,
        alternativaE: questao.alternativaE,
        alternativaCorreta: questao.alternativaCorreta.toLowerCase(),
        categoriaOrigem: 'INSTITUCIONAL_INTERNA',
        bancaId: null,
        instituicaoId: null,
        ano: new Date().getFullYear(),
        prova: 'Gerado via IA',
        imagem: null
      };

      const res = await fetch('/api/admin/questoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken || '' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            toast.error("Sessão expirada.");
            router.push('/auth/login');
            return;
        }
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar');
      }

      toast.success("Questão salva com sucesso!");
      const updated = generatedQuestions.filter((_, i) => i !== index);
      setGeneratedQuestions(updated);
      if (updated.length === 0) setStep(3);

    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setSavingIndex(null);
    }
  };

  if (loadingOptions) return <div className="h-screen flex items-center justify-center animate-pulse text-purple-600 font-bold">Carregando IA...</div>;

  // --- TELA FINAL ---
  if (step === 3) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in zoom-in-95">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-sm"><CheckCircle size={48} /></div>
            <h2 className="text-3xl font-bold text-gray-900">Processo Concluído!</h2>
            <p className="text-gray-500 mb-8 mt-2 max-w-md">Todas as questões geradas foram processadas.</p>
            <div className="flex gap-4">
                <button onClick={() => { setStep(1); setConfig(prev => ({...prev, palavrasChave: ''})) }} className="bg-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg">Gerar Mais</button>
                <button onClick={() => router.push('/admin/questoes')} className="bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-xl font-bold hover:bg-gray-50">Ir para Lista</button>
            </div>
        </div>
      )
  }

  // --- TELA DE CONFIGURAÇÃO (PASSO 1) ---
  if (step === 1) {
    return (
      <div className="w-full max-w-[1600px] mx-auto pb-24 px-4 md:px-6 relative">
        
        {/* OVERLAY */}
        {generating && (
          <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500 cursor-wait">
            <div className="relative flex items-center justify-center mb-8">
                <div className="w-24 h-24 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin duration-700"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <BrainCircuit size={40} className="text-purple-600 animate-pulse" />
                </div>
            </div>
            <h2 className="text-3xl font-black text-gray-900 font-oswald uppercase tracking-wide mb-3 animate-pulse tabular-nums">{progressText || "Iniciando..."}</h2>
            <p className="text-gray-500 font-medium text-lg max-w-md text-center leading-relaxed mb-6">A IA está processando cada questão individualmente para garantir máxima qualidade técnica.</p>
            <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500 ease-out" style={{ width: `${(generatedQuestions.length / config.quantidade) * 100}%` }} />
            </div>
            <span className="text-xs text-gray-400 mt-2 font-mono">{generatedQuestions.length} / {config.quantidade} concluídas</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center py-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-purple-200"><BrainCircuit size={32} /></div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 font-oswald tracking-tight uppercase flex items-center gap-2">Gerador Inteligente <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-bold">GPT-5 READY</span></h1>
              <p className="text-sm text-gray-500 font-medium">Crie questões inéditas contextualizadas usando IA.</p>
            </div>
          </div>
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold text-sm flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition"><ArrowLeft size={18} /> Voltar</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-2 space-y-6">
                {/* ... (Seções de Contexto e Matriz - Mantidas iguais) ... */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-purple-200 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><GraduationCap size={100} /></div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-xs">1</span> Contexto Educacional</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                        <SelectField label="Curso Técnico" value={config.cursoTecnicoId} onChange={v => handleChange('cursoTecnicoId', v)} options={options.cursos} getLabel={i => i.nome} />
                        <SelectField label="Unidade Curricular" value={config.unidadeCurricularId} onChange={v => handleChange('unidadeCurricularId', v)} options={ucsFiltradas} disabled={!config.cursoTecnicoId} getLabel={i => `${i.codigo} - ${i.nome}`} />
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <SelectField label="Objeto de Conhecimento" value={config.objetoConhecimentoId} onChange={v => handleChange('objetoConhecimentoId', v)} options={objetosFiltrados} disabled={!config.unidadeCurricularId} getLabel={i => `${i.codigo} - ${i.nome}`} />
                            <SelectField label="Sub-conhecimento (Opcional)" value={config.subConhecimentoId} onChange={v => handleChange('subConhecimentoId', v)} options={subConhecimentosFiltrados} disabled={!config.objetoConhecimentoId} getLabel={i => `${i.codigo} - ${i.nome}`} />
                        </div>
                    </div>
                </section>

                <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-purple-200 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Target size={100} /></div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">2</span> Matriz de Referência</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                        <SelectField label="Função" value={config.funcaoId} onChange={v => handleChange('funcaoId', v)} options={funcoesFiltradas} getLabel={i => `${i.codigo} - ${i.nome}`} />
                        <SelectField label="Subfunção" value={config.subfuncaoId} onChange={v => handleChange('subfuncaoId', v)} options={subfuncoesFiltradas} disabled={!config.funcaoId} getLabel={i => `${i.codigo} - ${i.nome}`} />
                        <div className="md:col-span-2">
                            <SelectField label="Capacidade Técnica" value={config.capacidadeId} onChange={v => handleChange('capacidadeId', v)} options={capacidadesFiltradas} disabled={!config.subfuncaoId} getLabel={i => `${i.sigla} - ${i.descricao}`} />
                        </div>
                    </div>
                </section>
            </div>

            <div className="lg:col-span-1 space-y-6">
                <section className="bg-gradient-to-b from-white to-purple-50/30 p-6 rounded-2xl shadow-sm border border-purple-100 h-full flex flex-col">
                    <h3 className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-6 flex items-center gap-2"><Sparkles size={16} /> Parâmetros da Geração</h3>
                    
                    {/* --- AVISO DE LIMITE (Novo) --- */}
                    {limitReached ? (
                        <div className="flex flex-col items-center justify-center flex-1 text-center py-10 bg-white/50 rounded-xl border border-red-100 p-4">
                            <div className="bg-red-100 p-4 rounded-full mb-3 text-red-600"><Lock size={32} /></div>
                            <h4 className="text-red-700 font-bold text-lg mb-1">Cota Diária Atingida</h4>
                            <p className="text-red-500 text-sm max-w-xs">Você atingiu o limite de geração por hoje. Seus créditos serão renovados à meia-noite.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-6 flex-1">
                                <div>
                                    <div className="flex justify-between mb-2"><label className="text-xs font-bold text-gray-700">Quantidade</label><span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">{config.quantidade} Questões</span></div>
                                    <input type="range" min="1" max="5" step="1" className="w-full accent-purple-600 cursor-pointer" value={config.quantidade} onChange={e => handleChange('quantidade', Number(e.target.value))} />
                                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><AlertCircle size={10} /> Máximo de 5 por geração.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1.5">Dificuldade</label>
                                        <select className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-purple-500" value={config.dificuldade} onChange={e => handleChange('dificuldade', e.target.value)}>
                                            <option value="MUITO_FACIL">Muito Fácil</option>
                                            <option value="FACIL">Fácil</option>
                                            <option value="MEDIO">Médio</option>
                                            <option value="DIFICIL">Difícil</option>
                                            <option value="MUITO_DIFICIL">Muito Difícil</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1.5">Bloom</label>
                                        <select className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-purple-500" value={config.nivelCognitivo} onChange={e => handleChange('nivelCognitivo', e.target.value)}>
                                            <option value="LEMBRAR">Lembrar</option>
                                            <option value="ENTENDER">Entender</option>
                                            <option value="APLICAR">Aplicar</option>
                                            <option value="ANALISAR">Analisar</option>
                                            <option value="AVALIAR">Avaliar</option>
                                            <option value="CRIAR">Criar</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1.5">Contexto / Palavras-chave</label>
                                    <textarea className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none transition resize-none h-32" placeholder="Ex: Foque em falhas comuns de inversores de frequência..." value={config.palavrasChave} onChange={e => handleChange('palavrasChave', e.target.value)} />
                                </div>
                            </div>
                            <div className="pt-6 mt-6 border-t border-purple-100">
                                <button onClick={handleGenerate} disabled={!canGenerate || generating} className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-xl font-bold shadow-xl shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden group">
                                    {generating ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Criando Questões...</span></> : <><Wand2 size={20} className="group-hover:rotate-12 transition-transform" /><span>Gerar com IA</span></>}
                                </button>
                                {!canGenerate && <p className="text-center text-[10px] text-red-400 mt-3 font-medium animate-pulse">Preencha todos os campos pedagógicos (Esq.)</p>}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
      </div>
    );
  }

  // --- TELA DE PREVIEW (PASSO 2 - Mantida igual) ---
  if (step === 2) {
    return (
        <div className="w-full max-w-[1200px] mx-auto pb-24 px-4 md:px-6">
            <div className="py-8 border-b border-gray-100 mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 font-oswald uppercase flex items-center gap-2">Revisão de Conteúdo</h2>
                    <p className="text-sm text-gray-500">Revise, edite e aprove as questões geradas antes de salvar.</p>
                </div>
                <div className="text-sm font-bold bg-purple-50 text-purple-700 px-4 py-2 rounded-lg border border-purple-100">
                    Restantes: {generatedQuestions.length}
                </div>
            </div>

            <div className="space-y-12">
                {generatedQuestions.map((q, idx) => (
                    <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Questão Gerada #{idx + 1}</span>
                            <div className="flex gap-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-white border rounded text-gray-600">{config.dificuldade}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-white border rounded text-gray-600">{config.nivelCognitivo}</span>
                            </div>
                        </div>
                        
                        <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-4">
                                <label className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1"><Edit3 size={12}/> Enunciado</label>
                                <textarea 
                                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-200 focus:bg-white rounded-xl text-gray-800 leading-relaxed outline-none transition min-h-[150px] resize-none"
                                    value={q.enunciado}
                                    onChange={e => handleUpdateQuestion(idx, 'enunciado', e.target.value)}
                                />
                                {q.comentario && (
                                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                                        <strong>Nota da IA:</strong> {q.comentario}
                                    </div>
                                )}
                            </div>

                            <div className="lg:col-span-1 space-y-3">
                                <label className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1"><Edit3 size={12}/> Alternativas</label>
                                {['a','b','c','d','e'].map(letra => {
                                    const key = `alternativa${letra.toUpperCase()}`;
                                    const isCorrect = q.alternativaCorreta.toLowerCase() === letra;
                                    return (
                                        <div key={letra} className={`flex items-start gap-2 p-2 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                                            <button 
                                                onClick={() => handleUpdateQuestion(idx, 'alternativaCorreta', letra)}
                                                className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition ${isCorrect ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                            >
                                                {letra.toUpperCase()}
                                            </button>
                                            <input 
                                                type="text"
                                                className="w-full bg-transparent outline-none text-sm text-gray-700"
                                                value={q[key]}
                                                onChange={e => handleUpdateQuestion(idx, key, e.target.value)}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                            <button onClick={() => handleDiscard(idx)} className="px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 text-sm font-bold flex items-center gap-2 transition">
                                <Trash2 size={16} /> Descartar
                            </button>
                            <button onClick={() => handleSaveQuestion(idx)} disabled={savingIndex === idx} className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-70">
                                {savingIndex === idx ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Save size={16} />}
                                Aprovar & Salvar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  }

  return null;
}

// Componente Select Reutilizável
interface SelectFieldProps { label: string; value: string | number; onChange: (v: string) => void; options: any[]; disabled?: boolean; getLabel: (i: any) => string; }
function SelectField({ label, value, onChange, options, disabled, getLabel }: SelectFieldProps) {
    const truncate = (str: string, max: number) => {
        return str.length > max ? str.substring(0, max) + '...' : str;
    };

    return (
        <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block truncate">{label}</label>
            <div className="relative">
                <select 
                    className="w-full p-2.5 pr-8 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition disabled:opacity-50 appearance-none truncate" 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    disabled={disabled}
                    title={options?.find(o => o.id == value) ? getLabel(options.find(o => o.id == value)) : ''}
                >
                    <option value="">Selecione...</option>
                    {options?.map((opt: any) => {
                        const fullLabel = getLabel(opt);
                        return <option key={opt.id} value={opt.id}>{truncate(fullLabel, 70)}</option>;
                    })}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ChevronRight className="rotate-90" size={16} /></div>
            </div>
        </div>
    );
}