'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSecureFetch } from '@/lib/hooks/useSecureFetch';
import { 
  CheckCircle2, XCircle, Calendar, PieChart, Loader2, Clock, MapPin 
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { StudentCheckinModal } from './student-checkin-modal';

interface HistoricoItem {
  id: number;
  data: string;
  fechamento: string;
  tipo: 'AUTOMATICA' | 'PRESENCIAL';
  status: 'PRESENTE' | 'AUSENTE';
  realizadoEm: string | null;
}

interface ResumoPresenca {
  totalAulas: number;
  totalPresencas: number;
  totalFaltas: number;
  frequencia: number;
}

export function StudentAttendanceHistory({ turmaId }: { turmaId: number | string }) {
  const secureFetch = useSecureFetch();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ resumo: ResumoPresenca, historico: HistoricoItem[] } | null>(null);
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await secureFetch(`/api/estudante/turmas/${turmaId}/presenca`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Erro ao carregar frequência", error);
    } finally {
      setLoading(false);
    }
  }, [turmaId, secureFetch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCheckinSuccess = () => {
    setLoading(true);
    fetchHistory();
  };

  if (loading && !data) {
    return <div className="p-6 md:p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  }

  const resumo = data?.resumo || { totalAulas: 0, totalPresencas: 0, totalFaltas: 0, frequencia: 100 };
  const historico = data?.historico || [];
  
  const getProgressColor = (val: number) => {
    if (val >= 75) return "bg-emerald-500";
    if (val >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <>
      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="pb-3 md:pb-4 border-b bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-6 py-3 md:py-4">
          <CardTitle className="text-base md:text-lg flex items-center gap-2 text-slate-800">
            <PieChart className="h-4 w-4 md:h-5 md:w-5 text-indigo-600" />
            Meu Desempenho
          </CardTitle>
          
          <Button 
            onClick={() => setIsCheckinOpen(true)}
            size="sm" 
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-sm transition-all active:scale-95 text-xs md:text-sm h-9 md:h-auto"
          >
            <MapPin size={14} className="md:hidden" />
            <MapPin size={16} className="hidden md:block" />
            Registrar Presença
          </Button>
        </CardHeader>
        
        <CardContent className="pt-4 md:pt-6 px-4 md:px-6">
          {/* RESUMO */}
          <div className="mb-6 md:mb-8">
            <div className="flex justify-between items-end mb-1.5 md:mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-600">Frequência Geral</span>
              <span className={`text-xl md:text-2xl font-bold ${resumo.frequencia >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>
                {resumo.frequencia.toFixed(0)}%
              </span>
            </div>
            <Progress 
              value={resumo.frequencia} 
              className={`h-2.5 md:h-3 [&>*]:${getProgressColor(resumo.frequencia)} bg-slate-100`} 
            />
            <div className="flex justify-between mt-1.5 md:mt-2 text-[10px] md:text-xs font-medium text-slate-500">
              <span>{resumo.totalPresencas} presenças</span>
              <span>{resumo.totalFaltas} faltas</span>
            </div>
          </div>

          {/* LISTA HISTÓRICO */}
          <h4 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 md:mb-4 flex items-center gap-1.5 md:gap-2">
            <Calendar size={12} className="md:hidden" />
            <Calendar size={14} className="hidden md:block" />
            Histórico de Aulas
          </h4>
          
          {historico.length === 0 ? (
            <div className="text-center py-6 md:py-8 text-slate-400 border-2 border-dashed rounded-xl">
              <Calendar className="mx-auto h-6 w-6 md:h-8 md:w-8 mb-2 opacity-50" />
              <p className="text-xs md:text-sm">Nenhuma aula registrada ainda.</p>
            </div>
          ) : (
            <ScrollArea className="h-[320px] md:h-[400px] pr-2 md:pr-4">
              <div className="space-y-3 md:space-y-4">
                {historico.map((item) => {
                  const dataAbertura = new Date(item.data);
                  const dataFechamento = new Date(item.fechamento);
                  const dataRealizacao = item.realizadoEm ? new Date(item.realizadoEm) : null;

                  return (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 rounded-xl border bg-white hover:border-indigo-200 transition-colors shadow-sm gap-3 md:gap-4">
                      
                      {/* INFO DA AULA */}
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className={`mt-0.5 md:mt-1 p-1.5 md:p-2 rounded-full shrink-0 ${item.status === 'PRESENTE' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                          {item.status === 'PRESENTE' 
                            ? <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" /> 
                            : <XCircle className="h-4 w-4 md:h-5 md:w-5" />
                          }
                        </div>
                        
                        <div>
                          <p className="font-bold text-slate-800 text-xs md:text-sm capitalize">
                            {format(dataAbertura, "dd 'de' MMMM", { locale: ptBR })}
                          </p>
                          
                          <div className="flex flex-col gap-0.5 md:gap-1 mt-0.5 md:mt-1">
                            <span className="text-[10px] md:text-xs text-slate-500 flex items-center gap-1 md:gap-1.5">
                              <Clock size={10} className="text-indigo-400 md:hidden" />
                              <Clock size={12} className="text-indigo-400 hidden md:block" />
                              <span className="font-mono text-slate-700 bg-slate-100 px-1 rounded text-[10px] md:text-xs">
                                {format(dataAbertura, "HH:mm")}
                              </span>
                              às 
                              <span className="font-mono text-slate-700 bg-slate-100 px-1 rounded text-[10px] md:text-xs">
                                {format(dataFechamento, "HH:mm")}
                              </span>
                            </span>
                            
                            <span className="text-[9px] md:text-[10px] text-slate-400">
                              {item.tipo === 'AUTOMATICA' ? 'Chamada Automática' : 'Check-in via Código'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* STATUS */}
                      <div className="flex flex-col items-start sm:items-end gap-1 pl-9 sm:pl-0">
                        {item.status === 'PRESENTE' && dataRealizacao ? (
                          <div className="sm:text-right">
                            <span className="block text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-wide">Registrado às</span>
                            <span className="font-mono text-xs md:text-sm font-bold text-emerald-600 bg-emerald-50 px-1.5 md:px-2 py-0.5 md:py-1 rounded border border-emerald-100">
                              {format(dataRealizacao, "HH:mm:ss")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] md:text-xs font-bold text-red-500 bg-red-50 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-red-100">
                            FALTA
                          </span>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <StudentCheckinModal 
        turmaId={turmaId}
        isOpen={isCheckinOpen}
        onClose={() => setIsCheckinOpen(false)}
        onSuccess={handleCheckinSuccess}
      />
    </>
  );
}
