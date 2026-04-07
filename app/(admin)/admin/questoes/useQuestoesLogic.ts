import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Interface para Tipagem Segura dos Filtros
export interface QuestaoFilters {
  busca: string;
  cursoId: string;
  ucId: string;
  objetoId: string;
  subConhecimentoId: string;
  funcaoId: string;
  subfuncaoId: string;
  capacidadeId: string;
  instituicaoId: string;
  bancaId: string;
  ano: string;
  dificuldade: string;
}

export function useQuestoesLogic() {
  const router = useRouter();
  
  // --- ESTADOS DE DADOS ---
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [options, setOptions] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // --- UI STATE ---
  const [showFilters, setShowFilters] = useState(false); // Painel de Filtros
  const [showMenu, setShowMenu] = useState(false);       // Dropdown "Nova Questão"

  // --- REF PARA AÇÕES (DELETE) ---
  const actionData = useRef<any>(null);

  // --- PAGINAÇÃO E FILTROS ---
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [statusFilter, setStatusFilter] = useState<'ativas' | 'inativas' | 'todas'>('ativas');
  
  // Estado Centralizado de Filtros
  const [filters, setFilters] = useState<QuestaoFilters>({
    busca: '',
    cursoId: '',
    ucId: '',
    objetoId: '',
    subConhecimentoId: '',
    funcaoId: '',
    subfuncaoId: '',
    capacidadeId: '',
    instituicaoId: '',
    bancaId: '',
    ano: '',
    dificuldade: ''
  });

  // --- MODAL FEEDBACK ---
  const [modal, setModal] = useState({
    isOpen: false,
    type: 'CONFIRM' as 'CONFIRM' | 'LOADING' | 'SUCCESS' | 'ERROR',
    title: '',
    message: '',
    action: null as (() => void) | null,
  });

// 1. FILTROS INTELIGENTES (Baseado nas questões existentes, reage a mudanças de filtro)
useEffect(() => {
  let mounted = true;
  async function fetchSmartFilters() {
    try {
      const params = new URLSearchParams();
      if (filters.cursoId) params.set("cursoId", filters.cursoId);
      if (filters.ucId) params.set("unidadeId", filters.ucId);
      if (filters.funcaoId) params.set("funcaoId", filters.funcaoId);
      if (filters.subfuncaoId) params.set("subfuncaoId", filters.subfuncaoId);

      const res = await fetch(`/api/questoes/filtros-inteligentes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (mounted) setOptions(data);
      }
    } catch (e) { console.error("Erro ao carregar filtros inteligentes", e); }
  }
  fetchSmartFilters();
  return () => { mounted = false; };
}, [filters.cursoId, filters.ucId, filters.funcaoId, filters.subfuncaoId]);

  // 2. FETCH QUESTÕES (Com Debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
        fetchQuestoes();
    }, 300); // Aguarda 300ms após parar de digitar/filtrar
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, statusFilter, filters]);

  const fetchQuestoes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Mapeamento automático dos filtros para URL params
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      params.append('status', statusFilter);
      params.append('page', pagination.page.toString());

      const res = await fetch(`/api/admin/questoes?${params.toString()}`);

      if (!res.ok) {
        if (res.status === 401) router.push('/login');
        throw new Error("Erro API");
      }

      const responseData = await res.json();
      
      // Normalização da resposta (suporta array direto ou objeto paginado)
      let lista = [];
      if (responseData.data) {
          lista = responseData.data;
          setPagination(prev => ({
              ...prev,
              page: responseData.meta?.page || prev.page, // Mantém sync com backend
              totalItems: responseData.meta?.total || 0 // Tenta pegar total se existir
          }));
      } else if (Array.isArray(responseData)) {
          lista = responseData;
      }

      setQuestoes(lista);

    } catch (error) {
      console.error(error);
      setQuestoes([]);
    } finally {
      setLoading(false);
    }
  };

  // --- GERENCIAMENTO INTELIGENTE DE FILTROS (CASCATA) ---
  const handleFilterChange = (field: keyof QuestaoFilters, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value };

      // Regra 1: Mudou Curso -> Limpa UC, Objeto e SubConhecimento
      if (field === 'cursoId') {
        newFilters.ucId = '';
        newFilters.objetoId = '';
        newFilters.subConhecimentoId = '';
      }

      // Regra 2: Mudou UC -> Limpa Objeto e SubConhecimento
      if (field === 'ucId') {
        newFilters.objetoId = '';
        newFilters.subConhecimentoId = '';
      }

      // Regra 3: Mudou Objeto -> Limpa SubConhecimento
      if (field === 'objetoId') {
        newFilters.subConhecimentoId = '';
      }

      // Regra 4: Mudou Função -> Limpa Subfunção
      if (field === 'funcaoId') {
        newFilters.subfuncaoId = '';
      }

      // Ao filtrar, sempre volta para a página 1
      setPagination(p => ({ ...p, page: 1 }));
      
      return newFilters;
    });
  };

  const clearFilters = () => {
    setFilters({
      busca: '',
      cursoId: '',
      ucId: '',
      objetoId: '',
      subConhecimentoId: '',
      funcaoId: '',
      subfuncaoId: '',
      capacidadeId: '',
      instituicaoId: '',
      bancaId: '',
      ano: '',
      dificuldade: ''
    });
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handlePageChange = (p: number) => { 
      if (p >= 1) setPagination(prev => ({ ...prev, page: p })); 
  };

  // --- AÇÃO DE EXCLUSÃO (Blindada com CSRF) ---
  const handleDeleteClick = (questao: any) => {
    actionData.current = questao;
    setModal({
        isOpen: true,
        type: 'CONFIRM',
        title: 'Excluir Questão?',
        message: `Tem certeza que deseja remover a questão #${questao.id}?`,
        action: confirmDelete
    });
  };

  const confirmDelete = async () => {
    const item = actionData.current;
    if (!item) return;

    setModal(prev => ({ ...prev, type: 'LOADING', title: 'Excluindo...', message: '' }));

    try {
      // 🛡️ Segurança: Busca Token CSRF
      const csrfRes = await fetch('/api/csrf');
      const { token } = await csrfRes.json();
      if (!token) throw new Error("Token de segurança ausente.");

      const res = await fetch(`/api/admin/questoes/${item.id}`, { 
        method: 'DELETE',
        headers: {
            'x-csrf-token': token 
        }
      });

      if (res.ok) {
        setModal(prev => ({ 
            ...prev, 
            type: 'SUCCESS', 
            title: 'Sucesso!', 
            message: 'Questão removida.',
            action: null 
        }));
        fetchQuestoes(); // Recarrega a lista
        setTimeout(() => setModal(prev => ({ ...prev, isOpen: false })), 1500);
      } else {
        const err = await res.json().catch(() => ({}));
        setModal(prev => ({ 
            ...prev, 
            type: 'ERROR', 
            title: 'Erro', 
            message: err.error || "Não foi possível excluir." 
        }));
      }
    } catch (e) {
      setModal(prev => ({ ...prev, type: 'ERROR', title: 'Erro', message: 'Falha de conexão.' }));
    }
  };

  return {
    router,
    questoes,
    options,
    loading,
    pagination,
    statusFilter,
    setStatusFilter,
    filters,
    
    // UI States
    showFilters,     
    setShowFilters,
    showMenu,        
    setShowMenu,     
    
    handleFilterChange, 
    clearFilters,       
    handlePageChange,
    handleDeleteClick,
    modal,
    setModal
  };
}