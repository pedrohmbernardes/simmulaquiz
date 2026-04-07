import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ConfigurarTurmaForm } from './ConfigurarTurmaForm';
import { Settings, Sparkles, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ turmaId: string }>;
}

export default async function ConfiguracoesTurmaPage({ params }: PageProps) {
  const { turmaId } = await params;
  const session = await getSession();

  // 1. Validação de Sessão Flexível (Permite Professor e Super Admin)
  if (!session || (session.role !== 'PROFESSOR' && session.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  const turmaIdInt = parseInt(turmaId);
  if (isNaN(turmaIdInt)) {
    redirect('/professor/turmas');
  }

  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  // 2. Validação Dinâmica de Acesso e Busca de Dados
  // Super Admin busca a turma ignorando a tabela pivot.
  const whereClause = isSuperAdmin
    ? { id: turmaIdInt }
    : { 
        id: turmaIdInt, 
        professores: { some: { professorId: parseInt(session.sub) } } 
      };

  const turma = await prisma.turma.findUnique({
    where: whereClause,
    select: {
      id: true,
      nome: true,
      descricao: true,
      ativo: true,
      codigo: true,
      _count: {
        select: {
          alunos: { where: { status: 'ATIVO' } },
          agendamentos: true,
          materiais: true
        }
      }
    }
  });

  if (!turma) {
    redirect('/professor/turmas');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-5xl mx-auto p-6 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700">
        
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 md:p-10 shadow-2xl">
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
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    Configurações
                  </Badge>
                  {!turma.ativo && (
                    <Badge variant="destructive" className="shadow-lg">
                      Arquivada
                    </Badge>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                    Configurações da Turma
                  </h1>
                  <p className="text-blue-100 text-base md:text-lg mt-2">
                    Gerencie detalhes, visibilidade e preferências da turma
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Quick View */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-blue-100 text-xs font-medium mb-1">Código</p>
                <p className="text-white text-xl font-bold font-mono">{turma.codigo}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-blue-100 text-xs font-medium mb-1">Alunos Ativos</p>
                <p className="text-white text-xl font-bold">{turma._count.alunos}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-blue-100 text-xs font-medium mb-1">Simulados</p>
                <p className="text-white text-xl font-bold">{turma._count.agendamentos}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-blue-100 text-xs font-medium mb-1">Materiais</p>
                <p className="text-white text-xl font-bold">{turma._count.materiais}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Formulário de Configuração */}
        <ConfigurarTurmaForm turma={turma} turmaId={turmaIdInt} />
      </div>
    </div>
  );
}