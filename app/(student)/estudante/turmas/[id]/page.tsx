import { redirect } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Megaphone, 
  CalendarDays, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  ArrowRight,
  Zap,
  TrendingUp,
  FileText,
  Users,
  BookOpen,
  Sparkles,
  Target,
  Activity,
  Brain,
  Timer,
  Calendar,
  Bell,
  MessageCircle,
  Trophy,
  CalendarCheck
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TurmaDashboardPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session || session.role !== "ALUNO") redirect("/login");

  const turmaId = parseInt(id);
  const alunoId = parseInt(session.sub);

  if (isNaN(turmaId)) redirect("/estudante/turmas");

  const [turma, totalAulas, minhasPresencas, minhasEntregasDeAgendamentos] = await Promise.all([
    prisma.turma.findFirst({
      where: {
        id: turmaId,
        alunos: { some: { alunoId: alunoId, status: "ATIVO" } }
      },
      include: {
        avisos: {
          take: 3,
          orderBy: [{ fixado: 'desc' }, { createdAt: 'desc' }],
          include: { autor: { select: { nome: true, fotoUrl: true } } }
        },
        agendamentos: {
          // CORREÇÃO: Agora buscamos tanto os em andamento (PUBLICADO) quanto o histórico (ENCERRADO) 
          // para compor as estatísticas de média e conclusão reais.
          where: { 
            status: {
              in: ["PUBLICADO", "ENCERRADO"]
            }
          }
        },
        tarefas: {
          include: {
            entregas: {
              where: { alunoId: alunoId },
              select: { status: true, nota: true, createdAt: true }
            }
          }
        },
        professores: {
          include: {
            professor: {
              select: { nome: true, fotoUrl: true }
            }
          }
        }
      }
    }),
    
    prisma.sessaoCheckIn.count({
      where: { 
        turmaId: turmaId,
        fechaEm: { lt: new Date() }
      }
    }),

    prisma.checkInRegistro.count({
      where: {
        turmaId: turmaId,
        alunoId: alunoId
      }
    }),

    prisma.agendamentoEntrega.findMany({
      where: {
        alunoId: alunoId,
        turmaId: turmaId
      },
      include: {
        simulado: {
          select: {
            status: true,
            notaPercentual: true
          }
        }
      }
    })
  ]);

  if (!turma) redirect("/estudante/turmas");

  const agora = new Date();
  
  const taxaFrequencia = totalAulas > 0 
    ? Math.round((minhasPresencas / totalAulas) * 100) 
    : 100;

  const listaAgendamentos = turma.agendamentos.map(ag => {
    const entrega = minhasEntregasDeAgendamentos.find(e => e.agendamentoId === ag.id);
    const simulado = entrega?.simulado;
    
    return {
      id: ag.id,
      titulo: ag.titulo,
      tipo: 'SIMULADO' as const,
      dataFim: new Date(ag.dataFim),
      dataInicio: new Date(ag.dataInicio),
      entregue: (simulado?.status === "CONCLUIDO") || (entrega?.status === "CONCLUIDO"),
      // CORREÇÃO DE SEGURANÇA: Lê a nota tanto do Simulado real quanto da Entrega pivot.
      nota: simulado?.notaPercentual ?? entrega?.notaPercentual ?? null,
      link: `/estudante/turmas/${id}/agendamentos/${ag.id}/inicio`,
      duracao: ag.duracaoMinutos,
    };
  });

  const listaTarefas = turma.tarefas.map(t => ({
    id: t.id,
    titulo: t.titulo,
    tipo: 'TAREFA' as const,
    dataFim: t.dataEntrega ? new Date(t.dataEntrega) : null,
    dataInicio: new Date(t.createdAt),
    entregue: t.entregas.length > 0 && t.entregas[0].status !== 'PENDENTE',
    nota: t.entregas[0]?.nota,
    link: `/estudante/turmas/${id}/tarefas/${t.id}`,
  }));

  const todasAtividades = [...listaAgendamentos, ...listaTarefas].sort((a, b) => {
    if (!a.dataFim) return 1; 
    if (!b.dataFim) return -1;
    return a.dataFim.getTime() - b.dataFim.getTime();
  });

  const pendentes = todasAtividades.filter(a => !a.entregue && (!a.dataFim || a.dataFim >= agora));
  const concluidas = todasAtividades.filter(a => a.entregue);
  const atrasadas = todasAtividades.filter(a => !a.entregue && a.dataFim && a.dataFim < agora);
  
  const atividadeDestaque = pendentes.length > 0 ? pendentes[0] : null;
  const proximasAtividades = pendentes.slice(0, 6);
  
  const notasNormalizadas = concluidas
    .filter(a => a.nota !== null && a.nota !== undefined)
    .map(a => a.tipo === 'SIMULADO' ? (a.nota! / 10) : a.nota!);

  const mediaNotas = notasNormalizadas.length > 0 
    ? notasNormalizadas.reduce((acc, nota) => acc + nota, 0) / notasNormalizadas.length 
    : 0;

  const totalAtividadesCount = todasAtividades.length;
  const taxaConclusao = totalAtividadesCount > 0 ? (concluidas.length / totalAtividadesCount) * 100 : 0;

  const getPrazoText = (data: Date) => {
    if (isToday(data)) return "Hoje";
    if (isTomorrow(data)) return "Amanhã";
    return format(data, "dd/MM", { locale: ptBR });
  };

  const getPrazoColor = (data: Date | null) => {
    if (!data) return "text-slate-500";
    const diffHours = (data.getTime() - agora.getTime()) / (1000 * 60 * 60);
    if (diffHours < 0) return "text-red-600 font-bold";
    if (diffHours < 24) return "text-orange-600 font-bold";
    if (diffHours < 72) return "text-amber-600 font-semibold";
    return "text-violet-600";
  };

  return (
    <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
      <div className="max-w-[1920px] mx-auto px-4 md:px-6 lg:px-8 xl:px-12 py-5 md:py-8 space-y-5 md:space-y-8">
        
        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white">
            <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <CardContent className="p-4 md:p-6 relative z-10">
              <div className="flex items-start justify-between mb-2 md:mb-4">
                <div className="p-2 md:p-3 bg-white/20 rounded-lg md:rounded-xl backdrop-blur-sm">
                  <Target className="h-4 w-4 md:h-6 md:w-6" />
                </div>
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-emerald-300" />
              </div>
              <div className="space-y-1 md:space-y-2">
                <p className="text-[11px] md:text-sm font-medium text-violet-100">Conclusão</p>
                <p className="text-2xl md:text-4xl font-bold">{Math.round(taxaConclusao)}%</p>
                <Progress value={taxaConclusao} className="h-1.5 md:h-2 bg-white/20" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-pink-600 to-rose-700 text-white">
            <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <CardContent className="p-4 md:p-6 relative z-10">
              <div className="flex items-start justify-between mb-2 md:mb-4">
                <div className="p-2 md:p-3 bg-white/20 rounded-lg md:rounded-xl backdrop-blur-sm">
                  <Trophy className="h-4 w-4 md:h-6 md:w-6" />
                </div>
                <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-yellow-300" />
              </div>
              <div className="space-y-1 md:space-y-2">
                <p className="text-[11px] md:text-sm font-medium text-pink-100">Média</p>
                <p className="text-2xl md:text-4xl font-bold">{mediaNotas.toFixed(1)}</p>
                <p className="text-[10px] md:text-xs text-pink-100">{concluidas.length} avaliadas</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <CardContent className="p-4 md:p-6 relative z-10">
              <div className="flex items-start justify-between mb-2 md:mb-4">
                <div className="p-2 md:p-3 bg-white/20 rounded-lg md:rounded-xl backdrop-blur-sm">
                  <Clock className="h-4 w-4 md:h-6 md:w-6" />
                </div>
                {atrasadas.length > 0 && <Bell className="h-4 w-4 md:h-5 md:w-5 text-red-200 animate-bounce" />}
              </div>
              <div className="space-y-1 md:space-y-2">
                <p className="text-[11px] md:text-sm font-medium text-amber-100">Pendentes</p>
                <p className="text-2xl md:text-4xl font-bold">{pendentes.length}</p>
                {atrasadas.length > 0 ? (
                  <p className="text-[10px] md:text-xs text-red-200 font-semibold">{atrasadas.length} atrasada{atrasadas.length > 1 ? 's' : ''}</p>
                ) : (
                  <p className="text-[10px] md:text-xs text-amber-100 opacity-0">—</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-cyan-600 to-blue-700 text-white">
            <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <CardContent className="p-4 md:p-6 relative z-10">
              <div className="flex items-start justify-between mb-2 md:mb-4">
                <div className="p-2 md:p-3 bg-white/20 rounded-lg md:rounded-xl backdrop-blur-sm">
                  <CalendarCheck className="h-4 w-4 md:h-6 md:w-6 text-cyan-100" />
                </div>
                <Activity className="h-4 w-4 md:h-5 md:w-5 text-cyan-200" />
              </div>
              <div className="space-y-1 md:space-y-2">
                <p className="text-[11px] md:text-sm font-medium text-cyan-100">Frequência</p>
                <p className="text-2xl md:text-4xl font-bold">{taxaFrequencia}%</p>
                <p className="text-[10px] md:text-xs text-cyan-100">
                  {minhasPresencas}/{totalAulas} aulas
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Grid Principal */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 md:gap-8">
          
          <div className="xl:col-span-2 space-y-5 md:space-y-6">
            {atividadeDestaque && (
              <Card className="border-0 shadow-2xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-violet-700 text-white overflow-hidden">
                <div className="absolute inset-0 bg-grid-white/5"></div>
                <CardContent className="p-5 md:p-8 relative z-10">
                  <div className="flex items-start justify-between mb-4 md:mb-6">
                    <div className="flex items-center gap-2.5 md:gap-3">
                      <div className="p-2.5 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm animate-pulse">
                        <Zap className="h-5 w-5 md:h-7 md:w-7 text-yellow-300" />
                      </div>
                      <div>
                        <p className="text-[10px] md:text-sm font-bold uppercase tracking-wider text-pink-200">Foco Agora</p>
                        <p className="text-lg md:text-2xl font-bold mt-0.5">Próxima Entrega</p>
                      </div>
                    </div>
                    <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-300 font-bold px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs">
                      URGENTE
                    </Badge>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20">
                    <h3 className="text-lg md:text-2xl font-bold mb-2 md:mb-3">{atividadeDestaque.titulo}</h3>
                    <div className="flex flex-wrap items-center gap-2.5 md:gap-4 mb-4 md:mb-6">
                      <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                        <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        <span className="font-semibold">
                          {atividadeDestaque.dataFim 
                            ? `${getPrazoText(atividadeDestaque.dataFim)} às ${format(atividadeDestaque.dataFim, "HH:mm")}`
                            : 'Sem prazo'}
                        </span>
                      </div>
                      {atividadeDestaque.tipo === 'SIMULADO' && atividadeDestaque.duracao && (
                        <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                          <Timer className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          <span>{atividadeDestaque.duracao} min</span>
                        </div>
                      )}
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-[10px] md:text-xs">
                        {atividadeDestaque.tipo === 'SIMULADO' ? 'Simulado' : 'Tarefa'}
                      </Badge>
                    </div>
                    <Button size="lg" className="w-full bg-white text-purple-700 hover:bg-white/90 font-bold shadow-xl text-sm md:text-base h-10 md:h-12" asChild>
                      <Link href={atividadeDestaque.link}>
                        Começar Agora
                        <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-violet-200 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-purple-50 px-4 md:px-6 py-3 md:py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-violet-900 text-sm md:text-base">
                    <Calendar className="h-4 w-4 md:h-5 md:w-5 text-violet-600" />
                    Próximas Atividades
                  </CardTitle>
                  <Badge variant="outline" className="text-violet-700 border-violet-300 text-[10px] md:text-xs">
                    {proximasAtividades.length} pendente{proximasAtividades.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {proximasAtividades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 md:py-16 text-center">
                    <div className="p-3 md:p-4 bg-violet-100 rounded-full mb-3 md:mb-4">
                      <CheckCircle2 className="h-8 w-8 md:h-12 md:w-12 text-violet-600" />
                    </div>
                    <p className="text-base md:text-lg font-semibold text-violet-900">Tudo em dia!</p>
                    <p className="text-xs md:text-sm text-violet-600 mt-1">Nenhuma atividade pendente no momento.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-violet-100">
                    {proximasAtividades.map((atv) => (
                      <Link 
                        key={`${atv.tipo}-${atv.id}`}
                        href={atv.link}
                        className="flex items-center gap-3 md:gap-4 p-3.5 md:p-5 hover:bg-violet-50/50 active:bg-violet-50 transition-colors group"
                      >
                        <div className={`p-2.5 md:p-3.5 rounded-xl shadow-sm group-hover:scale-110 transition-transform shrink-0 ${
                          atv.tipo === 'SIMULADO' 
                            ? 'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700' 
                            : 'bg-gradient-to-br from-pink-100 to-pink-200 text-pink-700'
                        }`}>
                          {atv.tipo === 'SIMULADO' ? <Brain className="h-5 w-5 md:h-6 md:w-6" /> : <FileText className="h-5 w-5 md:h-6 md:w-6" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-violet-900 truncate group-hover:text-purple-700 transition-colors text-sm md:text-base">
                            {atv.titulo}
                          </h4>
                          <div className="flex items-center gap-2 md:gap-3 mt-1">
                            <Badge variant="secondary" className="text-[9px] md:text-[10px] h-4 md:h-5 px-1.5 md:px-2 bg-violet-100 text-violet-700 font-semibold">
                              {atv.tipo === 'SIMULADO' ? 'Simulado' : 'Tarefa'}
                            </Badge>
                            {atv.dataFim && (
                              <span className={`text-[10px] md:text-xs flex items-center gap-1 font-semibold ${getPrazoColor(atv.dataFim)}`}>
                                <CalendarDays className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                {getPrazoText(atv.dataFim)} {format(atv.dataFim, "HH:mm")}
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-violet-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5 md:space-y-6">
            <Card className="border-violet-200 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-purple-50 px-4 md:px-6 py-3 md:py-4">
                <CardTitle className="flex items-center gap-2 text-violet-900 text-sm md:text-base">
                  <Megaphone className="h-4 w-4 md:h-5 md:w-5 text-violet-600" />
                  Avisos Recentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 md:p-4 space-y-3 md:space-y-4">
                {turma.avisos.length === 0 ? (
                  <p className="text-xs md:text-sm text-violet-500 text-center py-3 md:py-4">Nenhum aviso no momento</p>
                ) : (
                  turma.avisos.map((aviso) => (
                    <div key={aviso.id} className="space-y-1.5 md:space-y-2 pb-3 md:pb-4 border-b border-violet-100 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 md:h-7 md:w-7 ring-2 ring-violet-100">
                          <AvatarImage src={aviso.autor.fotoUrl || undefined} />
                          <AvatarFallback className="bg-violet-200 text-violet-700 text-[10px] md:text-xs font-bold">
                            {aviso.autor.nome[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] md:text-xs font-semibold text-violet-900 truncate">{aviso.autor.nome}</p>
                          <p className="text-[9px] md:text-[10px] text-violet-500">
                            {formatDistanceToNow(new Date(aviso.createdAt), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        {aviso.fixado && <Badge className="bg-violet-600 text-white text-[8px] md:text-[9px] h-3.5 md:h-4">Fixado</Badge>}
                      </div>
                      <p className="text-xs md:text-sm text-violet-700 line-clamp-2 leading-relaxed">
                        {aviso.conteudo.replace(/<[^>]+>/g, '')}
                      </p>
                    </div>
                  ))
                )}
                <Button variant="outline" size="sm" className="w-full border-violet-300 text-violet-700 hover:bg-violet-50 text-xs md:text-sm h-8 md:h-9" asChild>
                  <Link href={`/estudante/turmas/${id}/mural`}>
                    Ver todos os avisos
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-violet-200 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-purple-50 px-4 md:px-6 py-3 md:py-4">
                <CardTitle className="flex items-center gap-2 text-violet-900 text-sm md:text-base">
                  <Users className="h-4 w-4 md:h-5 md:w-5 text-violet-600" />
                  Professor{turma.professores.length > 1 ? 'es' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 md:p-4 space-y-2.5 md:space-y-3">
                {turma.professores.map(({ professor }) => (
                  <div key={professor.nome} className="flex items-center gap-2.5 md:gap-3">
                    <Avatar className="h-9 w-9 md:h-10 md:w-10 ring-2 ring-violet-200">
                      <AvatarImage src={professor.fotoUrl || undefined} />
                      <AvatarFallback className="bg-violet-200 text-violet-700 font-bold text-xs md:text-sm">
                        {professor.nome[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-violet-900 text-xs md:text-sm">{professor.nome}</p>
                      <p className="text-[10px] md:text-xs text-violet-600">Professor(a)</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="hidden md:block border-violet-200 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-purple-50">
                <CardTitle className="flex items-center gap-2 text-violet-900 text-base">
                  <Zap className="h-5 w-5 text-violet-600" />
                  Acesso Rápido
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Link href={`/estudante/turmas/${id}/conteudo`} className="flex flex-col items-center justify-center p-4 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors group border-2 border-transparent hover:border-violet-300">
                    <BookOpen className="h-6 w-6 text-violet-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-violet-700">Conteúdos</span>
                  </Link>

                  <Link href={`/estudante/turmas/${id}/forum`} className="flex flex-col items-center justify-center p-4 bg-pink-50 hover:bg-pink-100 rounded-xl transition-colors group border-2 border-transparent hover:border-pink-300">
                    <MessageCircle className="h-6 w-6 text-pink-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-pink-700">Fórum</span>
                  </Link>

                  <Link href={`/estudante/turmas/${id}/presenca`} className="flex flex-col items-center justify-center p-4 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors group border-2 border-transparent hover:border-emerald-300">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-emerald-700">Frequência</span>
                  </Link>

                  <Link href={`/estudante/turmas/${id}/pessoas`} className="flex flex-col items-center justify-center p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors group border-2 border-transparent hover:border-amber-300">
                    <Users className="h-6 w-6 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-amber-700">Turma</span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}