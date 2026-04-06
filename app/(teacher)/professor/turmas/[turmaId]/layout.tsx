import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import TeacherSidebar from '../../TeacherSidebar';
import { Badge } from '@/components/ui/badge';

interface TurmaLayoutProps {
  children: React.ReactNode;
  params: Promise<{ turmaId: string }>;
}

export default async function TurmaLayout({ children, params }: TurmaLayoutProps) {
  const session = await getSession();
  if (!session || session.role !== 'PROFESSOR') {
    redirect('/login');
  }

  const { turmaId } = await params;
  const turmaIdInt = parseInt(turmaId);

  if (isNaN(turmaIdInt)) {
    redirect('/professor/turmas');
  }

  const turma = await prisma.turma.findUnique({
    where: {
      id: turmaIdInt,
      professores: {
        some: {
          professorId: parseInt(session.sub),
        },
      },
    },
    select: {
      id: true,
      nome: true,
      codigo: true,
      descricao: true,
      imagemUrl: true,
    },
  });

  if (!turma) {
    redirect('/professor/turmas');
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar Unificada com Contexto da Turma */}
      <TeacherSidebar
        turmaContext={{
          id: turmaId,
          nome: turma.nome,
          codigo: turma.codigo,
        }}
      />

      {/* Área Principal */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Cabeçalho Compacto e Fixo */}
        <header className="z-30 flex-shrink-0 border-b border-slate-200 bg-white shadow-sm">
          <div className="px-8 py-5">
            {/* Breadcrumb */}
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
              <Link
                href="/professor/turmas"
                className="flex items-center gap-1.5 font-medium transition-colors hover:text-emerald-600"
              >
                <ArrowLeft size={14} />
                Minhas Turmas
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-700">{turma.nome}</span>
            </div>

            {/* Info Principal da Turma - Layout Horizontal Compacto */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Ícone/Avatar da Turma */}
                <div className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                  <GraduationCap size={28} />
                </div>

                {/* Nome e Código */}
                <div>
                  <h1 className="text-xl font-bold leading-tight text-slate-900">{turma.nome}</h1>
                  <div className="mt-1 flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 px-2.5 py-0.5 font-mono text-xs text-emerald-700 border-emerald-200"
                    >
                      {turma.codigo}
                    </Badge>
                    {turma.descricao && (
                      <span className="max-w-md line-clamp-1 text-sm text-slate-500">
                        {turma.descricao}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo da Página com Scroll */}
        <main className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50/20">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
