import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, FileText, Clock, 
  CheckCircle2, AlertCircle, Calendar, 
  History, PenTool
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

// ✅ Importamos o componente que você acabou de criar
import { CorrigirEntregaDialog } from "@/components/classroom/CorrigirEntregaDialog";

// Utilitário para iniciais
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

  // 2. Busca Dados (Tarefa + Alunos + Entregas)
  const tarefa = await prisma.tarefa.findUnique({
    where: { id: tarefaIdInt, turmaId: turmaIdInt },
  });

  if (!tarefa) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <AlertCircle size={48} className="mb-4 opacity-20" />
        <h2 className="text-xl font-semibold">Tarefa não encontrada</h2>
        <Button variant="link" asChild className="mt-4">
          <Link href={`/professor/turmas/${turmaId}/conteudo`}>Voltar para o Conteúdo</Link>
        </Button>
      </div>
    );
  }

  // Buscamos todos os alunos ATIVOS da turma
  const alunosMatriculados = await prisma.turmaAluno.findMany({
    where: { turmaId: turmaIdInt, status: "ATIVO" },
    include: { aluno: true },
    orderBy: { aluno: { nome: "asc" } },
  });

  // Buscamos todas as entregas existentes para essa tarefa
  const entregas = await prisma.entregaTarefa.findMany({
    where: { tarefaId: tarefaIdInt },
    include: { arquivos: true },
  });

  // 3. Processamento de Dados (Merge Alunos + Entregas)
  const listaCompleta = alunosMatriculados.map((matricula) => {
    const entrega = entregas.find((e) => e.alunoId === matricula.alunoId);
    
    // Status calculado
    let status = "PENDENTE";
    if (entrega) {
      status = entrega.status; // ENTREGUE, CORRIGIDO, etc.
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
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link 
          href={`/professor/turmas/${turmaId}/tarefas`} 
          className="flex items-center text-sm text-slate-500 hover:text-indigo-600 transition-colors w-fit"
        >
          <ArrowLeft size={16} className="mr-1" /> Voltar para Tarefas
        </Link>

        <div className="flex justify-between items-start border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{tarefa.titulo}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              {tarefa.dataEntrega && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  Prazo: {format(tarefa.dataEntrega, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CheckCircle2 size={14} />
                Valor: {tarefa.notaMaxima} pts
              </span>
            </div>
          </div>
          
          <div className="flex gap-3">
             <div className="flex gap-2">
                <Badge variant="outline" className="h-9 px-4 text-sm font-normal bg-indigo-50 border-indigo-100 text-indigo-700">
                    {entregas.length} entregas realizadas
                </Badge>
                <Badge variant="outline" className="h-9 px-4 text-sm font-normal bg-emerald-50 border-emerald-100 text-emerald-700">
                    {historico.length} corrigidas
                </Badge>
             </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal: Abas */}
      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="pendentes">A Corrigir / Pendentes</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Correções</TabsTrigger>
        </TabsList>

        {/* ABA: PENDENTES / A CORRIGIR */}
        <TabsContent value="pendentes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {aCorrigir.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed rounded-xl">
                    <CheckCircle2 size={48} className="mx-auto mb-3 opacity-20" />
                    <p>Tudo em dia! Nenhuma entrega pendente de correção.</p>
                </div>
            ) : (
                aCorrigir.map(({ aluno, entrega, status }) => (
                <Card key={aluno.id} className={`overflow-hidden transition-all hover:shadow-md border-l-4 
                    ${status === 'ENTREGUE' ? 'border-l-emerald-500' : 'border-l-slate-200'}
                `}>
                    <CardHeader className="flex flex-row items-center gap-3 pb-3 pt-4 px-4 bg-slate-50/50">
                    <Avatar className="h-10 w-10 border border-white shadow-sm">
                        <AvatarImage src={aluno.fotoUrl || ""} />
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold">
                        {getInitials(aluno.nome)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                        <CardTitle className="text-sm font-semibold truncate" title={aluno.nome}>
                        {aluno.nome}
                        </CardTitle>
                        <p className="text-xs text-slate-500 truncate">{aluno.email}</p>
                    </div>
                    {status === 'ENTREGUE' && (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
                            Entregue
                        </Badge>
                    )}
                    {status === 'PENDENTE' && (
                        <Badge variant="outline" className="text-slate-400 border-slate-200">
                            Pendente
                        </Badge>
                    )}
                    {status === 'ATRASADO_NAO_ENTREGUE' && (
                        <Badge variant="destructive" className="opacity-80">
                            Atrasado
                        </Badge>
                    )}
                    </CardHeader>
                    
                    <CardContent className="p-4 text-sm space-y-3">
                    {entrega ? (
                        <>
                        <div className="flex items-center justify-between text-slate-500 text-xs">
                            <span className="flex items-center gap-1">
                                <Clock size={12} /> 
                                {entrega.entregueEm ? format(entrega.entregueEm, "dd/MM HH:mm") : "-"}
                            </span>
                            {entrega.arquivos.length > 0 && (
                                <span className="flex items-center gap-1 text-indigo-600 font-medium">
                                    <FileText size={12} /> {entrega.arquivos.length} arquivo(s)
                                </span>
                            )}
                        </div>
                        
                        {entrega.textoResposta && (
                            <div className="bg-slate-50 p-2 rounded-md border border-slate-100 italic text-slate-600 line-clamp-2">
                                "{entrega.textoResposta}"
                            </div>
                        )}

                        {/* ✅ Botão Conectado ao Dialog de Correção */}
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
                            <Button className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700" size="sm">
                                <PenTool size={14} className="mr-2" />
                                Corrigir Entrega
                            </Button>
                          }
                        />
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-4 text-slate-400 gap-1">
                            <Clock size={24} className="opacity-20" />
                            <span className="text-xs">Aluno ainda não enviou.</span>
                        </div>
                    )}
                    </CardContent>
                </Card>
                ))
            )}
          </div>
        </TabsContent>

        {/* ABA: HISTÓRICO / CORRIGIDOS */}
        <TabsContent value="historico">
          <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <History size={18} className="text-slate-500" />
                    Entregas Corrigidas
                </CardTitle>
            </CardHeader>
            <CardContent>
                {historico.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                        Nenhuma tarefa corrigida ainda.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {historico.map(({ aluno, entrega }) => (
                            <div key={aluno.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback className="bg-slate-200 text-slate-600 text-xs">
                                            {getInitials(aluno.nome)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium text-sm text-slate-900">{aluno.nome}</p>
                                        <p className="text-xs text-slate-500">
                                            Corrigido em: {entrega?.corrigidoEm ? format(entrega.corrigidoEm, "dd/MM/yyyy") : "-"}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 uppercase font-semibold">Nota</p>
                                        <p className="font-bold text-indigo-700 text-lg">
                                            {entrega?.nota} <span className="text-slate-400 text-xs font-normal">/ {tarefa.notaMaxima}</span>
                                        </p>
                                    </div>
                                    
                                    {/* ✅ Permitir re-correção no histórico também */}
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
                                          <Button variant="outline" size="sm">
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
  );
}