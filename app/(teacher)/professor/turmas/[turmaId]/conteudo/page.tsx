import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  ArrowLeft, FolderOpen, Layers
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Importação dos novos componentes de Módulo
import { CreateModuleModal } from "@/components/classroom/CreateModuleModal";
import { ModuleItem } from "@/components/classroom/ModuleItem";

interface PageProps {
  params: Promise<{ turmaId: string }>;
}

export default async function ConteudoPage({ params }: PageProps) {
  const { turmaId } = await params;
  const session = await getSession();

  // 1. Segurança e Sessão
  if (!session || session.role !== "PROFESSOR") redirect("/login");
  const turmaIdInt = parseInt(turmaId);

  if (isNaN(turmaIdInt)) redirect("/professor/dashboard");

  // 2. Validação de Propriedade
  const isOwner = await prisma.turmaProfessor.findUnique({
    where: {
      turmaId_professorId: {
        turmaId: turmaIdInt,
        professorId: parseInt(session.sub)
      }
    }
  });

  if (!isOwner) redirect("/professor/dashboard");

  // 3. Busca Módulos e Itens (Eager Loading)
  const modulos = await prisma.moduloTurma.findMany({
    where: { turmaId: turmaIdInt },
    orderBy: { ordem: "asc" },
    include: {
      itens: {
        orderBy: { ordem: "asc" },
        include: {
          material: true,
          agendamento: { select: { id: true, titulo: true, status: true, dataFim: true } },
          tarefa: { select: { id: true, titulo: true, dataEntrega: true } }
        }
      }
    }
  });

  // 4. Estatísticas
  const stats = {
    totalModulos: modulos.length,
    totalItens: modulos.reduce((acc, m) => acc + m.itens.length, 0),
    modulosPublicados: modulos.filter(m => m.publicado).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700">
        
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 md:p-10 shadow-2xl">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-purple-300 rounded-full blur-3xl"></div>
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
                    <Layers className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    Estrutura
                  </Badge>
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                    Conteúdo & Módulos
                  </h1>
                  <p className="text-blue-100 text-base md:text-lg mt-2">
                    Organize a trilha de aprendizagem em módulos, aulas e avaliações
                  </p>
                </div>
              </div>
              
              <CreateModuleModal turmaId={turmaId} />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-blue-100 text-xs font-medium mb-1">Total Módulos</p>
                <p className="text-white text-2xl font-bold">{stats.totalModulos}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-blue-100 text-xs font-medium mb-1">Publicados</p>
                <p className="text-white text-2xl font-bold">{stats.modulosPublicados}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-blue-100 text-xs font-medium mb-1">Total Itens</p>
                <p className="text-white text-2xl font-bold">{stats.totalItens}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Módulos */}
        <div className="space-y-6">
          {modulos.length === 0 ? (
            // Empty State
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="py-20">
                <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                  {/* Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                    <div className="relative p-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl">
                      <FolderOpen className="h-16 w-16 text-blue-600" />
                    </div>
                  </div>
                  
                  {/* Text */}
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-slate-900">
                      Nenhum módulo criado
                    </h3>
                    <p className="text-slate-600 text-base leading-relaxed">
                      Comece criando o primeiro módulo (ex: "Módulo 1: Introdução") 
                      para organizar seus materiais, tarefas e simulados.
                    </p>
                  </div>
                  
                  {/* CTA Button */}
                  <CreateModuleModal turmaId={turmaId} variant="cta" />
                </div>
              </CardContent>
            </Card>
          ) : (
            // Lista Real
            <div className="space-y-4">
              {modulos.map((modulo, index) => (
                <ModuleItem 
                  key={modulo.id} 
                  modulo={modulo} 
                  turmaId={turmaId}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}