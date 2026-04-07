'use client';

import { useState } from 'react';
import { 
  X, Eye, CheckCircle2, BookOpen, BrainCircuit, 
  Hash, Target, Building2, FileBadge, Calendar,
  Layers, ImageIcon, Loader2
} from 'lucide-react';
import Image from 'next/image';

interface QuestaoPreviewProps {
  questao: any;
  isOpen: boolean;
  onClose: () => void;
  compact?: boolean;
}

export function QuestaoPreviewModal({ questao, isOpen, onClose, compact = false }: QuestaoPreviewProps) {
  if (!isOpen || !questao) return null;

  const alternativas = [
    { letra: 'A', texto: questao.alternativaA },
    { letra: 'B', texto: questao.alternativaB },
    { letra: 'C', texto: questao.alternativaC },
    { letra: 'D', texto: questao.alternativaD },
    { letra: 'E', texto: questao.alternativaE },
  ];

  const correta = questao.alternativaCorreta?.toUpperCase();

  const getDificuldadeStyle = (dif: string) => {
    const map: Record<string, string> = {
      'MUITO_FACIL': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'FACIL': 'bg-teal-100 text-teal-700 border-teal-200',
      'MEDIO': 'bg-amber-100 text-amber-700 border-amber-200',
      'DIFICIL': 'bg-orange-100 text-orange-700 border-orange-200',
      'MUITO_DIFICIL': 'bg-red-100 text-red-700 border-red-200',
    };
    return map[dif] || 'bg-gray-100 text-gray-600 border-gray-200';
  };

  return (
    <div 
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 ${compact ? 'pt-24' : ''}`}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {!compact && (
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Eye size={18} className="text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">Questão #{questao.id}</span>
                  {questao.codigo && (
                    <span className="text-xs text-slate-400 font-mono">{questao.codigo}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {questao.dificuldade && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getDificuldadeStyle(questao.dificuldade)}`}>
                      {questao.dificuldade.replace(/_/g, ' ')}
                    </span>
                  )}
                  {questao.nivelCognitivo && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                      <BrainCircuit size={10} />
                      {questao.nivelCognitivo}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        )}
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 relative">
          {/* Metadata pills */}
            {compact && (
              <button onClick={onClose} className="absolute top-0 right-0 p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            )}
          <div className="flex flex-wrap gap-2">
            {questao.unidadeCurricular && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <BookOpen size={12} />
                {questao.unidadeCurricular.nome || questao.unidadeCurricular.codigo}
              </span>
            )}
            {questao.funcao && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Target size={12} />
                {questao.funcao.codigo}
              </span>
            )}
            {questao.capacidade && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                <Layers size={12} />
                {questao.capacidade.sigla}
              </span>
            )}
          </div>

          {/* Imagem (se houver) */}
          {questao.imagens && questao.imagens.length > 0 && questao.imagens[0]?.url && (
            <div className="rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-50">
              <div className="relative w-full h-48">
                <Image 
                  src={questao.imagens[0].url} 
                  alt="Imagem da questão" 
                  fill 
                  className="object-contain" 
                  unoptimized 
                />
              </div>
            </div>
          )}

          {/* Enunciado */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enunciado</p>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {questao.enunciado}
            </p>
          </div>

          {/* Alternativas */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Alternativas</p>
            <div className="space-y-2">
              {alternativas.map(({ letra, texto }) => {
                const isCorreta = letra === correta;
                return (
                  <div
                    key={letra}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 text-sm transition-all ${
                      isCorreta
                        ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCorreta
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {letra}
                    </span>
                    <span className={`flex-1 pt-0.5 ${isCorreta ? 'text-emerald-900 font-medium' : 'text-slate-600'}`}>
                      {texto || <span className="italic text-slate-300">Sem texto</span>}
                    </span>
                    {isCorreta && (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-sm transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for fetching question details
export function useQuestaoPreview() {
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openPreview = async (questaoId: number) => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const res = await fetch(`/api/admin/questoes/${questaoId}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      }
    } catch (e) {
      console.error('Erro ao buscar questão', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewData(null);
  };

  return { previewData, previewOpen, previewLoading, openPreview, closePreview };
}
