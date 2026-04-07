'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuestoesLogic } from './useQuestoesLogic';
import { ActionModal } from './ActionModal';
import { 
  Plus, Search, Edit3, Trash2, Image as ImageIcon, 
  Layers, ChevronDown, Filter, BrainCircuit, Target, BookOpen, 
  Hash, XCircle, ChevronUp, GraduationCap, Building2, Calendar, FileBadge,
  Sparkles, TrendingUp, Award, Eye
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { QuestaoPreviewModal, useQuestaoPreview } from './QuestaoPreviewModal';

export default function AdminQuestoesPage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/csrf')
      .then(res => {
        if (!res.ok) {
           router.push('/auth/login');
        }
      })
      .catch(() => {
         toast.error("Erro de conexão com o servidor de segurança.");
      });
  }, [router]);

  const {
    questoes, options, loading, pagination,
    statusFilter, setStatusFilter, filters, 
    showFilters, setShowFilters, handleFilterChange, clearFilters,
    showMenu, setShowMenu, 
    modal, setModal, handleDeleteClick, handlePageChange
  } = useQuestoesLogic();

  const { previewData, previewOpen, previewLoading, openPreview, closePreview } = useQuestaoPreview();

  const isIdSearch = filters.busca.startsWith('#');
  const idValue = isIdSearch ? filters.busca.substring(1) : '';
  const textValue = isIdSearch ? '' : filters.busca;

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    handleFilterChange('busca', val ? `#${val}` : '');
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilterChange('busca', e.target.value);
  };

  const hasActiveFilters = filters.cursoId || filters.ucId || filters.objetoId || 
                           filters.funcaoId || filters.capacidadeId ||
                           filters.instituicaoId || filters.bancaId || filters.ano || filters.dificuldade;

  const getDificuldadeBadge = (dif: string) => {
    const map: any = {
      'MUITO_FACIL': { css: 'bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 border-emerald-200', label: 'M. Fácil', dot: 'bg-emerald-500' },
      'FACIL': { css: 'bg-gradient-to-br from-teal-100 to-cyan-100 text-teal-700 border-teal-200', label: 'Fácil', dot: 'bg-teal-500' },
      'MEDIO': { css: 'bg-gradient-to-br from-yellow-100 to-amber-100 text-yellow-700 border-yellow-200', label: 'Médio', dot: 'bg-yellow-500' },
      'DIFICIL': { css: 'bg-gradient-to-br from-orange-100 to-red-100 text-orange-700 border-orange-200', label: 'Difícil', dot: 'bg-orange-500' },
      'MUITO_DIFICIL': { css: 'bg-gradient-to-br from-red-100 to-rose-100 text-red-700 border-red-200', label: 'M. Difícil', dot: 'bg-red-500' },
    };
    const config = map[dif] || { css: 'bg-gray-100 text-gray-500', label: 'N/A', dot: 'bg-gray-500' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wide ${config.css}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`}></span>
            {config.label}
        </span>
    );
  };

  const getBloomBadge = (bloom: string) => {
    const map: any = {
      'LEMBRAR': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
      'ENTENDER': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
      'APLICAR': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
      'ANALISAR': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
      'AVALIAR': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
      'CRIAR': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    };
    const config = map[bloom] || { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${config.bg} ${config.text} ${config.border}`}>
        <BrainCircuit size={12} />
        {bloom}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
        
        <ActionModal 
          isOpen={modal.isOpen} type={modal.type} title={modal.title} message={modal.message}
          onConfirm={modal.action || undefined} onCancel={() => setModal(prev => ({ ...prev, isOpen: false }))}
          confirmText="Sim, Excluir" cancelText="Cancelar"
        />
        <QuestaoPreviewModal 
          questao={previewData} 
          isOpen={previewOpen} 
          onClose={closePreview} 
        />
        
        {/* HEADER MODERNO */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 shadow-2xl">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
          </div>

          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <BookOpen className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tight">
                    Gestão de Questões
                  </h1>
                  <p className="text-indigo-100 font-medium">
                    <span className="font-bold">{questoes.length}</span> questões encontradas
                  </p>
                </div>
              </div>
            </div>
            
            <div className="relative z-20">
              <button 
                onClick={() => setShowMenu(!showMenu)} 
                className="group inline-flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                <Plus size={20} /> 
                <span>Nova Questão</span>
                <ChevronDown size={16} className={`transition-transform ${showMenu ? 'rotate-180' : ''}`} />
              </button>
              
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-20 animate-in zoom-in-95 duration-200">
                    <button 
                      onClick={() => router.push('/admin/questoes/nova')} 
                      className="w-full text-left px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-indigo-50 flex items-center gap-3 transition border-b border-gray-100 group"
                    >
                      <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
                        <Edit3 size={18}/>
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">Criar Manualmente</p>
                        <p className="text-xs text-gray-500">Adicione questão pelo formulário</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => router.push('/admin/questoes/ia')} 
                      className="w-full text-left px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-purple-50 flex items-center gap-3 transition group"
                    >
                      <div className="bg-purple-100 p-2.5 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
                        <Sparkles size={18}/>
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">Gerar com IA</p>
                        <p className="text-xs text-gray-500">Use inteligência artificial</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* BUSCA E FILTROS */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="p-6 space-y-4">
            {/* Abas de Status */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[
                { value: 'TODAS', label: 'Todas', icon: BookOpen, color: 'indigo' },
                { value: 'ATIVAS', label: 'Ativas', icon: Award, color: 'green' },
                { value: 'INATIVAS', label: 'Inativas', icon: XCircle, color: 'red' }
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
                    statusFilter === tab.value
                      ? `bg-gradient-to-r from-${tab.color}-500 to-${tab.color}-600 text-white shadow-lg`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Busca */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por ID..."
                  value={idValue}
                  onChange={handleIdChange}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por texto..."
                  value={textValue}
                  onChange={handleTextChange}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition"
                />
              </div>
            </div>

            {/* Botão Filtros Avançados */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                hasActiveFilters
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter size={16} />
              Filtros Avançados
              {hasActiveFilters && <span className="bg-white text-indigo-600 px-2 py-0.5 rounded-full text-xs font-bold">Ativos</span>}
              {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {/* Painel de Filtros Avançados */}
          {showFilters && (
            <div className="border-t border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 p-6 animate-in slide-in-from-top duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Curso */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Curso Técnico</label>
                  <select
                    value={filters.cursoId}
                    onChange={(e) => handleFilterChange('cursoId', e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition bg-white"
                  >
                    <option value="">Todos</option>
                    {options.cursos?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                {/* UC */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Unidade Curricular</label>
                  <select
                    value={filters.ucId}
                    onChange={(e) => handleFilterChange('ucId', e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition bg-white"
                  >
                    <option value="">Todas</option>
                    {options.unidades?.map((uc: any) => (
                      <option key={uc.id} value={uc.id}>{uc.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Dificuldade */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Dificuldade</label>
                  <select
                    value={filters.dificuldade}
                    onChange={(e) => handleFilterChange('dificuldade', e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition bg-white"
                  >
                    <option value="">Todas</option>
                    <option value="MUITO_FACIL">Muito Fácil</option>
                    <option value="FACIL">Fácil</option>
                    <option value="MEDIO">Médio</option>
                    <option value="DIFICIL">Difícil</option>
                    <option value="MUITO_DIFICIL">Muito Difícil</option>
                  </select>
                </div>

                {/* Ano */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Ano</label>
                  <input
                    type="number"
                    placeholder="Ex: 2024"
                    value={filters.ano}
                    onChange={(e) => handleFilterChange('ano', e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition bg-white"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl font-semibold text-sm hover:bg-red-200 transition-all"
                >
                  <XCircle size={16} />
                  Limpar Filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* TABELA */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 font-medium">Carregando questões...</p>
          </div>
        ) : questoes.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="text-gray-400" size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhuma questão encontrada</h3>
            <p className="text-gray-500 mb-6">Ajuste os filtros ou crie uma nova questão</p>
            <button
              onClick={() => router.push('/admin/questoes/nova')}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all"
            >
              <Plus size={20} />
              Criar Primeira Questão
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b-2 border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Questão</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Competências</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Origem</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {questoes.map((q: any) => (
                    <tr key={q.id} className="group hover:bg-indigo-50/30 transition-colors">
                      {/* ID */}
                      <td className="px-6 py-5 align-top">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openPreview(q.id)}
                            className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition-all"
                            title="Visualizar questão"
                          >
                            <Eye size={16} />
                          </button>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-slate-100 to-gray-100 text-slate-700 rounded-lg font-bold text-sm border border-slate-200">
                            <Hash size={14} />
                            {q.id}
                          </span>
                        </div>
                      </td>

                      {/* QUESTÃO */}
                      <td className="px-6 py-5 align-top">
                        <div className="flex gap-4">
                          {q.imagens && q.imagens.length > 0 && q.imagens[0].url ? (
                            <div className="w-16 h-16 relative shrink-0 rounded-xl border-2 border-gray-200 bg-white shadow-sm overflow-hidden">
                              <Image src={q.imagens[0].url} alt="Img" fill className="object-cover" unoptimized />
                            </div>
                          ) : (
                            <div className="w-16 h-16 shrink-0 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300">
                              <ImageIcon size={20} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug mb-2" title={q.enunciado}>
                              {q.enunciado}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              {q.unidadeCurricular && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg border border-blue-200">
                                  <BookOpen size={12} />
                                  {q.unidadeCurricular.codigo}
                                </span>
                              )}
                              {getDificuldadeBadge(q.dificuldade)}
                              {getBloomBadge(q.nivelCognitivo)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* COMPETÊNCIAS */}
                      <td className="px-6 py-5 align-top">
                        <div className="space-y-2">
                          {q.funcao && (
                            <div className="flex items-center gap-2" title={q.funcao.nome}>
                              <Target size={14} className="text-indigo-500"/>
                              <span className="text-xs font-bold text-gray-700">{q.funcao.codigo}</span>
                            </div>
                          )}
                          {q.capacidade && (
                            <div className="flex items-center gap-2" title={q.capacidade.descricao}>
                              <Layers size={14} className="text-purple-500"/>
                              <span className="text-xs font-bold text-gray-700">{q.capacidade.sigla}</span>
                            </div>
                          )}
                          {!q.funcao && !q.capacidade && (
                            <span className="text-xs text-gray-400 italic">Não definido</span>
                          )}
                        </div>
                      </td>

                      {/* ORIGEM */}
                      <td className="px-6 py-5 align-top">
                        <div className="flex flex-col gap-1.5">
                          {q.instituicao && (
                            <div className="flex items-center gap-2">
                              <Building2 size={12} className="text-gray-400"/>
                              <span className="text-xs font-semibold text-gray-700 truncate">{q.instituicao.sigla}</span>
                            </div>
                          )}
                          {q.banca && (
                            <div className="flex items-center gap-2">
                              <FileBadge size={12} className="text-gray-400"/>
                              <span className="text-xs text-gray-600 truncate">{q.banca.sigla}</span>
                            </div>
                          )}
                          {q.ano && (
                            <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-gray-400"/>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">{q.ano}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-5 align-top">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border-2 ${
                          q.ativa 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${q.ativa ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
                          {q.ativa ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>

                      {/* AÇÕES */}
                      <td className="px-6 py-5 align-top text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link 
                            href={`/admin/questoes/${q.id}`} 
                            className="p-2.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all hover:scale-110" 
                            title="Editar"
                          >
                            <Edit3 size={18} />
                          </Link>
                          <button 
                            onClick={() => handleDeleteClick(q)} 
                            className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all hover:scale-110" 
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO */}
            <div className="p-6 bg-gradient-to-r from-slate-50 to-gray-50 border-t-2 border-gray-200 flex justify-between items-center">
              <span className="text-sm text-gray-600 font-medium">
                Página <span className="font-bold text-gray-800">{pagination.page}</span>
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => handlePageChange(pagination.page - 1)} 
                  disabled={pagination.page === 1 || loading} 
                  className="px-5 py-2.5 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  Anterior
                </button>
                <button 
                  onClick={() => handlePageChange(pagination.page + 1)} 
                  disabled={questoes.length < 50 || loading} 
                  className="px-5 py-2.5 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
