'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, CheckCircle, BookOpen, Layers, 
  BrainCircuit, Image as ImageIcon, ChevronRight, AlertCircle, Target,
} from 'lucide-react';
import { ImageUploader } from '@/components/upload/ImageUploader';
import { toast } from 'sonner';

// --- DADOS ESTÁTICOS & TYPES ---
const BLOOM_TIPS: Record<string, string> = {
  LEMBRAR: 'Citar, Definir, Indicar, Listar...',
  ENTENDER: 'Explicar, Parafrasear, Resumir...',
  APLICAR: 'Calcular, Demonstrar, Usar, Resolver...',
  ANALISAR: 'Diferenciar, Distinguir, Testar...',
  AVALIAR: 'Julgar, Criticar, Justificar...',
  CRIAR: 'Planejar, Compor, Construir...'
};

interface ImagemData {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export default function NovaQuestaoPage() {
  const router = useRouter();
  
  // Estados
  const [options, setOptions] = useState<any>({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [createdQuestao, setCreatedQuestao] = useState<any>(null);

  // Estado Inicial do Formulário
  const initialFormState = {
    // Origem
    categoriaOrigem: 'INSTITUCIONAL_INTERNA',
    instituicaoId: '',
    ano: new Date().getFullYear().toString(),
    bancaId: '',
    prova: '',
    
    // Currículo
    cursoTecnicoId: '',
    unidadeCurricularId: '',
    objetoConhecimentoId: '',
    subConhecimentoId: '',
    
    // Competências
    funcaoId: '',
    subfuncaoId: '',
    capacidadeId: '',
    
    // Classificação
    dificuldade: 'MEDIO',
    nivelCognitivo: 'APLICAR',
    
    // Conteúdo
    enunciado: '',
    imagem: null as ImagemData | null,
    alternativaA: '',
    alternativaB: '',
    alternativaC: '',
    alternativaD: '',
    alternativaE: '',
    alternativaCorreta: 'a'
  };

  const [form, setForm] = useState(initialFormState);

  // 🛡️ 1. BLINDAGEM: Carregar Opções com Verificação de Auth
  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch('/api/admin/options');
        
        // Se a API retornar erro de auth, expulsa o usuário
        if (res.status === 401 || res.status === 403) {
            router.push('/auth/login');
            return;
        }

        if (res.ok) {
            const data = await res.json();
            setOptions(data);
        } else {
            toast.error("Erro ao carregar opções.");
        }
      } catch (e) {
        console.error("Erro de conexão:", e);
        toast.error("Erro de conexão.");
      }
    }
    loadOptions();
  }, [router]);

  // --- LÓGICA DE FILTROS (CASCATA CORRIGIDA) ---
  const ucsFiltradas = options.ucs?.filter((uc: any) => 
    !form.cursoTecnicoId || uc.cursoTecnicoId === Number(form.cursoTecnicoId)
  );

  const objetosFiltrados = options.objetos?.filter((obj: any) => 
    !form.unidadeCurricularId || 
    (obj.ucsIds && obj.ucsIds.includes(Number(form.unidadeCurricularId)))
  );

  const subConhecimentosFiltrados = options.subconhecimentos?.filter((sub: any) =>
    !form.objetoConhecimentoId || sub.conhecimentoId === Number(form.objetoConhecimentoId)
  );

  const funcoesFiltradas = options.funcoes?.filter((f: any) => 
    !form.cursoTecnicoId || 
    (f.cursosIds && f.cursosIds.includes(Number(form.cursoTecnicoId)))
  );

  const subfuncoesFiltradas = options.subfuncoes?.filter((sub: any) => 
    !form.funcaoId || sub.funcaoId === Number(form.funcaoId)
  );
  
  const capacidadesFiltradas = options.capacidades?.filter((cap: any) =>
     !form.subfuncaoId || 
     (cap.subfuncoesIds && cap.subfuncoesIds.includes(Number(form.subfuncaoId)))
  );

  const handleChange = (field: string, value: any) => {
    setForm(prev => {
      const updates: any = { [field]: value };
      
      if (field === 'cursoTecnicoId') { updates.unidadeCurricularId = ''; updates.objetoConhecimentoId = ''; updates.subConhecimentoId = ''; }
      if (field === 'unidadeCurricularId') { updates.objetoConhecimentoId = ''; updates.subConhecimentoId = ''; }
      if (field === 'objetoConhecimentoId') { updates.subConhecimentoId = ''; }
      
      if (field === 'funcaoId') { updates.subfuncaoId = ''; updates.capacidadeId = ''; }
      if (field === 'subfuncaoId') { updates.capacidadeId = ''; }
      
      return { ...prev, ...updates };
    });
  };

  const handleAutoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    handleChange(e.target.name, e.target.value);
  };

  const getLabel = (item: any, tipo: 'curso' | 'uc' | 'objeto' | 'funcao' | 'cap' | 'inst' | 'banca') => {
    if (!item) return '';
    switch (tipo) {
      case 'curso': return item.nome;
      case 'uc': return `${item.codigo} - ${item.nome}`;
      case 'objeto': return `${item.codigo} - ${item.nome}`;
      case 'funcao': return `${item.codigo} - ${item.nome}`;
      case 'cap': return `${item.sigla} - ${item.descricao}`;
      case 'inst': return item.sigla ? `${item.sigla} - ${item.nome}` : item.nome;
      case 'banca': return item.sigla ? `${item.sigla} - ${item.nome}` : item.nome;
      default: return item.nome;
    }
  };

  const getNomeById = (lista: any[], id: any, tipo: any = 'curso') => {
    const item = lista?.find(i => i.id == id);
    return item ? getLabel(item, tipo) : 'Não selecionado';
  };

  const canAdvance = 
    form.cursoTecnicoId && form.unidadeCurricularId && 
    form.funcaoId && form.subfuncaoId && 
    form.objetoConhecimentoId && form.capacidadeId;

  // --- ENVIO DO FORMULÁRIO ---
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 🛡️ PASSO 1: Obter Token CSRF
      const csrfRes = await fetch('/api/csrf');
      if (!csrfRes.ok) throw new Error("Sessão expirada. Faça login novamente.");
      
      const { token } = await csrfRes.json();
      if (!token) throw new Error("Falha na autenticação de segurança.");

      const payload = {
        ...form,
        imagens: form.imagem ? [form.imagem] : [] 
      };

      // 🛡️ PASSO 2: Enviar com header x-csrf-token
      const res = await fetch('/api/admin/questoes', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': token 
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        setCreatedQuestao(data);
        setShowPreview(false);
        setStep(3);
        toast.success("Questão salva com sucesso!");
      } else {
        if (res.status === 401 || res.status === 403) {
            router.push('/auth/login');
            throw new Error("Sessão expirada.");
        }
        throw new Error(data.error || 'Erro ao salvar');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ 
      ...initialFormState, 
      cursoTecnicoId: form.cursoTecnicoId, 
      unidadeCurricularId: form.unidadeCurricularId, 
      funcaoId: form.funcaoId, 
      subfuncaoId: form.subfuncaoId, 
      capacidadeId: form.capacidadeId, 
      objetoConhecimentoId: form.objetoConhecimentoId,
      // Mantém origem para facilitar cadastro em massa da mesma prova
      categoriaOrigem: form.categoriaOrigem,
      instituicaoId: form.instituicaoId,
      ano: form.ano,
      bancaId: form.bancaId,
      prova: form.prova
    });
    setCreatedQuestao(null);
    setStep(2);
  };

  return (
    <div className="w-full max-w-[96%] xl:max-w-[1600px] mx-auto pb-24 px-4 sm:px-6">
      
      {step !== 3 && (
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 transition text-gray-500">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Nova Questão</h1>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Adicionar ao Banco de Dados</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm font-medium">
             <span className={step === 1 ? "text-blue-600" : "text-gray-400"}>1. Classificação</span>
             <ChevronRight size={14} className="text-gray-300" />
             <span className={step === 2 ? "text-blue-600" : "text-gray-400"}>2. Conteúdo</span>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
          
          {/* SEÇÃO 1: ORIGEM */}
          <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
                <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Target size={20} /></div>
                <h2 className="text-lg font-bold text-gray-800">Origem & Contexto</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Categoria</label>
                <div className="relative">
                  <select 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition appearance-none"
                    value={form.categoriaOrigem}
                    onChange={(e) => handleChange('categoriaOrigem', e.target.value)}
                  >
                    <option value="INSTITUCIONAL_INTERNA">Institucional (Interna)</option>
                    <option value="CONCURSO_PUBLICO">Concurso Público</option>
                    <option value="CONCURSO_MILITAR">Concurso Militar</option>
                    <option value="VESTIBULAR">Vestibular</option>
                    <option value="CERTIFICACAO">Certificação</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ChevronRight className="rotate-90" size={16} /></div>
                </div>
              </div>

              <SelectField 
                label="Instituição / Órgão" 
                value={form.instituicaoId} 
                onChange={(v) => handleChange('instituicaoId', v)} 
                options={options.instituicoes || []} 
                getLabel={(i: any) => getLabel(i, 'inst')} 
              />

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Ano</label>
                <input 
                  type="text"
                  inputMode="numeric"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition"
                  placeholder="Ex: 2024"
                  value={form.ano}
                  onChange={(e) => handleChange('ano', e.target.value)}
                />
              </div>

              <SelectField 
                label="Banca Examinadora" 
                value={form.bancaId} 
                onChange={(v) => handleChange('bancaId', v)} 
                options={options.bancas || []} 
                getLabel={(i: any) => getLabel(i, 'banca')} 
              />

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Prova / Cargo (Opcional)</label>
                <input 
                  type="text"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition"
                  placeholder="Ex: Técnico de Manutenção Júnior - Elétrica"
                  value={form.prova}
                  onChange={(e) => handleChange('prova', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* SEÇÃO 2: CURRÍCULO */}
          <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><BookOpen size={20} /></div>
                <h2 className="text-lg font-bold text-gray-800">Estrutura Curricular</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SelectField label="Curso Técnico" value={form.cursoTecnicoId} onChange={(v) => handleChange('cursoTecnicoId', v)} options={options.cursos} getLabel={(i: any) => `${i.codigo} - ${i.nome}`} />
              <SelectField label="Unidade Curricular" value={form.unidadeCurricularId} onChange={(v) => handleChange('unidadeCurricularId', v)} options={ucsFiltradas} disabled={!form.cursoTecnicoId} getLabel={(i) => getLabel(i, 'uc')} />
              <div className="md:col-span-2 space-y-3">
                 <SelectField label="Objeto de Conhecimento" value={form.objetoConhecimentoId} onChange={(v) => handleChange('objetoConhecimentoId', v)} options={objetosFiltrados} disabled={!form.unidadeCurricularId} getLabel={(i) => getLabel(i, 'objeto')} />

                 {form.objetoConhecimentoId && (
                     <div className="animate-in fade-in slide-in-from-top-1">
                        <SelectField 
                            label="Detalhamento (Sub-conhecimento)" 
                            value={form.subConhecimentoId} 
                            onChange={(v) => handleChange('subConhecimentoId', v)} 
                            options={subConhecimentosFiltrados} 
                            disabled={!form.objetoConhecimentoId} 
                            getLabel={(i) => getLabel(i, 'objeto')} 
                        />
                     </div>
                 )}
              </div>
            </div>
          </section>

          {/* SEÇÃO 3: COMPETÊNCIAS */}
          <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
                <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><Layers size={20} /></div>
                <h2 className="text-lg font-bold text-gray-800">Eixo Tecnológico</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectField label="Função" value={form.funcaoId} onChange={(v) => handleChange('funcaoId', v)} options={funcoesFiltradas} getLabel={(i) => getLabel(i, 'funcao')} />
                <SelectField label="Subfunção" value={form.subfuncaoId} onChange={(v) => handleChange('subfuncaoId', v)} options={subfuncoesFiltradas} disabled={!form.funcaoId} getLabel={(i) => getLabel(i, 'funcao')} />
                <div className="md:col-span-2">
                    <SelectField label="Capacidade Técnica" value={form.capacidadeId} onChange={(v) => handleChange('capacidadeId', v)} options={capacidadesFiltradas} disabled={!form.subfuncaoId} getLabel={(i) => getLabel(i, 'cap')} />
                </div>
            </div>
          </section>

          {/* SEÇÃO 4: CLASSIFICAÇÃO */}
          <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-purple-200 border-l-4 border-l-purple-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-purple-900"><BrainCircuit size={120} /></div>
            <div className="relative z-10 space-y-6">
               <div className="flex items-center gap-3 bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 shadow-sm">
                  <div className="bg-red-100 p-2 rounded-full shrink-0"><AlertCircle size={20} className="text-red-600" /></div>
                  <div><h4 className="font-bold text-sm">Atenção Pedagógica</h4><p className="text-xs text-red-600/80 mt-0.5">Verifique se a dificuldade e o nível Bloom condizem com a questão.</p></div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Nível Cognitivo (Bloom)</label>
                      <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition text-gray-800" value={form.nivelCognitivo} onChange={e => handleChange('nivelCognitivo', e.target.value)}>
                        {Object.keys(BLOOM_TIPS).map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <p className="text-xs text-purple-700 mt-2 font-medium bg-purple-50 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-purple-100">💡 Dica: {BLOOM_TIPS[form.nivelCognitivo]}</p>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Dificuldade</label>
                      <div className="grid grid-cols-5 gap-2">
                        {['MUITO_FACIL', 'FACIL', 'MEDIO', 'DIFICIL', 'MUITO_DIFICIL'].map((dif) => {
                          const config: any = { 'MUITO_FACIL': { l: 'M. Fácil', c: 'green' }, 'FACIL': { l: 'Fácil', c: 'teal' }, 'MEDIO': { l: 'Médio', c: 'yellow' }, 'DIFICIL': { l: 'Difícil', c: 'orange' }, 'MUITO_DIFICIL': { l: 'M. Dif', c: 'red' } };
                          const active = form.dificuldade === dif;
                          const activeClasses = { 'green': 'bg-green-100 border-green-500 text-green-800 ring-1 ring-green-500', 'teal': 'bg-teal-100 border-teal-500 text-teal-800 ring-1 ring-teal-500', 'yellow': 'bg-yellow-100 border-yellow-500 text-yellow-800 ring-1 ring-yellow-500', 'orange': 'bg-orange-100 border-orange-500 text-orange-800 ring-1 ring-orange-500', 'red': 'bg-red-100 border-red-500 text-red-800 ring-1 ring-red-500' }[config[dif].c as string];
                          return (
                            <button key={dif} onClick={() => handleChange('dificuldade', dif)} className={`flex flex-col items-center justify-center p-2 rounded-lg border text-[10px] font-bold uppercase transition-all ${active ? activeClasses : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>{config[dif].l}</button>
                          )
                        })}
                      </div>
                  </div>
               </div>
            </div>
          </section>

          <div className="flex justify-end pt-4">
            <button onClick={() => setStep(2)} disabled={!canAdvance} className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center gap-2">
              Continuar <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-in slide-in-from-right-10 duration-300 grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <label className="text-sm font-bold text-gray-700 mb-3 block">Enunciado da Questão</label>
                    <textarea 
                        name="enunciado"
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition min-h-[200px] resize-none overflow-hidden" 
                        placeholder="Digite o enunciado completo aqui..." 
                        value={form.enunciado} 
                        onChange={handleAutoResize}
                    />
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                        <ImageIcon size={18} className="text-gray-500" />
                        <label className="text-sm font-bold text-gray-700">Imagem de Apoio (Opcional)</label>
                    </div>
                    <ImageUploader 
                        currentImageUrl={form.imagem?.url}
                        onUploadComplete={(data) => handleChange('imagem', data)}
                        onRemove={() => handleChange('imagem', null)}
                    />
                </div>
           </div>

           <div className="lg:col-span-1 space-y-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
                    <label className="text-sm font-bold text-gray-700 mb-4 flex items-center justify-between">
                        <span>Alternativas</span>
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase font-bold">Marque a correta</span>
                    </label>
                    
                    <div className="space-y-3 flex-1">
                        {['A', 'B', 'C', 'D', 'E'].map((letra) => {
                            const isCorreta = form.alternativaCorreta === letra.toLowerCase();
                            return (
                                <div 
                                    key={letra} 
                                    className={`group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 ${
                                        isCorreta 
                                        ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-200 shadow-sm' 
                                        : 'bg-white border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="pt-1 flex flex-col items-center gap-1">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                                            isCorreta ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                                        }`}>
                                            {letra}
                                        </div>
                                        <input 
                                            type="radio" 
                                            name="correta" 
                                            checked={isCorreta}
                                            onChange={() => handleChange('alternativaCorreta', letra.toLowerCase())} 
                                            className="mt-1 cursor-pointer accent-blue-600"
                                            title="Marcar como correta"
                                        />
                                    </div>

                                    <textarea 
                                        name={`alternativa${letra}`}
                                        rows={1}
                                        className="flex-1 bg-transparent border-none p-1.5 text-sm focus:ring-0 resize-none text-gray-800 placeholder-gray-400 leading-relaxed overflow-hidden" 
                                        placeholder={`Digite a alternativa ${letra}...`} 
                                        value={(form as any)[`alternativa${letra}`]} 
                                        onChange={handleAutoResize}
                                        style={{ minHeight: '40px' }}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-3">
                        <button 
                            onClick={() => setShowPreview(true)} 
                            disabled={form.enunciado.length < 5} 
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
                        >
                            Visualizar Questão
                        </button>
                        <button onClick={() => setStep(1)} className="w-full py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition text-sm">
                            Voltar
                        </button>
                    </div>
                </div>
           </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
               <h3 className="text-xl font-bold text-gray-800">Revisão Final</h3>
               <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-red-500 transition"><ChevronRight className="rotate-90" /></button>
            </div>
            <div className="p-8 space-y-8">
               <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs text-gray-500 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><span className="block font-bold text-gray-700">UC</span> {getNomeById(options.ucs, form.unidadeCurricularId, 'uc')}</div>
                  <div><span className="block font-bold text-gray-700">Origem</span> {form.categoriaOrigem.replace('_', ' ')}</div>
                  <div><span className="block font-bold text-gray-700">Bloom</span> {form.nivelCognitivo}</div>
                  <div><span className="block font-bold text-gray-700">Dificuldade</span> {form.dificuldade}</div>
               </div>
               
               <div className="space-y-4">
                  <div className="prose prose-blue max-w-none text-gray-800 whitespace-pre-wrap font-medium">{form.enunciado}</div>
                  {form.imagem && (
                    <div className="relative h-64 w-full md:w-2/3 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        <Image src={form.imagem.url} alt="Imagem da Questão" fill className="object-contain" unoptimized />
                    </div>
                  )}
               </div>
               <div className="space-y-2">
                 {['A','B','C','D','E'].map(letra => {
                   const isCorreta = form.alternativaCorreta === letra.toLowerCase();
                   return (
                     <div key={letra} className={`p-4 rounded-lg border flex gap-4 items-start ${isCorreta ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isCorreta ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{letra}</div>
                        <div className="text-sm text-gray-700 break-words w-full">{(form as any)[`alternativa${letra}`]}</div>
                     </div>
                   )
                 })}
               </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 sticky bottom-0 z-10">
               <button onClick={() => setShowPreview(false)} className="px-6 py-2 rounded-lg font-bold text-gray-600 hover:bg-gray-200 transition text-sm">Corrigir</button>
               <button onClick={handleSubmit} disabled={loading} className="px-8 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-lg flex items-center gap-2 transition text-sm disabled:opacity-70">{loading ? 'Salvando...' : 'Confirmar Cadastro'}</button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && createdQuestao && (
        <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in-95">
           <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-sm"><CheckCircle size={40} /></div>
           <h2 className="text-2xl font-bold text-gray-900">Questão Criada!</h2>
           <p className="text-gray-500 mb-8 mt-2">A questão #{createdQuestao.id} já está disponível no banco de dados.</p>
           <div className="flex gap-4">
              <button onClick={handleReset} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-black shadow-md text-sm">Criar Outra</button>
              <Link href="/admin/questoes" className="bg-white border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-bold hover:bg-gray-50 transition text-sm">Voltar para Lista</Link>
           </div>
        </div>
      )}
    </div>
  );
}

// Sub-componente Select (Reutilizável)
interface SelectFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: any[];
  disabled?: boolean;
  getLabel: (item: any) => string;
}

function SelectField({ label, value, onChange, options, disabled, getLabel }: SelectFieldProps) {
    const truncate = (str: string, max: number) => {
        return str.length > max ? str.substring(0, max) + '...' : str;
    };

    return (
        <div className="w-full">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block truncate">
                {label}
            </label>
            <div className="relative w-full">
                <select 
                    className="w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed appearance-none truncate" 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    disabled={disabled}
                    title={options?.find(o => o.id == value) ? getLabel(options.find(o => o.id == value)) : ''}
                >
                    <option value="">Selecione...</option>
                    {options?.map((opt: any) => {
                        const fullLabel = getLabel(opt);
                        return (
                            <option key={opt.id} value={opt.id}>
                                {truncate(fullLabel, 90)}
                            </option>
                        );
                    })}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 bg-gray-50 pl-2">
                    <ChevronRight size={16} className="rotate-90" />
                </div>
            </div>
        </div>
    );
}