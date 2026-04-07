import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { 
  School
} from "lucide-react";
import { TurmaCard } from "@/components/turmas/TurmaCard";
import { JoinTurmaButton } from "@/components/turmas/JoinTurmaButton";

export default async function MinhasTurmasPage() {
  const session = await getSession();

  // 1. RBAC: Alunos OU Super Admin (para visualização/debug)
  // ✅ CORREÇÃO: Adicionada verificação para SUPER_ADMIN não ser barrado
  if (!session || (session.role !== "ALUNO" && session.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const alunoId = parseInt(session.sub);

  // 2. Query Segura
  // Nota: Se você é Admin e não tem registro na tabela TurmaAluno, 
  // a lista virá vazia, mas a página carregará.
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
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Minhas Aulas</h1>
          <p className="text-slate-500 mt-1">
            Acompanhe seu progresso e acesse os materiais das turmas.
          </p>
        </div>
        
        <JoinTurmaButton />
      </div>

      {/* Lista de Turmas */}
      {matriculas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/50 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 mb-6">
            <School className="h-10 w-10 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Você ainda não está em nenhuma turma</h3>
          <p className="mt-2 text-slate-500 max-w-md">
            {session.role === 'SUPER_ADMIN' 
              ? "Modo Admin: Entre em uma turma usando o código para testar a visão do aluno."
              : "Peça o código da turma para o seu professor e clique no botão acima para começar."
            }
          </p>
          <div className="mt-8">
             <JoinTurmaButton text="Participar de uma turma agora" variant="link" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {matriculas.map((matricula) => (
            <TurmaCard 
              key={matricula.turmaId} 
              turma={matricula.turma} 
              status={matricula.status} 
            />
          ))}
        </div>
      )}
    </div>
  );
}