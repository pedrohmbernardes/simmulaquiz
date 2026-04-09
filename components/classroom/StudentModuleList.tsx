'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  CheckCircle, 
  Circle, 
  Clock, 
  PlayCircle, 
  FileCheck,
  ChevronDown,
  ChevronRight,
  Lock,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Interfaces alinhadas com o retorno da API
export interface TrilhaItem {
  id: number;
  tipo: 'MATERIAL' | 'TAREFA' | 'AGENDAMENTO_SIMULADO'; 
  titulo: string;
  status?: string; 
  nota?: number | null;
  recurso: any; 
  
  isAberto?: boolean;
  disponivelDe?: string;
  disponivelAte?: string;
  dataEntrega?: string;   
  temFeedback?: boolean;
}

export interface TrilhaModulo {
  id: number;
  titulo: string;
  descricao?: string;
  itens: TrilhaItem[];
}

interface StudentModuleListProps {
  turmaId: string | number;
  modulos: TrilhaModulo[];
  onViewMaterial: (material: any) => void;
}

export function StudentModuleList({ turmaId, modulos, onViewMaterial }: StudentModuleListProps) {
  const router = useRouter();
  
  const [openModules, setOpenModules] = useState<number[]>(
    modulos.length > 0 ? [modulos[0].id] : []
  );

  const toggleModule = (id: number) => {
    setOpenModules(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleItemClick = (item: TrilhaItem) => {
    if (item.tipo === 'MATERIAL') {
      onViewMaterial(item.recurso);
      return;
    }

    if (item.tipo === 'TAREFA') {
      router.push(`/estudante/turmas/${turmaId}/tarefas/${item.recurso.id}`);
      return;
    }

    if (item.tipo === 'AGENDAMENTO_SIMULADO') {
      const isLocked = !item.isAberto && item.status === 'PENDENTE';
      
      if (!isLocked) {
        router.push(`/estudante/turmas/${turmaId}/agendamentos/${item.recurso.id}/inicio`);
      }
    }
  };

  const getStatusIcon = (item: TrilhaItem) => {
    if (['CONCLUIDO', 'ENTREGUE', 'CORRIGIDO'].includes(item.status || '')) {
      return <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-500" />;
    }
    
    if (item.status === 'EM_ANDAMENTO') {
      return <Clock className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />;
    }
    
    if (item.tipo === 'AGENDAMENTO_SIMULADO' && !item.isAberto && item.status === 'PENDENTE') {
      return <Lock className="h-4 w-4 md:h-5 md:w-5 text-gray-300" />;
    }
    
    return <Circle className="h-4 w-4 md:h-5 md:w-5 text-gray-300" />;
  };

  const getTypeIcon = (tipo: string) => {
    switch (tipo) {
      case 'MATERIAL': return <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />;
      case 'TAREFA': return <FileCheck className="h-3.5 w-3.5 md:h-4 md:w-4" />;
      case 'AGENDAMENTO_SIMULADO': return <PlayCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />;
      default: return <Circle className="h-3.5 w-3.5 md:h-4 md:w-4" />;
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {modulos.map((modulo) => (
        <Collapsible
          key={modulo.id}
          open={openModules.includes(modulo.id)}
          onOpenChange={() => toggleModule(modulo.id)}
          className="border rounded-xl md:rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden"
        >
          {/* Cabeçalho do Módulo */}
          <div className="flex items-center justify-between p-3 md:p-4 bg-accent/20 hover:bg-accent/40 active:bg-accent/50 transition-colors">
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2.5 md:gap-3 cursor-pointer flex-1 min-w-0">
                <div className="p-1.5 md:p-2 bg-background rounded-full border shadow-sm shrink-0">
                  {openModules.includes(modulo.id) ? (
                    <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm md:text-lg leading-tight truncate">{modulo.titulo}</h3>
                    {/* Item count inline on mobile */}
                    <Badge variant="secondary" className="text-[9px] md:text-xs px-1.5 md:px-2 h-4 md:h-5 shrink-0 tabular-nums">
                      {modulo.itens.length}
                    </Badge>
                  </div>
                  {modulo.descricao && (
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-1 mt-0.5 md:mt-1">
                      {modulo.descricao}
                    </p>
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
          </div>

          {/* Lista de Itens */}
          <CollapsibleContent>
            <div className="p-3 md:p-4 pt-1.5 md:pt-2 space-y-1.5 md:space-y-2 bg-background/50">
              {modulo.itens.length === 0 ? (
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground p-3 md:p-4 bg-muted/30 rounded-md border border-dashed">
                  <AlertCircle className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                  <span>Nenhum conteúdo publicado neste módulo.</span>
                </div>
              ) : (
                modulo.itens.map((item) => {
                  const isLocked = item.tipo === 'AGENDAMENTO_SIMULADO' && !item.isAberto && item.status === 'PENDENTE';
                  
                  return (
                    <Card
                      key={`${item.tipo}-${item.id}`}
                      className={cn(
                        "relative flex items-center justify-between transition-all border-l-4 group overflow-hidden",
                        isLocked 
                          ? "opacity-75 bg-muted/50 cursor-not-allowed border-l-gray-300" 
                          : "hover:bg-accent/5 active:bg-accent/10 cursor-pointer border-l-transparent hover:border-l-primary hover:shadow-md"
                      )}
                      onClick={(e) => {
                          if (isLocked) {
                            e.preventDefault();
                            return;
                          }
                          handleItemClick(item);
                      }}
                    >
                      <div className="flex items-center gap-2.5 md:gap-4 p-2.5 md:p-3 flex-1 min-w-0">
                        {/* Ícone de Status */}
                        <div className="shrink-0 flex justify-center w-6 md:w-8">
                          {getStatusIcon(item)}
                        </div>
                        
                        {/* Info Principal */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
                             <Badge 
                               variant="outline" 
                               className="text-[8px] md:text-[10px] px-1 md:px-1.5 py-0 h-4 md:h-5 gap-0.5 md:gap-1 font-normal text-muted-foreground uppercase tracking-wider shrink-0"
                             >
                               {getTypeIcon(item.tipo)}
                               <span className="hidden sm:inline">{item.tipo === 'AGENDAMENTO_SIMULADO' ? 'SIMULADO' : item.tipo}</span>
                               <span className="sm:hidden">{item.tipo === 'AGENDAMENTO_SIMULADO' ? 'SIM' : item.tipo === 'MATERIAL' ? 'MAT' : 'TAR'}</span>
                             </Badge>
                             <span className={cn(
                               "font-medium truncate text-xs md:text-base",
                               isLocked && "text-muted-foreground"
                             )}>
                               {item.titulo}
                             </span>
                          </div>
                          
                          {/* Metadados (Prazos/Notas) */}
                          <div className="text-[10px] md:text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 md:gap-x-4 gap-y-0.5 md:gap-y-1 pl-0.5 md:pl-1">
                            {item.tipo === 'AGENDAMENTO_SIMULADO' && item.disponivelAte && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                {item.status === 'PENDENTE' ? 'Fecha' : 'Fechou'}: {format(new Date(item.disponivelAte), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                            )}
                            
                            {item.tipo === 'TAREFA' && item.dataEntrega && item.status === 'PENDENTE' && (
                              <span className="flex items-center gap-1 text-orange-600 font-medium">
                                <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                Entrega: {format(new Date(item.dataEntrega), "dd/MM", { locale: ptBR })}
                              </span>
                            )}

                            {item.nota !== undefined && item.nota !== null && (
                              <Badge variant="secondary" className={cn("h-4 md:h-5 text-[8px] md:text-[10px] px-1.5 md:px-2", 
                                (item.tipo === 'AGENDAMENTO_SIMULADO' ? item.nota >= 70 : item.nota >= 6) 
                                  ? "text-green-700 bg-green-100 border-green-200" 
                                  : "text-orange-700 bg-orange-100 border-orange-200"
                              )}>
                                {item.tipo === 'AGENDAMENTO_SIMULADO' ? `${item.nota.toFixed(0)}%` : `Nota: ${item.nota}`}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação (Desktop) */}
                      <div className="hidden sm:flex items-center pr-4 pl-2 gap-2">
                          {item.tipo === 'MATERIAL' && (
                            <Button variant="ghost" size="sm" className="h-8 text-xs">
                              Visualizar
                            </Button>
                          )}
                          {item.tipo === 'TAREFA' && item.status === 'PENDENTE' && (
                             <Button size="sm" variant="outline" className="h-8 text-xs gap-2">
                               <FileCheck className="h-3 w-3" /> Enviar
                             </Button>
                          )}
                          {item.tipo === 'AGENDAMENTO_SIMULADO' && !isLocked && item.status === 'PENDENTE' && (
                             <Button size="sm" className="h-8 text-xs gap-2">
                               <PlayCircle className="h-3 w-3" /> Iniciar
                             </Button>
                          )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
