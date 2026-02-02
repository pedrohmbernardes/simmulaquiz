import { Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface ActionModalProps {
  isOpen: boolean;
  type: 'CONFIRM' | 'LOADING' | 'SUCCESS' | 'ERROR';
  title: string;
  message?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ActionModal({ 
  isOpen, type, title, message, onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar' 
}: ActionModalProps) {
  if (!isOpen) return null;

  const iconConfig = {
    LOADING: { 
      icon: <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />,
      bg: 'bg-gradient-to-br from-blue-100 to-indigo-100',
      border: 'border-blue-200'
    },
    SUCCESS: { 
      icon: <CheckCircle className="w-12 h-12 text-green-600" />,
      bg: 'bg-gradient-to-br from-green-100 to-emerald-100',
      border: 'border-green-200'
    },
    ERROR: { 
      icon: <XCircle className="w-12 h-12 text-red-600" />,
      bg: 'bg-gradient-to-br from-red-100 to-rose-100',
      border: 'border-red-200'
    },
    CONFIRM: { 
      icon: <AlertTriangle className="w-12 h-12 text-amber-600" />,
      bg: 'bg-gradient-to-br from-amber-100 to-yellow-100',
      border: 'border-amber-200'
    }
  };

  const config = iconConfig[type];

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center border-2 border-gray-100 transform transition-all scale-100 animate-in zoom-in-95 duration-300">
        
        {/* ÍCONE DINÂMICO */}
        <div className="flex justify-center mb-6">
          <div className={`p-5 rounded-2xl border-2 ${config.bg} ${config.border} shadow-lg`}>
            {config.icon}
          </div>
        </div>

        <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">{title}</h3>
        {message && (
          <p className="text-sm text-gray-600 mb-8 leading-relaxed max-w-sm mx-auto">
            {message}
          </p>
        )}

        {/* BOTÕES */}
        {type === 'CONFIRM' && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={onCancel} 
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all border-2 border-gray-200"
            >
              {cancelText}
            </button>
            <button 
              onClick={onConfirm} 
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30"
            >
              {confirmText}
            </button>
          </div>
        )}

        {/* Botão de Fechar para Erro ou Sucesso */}
        {(type === 'ERROR' || type === 'SUCCESS') && onCancel && (
           <button 
             onClick={onCancel} 
             className="w-full py-3 bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 font-bold rounded-xl hover:from-gray-200 hover:to-slate-200 transition-all border-2 border-gray-200"
           >
             Fechar
           </button>
        )}

        {/* Loading não tem botões - apenas mostra o spinner */}
      </div>
    </div>
  );
}
