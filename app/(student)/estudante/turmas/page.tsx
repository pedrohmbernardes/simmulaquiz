import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { 
  School,
  Layers
} from "lucide-react";
import { TurmaCard } from "@/components/turmas/TurmaCard";
import { JoinTurmaButton } from "@/components/turmas/JoinTurmaButton";
import { Badge } from "@/components/ui/badge";

export default async function MinhasTurmasPage() {
  const session = await getSession();

  // 1. RBAC: Alunos OU Super Admin
  if (!session || (session.role !== "ALUNO" && session.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const alunoId = parseInt(session.sub);

  // 2. Query Segura
  const matriculas = await prisma.turmaAluno.findMany({
    where: {
      alunoId: alunoId,
      turma: { ativo: true },
    },
    include: {
      turma: {
        include: {
          professores: {
            include: {
              professor: {
                select: { nome: true, fotoUrl: true }
              }
            }
          },
          _count: {
            select: { alunos: true }
          }
        }
      }
    },
    orderBy: {
      entrouEm: 'desc'
    }
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-700">

        {/* ── Card de Apresentação (Inspirado no Design Mobile) ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-purple-900 to-slate-800 p-5 md:p-8 shadow-xl">
          {/* Decoração sutil de fundo */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="space-y-4 md:flex-1">
              {/* Ícone + Badge */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl shadow-inner">
                  <School className="w-5 h-5 text-white" />
                </div>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/20 hover:bg-white/30 text-[10px] md:text-xs">
                  Área do Aluno
                </Badge>
              </div>

              {/* Títulos */}
              <div>
                <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
                  Minhas Turmas
                </h1>
                <p className="text-white/80 text-sm md:text-base mt-1.5 md:mt-2 max-w-md leading-relaxed">
                  Acompanhe seu progresso, acesse materiais e interaja com sua turma
                </p>
              </div>

              {/* Botão de Participar Integrado ao Card no Mobile */}
              <div className="pt-2">
                <JoinTurmaButton 
                  className="w-full md:w-auto bg-indigo-600/90 hover:bg-indigo-600 text-white border-0 shadow-lg backdrop-blur-sm transition-all active:scale-95" 
                />
              </div>

              {/* Stats Rápidos */}
              <div className="grid grid-cols-2 gap-3 mt-4 md:max-w-sm">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 shadow-sm">
                  <p className="text-white/70 text-[10px] md:text-xs font-semibold mb-1">Turmas Ativas</p>
                  <p className="text-white text-xl md:text-2xl font-bold">{matriculas.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 shadow-sm">
                  <p className="text-white/70 text-[10px] md:text-xs font-semibold mb-1">Status</p>
                  <p className="text-emerald-300 text-sm md:text-base font-bold flex items-center gap-1.5 mt-1 md:mt-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    Online
                  </p>
                </div>
              </div>
            </div>

            {/* Imagem/Ilustração opcional para Desktop (escondida no mobile) */}
            <div className="hidden md:flex items-center justify-center opacity-80 pl-8">
              <Layers className="w-40 h-40 text-white/20" />
            </div>
          </div>
        </div>

        {/* ── Lista de Turmas ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Layers className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900">Salas de Aula</h2>
              <p className="text-xs md:text-sm text-slate-500">
                {matriculas.length} turma{matriculas.length !== 1 ? 's' : ''} matriculada{matriculas.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {matriculas.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-16 md:py-24 text-center shadow-sm">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-indigo-100 rounded-full blur-xl opacity-60 animate-pulse" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 shadow-sm">
                  <School className="h-10 w-10 text-indigo-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Nenhuma turma encontrada</h3>
              <p className="mt-2 text-slate-500 max-w-sm text-sm md:text-base leading-relaxed px-4">
                {session.role === 'SUPER_ADMIN' 
                  ? "Modo Admin: Entre em uma turma usando o código para testar a visão do aluno."
                  : "Peça o código da turma para o seu professor e clique no botão acima para começar."
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {matriculas.map((matricula) => (
                <TurmaCard 
                  key={matricula.turmaId} 
                  turma={matricula.turma} 
                  status={matricula.status} 
                />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}