import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  Users, 
  BookOpen, 
  MessageSquare, 
  FileText,
  Calendar,
  PenTool,
  ArrowRight,
  Megaphone,
  TrendingUp,
  Clock,
  Sparkles,
  BarChart3,
  Award,
  Target,
  ClipboardList // Ícone novo para diferenciar Simulado de Tarefa
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ turmaId: string }>;
}

export default async function ProfessorTurmaDashboard({ params }: PageProps) {
  const session = await getSession();
  if (!session || session.role !== 'PROFESSOR') {
    redirect('/login');
  }

  const { turmaId } = await params;
  const turmaIdInt = parseInt(turmaId);

  if (isNaN(turmaIdInt)) redirect('/professor/turmas');

  // Buscando dados da turma + listas recentes de tarefas e simulados
  const turma = await prisma.turma.findUnique({
    where: { 
      id: turmaIdInt,
      professores: { some: { professorId: parseInt(session.sub) } }
    },
    include: {
      _count: {
        select: {
          alunos: { where: { status: 'ATIVO' } },
          agendamentos: true, // Contagem total
          tarefas: true,      // Contagem total
          materiais: true,
          avisos: true,
          forumTopicos: { where: { resolvido: false } }
        }
      },
      tarefas: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { 
          id: true, 
          titulo: true, 
          createdAt: true,
          dataEntrega: true
        }
      },
      agendamentos: { // Nova busca para o feed unificado
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          titulo: true,
          createdAt: true,
          status: true
        }
      },
      avisos: {
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          titulo: true,
          createdAt: true
        }
      }
    }
  });

  if (!turma) redirect('/professor/turmas');

  // Lógica de Unificação: Junta Tarefas e Simulados, ordena e pega os 5 mais recentes
  const atividadesRecentes = [
    ...turma.tarefas.map(t => ({ ...t, tipo: 'TAREFA' as const })),
    ...turma.agendamentos.map(a => ({ ...a, tipo: 'SIMULADO' as const, dataEntrega: null }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="space-y-8 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">
        
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-purple-300 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    Visão Geral
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                  Dashboard da Turma
                </h1>
                <p className="text-blue-100 text-base md:text-lg max-w-2xl">
                  Acompanhe o progresso, gerencie atividades e mantenha sua turma engajada
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button 
                  asChild 
                  variant="outline" 
                  className="gap-2 bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:border-white/50 transition-all"
                >
                  <Link href={`/professor/turmas/${turmaId}/mural`}>
                    <Megaphone size={18} /> Novo Aviso
                  </Link>
                </Button>
                <Button 
                  asChild 
                  className="gap-2 bg-white text-blue-700 hover:bg-blue-50 shadow-xl hover:shadow-2xl transition-all font-semibold"
                >
                  <Link href={`/professor/turmas/${turmaId}/simulados`}>
                    <PenTool size={18} /> Agendar Simulado
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid - ATUALIZADO: 5 Colunas para separar Tarefas de Simulados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <MetricCard 
            icon={Users} 
            label="Alunos Ativos" 
            value={turma._count.alunos} 
            trend="+3 este mês"
            color="blue"
            href={`/professor/turmas/${turmaId}/pessoas`}
            gradient="from-blue-500 to-cyan-500"
          />
          <MetricCard 
            icon={BookOpen} 
            label="Materiais" 
            value={turma._count.materiais} 
            trend="Publicados"
            color="emerald"
            href={`/professor/turmas/${turmaId}/conteudo`}
            gradient="from-emerald-500 to-teal-500"
          />
          {/* Card Tarefas Separado */}
          <MetricCard 
            icon={FileText} 
            label="Tarefas" 
            value={turma._count.tarefas} 
            trend="Total criadas"
            color="violet"
            href={`/professor/turmas/${turmaId}/tarefas`}
            gradient="from-violet-500 to-purple-500"
          />
          {/* Card Simulados Separado */}
          <MetricCard 
            icon={PenTool} 
            label="Simulados" 
            value={turma._count.agendamentos} 
            trend="Total agendados"
            color="pink"
            href={`/professor/turmas/${turmaId}/simulados`}
            gradient="from-pink-500 to-rose-500"
          />
          <MetricCard 
            icon={MessageSquare} 
            label="Dúvidas" 
            value={turma._count.forumTopicos} 
            trend={turma._count.forumTopicos > 0 ? "Pendentes" : "Resolvido"}
            color={turma._count.forumTopicos > 0 ? "orange" : "slate"}
            href={`/professor/turmas/${turmaId}/forum`}
            gradient={turma._count.forumTopicos > 0 ? "from-orange-500 to-amber-500" : "from-slate-500 to-gray-500"}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Activities */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Recent Activities Unified */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900">
                        Atividades Recentes
                      </CardTitle>
                      <p className="text-sm text-slate-600 mt-0.5">
                        Últimos simulados e tarefas
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {atividadesRecentes.length > 0 ? (
                  <div className="space-y-3">
                    {atividadesRecentes.map((item, index) => (
                      <div 
                        key={`${item.tipo}-${item.id}`} 
                        className={cn(
                          "group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
                          item.tipo === 'TAREFA' 
                            ? "bg-gradient-to-br from-slate-50 to-violet-50/30 border-slate-200/60 hover:border-violet-300"
                            : "bg-gradient-to-br from-slate-50 to-pink-50/30 border-slate-200/60 hover:border-pink-300"
                        )}
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="relative flex items-center gap-4">
                          <div className="flex-shrink-0">
                            <div className={cn(
                              "p-3 rounded-xl border shadow-sm transition-all",
                              item.tipo === 'TAREFA' 
                                ? "bg-white border-violet-100 group-hover:border-violet-300" 
                                : "bg-white border-pink-100 group-hover:border-pink-300"
                            )}>
                              {item.tipo === 'TAREFA' ? (
                                <FileText size={20} className="text-violet-600" />
                              ) : (
                                <ClipboardList size={20} className="text-pink-600" />
                              )}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={cn(
                                    "text-[10px] h-5 px-1.5",
                                    item.tipo === 'TAREFA' 
                                        ? "text-violet-700 bg-violet-50 border-violet-200" 
                                        : "text-pink-700 bg-pink-50 border-pink-200"
                                )}>
                                    {item.tipo}
                                </Badge>
                                <h4 className="font-semibold text-slate-900 line-clamp-1">
                                    {item.titulo}
                                </h4>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                                <Clock size={13} className="text-slate-400" />
                                Criado em {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                              {item.dataEntrega && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs border-orange-200 bg-orange-50 text-orange-700 px-2.5 py-0.5"
                                >
                                  <Target size={12} className="mr-1" />
                                  Entrega: {new Date(item.dataEntrega).toLocaleDateString('pt-BR')}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn(
                                "opacity-0 group-hover:opacity-100 transition-all flex-shrink-0",
                                item.tipo === 'TAREFA' 
                                    ? "bg-violet-50 hover:bg-violet-100 text-violet-700" 
                                    : "bg-pink-50 hover:bg-pink-100 text-pink-700"
                            )} 
                            asChild
                          >
                            <Link 
                                href={item.tipo === 'TAREFA' 
                                    ? `/professor/turmas/${turmaId}/tarefas/${item.id}/entregas`
                                    : `/professor/turmas/${turmaId}/simulados/${item.id}/resultados`
                                } 
                                className="flex items-center gap-1"
                            >
                              Ver <ArrowRight size={14} />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="inline-flex p-5 bg-gradient-to-br from-slate-100 to-blue-100/50 rounded-2xl mb-4">
                      <FileText size={32} className="text-slate-400" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-700 mb-1">
                      Nenhuma atividade criada
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                      Comece criando sua primeira tarefa ou simulado
                    </p>
                    <div className="flex justify-center gap-3">
                        <Button asChild variant="outline" className="gap-2">
                            <Link href={`/professor/turmas/${turmaId}/tarefas`}>
                                <FileText size={16} /> Nova Tarefa
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="gap-2">
                            <Link href={`/professor/turmas/${turmaId}/simulados`}>
                                <PenTool size={16} /> Novo Simulado
                            </Link>
                        </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Latest Announcements */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-4 bg-gradient-to-r from-indigo-50 to-purple-50/50 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
                      <Megaphone className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900">
                        Últimos Avisos
                      </CardTitle>
                      <p className="text-sm text-slate-600 mt-0.5">
                        Comunicados recentes
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    asChild 
                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium"
                  >
                    <Link href={`/professor/turmas/${turmaId}/mural`} className="flex items-center gap-1">
                      Ver mural <ArrowRight size={16} />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {turma.avisos.length > 0 ? (
                  <div className="space-y-3">
                    {turma.avisos.map((aviso, index) => (
                      <div 
                        key={aviso.id}
                        className="group flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50/80 to-purple-50/30 rounded-xl border border-indigo-100/60 hover:border-indigo-300 hover:shadow-md transition-all duration-300"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex-shrink-0">
                          <div className="p-2.5 bg-white rounded-lg shadow-sm border border-indigo-200">
                            <Megaphone size={18} className="text-indigo-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 line-clamp-1">
                            {aviso.titulo}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(aviso.createdAt).toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: 'short',
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                        <ArrowRight 
                          size={16} 
                          className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all flex-shrink-0" 
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex p-4 bg-gradient-to-br from-indigo-100 to-purple-100/50 rounded-2xl mb-3">
                      <Megaphone size={28} className="text-indigo-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-1">
                      Nenhum aviso publicado
                    </p>
                    <p className="text-xs text-slate-500">
                      Mantenha seus alunos informados
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Guide & Stats */}
          <div className="space-y-6">
            
            {/* Next Steps Card */}
            <div className="relative overflow-hidden rounded-3xl shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-400/20 rounded-full -ml-16 -mb-16 blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
              
              <div className="relative z-10 p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl shadow-lg">
                    <TrendingUp size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-white">Próximos Passos</h3>
                    <p className="text-blue-100 text-xs mt-0.5">
                      Guia rápido para gerenciar sua turma
                    </p>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-6">
                  {[
                    { num: 1, text: 'Verifique se há novos alunos pendentes na aba', bold: 'Pessoas' },
                    { num: 2, text: 'Organize seus materiais em módulos na aba', bold: 'Conteúdo' },
                    { num: 3, text: 'Lance a chamada do dia na aba', bold: 'Frequência' }
                  ].map((step) => (
                    <li key={step.num} className="flex items-start gap-3 group">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md text-sm font-bold text-white shadow-lg group-hover:bg-white/30 transition-all">
                        {step.num}
                      </div>
                      <span className="text-blue-50 leading-relaxed text-sm pt-0.5">
                        {step.text} <strong className="text-white font-semibold">{step.bold}</strong>
                      </span>
                    </li>
                  ))}
                </ul>

                <Button 
                  asChild 
                  className="w-full bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-xl hover:shadow-2xl transition-all py-6 text-base"
                >
                  <Link href={`/professor/turmas/${turmaId}/configuracoes`} className="flex items-center justify-center gap-2">
                    <Award size={18} />
                    Configurar Turma
                  </Link>
                </Button>
              </div>
            </div>

            {/* Performance Indicator */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-amber-50 via-orange-50 to-red-50/30 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg flex-shrink-0">
                    <Award size={24} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 mb-1">
                      Engajamento da Turma
                    </h4>
                    <p className="text-sm text-slate-600 mb-3">
                      {turma._count.forumTopicos > 0 
                        ? `${turma._count.forumTopicos} dúvidas aguardando resposta` 
                        : 'Todas as dúvidas foram respondidas! 🎉'
                      }
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((turma._count.alunos / 30) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">
                        {turma._count.alunos}/30
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Metric Card Component
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  trend,
  color,
  href,
  gradient 
}: {
  icon: any;
  label: string;
  value: number;
  trend: string;
  color: string;
  href: string;
  gradient: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white/80 backdrop-blur-sm">
        {/* Gradient Overlay */}
        <div className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br",
          gradient
        )} />
        
        <CardContent className="p-6 relative z-10">
          <div className="flex items-start justify-between mb-5">
            <div className={cn(
              "p-4 rounded-2xl shadow-lg bg-gradient-to-br transform group-hover:scale-110 transition-transform duration-500",
              gradient
            )}>
              <Icon className="h-7 w-7 text-white" />
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-slate-900 group-hover:scale-105 transition-transform duration-300">
                {value}
              </p>
              {value > 0 && (
                <TrendingUp className="h-4 w-4 text-emerald-500 animate-pulse" />
              )}
            </div>
            <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
              {label}
            </p>
            <p className={cn(
              "text-xs font-medium bg-gradient-to-r bg-clip-text text-transparent",
              gradient
            )}>
              {trend}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}