'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSecureFetch } from '@/lib/hooks/useSecureFetch';
import { toast } from 'sonner';
import { 
  MapPin, RefreshCw, Copy, XCircle, Users, Zap, Loader2, 
  AlertTriangle
} from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProfessorCheckinManagerProps {
  turmaId: number | string;
}

interface AlunoPresente {
  nome: string;
  fotoUrl: string | null;
  horario: string;
}

interface SessaoCheckin {
  id: number;
  codigo: string;
  tipo: 'AUTOMATICA' | 'CODIGO';
  abertoEm: string;
  fechaEm: string;
  ativo: boolean;
  listaPresentes: AlunoPresente[];
  _count?: {
    checkins: number;
  };
}

export function ProfessorCheckinManager({ turmaId }: ProfessorCheckinManagerProps) {
  const secureFetch = useSecureFetch();
  
  const [activeSession, setActiveSession] = useState<SessaoCheckin | null>(null);
  // Removido state de history para não duplicar com a página de frequência
  
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'MANUAL' | 'AUTO'>('MANUAL');
  const [showStopModal, setShowStopModal] = useState(false);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const checkActiveSession = useCallback(async () => {
    try {
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/checkin`);
      if (res.ok) {
        const data: SessaoCheckin[] = await res.json();
        
        // 1. Encontra a sessão ativa para mostrar o "Live"
        const now = new Date();
        const active = data.find(s => s.ativo && new Date(s.fechaEm) > now);
        
        setActiveSession(active || null);
      }
    } catch (error) {
      console.error('Erro ao verificar sessões', error);
    }
  }, [secureFetch, turmaId]);

  const activeSessionId = activeSession?.id;

  // Inicialização
  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  // Polling (Mantido para atualização em tempo real dos alunos entrando)
  useEffect(() => {
    if (activeSessionId) {
      pollingRef.current = setInterval(() => {
        checkActiveSession(); 
      }, 5000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeSessionId, checkActiveSession]);

  const handleStartSession = async () => {
    setLoading(true);
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/checkin`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken || '' },
        body: { presencaAutomatica: mode === 'AUTO', tempoMinutos: 10 }
      });

      if (res.ok) {
        const data = await res.json();
        if (mode === 'AUTO') {
          toast.success('Presença automática registrada!');
          checkActiveSession();
        } else {
          setActiveSession({ ...data.sessao, listaPresentes: [] });
          toast.success('Chamada aberta!');
        }
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao abrir chamada.');
      }
    } catch (error) {
      toast.error('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopClick = () => {
    setShowStopModal(true);
  };

  const confirmStopSession = async () => {
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/checkin`, {
        method: 'PATCH',
        headers: { 'x-csrf-token': csrfToken || '' },
      });

      if (res.ok) {
        toast.success('Chamada encerrada com sucesso.');
        setActiveSession(null);
        // Opcional: Recarregar a página para atualizar a lista de histórico abaixo
        window.location.reload(); 
      } else {
        toast.error('Erro ao encerrar chamada.');
      }
    } catch (error) {
      toast.error('Erro de conexão.');
    } finally {
      setShowStopModal(false);
    }
  };

  const copyCode = () => {
    if (activeSession) {
      navigator.clipboard.writeText(activeSession.codigo);
      toast.success('Código copiado!');
    }
  };

  return (
    <div className="space-y-8">
      
      {/* 1. SEÇÃO ATIVA (LIVE SESSION) */}
      {activeSession ? (
        <div className="bg-indigo-600 rounded-xl overflow-hidden shadow-lg animate-in fade-in zoom-in duration-300 flex flex-col md:flex-row h-[320px]">
          {/* LADO ESQUERDO */}
          <div className="w-full md:w-1/2 p-6 flex flex-col justify-between relative text-white border-b md:border-b-0 md:border-r border-indigo-500/30">
            <div className="absolute top-0 left-0 p-20 bg-white/5 rounded-full blur-3xl -ml-10 -mt-10 pointer-events-none"></div>

            <div className="flex justify-between items-start z-10">
              <div>
                <h3 className="text-indigo-100 font-semibold flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  Ao Vivo
                </h3>
                <p className="text-xs text-indigo-200 mt-1">
                  Até {new Date(activeSession.fechaEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
              
              <button 
                onClick={handleStopClick} 
                className="text-white/60 hover:text-white hover:bg-white/20 p-2 rounded-full transition-colors" 
                title="Encerrar Chamada"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center cursor-pointer group z-10" onClick={copyCode}>
              <div className="text-6xl font-mono font-bold tracking-widest drop-shadow-md group-hover:scale-105 transition-transform">
                  {activeSession.codigo}
              </div>
              <p className="text-indigo-300 text-xs mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Copy size={10} /> Clique para copiar
              </p>
            </div>

            <div className="text-center z-10">
              <span className="text-indigo-200 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin h-3 w-3" /> Atualizando em tempo real
              </span>
            </div>
          </div>

          {/* LADO DIREITO (Lista de alunos ao vivo) */}
          <div className="w-full md:w-1/2 bg-white/10 backdrop-blur-sm flex flex-col h-full">
              <div className="p-4 border-b border-indigo-500/30 flex justify-between items-center text-white">
                  <span className="font-bold flex items-center gap-2">
                      <Users size={16} /> Confirmados
                  </span>
                  <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {activeSession.listaPresentes?.length || 0}
                  </span>
              </div>
              
              <ScrollArea className="flex-1 p-0">
                  <ul className="divide-y divide-indigo-500/20">
                      {activeSession.listaPresentes?.map((aluno, i) => (
                          <li key={i} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors animate-in slide-in-from-right-2 duration-300">
                              <Avatar className="h-8 w-8 border border-white/20">
                                  <AvatarImage src={aluno.fotoUrl || undefined} />
                                  <AvatarFallback className="bg-indigo-800 text-xs text-white">
                                      {aluno.nome.substring(0,2).toUpperCase()}
                                  </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{aluno.nome}</p>
                                  <p className="text-[10px] text-indigo-200">
                                      {new Date(aluno.horario).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </p>
                              </div>
                          </li>
                      ))}
                  </ul>
              </ScrollArea>
          </div>
        </div>
      ) : (
        // CONFIGURAR NOVA CHAMADA
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <MapPin className="text-indigo-600" /> Nova Chamada
          </h3>

          <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setMode('MANUAL')}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-all flex justify-center items-center gap-2 ${mode === 'MANUAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <RefreshCw size={14} /> Código (Manual)
            </button>
            <button
              onClick={() => setMode('AUTO')}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-all flex justify-center items-center gap-2 ${mode === 'AUTO' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Zap size={14} /> Automática
            </button>
          </div>

          <div className="mb-4">
             {mode === 'MANUAL' ? (
                <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-100">
                  O código expira em 10 minutos.
                </p>
             ) : (
                <p className="text-xs text-gray-500 bg-emerald-50 p-3 rounded border border-emerald-100">
                  Presença imediata para todos os ativos.
                </p>
             )}
          </div>

          <button
            onClick={handleStartSession}
            disabled={loading}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all flex justify-center items-center gap-2
              ${mode === 'MANUAL' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}
              ${loading ? 'opacity-70 cursor-not-allowed' : ''}
            `}
          >
            {loading ? <Loader2 className="animate-spin" /> : (mode === 'MANUAL' ? 'Gerar Código' : 'Confirmar Presença')}
          </button>
        </div>
      )}

      {/* --- HISTÓRICO REMOVIDO DAQUI POIS ESTÁ NA PÁGINA PAI --- */}

      {/* MODAL DE CONFIRMAÇÃO DE ENCERRAMENTO */}
      <AlertDialog open={showStopModal} onOpenChange={setShowStopModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle /> Encerrar Chamada?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso invalidará o código <strong>{activeSession?.codigo}</strong> imediatamente.
              <br/>
              Alunos que ainda não registraram presença não conseguirão mais fazê-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStopSession} className="bg-red-600 hover:bg-red-700">
              Sim, encerrar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}