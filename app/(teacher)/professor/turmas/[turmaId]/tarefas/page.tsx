import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  Calendar, Users, CheckCircle2, Inbox,
  ClipboardList, ArrowRight, Eye, Sparkles, ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { NovaTarefaDialog } from "@/components/classroom/NovaTarefaDialog";
import { DeletarTarefaButton } from "@/components/classroom/DeletarTarefaButton";
import { EditarTarefaDialog } from "@/components/classroom/EditarTarefaDialog";

interface PageProps {
  params: Promise<{ turmaId: string }>;
}

export default async function TarefasPage({ params }: PageProps) {
  const { turmaId } = await params;
  const session = await getSession();

  // 1. Segurança e Sessão Flexível (Permite Professor e Super Admin)
  if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }
  
  const turmaIdInt = parseInt(turmaId);
  const isSuperAdmin = session.role === "SUPER_ADMIN";

  // 2. Validação de Acesso (Dinâmica)
  let temAcesso = isSuperAdmin;

  if (!isSuperAdmin) {
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: parseInt(session.sub)
        }
      }
    });
    temAcesso = !!isOwner;
  }

  if (!temAcesso) redirect("/professor/dashboard");

  // Busca Tarefas com contagem de entregas
  const tarefas = await prisma.tarefa.findMany({
    where: { turmaId: turmaIdInt },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { entregas: true }
      }
    }
  });

  // Estatísticas
  const now = new Date();
  const stats = {
    total: tarefas.length,
    ativas: tarefas.filter(t => !t.dataEntrega || new Date(t.dataEntrega) > now).length,
    expiradas: tarefas.filter(t => t.dataEntrega && new Date(t.dataEntrega) < now).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20">
      <div className="max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700">
        
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 md:p-10 shadow-2xl">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-fuchsia-300 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10 space-y-4">
            <Button
              asChild
              variant="ghost"
              className="text-white hover:bg-white/20 -ml-2"
            >
              <Link href={`/professor/turmas/${turmaId}`}>
                <ArrowLeft size={18} className="mr-2" />
                Voltar para Turma
              </Link>
            </Button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <ClipboardList className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    Atividades
                  </Badge>
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                    Tarefas e Trabalhos
                  </h1>
                  <p className="text-violet-100 text-base md:text-lg mt-2">
                    Gerencie atividades que exigem envio de arquivo ou texto
                  </p>
                </div>
              </div>
              
              <NovaTarefaDialog turmaId={turmaIdInt} />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-violet-100 text-xs font-medium mb-1">Total</p>
                <p className="text-white text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-violet-100 text-xs font-medium mb-1">Ativas</p>
                <p className="text-white text-2xl font-bold">{stats.ativas}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-violet-100 text-xs font-medium mb-1">Expiradas</p>
                <p className="text-white text-2xl font-bold">{stats.expiradas}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Tarefas */}
        <div className="space-y-4">
          {tarefas.length === 0 ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="py-20">
                <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                  {/* Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                    <div className="relative p-6 bg-gradient-to-br from-violet-100 to-purple-100 rounded-3xl">
                      <Inbox className="h-16 w-16 text-violet-600" />
                    </div>
                  </div>
                  
                  {/* Text */}
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-slate-900">
                      Nenhuma tarefa criada
                    </h3>
                    <p className="text-slate-600 text-base leading-relaxed">
                      Crie a primeira tarefa para seus alunos enviarem trabalhos e atividades avaliativas.
                    </p>
                  </div>
                  
                  {/* CTA Button */}
                  <NovaTarefaDialog 
                    turmaId={turmaIdInt} 
                    trigger={
                      <Button 
                        size="lg"
                        className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all px-8 py-6"
                      >
                        <Sparkles size={20} />
                        Criar Primeira Tarefa
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            tarefas.map((tarefa, index) => {
              const isExpired = tarefa.dataEntrega && new Date(tarefa.dataEntrega) < new Date();
              
              return (
                <Card 
                  key={tarefa.id}
                  className="group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-sm hover:-translate-y-1"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="relative">
                    {/* Status Indicator Bar */}
                    <div className={cn(
                      "absolute top-0 left-0 right-0 h-1.5",
                      isExpired 
                        ? "bg-gradient-to-r from-slate-400 to-gray-400" 
                        : "bg-gradient-to-r from-violet-500 to-purple-500"
                    )} />
                    
                    <CardContent className="p-6 md:p-8">
                      <div className="flex flex-col md:flex-row gap-6">
                        
                        {/* Icon Section */}
                        <div className="flex-shrink-0">
                          <div className={cn(
                            "h-16 w-16 rounded-2xl flex items-center justify-center border-2 shadow-lg transition-all duration-300 group-hover:scale-110",
                            isExpired 
                              ? "bg-slate-100 border-slate-200 text-slate-400" 
                              : "bg-gradient-to-br from-violet-500 to-purple-500 border-white text-white"
                          )}>
                            <ClipboardList size={28} />
                          </div>
                        </div>

                        {/* Content Section */}
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-xl text-slate-900 group-hover:text-violet-700 transition-colors line-clamp-2">
                                {tarefa.titulo}
                              </h3>
                              <p className="text-sm text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                                {tarefa.descricao || "Sem instruções adicionais."}
                              </p>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <EditarTarefaDialog 
                                turmaId={turmaIdInt}
                                tarefa={tarefa}
                              />
                              
                              <DeletarTarefaButton 
                                turmaId={turmaIdInt} 
                                tarefaId={tarefa.id} 
                                titulo={tarefa.titulo} 
                              />
                            </div>
                          </div>

                          {/* Metadata */}
                          <div className="flex flex-wrap items-center gap-4 pt-2">
                            <div className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-sm border",
                              isExpired 
                                ? "bg-red-50 text-red-700 border-red-200" 
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}>
                              <Calendar size={14} />
                              {tarefa.dataEntrega 
                                ? `${format(new Date(tarefa.dataEntrega), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
                                : "Sem prazo"
                              }
                            </div>
                            
                            <Badge className="gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200">
                              <Users size={14} />
                              {tarefa._count.entregas} entregas
                            </Badge>

                            {tarefa.notaMaxima && (
                              <Badge className="gap-1.5 px-3 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200">
                                <CheckCircle2 size={14} />
                                {tarefa.notaMaxima} pts
                              </Badge>
                            )}

                            <Button 
                              asChild 
                              size="sm"
                              className="ml-auto gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all font-semibold"
                            >
                              <Link href={`/professor/turmas/${turmaId}/tarefas/${tarefa.id}/entregas`}>
                                <Eye size={14} />
                                Ver Entregas
                                <ArrowRight size={14} />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}