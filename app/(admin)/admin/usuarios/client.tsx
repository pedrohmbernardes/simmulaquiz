'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCsrf } from '@/lib/hooks/use-csrf';
import { 
  Search, Plus, Edit3, Trash2, User, Shield, GraduationCap, 
  ChevronLeft, ChevronRight, Loader2, XCircle
} from 'lucide-react';

export default function AdminUsuariosClient() {
  const router = useRouter();
  const csrfToken = useCsrf();
  
  // --- ESTADOS DE DADOS ---
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- PAGINAÇÃO E FILTROS ---
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // --- ESTADOS DE FORMULÁRIO ---
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ 
    nome: '', email: '', tipo: 'ALUNO', senhaInicial: '', ativo: true 
  });

  // 1. Debounce da Busca (evita requisições a cada tecla)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPagination(p => ({ ...p, page: 1 })); // Reseta para pág 1 ao buscar
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Buscar Dados da API
  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('limit', '10'); // 10 por página
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await fetch(`/api/admin/usuarios?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao carregar');
      
      const data = await res.json();
      setUsuarios(data.data || []);
      setPagination(p => ({
        ...p,
        total: data.meta.total,
        totalPages: data.meta.totalPages
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, debouncedSearch]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  // --- AÇÕES DO FORMULÁRIO ---

  const resetForm = () => {
    setFormData({ nome: '', email: '', tipo: 'ALUNO', senhaInicial: '', ativo: true });
    setEditingUser(null);
    setShowForm(false);
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      nome: user.nome,
      email: user.email,
      tipo: user.tipo,
      senhaInicial: '', // Senha não vem do banco
      ativo: user.ativo
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = '/api/admin/usuarios';
      const method = editingUser ? 'PUT' : 'POST';
      const body = editingUser 
        ? { ...formData, id: editingUser.id } 
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken || '' // 🛡️ CSRF
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Erro ao salvar');
      } else {
        const data = await res.json();
        if (data.message) alert(data.message);
        resetForm();
        fetchUsuarios(); // Recarrega a lista
      }
    } catch (err) {
      alert('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza? Isso apagará o usuário e todo o histórico dele permanentemente.')) return;
    
    try {
      const res = await fetch(`/api/admin/usuarios?id=${id}`, { 
          method: 'DELETE',
          headers: { 'x-csrf-token': csrfToken || '' } // 🛡️ CSRF
      });

      if (res.ok) {
        fetchUsuarios();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      alert('Erro ao excluir');
    }
  };

  // Helper de Ícone por Tipo
  const getTypeIcon = (tipo: string) => {
    switch(tipo) {
        case 'SUPER_ADMIN': return <Shield size={14} className="text-purple-600" />;
        case 'PROFESSOR': return <GraduationCap size={14} className="text-blue-600" />;
        default: return <User size={14} className="text-gray-500" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      
      {/* --- COLUNA 1: FORMULÁRIO (Sticky) --- */}
      <div className="lg:col-span-1">
        <button 
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="w-full mb-4 md:hidden bg-blue-900 text-white p-3 rounded font-bold"
        >
          {showForm ? 'Fechar Formulário' : '+ Novo Usuário'}
        </button>

        <div className={`${showForm ? 'block' : 'hidden'} md:block bg-white p-6 rounded-xl shadow border border-gray-200 sticky top-6`}>
          <h2 className="text-lg font-bold mb-4 text-blue-900 border-b pb-2 flex items-center justify-between">
            {editingUser ? 'Editar Usuário' : 'Novo Cadastro'}
            {showForm && <button onClick={resetForm} className="md:hidden"><XCircle size={20}/></button>}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Nome</label>
              <input required className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none" 
                value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Nome completo" />
            </div>
            
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">E-mail</label>
              <input type="email" required className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none" 
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="usuario@email.com" />
              {editingUser && <p className="text-[10px] text-orange-600 mt-1 font-medium bg-orange-50 p-2 rounded">⚠️ Mudar o e-mail gera nova senha.</p>}
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Tipo de Acesso</label>
              <select className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                <option value="ALUNO">Aluno (Comum)</option>
                <option value="PROFESSOR">Professor</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            {!editingUser && (
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Senha Inicial</label>
                <input required className="w-full p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-100 outline-none text-gray-700" 
                  value={formData.senhaInicial} onChange={e => setFormData({...formData, senhaInicial: e.target.value})} placeholder="Mínimo 10 caracteres" />
              </div>
            )}

            {editingUser && (
              <div className="flex items-center gap-2 mt-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <input type="checkbox" id="ativo" 
                  checked={formData.ativo} onChange={e => setFormData({...formData, ativo: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="ativo" className="text-sm font-bold text-gray-700 cursor-pointer select-none">Conta Ativa</label>
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <button disabled={submitting} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition text-sm shadow-md disabled:opacity-70 flex items-center justify-center gap-2">
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {editingUser ? 'Atualizar' : 'Cadastrar'}
              </button>
              {editingUser && (
                <button type="button" onClick={resetForm} className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-600 transition">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* --- COLUNA 2: LISTA DE USUÁRIOS --- */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* BARRA DE FERRAMENTAS */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="relative w-full sm:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Search size={18} />
                </div>
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou e-mail..." 
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                    <User size={14} /> 
                    <span className="font-bold text-gray-700">{pagination.total}</span> Usuários
                </div>
            </div>
        </div>

        {/* TABELA DE USUÁRIOS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
             <div className="p-12 flex flex-col items-center justify-center text-gray-400 animate-pulse">
                <div className="w-12 h-12 bg-gray-100 rounded-full mb-3"></div>
                <div className="h-4 w-48 bg-gray-100 rounded"></div>
             </div>
          ) : usuarios.length === 0 ? (
             <div className="p-12 text-center text-gray-500">
                <p>Nenhum usuário encontrado.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500 font-bold tracking-wider">
                    <tr>
                    <th className="p-5">Usuário</th>
                    <th className="p-5">Status</th>
                    <th className="p-5 text-center hidden md:table-cell">Engajamento</th>
                    <th className="p-5 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {usuarios.map(u => (
                    <tr key={u.id} className="hover:bg-blue-50/30 transition group">
                        <td className="p-5">
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                                {u.nome}
                                {getTypeIcon(u.tipo)}
                            </div>
                            <div className="text-gray-500 text-xs">{u.email}</div>
                        </td>
                        
                        <td className="p-5">
                            <div className="flex flex-col gap-1 items-start">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border
                                ${u.tipo === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                                    u.tipo === 'PROFESSOR' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-gray-100 text-gray-600 border-gray-200'}
                                `}>
                                {u.tipo.replace('_', ' ')}
                                </span>
                                {u.ativo ? (
                                <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px] bg-emerald-50 px-1.5 rounded border border-emerald-100">Ativo</span>
                                ) : (
                                <span className="flex items-center gap-1 text-red-500 font-bold text-[10px] bg-red-50 px-1.5 rounded border border-red-100">Inativo</span>
                                )}
                            </div>
                        </td>

                        {/* COLUNA DE MÉTRICAS */}
                        <td className="p-5 bg-gray-50/30 hidden md:table-cell">
                            <div className="flex justify-center gap-6 text-xs">
                                <div className="text-center">
                                    <span className="block text-gray-400 font-bold text-[9px] uppercase tracking-wide">Simulados</span>
                                    <span className="font-bold text-blue-600 text-lg">{u.totalSimulados}</span>
                                </div>
                                <div className="text-center">
                                    <span className="block text-gray-400 font-bold text-[9px] uppercase tracking-wide">Questões</span>
                                    <span className="font-bold text-emerald-600 text-lg">{u.totalQuestoesRespondidas}</span>
                                </div>
                            </div>
                            <div className="text-center mt-1">
                                <span className="text-[10px] text-gray-400">Último Login: {u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleDateString('pt-BR') : 'Nunca'}</span>
                            </div>
                        </td>

                        <td className="p-5 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(u)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition" title="Editar"><Edit3 size={16} /></button>
                                <button onClick={() => handleDelete(u.id)} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition" title="Excluir"><Trash2 size={16} /></button>
                            </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          )}
          
          {/* CONTROLES DE PAGINAÇÃO */}
          {!loading && usuarios.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">
                    Página <span className="text-gray-900 font-bold">{pagination.page}</span> de {pagination.totalPages}
                </span>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setPagination(p => ({...p, page: p.page - 1}))} 
                        disabled={pagination.page === 1}
                        className="p-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button 
                        onClick={() => setPagination(p => ({...p, page: p.page + 1}))} 
                        disabled={pagination.page >= pagination.totalPages}
                        className="p-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}