import { useState, useEffect } from 'react';
import { BookOpen, Layers, BrainCircuit, Target, Save, X, Trash2, Sparkles, CheckCircle } from 'lucide-react';

// --- MODAL EXCLUIR ---
export const DeleteConfirmModal = ({ questao, onClose, onConfirm, loading }: any) => (
  <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center border-2 border-gray-100 animate-in zoom-in-95 duration-300">
      <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-rose-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-red-200 shadow-lg">
        <Trash2 size={36} />
      </div>
      <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">
        Excluir Questão #{questao.id}?
      </h3>
      <p className="text-sm text-gray-600 mb-8 leading-relaxed">
        Esta ação não pode ser desfeita. Tem certeza que deseja remover esta questão permanentemente?
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button 
          onClick={onClose} 
          className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all border-2 border-gray-200"
        >
          Cancelar
        </button>
        <button 
          onClick={onConfirm} 
          disabled={loading} 
          className="flex-1 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold rounded-xl hover:from-red-700 hover:to-rose-700 transition-all shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Excluindo...
            </span>
          ) : (
            'Sim, Excluir'
          )}
        </button>
      </div>
    </div>
  </div>
);

// --- MODAL SUCESSO ---
export const DeleteSuccessModal = ({ onClose, onCreateNew }: any) => (
  <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center border-2 border-gray-100 animate-in zoom-in-95 duration-300">
      <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-green-200 shadow-lg">
        <CheckCircle size={36} />
      </div>
      <h3 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Excluída com Sucesso!</h3>
      <p className="text-sm text-gray-600 mb-8">A questão foi removida do sistema.</p>
      <div className="flex flex-col gap-3">
        <button 
          onClick={onCreateNew} 
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
        >
          <Sparkles size={18} />
          Criar Nova Questão
        </button>
        <button 
          onClick={onClose} 
          className="w-full bg-gray-100 border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
        >
          Voltar para Lista
        </button>
      </div>
    </div>
  </div>
);

// --- MODAL EDIÇÃO ---
export const EditModal = ({ questao, onClose, onSave, onDelete, options }: any) => {
  const [formData, setFormData] = useState({
      ...questao,
      cursoTecnicoId: questao.cursoTecnicoId || questao.cursoTecnico?.id,
      unidadeCurricularId: questao.unidadeCurricularId || questao.unidadeCurricular?.id,
      objetoConhecimentoId: questao.conhecimentoId || questao.conhecimento?.id || questao.objetoConhecimento?.id,
      funcaoId: questao.funcaoId || questao.funcao?.id,
      subfuncaoId: questao.subfuncaoId || questao.subfuncao?.id,
      capacidadeId: questao.capacidadeId || questao.capacidade?.id,
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => {
        const updates: any = { [field]: value };
        
        if (field === 'cursoTecnicoId') { 
            updates.unidadeCurricularId = ''; 
            updates.objetoConhecimentoId = ''; 
        }
        if (field === 'unidadeCurricularId') { 
            updates.objetoConhecimentoId = ''; 
        }
        if (field === 'funcaoId') { 
            updates.subfuncaoId = ''; 
            updates.capacidadeId = ''; 
        }
        if (field === 'subfuncaoId') { 
            updates.capacidadeId = ''; 
        }

        return { ...prev, ...updates };
    });
  };

  const ucsFiltradas = options.ucs?.filter((uc: any) => 
    !formData.cursoTecnicoId || uc.cursoTecnicoId === Number(formData.cursoTecnicoId)
  );
  
  const objetosFiltrados = options.objetos?.filter((obj: any) => 
    !formData.unidadeCurricularId || 
    (obj.ucsIds && obj.ucsIds.includes(Number(formData.unidadeCurricularId)))
  );

  const funcoesFiltradas = options.funcoes?.filter((f: any) => 
    !formData.cursoTecnicoId || 
    (f.cursosIds && f.cursosIds.includes(Number(formData.cursoTecnicoId)))
  );

  const subfuncoesFiltradas = options.subfuncoes?.filter((sub: any) => 
    !formData.funcaoId || sub.funcaoId === Number(formData.funcaoId)
  );

  const capacidadesFiltradas = options.capacidades?.filter((cap: any) => 
    !formData.subfuncaoId || 
    (cap.subfuncoesIds && cap.subfuncoesIds.includes(Number(formData.subfuncaoId)))
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white sm:rounded-3xl shadow-2xl w-full max-w-6xl h-full sm:h-[90vh] overflow-hidden flex flex-col border-2 border-gray-200">
        
        {/* Header */}
        <div className="relative px-8 py-6 border-b-2 border-gray-200 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 top-0 z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <BookOpen className="text-white" size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Editar Questão #{questao.id}</h2>
                <p className="text-sm text-gray-600 font-medium">Faça os ajustes necessários e salve as alterações</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            >
              <X size={24}/>
            </button>
          </div>
        </div>
        
        <div className="p-8 space-y-6 bg-gradient-to-br from-gray-50 via-white to-slate-50 flex-1 overflow-y-auto custom-scrollbar">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Seção Curricular */}
                <section className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b-2 border-blue-100">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg">
                          <BookOpen size={20} className="text-white"/>
                        </div>
                        <h3 className="font-black text-base uppercase tracking-wide text-gray-800">
                          Estrutura Curricular
                        </h3>
                    </div>
                    <div className="space-y-4">
                        <div>
                           <label className="text-xs font-bold text-gray-600 block mb-2 uppercase tracking-wider">Curso Técnico</label>
                           <select 
                             className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition bg-white" 
                             value={formData.cursoTecnicoId || ''} 
                             onChange={e => handleChange('cursoTecnicoId', e.target.value)}
                           >
                             <option value="">Selecione...</option>
                             {options.cursos?.map((op:any) => <option key={op.id} value={op.id}>{op.nome}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-gray-600 block mb-2 uppercase tracking-wider">Unidade Curricular</label>
                           <select 
                             className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition bg-white disabled:bg-gray-50 disabled:text-gray-400" 
                             value={formData.unidadeCurricularId || ''} 
                             onChange={e => handleChange('unidadeCurricularId', e.target.value)} 
                             disabled={!formData.cursoTecnicoId}
                           >
                              <option value="">Selecione...</option>
                              {ucsFiltradas?.map((op:any) => <option key={op.id} value={op.id}>{op.nome}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-gray-600 block mb-2 uppercase tracking-wider">Objeto de Conhecimento</label>
                           <select 
                             className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition bg-white disabled:bg-gray-50 disabled:text-gray-400" 
                             value={formData.objetoConhecimentoId || ''} 
                             onChange={e => handleChange('objetoConhecimentoId', e.target.value)} 
                             disabled={!formData.unidadeCurricularId}
                           >
                              <option value="">Selecione...</option>
                              {objetosFiltrados?.map((op:any) => <option key={op.id} value={op.id}>{op.descricao || op.nome}</option>)}
                           </select>
                        </div>
                    </div>
                </section>

                {/* Seção Eixo Tecnológico */}
                <section className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b-2 border-indigo-100">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
                          <Target size={20} className="text-white"/>
                        </div>
                        <h3 className="font-black text-base uppercase tracking-wide text-gray-800">
                          Eixo Tecnológico
                        </h3>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-xs font-bold text-gray-600 block mb-2 uppercase tracking-wider">Função</label>
                               <select 
                                 className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition bg-white" 
                                 value={formData.funcaoId || ''} 
                                 onChange={e => handleChange('funcaoId', e.target.value)}
                               >
                                 <option value="">Selecione...</option>
                                 {funcoesFiltradas?.map((op:any) => <option key={op.id} value={op.id}>{op.codigo}</option>)}
                               </select>
                            </div>
                            <div>
                               <label className="text-xs font-bold text-gray-600 block mb-2 uppercase tracking-wider">Subfunção</label>
                               <select 
                                 className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition bg-white disabled:bg-gray-50 disabled:text-gray-400" 
                                 value={formData.subfuncaoId || ''} 
                                 onChange={e => handleChange('subfuncaoId', e.target.value)} 
                                 disabled={!formData.funcaoId}
                               >
                                  <option value="">Selecione...</option>
                                  {subfuncoesFiltradas?.map((op:any) => <option key={op.id} value={op.id}>{op.codigo}</option>)}
                               </select>
                            </div>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-gray-600 block mb-2 uppercase tracking-wider">Capacidade Técnica</label>
                           <select 
                             className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition bg-white disabled:bg-gray-50 disabled:text-gray-400" 
                             value={formData.capacidadeId || ''} 
                             onChange={e => handleChange('capacidadeId', e.target.value)} 
                             disabled={!formData.subfuncaoId}
                           >
                              <option value="">Selecione...</option>
                              {capacidadesFiltradas?.map((op:any) => <option key={op.id} value={op.id}>{op.sigla} - {op.descricao}</option>)}
                           </select>
                        </div>
                    </div>
                </section>
            </div>

            {/* Conteúdo */}
            <section className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-lg">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b-2 border-purple-100">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                      <BrainCircuit size={20} className="text-white"/>
                    </div>
                    <h3 className="font-black text-base uppercase tracking-wide text-gray-800">
                      Conteúdo da Questão
                    </h3>
                </div>
                
                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-gray-600 block mb-3 uppercase tracking-wider">Enunciado</label>
                        <textarea 
                            className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl text-sm leading-relaxed font-medium focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition min-h-[120px] resize-y"
                            value={formData.enunciado}
                            onChange={e => handleChange('enunciado', e.target.value)}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-600 block uppercase tracking-wider">Alternativas</label>
                        {['A','B','C','D','E'].map(letra => (
                            <div 
                              key={letra} 
                              className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                                formData.alternativaCorreta === letra.toLowerCase() 
                                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-md' 
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                                <input 
                                    type="radio"
                                    name="correta_modal"
                                    className="w-5 h-5 text-green-600 focus:ring-green-500 accent-green-600 cursor-pointer"
                                    checked={formData.alternativaCorreta === letra.toLowerCase()}
                                    onChange={() => handleChange('alternativaCorreta', letra.toLowerCase())}
                                />
                                <span className="font-black text-sm text-gray-600 w-8">{letra})</span>
                                <input 
                                    className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-800 placeholder-gray-400"
                                    value={formData[`alternativa${letra}`] || ''}
                                    onChange={e => handleChange(`alternativa${letra}`, e.target.value)}
                                    placeholder={`Digite a alternativa ${letra}...`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-gray-200 bg-white flex justify-between items-center sticky bottom-0 z-20 shadow-lg">
            <button 
              onClick={() => onDelete(questao)} 
              className="inline-flex items-center gap-2 px-5 py-3 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-all border-2 border-red-200"
            >
              <Trash2 size={18} />
              Excluir Questão
            </button>
            <div className="flex gap-3">
              <button 
                onClick={onClose} 
                className="px-6 py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => onSave(formData)} 
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/30 transition-all"
              >
                <Save size={18}/> 
                Salvar Alterações
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};
