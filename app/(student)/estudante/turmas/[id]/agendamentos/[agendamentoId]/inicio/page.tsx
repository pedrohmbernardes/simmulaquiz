import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  PenTool,
  Timer,
  Eye,
  Shield,
  Wifi,
  BookOpen,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BotaoIniciar } from "./BotaoIniciar";

interface PageProps {
  params: Promise<{ id: string; agendamentoId: string }>;
}

export default async function InicioAgendamentoPage({ params }: PageProps) {
  const { id, agendamentoId } = await params;
  const session = await getSession();

  if (!session || session.role !== "ALUNO") redirect("/login");

  const turmaIdInt = parseInt(id);
  const agendamentoIdInt = parseInt(agendamentoId);
  const alunoId = parseInt(session.sub);

  if (isNaN(turmaIdInt) || isNaN(agendamentoIdInt)) redirect("/estudante/turmas");

  const agendamento = await prisma.agendamentoSimulado.findUnique({
    where: {
      id: agendamentoIdInt,
      turmaId: turmaIdInt,
    },
    include: {
      turma: { select: { nome: true, codigo: true } },
      entregas: {
        where: { alunoId },
        select: { status: true, simuladoId: true, notaAcertos: true },
      },
    },
  });

  if (!agendamento) redirect(`/estudante/turmas/${id}/agendamentos`);

  const agora = new Date();
  const dataInicio = new Date(agendamento.dataInicio);
  const dataFim = new Date(agendamento.dataFim);

  const estaAberto = agora >= dataInicio && agora <= dataFim;
  const expirado = agora > dataFim;
  const futuro = agora < dataInicio;

  const entrega = agendamento.entregas[0];
  const jaEntregue = entrega?.status === "CONCLUIDO";
  const emAndamento = entrega?.status === "EM_ANDAMENTO";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-cyan-50/30">
      <div className="space-y-5 md:space-y-8 animate-in fade-in duration-700 p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto">

        {/* ── Hero — Dark slate/cyan theme ──────────────────── */}
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-5 md:p-10 shadow-2xl">
          {/* Decorative elements — geometric, not blobs */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 md:w-[500px] h-64 md:h-[500px] bg-cyan-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 md:w-80 h-48 md:h-80 bg-teal-500/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          </div>

          <div className="relative z-10 space-y-3 md:space-y-4">
            <Link
              href={`/estudante/turmas/${id}/agendamentos`}
              className="hidden md:inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors group"
            >
              <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              Voltar para Simulados
            </Link>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6">
              <div className="space-y-2 md:space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                  <div className="p-2 md:p-2.5 bg-cyan-500/20 backdrop-blur-sm rounded-lg md:rounded-xl border border-cyan-400/20">
                    <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                  </div>
                  <Badge className="bg-slate-700/60 backdrop-blur-sm text-cyan-300 border-cyan-500/30 text-[10px] md:text-xs font-mono">
                    {agendamento.turma.codigo}
                  </Badge>
                  <Badge className="bg-slate-700/60 backdrop-blur-sm text-slate-300 border-slate-500/30 text-[10px] md:text-xs hidden sm:inline-flex">
                    {agendamento.turma.nome}
                  </Badge>
                </div>
                <div>
                  <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight">
                    {agendamento.titulo}
                  </h1>
                  <p className="text-slate-400 text-xs md:text-base mt-1 md:mt-2">
                    Revise as informações e inicie quando estiver pronto
                  </p>
                </div>
              </div>

              {/* Status badge — inline on mobile, box on desktop */}
              <div className="flex-shrink-0">
                {jaEntregue ? (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 gap-1.5 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4" /> Concluído
                  </Badge>
                ) : expirado ? (
                  <Badge className="bg-red-500/20 text-red-300 border-red-400/30 gap-1.5 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-semibold">
                    <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" /> Encerrado
                  </Badge>
                ) : futuro ? (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 gap-1.5 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-semibold">
                    <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" /> Em Breve
                  </Badge>
                ) : emAndamento ? (
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30 gap-1.5 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-300" />
                    </span>
                    Em Andamento
                  </Badge>
                ) : (
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30 gap-1.5 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-300" />
                    </span>
                    Disponível
                  </Badge>
                )}
              </div>
            </div>

            {/* Exam Info Bar — horizontal chips */}
            <div className="flex flex-wrap gap-2 md:gap-3 mt-4 md:mt-6">
              <div className="flex items-center gap-2 bg-slate-700/50 backdrop-blur-sm rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 border border-slate-600/30">
                <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 text-cyan-400" />
                <div>
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-medium uppercase tracking-wider">Abertura</p>
                  <p className="text-white text-[11px] md:text-sm font-semibold">{format(dataInicio, "dd/MM HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-700/50 backdrop-blur-sm rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 border border-slate-600/30">
                <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 text-cyan-400" />
                <div>
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-medium uppercase tracking-wider">Encerramento</p>
                  <p className="text-white text-[11px] md:text-sm font-semibold">{format(dataFim, "dd/MM HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-cyan-500/15 backdrop-blur-sm rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 border border-cyan-500/20">
                <Timer className="h-3.5 w-3.5 md:h-4 md:w-4 text-cyan-400" />
                <div>
                  <p className="text-[9px] md:text-[10px] text-cyan-500/70 font-medium uppercase tracking-wider">Duração</p>
                  <p className="text-cyan-300 text-[11px] md:text-sm font-bold">{agendamento.duracaoMinutos} min</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-cyan-500/15 backdrop-blur-sm rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 border border-cyan-500/20">
                <FileText className="h-3.5 w-3.5 md:h-4 md:w-4 text-cyan-400" />
                <div>
                  <p className="text-[9px] md:text-[10px] text-cyan-500/70 font-medium uppercase tracking-wider">Questões</p>
                  <p className="text-cyan-300 text-[11px] md:text-sm font-bold">{agendamento.qtdeQuestoes}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Conteúdo Principal ───────────────────────────── */}
        {/* Mobile: action card first, then instructions */}
        <div className="grid lg:grid-cols-3 gap-5 md:gap-8">

          {/* AÇÃO — appears first on mobile */}
          <div className="lg:col-span-1 order-first lg:order-last">
            <Card className="overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm h-full">
              <div
                className={cn(
                  "h-1 md:h-1.5",
                  jaEntregue
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : expirado
                    ? "bg-gradient-to-r from-red-500 to-rose-500"
                    : futuro
                    ? "bg-gradient-to-r from-amber-400 to-orange-400"
                    : "bg-gradient-to-r from-cyan-500 to-teal-500"
                )}
              />
              <CardContent className="p-5 md:p-8 flex flex-col justify-center h-full">

                {jaEntregue ? (
                  <div className="text-center space-y-4 md:space-y-5">
                    <div className="relative mx-auto w-fit">
                      <div className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl opacity-15 animate-pulse" />
                      <div className="relative p-4 md:p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl md:rounded-3xl border border-emerald-200">
                        <CheckCircle2 className="h-10 w-10 md:h-12 md:w-12 text-emerald-600" />
                      </div>
                    </div>
                    <div className="space-y-1.5 md:space-y-2">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900">Prova Concluída</h3>
                      <p className="text-xs md:text-sm text-slate-500">Você já finalizou esta avaliação.</p>
                    </div>
                    {entrega.notaAcertos !== null && (
                      <div className="p-3 md:p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                        <p className="text-[10px] md:text-xs uppercase text-emerald-600 font-bold tracking-wider mb-0.5 md:mb-1">Sua Nota</p>
                        <p className="text-2xl md:text-3xl font-bold text-emerald-700">
                          {entrega.notaAcertos}
                          <span className="text-xs md:text-sm font-normal text-emerald-500 ml-1">acertos</span>
                        </p>
                      </div>
                    )}
                    {entrega.simuladoId && (
                      <Button
                        asChild
                        className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold h-11 md:py-6 text-sm md:text-base"
                      >
                        <Link href={`/estudante/simulado/${entrega.simuladoId}/resultado`}>
                          <Eye size={16} />
                          Ver Resultado Completo
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : expirado ? (
                  <div className="text-center space-y-4 md:space-y-5">
                    <div className="relative mx-auto w-fit">
                      <div className="absolute inset-0 bg-red-500 rounded-full blur-2xl opacity-15 animate-pulse" />
                      <div className="relative p-4 md:p-5 bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl md:rounded-3xl border border-red-200">
                        <Clock className="h-10 w-10 md:h-12 md:w-12 text-red-500" />
                      </div>
                    </div>
                    <div className="space-y-1.5 md:space-y-2">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900">Prazo Encerrado</h3>
                      <p className="text-xs md:text-sm text-slate-500">Esta avaliação não está mais disponível.</p>
                    </div>
                  </div>
                ) : futuro ? (
                  <div className="text-center space-y-4 md:space-y-5">
                    <div className="relative mx-auto w-fit">
                      <div className="absolute inset-0 bg-amber-400 rounded-full blur-2xl opacity-15 animate-pulse" />
                      <div className="relative p-4 md:p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl md:rounded-3xl border border-amber-200">
                        <Calendar className="h-10 w-10 md:h-12 md:w-12 text-amber-600" />
                      </div>
                    </div>
                    <div className="space-y-1.5 md:space-y-2">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900">Em Breve</h3>
                      <p className="text-xs md:text-sm text-slate-500">Aguarde o horário de abertura para iniciar.</p>
                    </div>
                    <div className="p-3 md:p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-[10px] md:text-xs uppercase text-amber-600 font-bold tracking-wider mb-0.5 md:mb-1">Abre em</p>
                      <p className="text-xs md:text-sm font-bold text-amber-700">
                        {format(dataInicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 md:space-y-6">
                    <div className="relative mx-auto w-fit">
                      <div className="absolute inset-0 bg-cyan-500 rounded-full blur-2xl opacity-15 animate-pulse" />
                      <div className="relative p-4 md:p-5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl md:rounded-3xl border border-slate-700">
                        <HelpCircle className="h-10 w-10 md:h-12 md:w-12 text-cyan-400" />
                      </div>
                    </div>
                    <div className="space-y-1.5 md:space-y-2">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900">Tudo pronto?</h3>
                      <p className="text-xs md:text-sm text-slate-500">
                        O tempo começará a contar assim que você iniciar.
                      </p>
                    </div>

                    {emAndamento && (
                      <div className="p-3 md:p-4 bg-amber-50 rounded-xl border border-amber-200 text-left">
                        <div className="flex gap-2.5 md:gap-3">
                          <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="space-y-0.5 md:space-y-1">
                            <p className="text-xs md:text-sm font-semibold text-amber-900">Em Andamento</p>
                            <p className="text-[10px] md:text-xs text-amber-700 leading-relaxed">
                              Você tem uma tentativa ativa. Clique para retomar.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <BotaoIniciar
                      agendamentoId={agendamentoIdInt}
                      turmaId={turmaIdInt}
                    />
                  </div>
                )}

              </CardContent>
            </Card>
          </div>

          {/* INSTRUÇÕES — appears second on mobile */}
          <div className="lg:col-span-2 space-y-5 md:space-y-6 order-last lg:order-first">
            <Card className="overflow-hidden border-0 shadow-lg bg-white">
              <div className="h-1 md:h-1.5 bg-gradient-to-r from-slate-800 to-cyan-600" />
              <CardContent className="p-4 md:p-8">
                <div className="flex items-center gap-2.5 md:gap-3 mb-4 md:mb-6">
                  <div className="p-1.5 md:p-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg md:rounded-xl shadow-lg">
                    <Shield className="h-4 w-4 md:h-5 md:w-5 text-cyan-400" />
                  </div>
                  <h2 className="text-base md:text-xl font-bold text-slate-900">Instruções da Avaliação</h2>
                </div>

                <div className="space-y-3 md:space-y-4">
                  <InstructionItem
                    icon={Timer}
                    gradient="from-slate-700 to-slate-800"
                    accent="text-cyan-500"
                    text="A prova possui um cronômetro automático. Ao finalizar o tempo, as respostas salvas serão enviadas."
                  />
                  <InstructionItem
                    icon={Wifi}
                    gradient="from-slate-700 to-slate-800"
                    accent="text-amber-400"
                    text="Certifique-se de ter uma conexão estável com a internet."
                  />
                  <InstructionItem
                    icon={AlertTriangle}
                    gradient="from-slate-700 to-slate-800"
                    accent="text-rose-400"
                    text="Não pause o teste após iniciar. O cronômetro continuará contando."
                  />
                  {agendamento.descricao && (
                    <div className="p-3 md:p-4 bg-cyan-50 rounded-xl border border-cyan-200">
                      <div className="flex gap-2.5 md:gap-3">
                        <PenTool className="h-4 w-4 md:h-5 md:w-5 text-cyan-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5 md:space-y-1">
                          <p className="text-xs md:text-sm font-semibold text-cyan-900">Nota do Professor</p>
                          <p className="text-xs md:text-sm text-cyan-700 leading-relaxed">{agendamento.descricao}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── InstructionItem ──────────────────────────────────────────
function InstructionItem({
  icon: Icon,
  gradient,
  accent,
  text,
}: {
  icon: React.ElementType;
  gradient: string;
  accent: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 md:gap-4 p-3 md:p-4 bg-slate-50 rounded-xl">
      <div className={cn("p-1.5 md:p-2 rounded-lg md:rounded-xl shadow-sm bg-gradient-to-br flex-shrink-0", gradient)}>
        <Icon className={cn("h-3.5 w-3.5 md:h-4 md:w-4", accent)} />
      </div>
      <p className="text-xs md:text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}
