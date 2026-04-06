import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, FileText, Clock, 
  CheckCircle2, AlertCircle, Calendar, 
  History, PenTool, Users, Eye, Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { CorrigirEntregaDialog } from "@/components/classroom/CorrigirEntregaDialog";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface PageProps {
  params: Promise<{ turmaId: string; tarefaId: string }>;
}

export default async function EntregasPage({ params }: PageProps) {
  const { turmaId, tarefaId } = await params;
  const session = await getSession();

  if (!session || session.role !== "PROFESSOR") redirect("/login");

  const turmaIdInt = parseInt(turmaId);
  const tarefaIdInt = parseInt(tarefaId);

  // 1. Validação de Acesso
  const isOwner = await prisma.turmaProfessor.findUnique({
    where: {
      turmaId_professorId: {
        turmaId: turmaIdInt,
        professorId: parseInt(session.sub),
      },
    },
  });

  if (!isOwner) redirect("/professor/dashboard");

  // 2. Busca Dados
  const tarefa = await prisma.tarefa.findUnique({
    where: { id: tarefaIdInt, turmaId: turmaIdInt },
  });

  if (!tarefa) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <AlertCircle size={48} className="mb-4 opacity-20" />
        <h2 className="text-xl font-semibold">Tarefa não encontrada</h2>
        <Button variant="link" asChild className="mt-4">
          <Link href={`/professor/turmas/${turmaId}/tarefas`}>Voltar para Tarefas</Link>
        </Button>
      </div>
    );
  }

  const alunosMatriculados = await prisma.turmaAluno.findMany({
    where: { turmaId: turmaIdInt, status: "ATIVO" },
    include: { aluno: true },
    orderBy: { aluno: { nome: "asc" } },
  });

  const entregas = await prisma.entregaTarefa.findMany({
    where: { tarefaId: tarefaIdInt },
    include: { arquivos: true },
  });

  // 3. Processamento
  const listaCompleta = alunosMatriculados.map((matricula) => {
    const entrega = entregas.find((e) => e.alunoId === matricula.alunoId);
    
    let status = "PENDENTE";
    if (entrega) {
      status = entrega.status;
    } else {
      if (tarefa.dataEntrega && new Date() > tarefa.dataEntrega) {
        status = "ATRASADO_NAO_ENTREGUE";
      }
    }

    return {
      aluno: matricula.aluno,
      entrega,
      status,
    };
  });

  const aCorrigir = listaCompleta.filter(item => 
    item.status === "ENTREGUE" || item.status === "PENDENTE" || item.status === "ATRASADO_NAO_ENTREGUE"
  );
  
  const historico = listaCompleta.filter(item => 
    item.status === "CORRIGIDO"
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20">
      <div className="max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700">
        
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 md:p-10 shadow-2xl">
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
              <Link href={`/professor/turmas/${turmaId}/tarefas`}>
                <ArrowLeft size={18} className="mr-2" />
                Voltar para Tarefas
              </Link>
            </Button>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                  Correção
                </Badge>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                  {tarefa.titulo}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-violet-100">
                  {tarefa.dataEntrega && (
                    <span className="flex items-center gap-2">
                      <Calendar size={16} />
                      Prazo: {format(tarefa.dataEntrega, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Valor: {tarefa.notaMaxima} pts
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-violet-100 text-xs font-medium mb-1">Entregas</p>
                <p className="text-white text-2xl font-bold">{entregas.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-violet-100 text-xs font-medium mb-1">Corrigidas</p>
                <p className="text-white text-2xl font-bold">{historico.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pendentes" className="w-full">
          <TabsList className="grid w-full max-w-[500px] grid-cols-2 mb-6 h-12 bg-white/80 backdrop-blur-sm shadow-lg">
            <TabsTrigger value="pendentes" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              A Corrigir / Pendentes
            </TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* ABA: PENDENTES */}
          <TabsContent value="pendentes" className="space-y-4">
            {aCorrigir.length === 0 ? (
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardContent className="py-16 text-center">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                      <div className="relative p-6 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl">
                        <CheckCircle2 className="h-16 w-16 text-emerald-600" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Tudo em dia!</h3>
                      <p className="text-slate-600 mt-2">Nenhuma entrega pendente de correção.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {aCorrigir.map(({ aluno, entrega, status }, index) => (
                  <Card 
                    key={aluno.id}
                    className={cn(
                      "overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 bg-white/80 backdrop-blur-sm",
                      status === 'ENTREGUE' && "ring-2 ring-emerald-200"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="relative">
                      <div className={cn(
                        "absolute top-0 left-0 right-0 h-1",
                        status === 'ENTREGUE' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-slate-200'
                      )} />
                      
                      <CardHeader className="pb-3 pt-4 px-4 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
                            <AvatarImage src={aluno.fotoUrl || ""} />
                            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-500 text-white font-bold">
                              {getInitials(aluno.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 overflow-hidden">
                            <CardTitle className="text-sm font-bold truncate" title={aluno.nome}>
                              {aluno.nome}
                            </CardTitle>
                            <p className="text-xs text-slate-500 truncate">{aluno.email}</p>
                          </div>
                          {status === 'ENTREGUE' && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">
                              Entregue
                            </Badge>
                          )}
                          {status === 'PENDENTE' && (
                            <Badge variant="outline" className="text-slate-400 border-slate-200">
                              Pendente
                            </Badge>
                          )}
                          {status === 'ATRASADO_NAO_ENTREGUE' && (
                            <Badge variant="destructive">
                              Atrasado
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-4 space-y-3">
                        {entrega ? (
                          <>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock size={12} /> 
                                {entrega.entregueEm ? format(entrega.entregueEm, "dd/MM HH:mm") : "-"}
                              </span>
                              {entrega.arquivos.length > 0 && (
                                <span className="flex items-center gap-1 text-violet-600 font-semibold">
                                  <FileText size={12} /> {entrega.arquivos.length} arquivo(s)
                                </span>
                              )}
                            </div>
                            
                            {entrega.textoResposta && (
                              <div className="bg-slate-50 p-3 rounded-lg border text-xs italic text-slate-700 line-clamp-2">
                                "{entrega.textoResposta}"
                              </div>
                            )}

                            <CorrigirEntregaDialog
                              turmaId={turmaIdInt}
                              tarefaId={tarefaIdInt}
                              entrega={{
                                id: entrega.id,
                                nota: entrega.nota,
                                feedback: entrega.feedback
                              }}
                              notaMaxima={tarefa.notaMaxima}
                              alunoNome={aluno.nome}
                              trigger={
                                <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md" size="sm">
                                  <PenTool size={14} className="mr-2" />
                                  Corrigir Entrega
                                </Button>
                              }
                            />
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                            <Clock size={32} className="opacity-20 mb-2" />
                            <span className="text-xs">Aluno ainda não enviou</span>
                          </div>
                        )}
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ABA: HISTÓRICO */}
          <TabsContent value="historico">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <History size={20} className="text-violet-600" />
                  Entregas Corrigidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-500">Nenhuma tarefa corrigida ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historico.map(({ aluno, entrega }) => (
                      <div key={aluno.id} className="flex items-center justify-between p-4 border-2 border-slate-100 rounded-xl hover:border-violet-200 hover:bg-violet-50/30 transition-all">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-white shadow">
                            <AvatarImage src={aluno.fotoUrl || ""} />
                            <AvatarFallback className="bg-gradient-to-br from-violet-100 to-purple-100 text-violet-700 font-semibold text-sm">
                              {getInitials(aluno.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-slate-900">{aluno.nome}</p>
                            <p className="text-xs text-slate-500">
                              Corrigido em: {entrega?.corrigidoEm ? format(entrega.corrigidoEm, "dd/MM/yyyy") : "-"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase font-bold">Nota</p>
                            <p className="font-bold text-violet-700 text-xl">
                              {entrega?.nota} <span className="text-slate-400 text-sm font-normal">/ {tarefa.notaMaxima}</span>
                            </p>
                          </div>
                          
                          {entrega && (
                            <CorrigirEntregaDialog
                              turmaId={turmaIdInt}
                              tarefaId={tarefaIdInt}
                              entrega={{
                                id: entrega.id,
                                nota: entrega.nota,
                                feedback: entrega.feedback
                              }}
                              notaMaxima={tarefa.notaMaxima}
                              alunoNome={aluno.nome}
                              trigger={
                                <Button variant="outline" size="sm" className="border-violet-200 hover:bg-violet-50">
                                  <PenTool size={14} className="mr-2" />
                                  Editar Nota
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
