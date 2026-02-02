'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { 
  ArrowLeft, BookOpen, Layers, BrainCircuit, Image as ImageIcon, 
  ChevronRight, Save, Trash2, Power, Target, AlertCircle
} from 'lucide-react';
import { ImageUploader } from '@/components/upload/ImageUploader';
import { ActionModal } from '../ActionModal';
import { toast } from 'sonner';

// --- DADOS ESTÁTICOS ---
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

export default function EditarQuestaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id; 
  
  // Estados de Dados
  const [options, setOptions] = useState<any>({});
  const [loadingData, setLoadingData] = useState(true);
  
  // Estado do Modal de Ação
  const [modal, setModal] = useState({
    isOpen: false,
    type: 'CONFIRM' as 'CONFIRM' | 'LOADING' | 'SUCCESS' | 'ERROR',
    title: '',
    message: '',
    action: null as (() => void) | null
  });

  // Estado do Formulário
  const [form, setForm] = useState({
    id: '',
    updatedAt: '',
    ativa: true,
    
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
    
    // Origem
    categoriaOrigem: 'INSTITUCIONAL_INTERNA',
    instituicaoId: '',
    bancaId: '',
    ano: new Date().getFullYear(),
    prova: '',
    
    // Conteúdo
    enunciado: '',
    imagem: null as ImagemData | null,
    alternativaA: '',
    alternativaB: '',
    alternativaC: '',
    alternativaD: '',
    alternativaE: '',
    alternativaCorreta: 'a'
  });

  // 🛡️ 1. BLINDAGEM: Validação de Sessão Inicial
  useEffect(() => {
    fetch('/api/csrf')
      .then(res => {
        if (!res.ok) {
           router.push('/auth/login');
        }
      })
      .catch(() => {});
  }, [router]);

  // --- CARGA INICIAL ---
  useEffect(() => {
    async function init() {
      try {
        const [resOpts, resQuestao] = await Promise.all([
            fetch('/api/admin/options'),
            fetch(`/api/admin/questoes/${id}`)
        ]);

        // 🛡️ Se API retornar 401/403, expulsa
        if (resQuestao.status === 401 || resQuestao.status === 403 || resOpts.status === 401) {
            router.push('/auth/login');
            return;
        }

        if (!resQuestao.ok) throw new Error("Questão não encontrada");

        const dataOpts = await resOpts.json();
        const questao = await resQuestao.json();

        setOptions(dataOpts);
        
        // Popula o formulário com dados existentes
        setForm({
            id: questao.id,
            updatedAt: questao.updatedAt,
            ativa: questao.ativa,
            
            cursoTecnicoId: questao.cursoTecnicoId || '',
            unidadeCurricularId: questao.unidadeCurricularId || '',
            objetoConhecimentoId: questao.conhecimentoId || questao.objetoConhecimentoId || '', 
            subConhecimentoId: questao.subConhecimentoId || '', 
            
            funcaoId: questao.funcaoId || '',
            subfuncaoId: questao.subfuncaoId || '',
            capacidadeId: questao.capacidadeId || '',
            
            dificuldade: questao.dificuldade,
            nivelCognitivo: questao.nivelCognitivo,
            
            enunciado: questao.enunciado,
            categoriaOrigem: questao.categoriaOrigem || 'INSTITUCIONAL_INTERNA',
            instituicaoId: questao.instituicaoId || '',
            bancaId: questao.bancaId || '',
            ano: questao.ano || '',
            prova: questao.prova || '',
            
            imagem: questao.imagens?.[0] || null,
            alternativaA: questao.alternativaA,
            alternativaB: questao.alternativaB,
            alternativaC: questao.alternativaC,
            alternativaD: questao.alternativaD,
            alternativaE: questao.alternativaE,
            alternativaCorreta: questao.alternativaCorreta
        });
      } catch (e) {
        setModal({ 
            isOpen: true, type: 'ERROR', title: 'Erro', 
            message: 'Não foi possível carregar os dados.', action: () => router.push('/admin/questoes') 
        });
      } finally {
        setLoadingData(false);
      }
    }
    if (id) init();
  }, [id, router]);

  // --- LÓGICA DE FILTROS ---
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

  // --- AÇÕES COM MODAL INTELIGENTE ---

  const requestSave = () => {
    setModal({
        isOpen: true,
        type: 'CONFIRM',
        title: 'Salvar Alterações?',
        message: 'Você está prestes a atualizar os dados desta questão.',
        action: executeSave
    });
  };

  const executeSave = async () => {
    setModal(prev => ({ ...prev, type: 'LOADING', title: 'Salvando...', message: '' }));
    try {
      const csrfRes = await fetch('/api/csrf');
      const { token } = await csrfRes.json();
      if (!token) throw new Error("Token de segurança não obtido.");

      const res = await fetch(`/api/admin/questoes/${form.id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': token 
        },
        body: JSON.stringify(form)
      });
      
      if (!res.ok) {
          if (res.status === 401) {
             router.push('/auth/login');
             throw new Error("Sessão expirada.");
          }
          const errorData = await res.json();
          throw new Error(errorData.error || 'Erro desconhecido');
      }
      
      setModal(prev => ({ 
          ...prev, 
          type: 'SUCCESS', 
          title: 'Salvo com Sucesso!', 
          message: 'As alterações foram registradas. Clique em fechar para voltar.' 
      }));
    } catch (e: any) {
      setModal(prev => ({ ...prev, type: 'ERROR', title: 'Erro ao Salvar', message: e.message || 'Verifique sua conexão e tente novamente.' }));
    }
  };

  const requestDelete = () => {
    setModal({
        isOpen: true,
        type: 'CONFIRM',
        title: 'Excluir Questão?',
        message: 'Esta ação removerá a questão permanentemente.',
        action: executeDelete
    });
  };

  const executeDelete = async () => {
    setModal(prev => ({ ...prev, type: 'LOADING', title: 'Excluindo...', message: '' }));
    try {
      const csrfRes = await fetch('/api/csrf');
      const { token } = await csrfRes.json();
      if (!token) throw new Error("Token de segurança não obtido.");

      const res = await fetch(`/api/admin/questoes/${form.id}`, { 
          method: 'DELETE',
          headers: { 'x-csrf-token': token }
      });

      if (!res.ok) {
          const err = await res.json();
          if (res.status === 409) {
             setModal(prev => ({ ...prev, type: 'ERROR', title: 'Não é possível excluir', message: err.error }));
             return;
          }
          throw new Error();
      }
      setModal(prev => ({ ...prev, type: 'SUCCESS', title: 'Questão Excluída', message: 'Redirecionando para a lista...' }));
      setTimeout(() => router.push('/admin/questoes'), 1500);
    } catch (e) {
      setModal(prev => ({ ...prev, type: 'ERROR', title: 'Erro ao Excluir', message: 'Tente novamente mais tarde.' }));
    }
  };

  const requestToggleStatus = () => {
    const novoStatus = !form.ativa;
    setModal({
        isOpen: true,
        type: 'CONFIRM',
        title: novoStatus ? 'Ativar Questão?' : 'Inativar Questão?',
        message: novoStatus 
            ? 'A questão voltará a aparecer nos simulados.' 
            : 'A questão ficará oculta nos simulados.',
        action: executeToggleStatus
    });
  };

  const executeToggleStatus = async () => {
    setModal(prev => ({ ...prev, type: 'LOADING', title: 'Atualizando Status...', message: '' }));
    try {
        const csrfRes = await fetch('/api/csrf');
        const { token } = await csrfRes.json();
        if (!token) throw new Error("Token de segurança não obtido.");

        const novoStatus = !form.ativa;
        const res = await fetch(`/api/admin/questoes/${form.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'x-csrf-token': token 
            },
            body: JSON.stringify({ ativa: novoStatus })
        });
        if (!res.ok) throw new Error();

        setForm(prev => ({ ...prev, ativa: novoStatus }));
        setModal(prev => ({ ...prev, type: 'SUCCESS', title: 'Status Atualizado!', message: `A questão agora está ${novoStatus ? 'ATIVA' : 'INATIVA'}.` }));
        setTimeout(() => setModal(prev => ({ ...prev, isOpen: false })), 1500);
    } catch (e) {
        setModal(prev => ({ ...prev, type: 'ERROR', title: 'Erro', message: 'Não foi possível alterar o status.' }));
    }
  };

  if (loadingData) return <div className="flex h-screen items-center justify-center text-gray-500 animate-pulse">Carregando editor...</div>;

  return (
    <div className="w-full max-w-[96%] xl:max-w-[1600px] mx-auto pb-24 px-4 sm:px-6">
      <ActionModal 
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.action || undefined}
        onCancel={() => {
            setModal(prev => ({ ...prev, isOpen: false }));
            if (modal.type === 'SUCCESS' && modal.title === 'Salvo com Sucesso!') {
                router.push('/admin/questoes');
            }
        }}
      />

      {/* HEADER DE AÇÕES */}
      <div className="flex flex-col md:flex-row justify-between items-center py-6 gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 transition text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                Editar Questão <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-sm border border-blue-100">#{form.id}</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${form.ativa ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    {form.ativa ? 'Disponível no Banco' : 'Arquivada / Inativa'}
                </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto bg-white p-2 rounded-xl shadow-sm border border-gray-100">
            <button 
                onClick={requestToggleStatus}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition border ${
                    form.ativa 
                    ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' 
                    : 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
                }`}
            >
                <Power size={16} />
                {form.ativa ? 'Inativar' : 'Ativar'}
            </button>

            <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${form.ativa ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    {form.ativa ? 'Disponível' : 'Inativa'}
                </p>
                <span className="text-gray-300">|</span>
                <p className="text-xs text-gray-400">
                    Atualizado em: {form.updatedAt ? new Date(form.updatedAt).toLocaleDateString('pt-BR') : '-'}
                </p>
            </div>

            <div className="h-6 w-px bg-gray-200"></div>

            <button onClick={requestDelete} className="text-gray-400 hover:text-red-500 p-2 rounded-lg transition" title="Excluir Definitivamente">
                <Trash2 size={20} />
            </button>
            
            <button onClick={requestSave} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-md shadow-blue-100 flex items-center gap-2 text-sm">
                <Save size={18} />
                Salvar
            </button>
        </div>
      </div>

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* SEÇÃO 1: ORIGEM */}
            <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-orange-100 col-span-1 lg:col-span-2">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
                    <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Target size={20} /></div>
                    <h2 className="text-lg font-bold text-gray-800">Origem & Contexto</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Categoria</label>
                        <select 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-200 outline-none"
                            value={form.categoriaOrigem}
                            onChange={e => handleChange('categoriaOrigem', e.target.value)}
                        >
                            <option value="INSTITUCIONAL_INTERNA">Institucional (Interna)</option>
                            <option value="CONCURSO_PUBLICO">Concurso Público</option>
                            <option value="CONCURSO_MILITAR">Concurso Militar</option>
                            <option value="VESTIBULAR">Vestibular</option>
                            <option value="CERTIFICACAO">Certificação Técnica</option>
                            <option value="OUTRO">Outro</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <SelectField 
                            label="Instituição / Órgão" 
                            value={form.instituicaoId} 
                            onChange={(v) => handleChange('instituicaoId', v)} 
                            options={options.instituicoes} 
                            getLabel={(i) => getLabel(i, 'inst')} 
                        />
                    </div>

                    <div className="md:col-span-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Ano</label>
                        <input 
                            type="number" 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-200 outline-none"
                            placeholder="Ex: 2024"
                            value={form.ano}
                            onChange={e => handleChange('ano', e.target.value)}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <SelectField 
                            label="Banca Examinadora" 
                            value={form.bancaId || ''} 
                            onChange={(v) => handleChange('bancaId', v)} 
                            options={options.bancas || []} 
                            getLabel={(i: any) => getLabel(i, 'banca')} 
                            />
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Prova / Cargo</label>
                        <input 
                            type="text" 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-200 outline-none"
                            placeholder="Ex: Técnico de Manutenção Júnior - Elétrica"
                            value={form.prova}
                            onChange={e => handleChange('prova', e.target.value)}
                        />
                    </div>
                </div>
            </section>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 h-full">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><BookOpen size={20} /></div>
                    <h2 className="text-lg font-bold text-gray-800">Estrutura Curricular</h2>
                </div>
                
                <div className="space-y-4">
                    <SelectField label="Curso Técnico" value={form.cursoTecnicoId} onChange={(v) => handleChange('cursoTecnicoId', v)} options={options.cursos} getLabel={(i) => `${i.codigo} - ${i.nome}`} />
                    <SelectField label="Unidade Curricular" value={form.unidadeCurricularId} onChange={(v) => handleChange('unidadeCurricularId', v)} options={ucsFiltradas} disabled={!form.cursoTecnicoId} getLabel={(i) => `${i.codigo} - ${i.nome}`} />
                    
                    <div className="space-y-3 pt-2">
                        <SelectField label="Objeto de Conhecimento" value={form.objetoConhecimentoId} onChange={(v) => handleChange('objetoConhecimentoId', v)} options={objetosFiltrados} disabled={!form.unidadeCurricularId} getLabel={(i) => `${i.codigo} - ${i.nome}`} />

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

            <div className="space-y-6">
                <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><Layers size={20} /></div>
                        <h2 className="text-lg font-bold text-gray-800">Eixo Tecnológico</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SelectField label="Função" value={form.funcaoId} onChange={(v) => handleChange('funcaoId', v)} options={options.funcoes} getLabel={(i) => `${i.codigo} - ${i.nome}`} />
                            <SelectField label="Subfunção" value={form.subfuncaoId} onChange={(v) => handleChange('subfuncaoId', v)} options={subfuncoesFiltradas} disabled={!form.funcaoId} getLabel={(i) => `${i.codigo} - ${i.nome}`} />
                        </div>
                        <SelectField label="Capacidade Técnica" value={form.capacidadeId} onChange={(v) => handleChange('capacidadeId', v)} options={capacidadesFiltradas} disabled={!form.subfuncaoId} getLabel={(i) => `${i.sigla} - ${i.descricao}`} />
                    </div>
                </section>

                <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-purple-200 border-l-4 border-l-purple-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-purple-900"><BrainCircuit size={120} /></div>
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Bloom</label>
                            <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:ring-2 focus:ring-purple-200 outline-none" value={form.nivelCognitivo} onChange={e => handleChange('nivelCognitivo', e.target.value)}>
                                {Object.keys(BLOOM_TIPS).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Dificuldade</label>
                            <div className="grid grid-cols-5 gap-1">
                                {['MUITO_FACIL', 'FACIL', 'MEDIO', 'DIFICIL', 'MUITO_DIFICIL'].map((dif) => {
                                    const config: any = { 'MUITO_FACIL': 'emerald', 'FACIL': 'teal', 'MEDIO': 'yellow', 'DIFICIL': 'orange', 'MUITO_DIFICIL': 'red' };
                                    const labels: any = { 'MUITO_FACIL': 'M. Fácil', 'FACIL': 'Fácil', 'MEDIO': 'Médio', 'DIFICIL': 'Difícil', 'MUITO_DIFICIL': 'M. Dif' };
                                    const color = config[dif];
                                    const activeClasses: any = {
                                        'emerald': 'bg-emerald-100 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500',
                                        'teal': 'bg-teal-100 border-teal-500 text-teal-800 ring-1 ring-teal-500',
                                        'yellow': 'bg-yellow-100 border-yellow-500 text-yellow-800 ring-1 ring-yellow-500',
                                        'orange': 'bg-orange-100 border-orange-500 text-orange-800 ring-1 ring-orange-500',
                                        'red': 'bg-red-100 border-red-500 text-red-800 ring-1 ring-red-500',
                                    };
                                    return (
                                        <button key={dif} onClick={() => handleChange('dificuldade', dif)} className={`text-[9px] font-bold py-2 rounded border transition-all ${form.dificuldade === dif ? activeClasses[color] : 'bg-white text-gray-400'}`}>{labels[dif]}</button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
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
                          <label className="text-sm font-bold text-gray-700">Imagem de Apoio</label>
                      </div>
                      <ImageUploader 
                            currentImageUrl={form.imagem?.url}
                            onUploadComplete={(data) => handleChange('imagem', data)}
                            onRemove={() => handleChange('imagem', null)}
                            uploadEndpoint="/api/admin/upload/imagem" // ✅ Aponta para a nova rota otimizada
                            maxBytes={5 * 1024 * 1024} // 5MB (limite maior para questões)
                        />
                  </div>
             </div>

             <div className="lg:col-span-1 space-y-4">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
                      <label className="text-sm font-bold text-gray-700 mb-4 flex items-center justify-between">
                          <span>Alternativas</span>
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase font-bold">Correta</span>
                      </label>
                      
                      <div className="space-y-3 flex-1">
                          {['A', 'B', 'C', 'D', 'E'].map((letra) => {
                              const isCorreta = form.alternativaCorreta === letra.toLowerCase();
                              return (
                                  <div key={letra} className={`group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 ${isCorreta ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-200 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                      <div className="pt-1 flex flex-col items-center gap-1">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${isCorreta ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}>{letra}</div>
                                          <input type="radio" name="correta" checked={isCorreta} onChange={() => handleChange('alternativaCorreta', letra.toLowerCase())} className="mt-1 cursor-pointer accent-blue-600" />
                                      </div>
                                      <textarea 
                                          name={`alternativa${letra}`}
                                          rows={1}
                                          className="flex-1 bg-transparent border-none p-1.5 text-sm focus:ring-0 resize-none text-gray-800 placeholder-gray-400 leading-relaxed overflow-hidden" 
                                          placeholder={`Alternativa ${letra}...`} 
                                          value={(form as any)[`alternativa${letra}`]} 
                                          onChange={handleAutoResize}
                                          style={{ minHeight: '40px' }}
                                      />
                                  </div>
                              );
                          })}
                      </div>
                  </div>
             </div>
          </div>
      </div>
    </div>
  );
}

// Sub-componente Select
interface SelectFieldProps { label: string; value: string | number; onChange: (v: string) => void; options: any[]; disabled?: boolean; getLabel: (i: any) => string; }
function SelectField({ label, value, onChange, options, disabled, getLabel }: SelectFieldProps) {
    return (
        <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">{label}</label>
            <div className="relative">
                <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 text-sm focus:ring-2 focus:ring-blue-100 outline-none transition disabled:opacity-50 appearance-none" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
                    <option value="">Selecione...</option>
                    {options?.map((opt: any) => <option key={opt.id} value={opt.id}>{getLabel(opt)}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ChevronRight className="rotate-90" size={16} /></div>
            </div>
        </div>
    );
}