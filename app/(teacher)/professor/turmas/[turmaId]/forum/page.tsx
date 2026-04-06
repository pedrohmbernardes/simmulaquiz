import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  MessageCircle, CheckCircle2, Clock, FileText,
  Calendar, BookOpen, TrendingUp, MessageSquare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NovoTopicoDialog } from "./NovoTopicoDialog";

interface PageProps {
  params: Promise<{ turmaId: string }>;
}

export default async function ForumTurmaPage({ params }: PageProps) {
  const { turmaId } = await params;
  const session = await getSession();

  if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const turmaIdInt = parseInt(turmaId);
  if (isNaN(turmaIdInt)) redirect("/professor/turmas");

  // SUPER_ADMIN não tem registro em turmaProfessor — pula verificação de ownership
  if (session.role !== "SUPER_ADMIN") {
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: parseInt(session.sub),
        },
      },
    });
    if (!isOwner) redirect("/professor/turmas");
  }

  const topicos = await prisma.topicoForum.findMany({
    where: { turmaId: turmaIdInt },
    orderBy: [{ resolvido: "asc" }, { createdAt: "desc" }],
    include: {
      autor: { select: { nome: true, fotoUrl: true, tipo: true } },
      _count: { select: { respostas: true } },
      agendamento: { select: { titulo: true } },
      tarefa: { select: { titulo: true } },
      material: { select: { titulo: true } },
    },
    take: 50,
  });

  const totalAbertos   = topicos.filter(t => !t.resolvido).length;
  const totalResolvidos = topicos.filter(t => t.resolvido).length;
  const totalRespostas  = topicos.reduce((acc, t) => acc + t._count.respostas, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-8 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                  Fórum
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                Fórum de Dúvidas
              </h1>
              <p className="text-indigo-100 text-base md:text-lg max-w-2xl">
                Espaço para perguntas, discussões e colaboração da turma
              </p>
            </div>
            <NovoTopicoDialog turmaId={turmaIdInt} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard icon={MessageCircle} label="Em Aberto"   value={totalAbertos}   gradient="from-indigo-500 to-blue-500"   description="Aguardando resposta"    highlight={totalAbertos > 0} />
          <StatsCard icon={CheckCircle2} label="Resolvidos"  value={totalResolvidos} gradient="from-emerald-500 to-teal-500"  description="Encerrados com solução" />
          <StatsCard icon={TrendingUp}   label="Respostas"   value={totalRespostas}  gradient="from-purple-500 to-pink-500"   description="Total de interações"    />
        </div>

        {/* Lista */}
        <div className="space-y-4">
          {topicos.length === 0 ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                  <div className="relative p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
                    <MessageCircle className="h-16 w-16 text-indigo-600" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-slate-900">Nenhum tópico criado</h3>
                  <p className="text-slate-600 text-base leading-relaxed">
                    O fórum está vazio. Crie um tópico para iniciar as discussões com a turma.
                  </p>
                </div>
                <NovoTopicoDialog turmaId={turmaIdInt} />
              </CardContent>
            </Card>
          ) : (
            topicos.map((topico, index) => (
              <Link key={topico.id} href={`/professor/turmas/${turmaId}/forum/${topico.id}`} className="block group">
                <Card
                  className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-sm hover:-translate-y-1"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {/* Status bar topo */}
                  <div className={cn(
                    "h-1.5",
                    topico.resolvido
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : "bg-gradient-to-r from-indigo-500 to-purple-500"
                  )} />

                  <CardContent className="p-5 md:p-6">
                    <div className="flex items-start gap-4">

                      {/* Ícone */}
                      <div className={cn(
                        "flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110",
                        topico.resolvido
                          ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                          : "bg-gradient-to-br from-indigo-500 to-purple-500 text-white"
                      )}>
                        {topico.resolvido
                          ? <CheckCircle2 className="h-6 w-6" />
                          : <MessageCircle className="h-6 w-6" />
                        }
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Título + badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-xl text-slate-900 group-hover:text-indigo-700 transition-colors mr-auto">
                            {topico.titulo}
                          </h3>
                          {topico.resolvido && (
                            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1.5 px-3 py-1 shadow-sm">
                              Resolvido
                            </Badge>
                          )}
                          {topico.agendamento && (
                            <Badge variant="outline" className="text-xs gap-1 border-blue-200 bg-blue-50 text-blue-700">
                              <Calendar className="h-3 w-3" /> {topico.agendamento.titulo}
                            </Badge>
                          )}
                          {topico.tarefa && (
                            <Badge variant="outline" className="text-xs gap-1 border-amber-200 bg-amber-50 text-amber-700">
                              <FileText className="h-3 w-3" /> {topico.tarefa.titulo}
                            </Badge>
                          )}
                          {topico.material && (
                            <Badge variant="outline" className="text-xs gap-1 border-purple-200 bg-purple-50 text-purple-700">
                              <BookOpen className="h-3 w-3" /> {topico.material.titulo}
                            </Badge>
                          )}
                        </div>

                        {/* Preview */}
                        <p className="text-sm text-slate-500 line-clamp-1">{topico.conteudo}</p>

                        {/* Meta */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5 ring-1 ring-slate-200">
                              <AvatarImage src={topico.autor.fotoUrl || undefined} />
                              <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700">
                                {topico.autor.nome.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className={topico.autor.tipo === 'PROFESSOR' ? 'text-indigo-600 font-semibold' : ''}>
                              {topico.autor.nome}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(topico.createdAt), { addSuffix: true, locale: ptBR })}
                          </div>
                          <div className="flex items-center gap-1 ml-auto">
                            <MessageCircle className="h-3 w-3" />
                            {topico._count.respostas} {topico._count.respostas === 1 ? 'resposta' : 'respostas'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({ icon: Icon, label, value, gradient, description, highlight = false }: {
  icon: any; label: string; value: number; gradient: string; description: string; highlight?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 bg-white/80 backdrop-blur-sm group hover:-translate-y-1">
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br", gradient)} />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-3 rounded-2xl shadow-lg bg-gradient-to-br transform group-hover:scale-110 transition-transform duration-500", gradient)}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {highlight && (
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-bold text-slate-900 group-hover:scale-105 transition-transform duration-300">{value}</p>
          <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{label}</p>
          <p className={cn("text-xs font-medium bg-gradient-to-r bg-clip-text text-transparent", gradient)}>{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
