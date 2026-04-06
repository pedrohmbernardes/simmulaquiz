"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { 
  ChevronDown, ChevronRight, MoreVertical, 
  FileText, PenTool, ClipboardList, Plus, Loader2,
  Sparkles, Eye, Trash2
} from "lucide-react";

import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { NovoMaterialDialog } from "@/components/classroom/NovoMaterialDialog";
import { EditModuleDialog } from "@/components/classroom/EditModuleDialog";
import { EditarMaterialDialog } from "@/components/classroom/EditarMaterialDialog";
import { EditarTarefaDialog } from "@/components/classroom/EditarTarefaDialog"; // ✅ IMPORTADO
import { NovaTarefaDialog } from "@/components/classroom/NovaTarefaDialog";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

interface ModuleItemProps {
  modulo: {
    id: number;
    titulo: string;
    descricao?: string | null;
    publicado: boolean;
    itens: Array<{
      id: number;
      titulo: string;
      tipo: string;
      material?: any;
      agendamento?: any;
      tarefa?: any;
    }>;
  };
  turmaId: string;
  index?: number;
}

export function ModuleItem({ modulo, turmaId, index = 0 }: ModuleItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const router = useRouter();
  const secureFetch = useSecureFetch();

  async function handleDeleteModule() {
    if (!confirm("Tem certeza? Isso excluirá o módulo e desvinculará seus itens.")) return;
    
    setDeleting(true);
    try {
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/modulos/${modulo.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Falha ao excluir");

      toast.success("Módulo excluído com sucesso!");
      router.refresh();
    } catch (error) {
      toast.error("Erro ao excluir módulo.");
      setDeleting(false);
    }
  }

  async function handleDeleteItem(itemId: number) {
    if(!confirm("Remover este item do módulo?")) return;

    try {
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/modulos/${modulo.id}/itens/${itemId}`, {
        method: "DELETE"
      });
      
      if (!res.ok) throw new Error();
      toast.success("Item removido do módulo!");
      router.refresh();
    } catch {
      toast.error("Erro ao remover item.");
    }
  }

  const getItemIcon = (tipo: string) => {
    switch(tipo) {
      case 'MATERIAL': return FileText;
      case 'AGENDAMENTO_SIMULADO': return PenTool;
      case 'TAREFA': return ClipboardList;
      default: return FileText;
    }
  };

  const getItemColor = (tipo: string) => {
    switch(tipo) {
      case 'MATERIAL': return 'emerald';
      case 'AGENDAMENTO_SIMULADO': return 'pink';
      case 'TAREFA': return 'violet';
      default: return 'blue';
    }
  };

  return (
    <>
      <Collapsible 
        open={isOpen} 
        onOpenChange={setIsOpen}
        className="group"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <Card className={cn(
          "overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 bg-white/80 backdrop-blur-sm",
          deleting && "opacity-50 pointer-events-none"
        )}>
          
          {/* Header do Módulo */}
          <div className="relative">
            <div className={cn(
              "absolute top-0 left-0 right-0 h-1.5",
              modulo.publicado 
                ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                : "bg-gradient-to-r from-slate-300 to-gray-300"
            )} />
            
            <div className="flex items-center p-5 bg-gradient-to-r from-slate-50 to-blue-50/30 gap-3">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-xl hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition-all"
                >
                  {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </Button>
              </CollapsibleTrigger>
              
              <div className="flex-1 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold text-xl text-slate-900">
                    {modulo.titulo}
                  </h3>
                  {!modulo.publicado && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 border border-amber-200">
                      Rascunho
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-slate-500 border-slate-300">
                    {modulo.itens.length} {modulo.itens.length === 1 ? 'item' : 'itens'}
                  </Badge>
                </div>
                {modulo.descricao && (
                  <p className="text-sm text-slate-600 line-clamp-1 mt-1">{modulo.descricao}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                
                {/* Botões de Ação Rápida */}
                <div className="hidden lg:flex items-center gap-1">
                  <NovoMaterialDialog 
                    turmaId={turmaId}
                    moduloId={modulo.id}
                    trigger={
                      <Button size="sm" variant="ghost" className="gap-1.5 text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200">
                        <FileText size={14} />
                        Material
                      </Button>
                    }
                  />

                  <NovaTarefaDialog 
                    turmaId={turmaId}
                    moduloId={modulo.id}
                    trigger={
                      <Button size="sm" variant="ghost" className="gap-1.5 text-violet-600 hover:bg-violet-50 border border-transparent hover:border-violet-200">
                        <ClipboardList size={14} />
                        Tarefa
                      </Button>
                    }
                  />

                  <Button 
                    asChild 
                    size="sm" 
                    variant="ghost"
                    className="gap-1.5 text-pink-600 hover:bg-pink-50 border border-transparent hover:border-pink-200"
                  >
                    <Link href={`/professor/turmas/${turmaId}/simulados/novo?moduloId=${modulo.id}`}>
                      <PenTool size={14} />
                      Simulado
                    </Link>
                  </Button>
                </div>

                {/* Menu Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 rounded-xl hover:bg-slate-100 text-slate-600"
                    >
                      {deleting ? <Loader2 className="animate-spin h-5 w-5" /> : <MoreVertical size={20} />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-sm shadow-xl">
                    
                    {/* Mobile: Opções de Adicionar */}
                    <div className="lg:hidden">
                      <div className="px-2 py-1.5 text-xs font-bold text-slate-400 uppercase">Adicionar</div>
                      <NovoMaterialDialog 
                        turmaId={turmaId} 
                        moduloId={modulo.id} 
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                            <FileText size={16} className="mr-2 text-emerald-600" />
                            Material
                          </DropdownMenuItem>
                        }
                      />
                      <NovaTarefaDialog 
                        turmaId={turmaId} 
                        moduloId={modulo.id} 
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                            <ClipboardList size={16} className="mr-2 text-violet-600" />
                            Tarefa
                          </DropdownMenuItem>
                        }
                      />
                      <DropdownMenuItem asChild>
                        <Link href={`/professor/turmas/${turmaId}/simulados/novo?moduloId=${modulo.id}`}>
                          <PenTool size={16} className="mr-2 text-pink-600" />
                          Simulado
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </div>

                    <DropdownMenuItem 
                      onClick={() => setIsEditOpen(true)}
                      className="cursor-pointer text-slate-700 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Eye size={16} className="mr-2 text-blue-600" />
                      Editar Módulo
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                      onClick={handleDeleteModule}
                      className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 font-medium"
                    >
                      <Trash2 size={16} className="mr-2" />
                      Excluir Módulo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Conteúdo Collapsible */}
          <CollapsibleContent>
            <div className="p-4 space-y-2 bg-white">
              {modulo.itens.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-xl opacity-20 animate-pulse" />
                      <div className="relative p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl">
                        <Plus size={32} className="text-blue-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-600 font-medium mb-3">Este módulo ainda não tem conteúdo</p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        <NovaTarefaDialog 
                          turmaId={turmaId} 
                          moduloId={modulo.id}
                          trigger={
                            <Button variant="link" className="text-violet-600 hover:text-violet-700 p-0 h-auto">
                              Adicionar Tarefa
                            </Button>
                          }
                        />
                        <span className="text-slate-300">•</span>
                        <NovoMaterialDialog 
                          turmaId={turmaId} 
                          moduloId={modulo.id}
                          trigger={
                            <Button variant="link" className="text-emerald-600 hover:text-emerald-700 p-0 h-auto">
                              Adicionar Material
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                modulo.itens.map((item, itemIndex) => {
                  const Icon = getItemIcon(item.tipo);
                  const color = getItemColor(item.tipo);
                  
                  // TÍTULO PRIORITÁRIO
                  const tituloExibicao = item.material?.titulo || 
                                         item.tarefa?.titulo || 
                                         item.agendamento?.titulo || 
                                         item.titulo;

                  return (
                    <div 
                      key={item.id}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-xl group/item transition-all border-2 border-transparent hover:border-slate-200"
                      style={{ animationDelay: `${itemIndex * 50}ms` }}
                    >
                      <div className={cn(
                        "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover/item:scale-110",
                        color === 'emerald' && "bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600",
                        color === 'pink' && "bg-gradient-to-br from-pink-100 to-rose-100 text-pink-600",
                        color === 'violet' && "bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600"
                      )}>
                        <Icon size={20} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 group-hover/item:text-blue-700 transition-colors truncate">
                          {tituloExibicao}
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs border-slate-200 text-slate-500">
                          {item.tipo === 'AGENDAMENTO_SIMULADO' ? 'Simulado' : item.tipo === 'TAREFA' ? 'Tarefa' : 'Material'}
                        </Badge>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all hover:bg-slate-100"
                          >
                            <MoreVertical size={16} className="text-slate-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-white/95 backdrop-blur-sm shadow-xl">
                          
                          {/* OPÇÃO DE EDITAR MATERIAL */}
                          {item.tipo === 'MATERIAL' && item.material && (
                            <EditarMaterialDialog 
                              turmaId={Number(turmaId)} 
                              material={item.material}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                                  <Eye size={16} className="mr-2 text-emerald-600" />
                                  Editar Material
                                </DropdownMenuItem>
                              }
                            />
                          )}

                          {/* OPÇÃO DE EDITAR TAREFA - ✅ ADICIONADO */}
                          {item.tipo === 'TAREFA' && item.tarefa && (
                            <EditarTarefaDialog
                              turmaId={Number(turmaId)}
                              tarefa={item.tarefa}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                                  <Eye size={16} className="mr-2 text-violet-600" />
                                  Editar Tarefa
                                </DropdownMenuItem>
                              }
                            />
                          )}

                          {/* OPÇÃO DE EDITAR SIMULADO */}
                          {item.tipo === 'AGENDAMENTO_SIMULADO' && item.agendamento && (
                            <DropdownMenuItem asChild>
                              <Link href={`/professor/turmas/${turmaId}/simulados/${item.agendamento.id}/editar`}>
                                <Eye size={16} className="mr-2 text-pink-600" />
                                Editar Simulado
                              </Link>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 size={16} className="mr-2" />
                            Remover do Módulo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <EditModuleDialog 
        turmaId={turmaId}
        modulo={modulo}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  );
}