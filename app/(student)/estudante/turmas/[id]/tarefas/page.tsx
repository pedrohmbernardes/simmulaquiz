import { redirect } from "next/navigation";
import Link from "next/link";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ListTodo,
  CalendarDays,
  ChevronRight,
  Inbox,
  TrendingUp,
  Sparkles,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TarefasTurmaPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session) redirect("/login");
  const turmaId = parseInt(id);
  const alunoId = parseInt(session.sub);

  if (isNaN(turmaId)) redirect("/estudante/turmas");

  // 1. Busca Tarefas e Entregas do Aluno
  const tarefas = await prisma.tarefa.findMany({
    where: { turmaId },
    orderBy: { createdAt: "desc" },
    include: {
      entregas: {
        where: { alunoId },
        select: { status: true, nota: true, entregueEm: true, feedback: true },
      },
    },
  });

  // 2. Processamento e Separação
  const listaTarefas = tarefas.map((t) => {
    const entrega = t.entregas[0];
    const status = entrega?.status || "PENDENTE";
    const isEntregue = status !== "PENDENTE";
    const isAtrasado =
      !isEntregue && t.dataEntrega && isPast(new Date(t.dataEntrega));

    return {
      ...t,
      status,
      nota: entrega?.nota,
      isEntregue,
      isAtrasado,
      dataEntrega: t.dataEntrega ? new Date(t.dataEntrega) : null,
    };
  });

  const pendentes  = listaTarefas.filter((t) => !t.isEntregue);
  const concluidas = listaTarefas.filter((t) => t.isEntregue);
  const atrasadas  = pendentes.filter((t) => t.isAtrasado);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 lg:p-10 space-y-5 md:space-y-8 animate-in fade-in duration-700">

        {/* ── Hero Header ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-5 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-48 md:w-96 h-48 md:h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-36 md:w-72 h-36 md:h-72 bg-fuchsia-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-3 md:space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6">
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="p-2 md:p-2.5 bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl shadow-lg">
                    <ListTodo className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 text-[10px] md:text-xs">
                    Atividades
                  </Badge>
                </div>
                <div>
                  <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white">
                    Tarefas e Trabalhos
                  </h1>
                  <p className="text-violet-100 text-sm md:text-lg mt-1 md:mt-2">
                    Gerencie suas entregas e acompanhe suas notas
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2.5 md:gap-4 mt-4 md:mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
                <p className="text-violet-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Pendentes</p>
                <p className="text-white text-xl md:text-2xl font-bold">{pendentes.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
                <p className="text-violet-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Concluídas</p>
                <p className="text-white text-xl md:text-2xl font-bold">{concluidas.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
                <p className="text-violet-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Atrasadas</p>
                <p className="text-white text-xl md:text-2xl font-bold">{atrasadas.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Cards — hidden on mobile ──────────────────── */}
        <div className="hidden md:grid grid-cols-3 gap-6">
          <StatsCard
            icon={AlertCircle}
            label="Pendentes"
            value={pendentes.length}
            gradient="from-violet-500 to-purple-500"
            description="Aguardando entrega"
            highlight={pendentes.length > 0}
          />
          <StatsCard
            icon={CheckCircle2}
            label="Concluídas"
            value={concluidas.length}
            gradient="from-emerald-500 to-teal-500"
            description="Tarefas entregues"
          />
          <StatsCard
            icon={TrendingUp}
            label="Total"
            value={listaTarefas.length}
            gradient="from-blue-500 to-indigo-500"
            description="Todas as atividades"
          />
        </div>

        {/* ── Abas ────────────────────────────────────────────── */}
        <Tabs defaultValue="pendentes" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 md:mb-6 h-10 md:h-auto">
            <TabsTrigger value="pendentes" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
              <AlertCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Pendentes
              {pendentes.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-0.5 md:ml-1 h-4 md:h-5 px-1 md:px-1.5 bg-violet-100 text-violet-700 text-[9px] md:text-[10px]"
                >
                  {pendentes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="concluidas" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Concluídas
            </TabsTrigger>
          </TabsList>

          {/* ── PENDENTES ───────────────────────────────────────── */}
          <TabsContent value="pendentes" className="space-y-3 md:space-y-4">
            {pendentes.length === 0 ? (
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
                <CardContent className="py-14 md:py-20">
                  <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 md:space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                      <div className="relative p-5 md:p-6 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl md:rounded-3xl">
                        <Sparkles className="h-12 w-12 md:h-16 md:w-16 text-emerald-600" />
                      </div>
                    </div>
                    <div className="space-y-2 md:space-y-3">
                      <h3 className="text-xl md:text-2xl font-bold text-slate-900">Tudo em dia!</h3>
                      <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                        Você não tem tarefas pendentes nesta turma. Ótimo trabalho!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              pendentes.map((tarefa, index) => (
                <Link
                  key={tarefa.id}
                  href={`/estudante/turmas/${id}/tarefas/${tarefa.id}`}
                  className="block group"
                >
                  <Card
                    className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-sm md:hover:-translate-y-1"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div
                      className={cn(
                        "h-1 md:h-1.5",
                        tarefa.isAtrasado
                          ? "bg-gradient-to-r from-red-500 to-rose-500"
                          : "bg-gradient-to-r from-violet-500 to-purple-500"
                      )}
                    />

                    <CardContent className="p-3.5 md:p-6">
                      <div className="flex items-start gap-3 md:gap-4">
                        {/* Ícone */}
                        <div
                          className={cn(
                            "flex-shrink-0 h-11 w-11 md:h-14 md:w-14 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110",
                            tarefa.isAtrasado
                              ? "bg-gradient-to-br from-red-500 to-rose-500 text-white"
                              : "bg-gradient-to-br from-violet-500 to-purple-500 text-white"
                          )}
                        >
                          <FileText className="h-5 w-5 md:h-6 md:w-6" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5 md:space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 md:gap-2">
                            <h3 className="font-bold text-sm md:text-xl text-slate-900 group-hover:text-violet-700 transition-colors line-clamp-1">
                              {tarefa.titulo}
                            </h3>
                            {tarefa.isAtrasado && (
                              <Badge variant="destructive" className="uppercase text-[9px] md:text-[10px] self-start flex-shrink-0 h-4 md:h-5 px-1.5 md:px-2">
                                Atrasado
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs md:text-sm text-slate-500 line-clamp-1">
                            {tarefa.descricao || "Sem descrição adicional."}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs font-medium pt-0.5 md:pt-1">
                            {tarefa.dataEntrega ? (
                              <span
                                className={cn(
                                  "flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border",
                                  tarefa.isAtrasado
                                    ? "bg-red-50 text-red-700 border-red-200 font-bold"
                                    : "bg-violet-50 text-violet-700 border-violet-200"
                                )}
                              >
                                <CalendarDays className="h-3 w-3 md:h-3.5 md:w-3.5" />
                                <span className="hidden sm:inline">{tarefa.isAtrasado ? "Venceu em: " : "Entrega: "}</span>
                                {format(tarefa.dataEntrega, "dd/MM", { locale: ptBR })}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl bg-slate-50 text-slate-500 border border-slate-200">
                                <Clock className="h-3 w-3 md:h-3.5 md:w-3.5" />
                                Sem prazo
                              </span>
                            )}

                            <Badge className="gap-1 bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[9px] md:text-xs h-5 md:h-auto px-1.5 md:px-2">
                              {tarefa.notaMaxima} pts
                            </Badge>
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-slate-300 group-hover:text-violet-500 transition-colors self-center flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </TabsContent>

          {/* ── CONCLUÍDAS ──────────────────────────────────────── */}
          <TabsContent value="concluidas" className="space-y-3 md:space-y-4">
            {concluidas.length === 0 ? (
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
                <CardContent className="py-14 md:py-20">
                  <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 md:space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                      <div className="relative p-5 md:p-6 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl md:rounded-3xl">
                        <Inbox className="h-12 w-12 md:h-16 md:w-16 text-violet-600" />
                      </div>
                    </div>
                    <div className="space-y-2 md:space-y-3">
                      <h3 className="text-xl md:text-2xl font-bold text-slate-900">
                        Nenhuma tarefa entregue
                      </h3>
                      <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                        Suas tarefas concluídas aparecerão aqui após a entrega.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              concluidas.map((tarefa, index) => (
                <Link
                  key={tarefa.id}
                  href={`/estudante/turmas/${id}/tarefas/${tarefa.id}`}
                  className="block group"
                >
                  <Card
                    className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-sm md:hover:-translate-y-1"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="h-1 md:h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

                    <CardContent className="p-3.5 md:p-6">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="flex-shrink-0 h-11 w-11 md:h-14 md:w-14 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white transition-all duration-300 group-hover:scale-110">
                          <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1 md:space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                            <h3 className="font-bold text-slate-700 group-hover:text-emerald-700 transition-colors text-sm md:text-lg truncate">
                              {tarefa.titulo}
                            </h3>
                            {tarefa.nota !== null && tarefa.nota !== undefined && (
                              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold text-[9px] md:text-xs h-4 md:h-5 px-1.5 md:px-2">
                                {tarefa.nota}/{tarefa.notaMaxima}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-slate-500">
                            <span>Status:</span>
                            <span
                              className={cn(
                                "font-bold uppercase",
                                tarefa.status === "CORRIGIDO"
                                  ? "text-emerald-600"
                                  : "text-blue-600"
                              )}
                            >
                              {tarefa.status}
                            </span>
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── StatsCard ──────────────────────────────────────────────────
function StatsCard({
  icon: Icon,
  label,
  value,
  gradient,
  description,
  highlight = false,
}: {
  icon: any;
  label: string;
  value: number;
  gradient: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 bg-white/80 backdrop-blur-sm group hover:-translate-y-1">
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br",
          gradient
        )}
      />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              "p-3 rounded-2xl shadow-lg bg-gradient-to-br transform group-hover:scale-110 transition-transform duration-500",
              gradient
            )}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
          {highlight && (
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-bold text-slate-900 group-hover:scale-105 transition-transform duration-300">
            {value}
          </p>
          <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            {label}
          </p>
          <p
            className={cn(
              "text-xs font-medium bg-gradient-to-r bg-clip-text text-transparent",
              gradient
            )}
          >
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
