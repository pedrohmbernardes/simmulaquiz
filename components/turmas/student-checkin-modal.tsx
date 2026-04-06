'use client';

import { useState } from 'react';
import { useSecureFetch } from '@/lib/hooks/useSecureFetch';
import { toast } from 'sonner';
import { X } from 'lucide-react';

interface StudentCheckinModalProps {
  turmaId: number | string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function StudentCheckinModal({ turmaId, isOpen, onClose, onSuccess }: StudentCheckinModalProps) {
  const secureFetch = useSecureFetch();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica de UX antes de chamar API (economiza rate limit)
    if (codigo.length < 3) {
      toast.warning('O código parece muito curto.');
      return;
    }

    setLoading(true);

    try {
      // Endpoint auditado: POST com Rate Limit estrito (5 tentativas/10min)
      const res = await secureFetch(`/api/estudante/turmas/${turmaId}/checkin/registrar`, {
        method: 'POST',
        body: { 
          codigo: codigo.toUpperCase().trim() 
        },
      });

      if (res.ok) {
        toast.success('Presença registrada com sucesso! 🎉');
        setCodigo('');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const data = await res.json();
        
        // Tratamento específico de erros de segurança
        if (res.status === 429) {
          toast.error('Muitas tentativas incorretas. Aguarde 10 minutos.');
        } else if (res.status === 404) {
          toast.error('Nenhuma chamada ativa para esta turma agora.');
        } else {
          toast.error(data.error || 'Código inválido ou expirado.');
        }
      }
    } catch (error) {
      toast.error('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            📍 Registrar Presença
          </h2>
          <button 
            onClick={onClose}
            className="text-indigo-100 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-gray-600 text-sm mb-4">
              Digite o código fornecido pelo professor para confirmar sua presença nesta aula.
            </p>
            
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              maxLength={6}
              className="w-full text-center text-3xl font-mono font-bold tracking-[0.5em] p-4 border-2 border-indigo-100 rounded-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none uppercase placeholder:text-gray-200 transition-all"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-gray-700 font-medium hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !codigo}
              className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all active:scale-[0.98]"
            >
              {loading ? 'Validando...' : 'Confirmar'}
            </button>
          </div>
        </form>
        
        {/* Footer Seguro */}
        <div className="bg-gray-50 px-6 py-3 text-center border-t">
          <p className="text-xs text-gray-400">
            Tentativas limitadas por segurança.
          </p>
        </div>
      </div>
    </div>
  );
}