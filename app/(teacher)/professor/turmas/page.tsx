import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { 
  GraduationCap, 
  MoreVertical, 
  Users, 
  BookOpen
} from "lucide-react";
import { CreateTurmaButton } from "@/components/turmas/CreateTurmaButton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ProfessorTurmasPage() {
  const session = await getSession();

  // 1. RBAC Flexível: Permite Professor e Super Admin
  if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const usuarioId = parseInt(session.sub);
  const isSuperAdmin = session.role === "SUPER_ADMIN";

  // 2. Query Dinâmica (Visão Global para Admin)
  const turmas = await prisma.turma.findMany({
    where: isSuperAdmin 
      ? { ativo: true } // Super Admin vê todas as turmas ativas do sistema
      : {
          professores: {
            some: { professorId: usuarioId }
          },
          ativo: true
        },
    include: {
      _count: {
        select: {
          alunos: { where: { status: "ATIVO" } },
          agendamentos: true,
          tarefas: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Cabeçalho Otimizado */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              {isSuperAdmin ? "Todas as Turmas" : "Minhas Turmas"}
            </h1>
            <p className="text-slate-600">
              Gerencie {turmas.length} {turmas.length === 1 ? 'turma ativa' : 'turmas ativas'}
            </p>
          </div>
          
          <CreateTurmaButton />
        </div>

        {/* Listagem */}
        {turmas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
            <div className="relative">
              {/* Efeito de fundo */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-2xl opacity-10 animate-pulse" />
              
              <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl shadow-sm mb-6 border border-blue-100">
                <GraduationCap className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Nenhuma turma encontrada
            </h3>
            <p className="text-slate-500 text-sm max-w-md text-center mb-8">
              Comece criando sua primeira turma para adicionar alunos, organizar conteúdos e agendar atividades.
            </p>
            <CreateTurmaButton />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {turmas.map((turma) => (
              <Card 
                key={turma.id} 
                className="group relative flex flex-col overflow-hidden border-slate-200/60 bg-white/80 backdrop-blur-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Barra de cor superior */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                
                <CardHeader className="pb-4 pt-6">
                  <div className="flex justify-between items-start mb-3">
                    <Badge 
                      variant="outline" 
                      className="font-mono text-xs border-slate-300 bg-slate-50 text-slate-700 px-3 py-1"
                    >
                      {turma.codigo}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <MoreVertical size={16} />
                    </Button>
                  </div>
                  
                  <CardTitle className="text-xl font-bold line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {turma.nome}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-slate-600 min-h-[40px] mt-1">
                    {turma.descricao || "Sem descrição definida."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pb-5 flex-1">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Alunos */}
                    <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-100 px-3 py-2.5 rounded-lg">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                        <Users size={16} className="text-blue-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-blue-600 font-medium">Alunos</span>
                        <span className="text-lg font-bold text-blue-700">{turma._count.alunos}</span>
                      </div>
                    </div>

                    {/* Atividades */}
                    <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-100 px-3 py-2.5 rounded-lg">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                        <BookOpen size={16} className="text-emerald-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-emerald-600 font-medium">Atividades</span>
                        <span className="text-lg font-bold text-emerald-700">
                          {turma._count.agendamentos + turma._count.tarefas}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-0 pb-4 px-6">
                  <Button 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300" 
                    asChild
                  >
                    <Link href={`/professor/turmas/${turma.id}`}>
                      Gerenciar Turma
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}