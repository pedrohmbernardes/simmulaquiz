"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  PenTool, Calendar, MoreVertical, 
  Lock, Users, Timer, Eye, Edit, PlayCircle
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Importe suas actions aqui. Certifique-se que o caminho está correto
import { DeletarSimuladoAction } from "./DeletarSimuladoAction";
import { EncerrarSimuladoAction } from "./EncerrarSimuladoAction";

function StatusBadge({ status, inicio, fim }: { status: string, inicio: Date, fim: Date }) {
  const now = new Date();
  const dataInicio = new Date(inicio);
  const dataFim = new Date(fim);
  
  if (status === 'CANCELADO') {
    return (
      <Badge variant="destructive" className="gap-1.5 px-3 py-1 shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Cancelado
      </Badge>
    );
  }

  if (status === 'ENCERRADO') {
    return (
      <Badge variant="secondary" className="bg-slate-200 text-slate-600 border-slate-300 gap-1.5 px-3 py-1">
        <Lock size={12} />
        Encerrado
      </Badge>
    );
  }
  
  if (now < dataInicio) {
    return (
      <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 gap-1.5 px-3 py-1 shadow-lg hover:shadow-xl transition-all">
        <Calendar size={12} />
        Agendado
      </Badge>
    );
  }
  
  if (now > dataFim) {
    return (
      <Badge variant="secondary" className="bg-slate-200 text-slate-600 border-slate-300 gap-1.5 px-3 py-1">
        <Lock size={12} />
        Encerrado
      </Badge>
    );
  }
  
  return (
    <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1.5 pl-2 pr-3 py-1 shadow-lg hover:shadow-xl transition-all">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
      </span>
      Em Andamento
    </Badge>
  );
}

export function SimuladoCard({
  agendamento,
  hasStarted,
  isClosed,
  isActive,
  isScheduled,
  turmaId,
  index
}: {
  agendamento: any;
  hasStarted: boolean;
  isClosed: boolean;
  isActive: boolean;
  isScheduled: boolean;
  turmaId: number;
  index: number;
}) {
  return (
    <Card 
      className="group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-sm hover:-translate-y-1"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="relative">
        {/* Status Indicator Bar */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-1.5",
          isActive && !isClosed ? "bg-gradient-to-r from-emerald-500 to-teal-500" :
          isClosed ? "bg-gradient-to-r from-slate-400 to-gray-400" :
          "bg-gradient-to-r from-blue-500 to-indigo-500"
        )} />
        
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Icon Section */}
            <div className="flex-shrink-0">
              <div className={cn(
                "h-16 w-16 rounded-2xl flex items-center justify-center border-2 shadow-lg transition-all duration-300",
                isClosed 
                  ? "bg-slate-100 border-slate-200 text-slate-400" 
                  : isActive
                  ? "bg-gradient-to-br from-emerald-500 to-teal-500 border-emerald-200 text-white group-hover:scale-110"
                  : "bg-gradient-to-br from-indigo-500 to-purple-500 border-indigo-200 text-white group-hover:scale-110"
              )}>
                {isClosed ? <Lock size={28} /> : <PenTool size={28} />}
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 min-w-0 space-y-4">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="flex items-start gap-3 flex-wrap">
                    <h3 className="font-bold text-xl text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {agendamento.titulo}
                    </h3>
                    <StatusBadge 
                      status={agendamento.status} 
                      inicio={agendamento.dataInicio} 
                      fim={agendamento.dataFim} 
                    />
                  </div>
                  
                  {/* Info Grid */}
                  <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <div className="p-1.5 bg-blue-50 rounded-lg">
                        <Calendar size={14} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Período</p>
                        <p className="font-semibold">
                          {format(new Date(agendamento.dataInicio), "dd/MM HH:mm", { locale: ptBR })} - {format(new Date(agendamento.dataFim), "HH:mm")}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-slate-600">
                      <div className="p-1.5 bg-purple-50 rounded-lg">
                        <Timer size={14} className="text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Duração</p>
                        <p className="font-semibold">{agendamento.duracaoMinutos} minutos</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "px-3 py-1.5 rounded-xl font-medium text-sm flex items-center gap-2 border",
                        hasStarted 
                          ? "bg-blue-50 text-blue-700 border-blue-200" 
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      )}>
                        <Users size={14} />
                        <span>{agendamento._count.entregas}</span>
                        <span className="text-xs opacity-70">
                          {hasStarted ? "iniciaram" : "alunos"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Actions Menu - AGORA FUNCIONA PORQUE É CLIENT COMPONENT */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                    >
                      <MoreVertical size={18} className="text-slate-600" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-sm border-slate-200 shadow-xl">
                    <DropdownMenuLabel className="text-slate-900 font-semibold">
                      Gerenciar Simulado
                    </DropdownMenuLabel>
                    
                    {/* Ver Relatório/Detalhes */}
                    <DropdownMenuItem asChild>
                      <Link 
                        href={`/professor/turmas/${turmaId}/simulados/${agendamento.id}/relatorio`} 
                        className="cursor-pointer flex items-center gap-2 text-slate-700 hover:text-indigo-700 hover:bg-indigo-50"
                      >
                        {hasStarted || isClosed ? (
                          <>
                            <Eye size={16} className="text-indigo-600" />
                            <span>Ver Relatório Completo</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle size={16} className="text-blue-600" />
                            <span>Ver Detalhes</span>
                          </>
                        )}
                      </Link>
                    </DropdownMenuItem>

                    {/* Editar */}
                    {!hasStarted && !isClosed && (
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/professor/turmas/${turmaId}/simulados/${agendamento.id}/editar`}
                          className="cursor-pointer flex items-center gap-2 text-slate-700 hover:text-purple-700 hover:bg-purple-50"
                        >
                          <Edit size={16} className="text-purple-600" />
                          <span>Editar Configurações</span>
                        </Link>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    
                    {/* Ações com preventDefault agora funcionam */}
                    <div className="flex flex-col gap-1 p-1">
                      {hasStarted && !isClosed ? (
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} asChild>
                            <EncerrarSimuladoAction simuladoId={agendamento.id} turmaId={turmaId} />
                        </DropdownMenuItem>
                      ) : !hasStarted ? (
                         <DropdownMenuItem onSelect={(e) => e.preventDefault()} asChild>
                            <DeletarSimuladoAction simuladoId={agendamento.id} turmaId={turmaId} />
                         </DropdownMenuItem>
                      ) : null}
                    </div>
                    
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Progress Indicator */}
              {hasStarted && !isClosed && (
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                  </div>
                  <p className="text-sm font-medium text-blue-900">
                    {agendamento._count.entregas} aluno(s) já iniciaram este simulado
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}