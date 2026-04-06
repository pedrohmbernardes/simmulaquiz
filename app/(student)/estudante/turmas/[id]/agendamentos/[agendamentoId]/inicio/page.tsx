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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-8 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">

        {/* ── Hero ────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-4">
            <Button
              asChild
              variant="ghost"
              className="text-white hover:bg-white/20 -ml-2"
            >
              <Link href={`/estudante/turmas/${id}/agendamentos`}>
                <ArrowLeft size={18} className="mr-2" />
                Voltar para Simulados
              </Link>
            </Button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <PenTool className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    {agendamento.turma.codigo}
                  </Badge>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    {agendamento.turma.nome}
                  </Badge>
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                    {agendamento.titulo}
                  </h1>
                  <p className="text-indigo-100 text-base md:text-lg mt-2">
                    Confira os detalhes da avaliação antes de iniciar
                  </p>
                </div>
              </div>

              {/* Status no hero */}
              <div className="flex-shrink-0">
                {jaEntregue ? (
                  <div className="bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 rounded-2xl p-5 text-center shadow-lg min-w-[120px]">
                    <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto mb-1" />
                    <p className="text-white text-sm font-bold uppercase tracking-wider">Concluído</p>
                  </div>
                ) : expirado ? (
                  <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-2xl p-5 text-center shadow-lg min-w-[120px]">
                    <Clock className="h-8 w-8 text-red-300 mx-auto mb-1" />
                    <p className="text-white text-sm font-bold uppercase tracking-wider">Encerrado</p>
                  </div>
                ) : futuro ? (
                  <div className="bg-amber-500/20 backdrop-blur-sm border border-amber-400/30 rounded-2xl p-5 text-center shadow-lg min-w-[120px]">
                    <Calendar className="h-8 w-8 text-amber-300 mx-auto mb-1" />
                    <p className="text-white text-sm font-bold uppercase tracking-wider">Em Breve</p>
                  </div>
                ) : (
                  <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl p-5 text-center shadow-lg min-w-[120px]">
                    <PenTool className="h-8 w-8 text-white mx-auto mb-1" />
                    <p className="text-white text-sm font-bold uppercase tracking-wider">Disponível</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Abertura</p>
                <p className="text-white text-sm font-bold">
                  {format(dataInicio, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Encerramento</p>
                <p className="text-white text-sm font-bold">
                  {format(dataFim, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Duração</p>
                <p className="text-white text-2xl font-bold">
                  {agendamento.duracaoMinutos}<span className="text-sm font-normal text-indigo-200 ml-1">min</span>
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Questões</p>
                <p className="text-white text-2xl font-bold">{agendamento.qtdeQuestoes}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Conteúdo Principal ───────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-8">

          {/* LADO ESQUERDO: Instruções */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Instruções da Avaliação</h2>
                </div>

                <div className="space-y-4 text-slate-600">
                  <InstructionItem
                    icon={Timer}
                    gradient="from-blue-500 to-indigo-500"
                    text="A prova possui um cronômetro automático. Ao finalizar o tempo, as respostas salvas serão enviadas."
                  />
                  <InstructionItem
                    icon={AlertTriangle}
                    gradient="from-amber-500 to-orange-500"
                    text="Certifique-se de ter uma conexão estável com a internet."
                  />
                  <InstructionItem
                    icon={Clock}
                    gradient="from-red-500 to-rose-500"
                    text="Não pause o teste após iniciar. O cronômetro continuará contando."
                  />
                  {agendamento.descricao && (
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                      <div className="flex gap-3">
                        <PenTool className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-indigo-900">Nota do Professor</p>
                          <p className="text-sm text-indigo-700 leading-relaxed">{agendamento.descricao}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LADO DIREITO: Ação */}
          <div className="lg:col-span-1">
            <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm h-full">
              <div
                className={cn(
                  "h-1.5",
                  jaEntregue
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : expirado
                    ? "bg-gradient-to-r from-red-500 to-rose-500"
                    : futuro
                    ? "bg-gradient-to-r from-amber-400 to-orange-400"
                    : "bg-gradient-to-r from-indigo-500 to-purple-500"
                )}
              />
              <CardContent className="p-6 md:p-8 flex flex-col justify-center h-full">

                {jaEntregue ? (
                  <div className="text-center space-y-5">
                    <div className="relative mx-auto w-fit">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                      <div className="relative p-5 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl">
                        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900">Prova Concluída</h3>
                      <p className="text-sm text-slate-500">Você já finalizou esta avaliação.</p>
                    </div>
                    {entrega.notaAcertos !== null && (
                      <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                        <p className="text-xs uppercase text-emerald-600 font-bold tracking-wider mb-1">Sua Nota</p>
                        <p className="text-3xl font-bold text-emerald-700">
                          {entrega.notaAcertos}
                          <span className="text-sm font-normal text-emerald-500 ml-1">acertos</span>
                        </p>
                      </div>
                    )}
                    {entrega.simuladoId && (
                      <Button
                        asChild
                        className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold py-6"
                      >
                        <Link href={`/estudante/simulado/${entrega.simuladoId}/resultado`}>
                          <Eye size={18} />
                          Ver Resultado Completo
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : expirado ? (
                  <div className="text-center space-y-5">
                    <div className="relative mx-auto w-fit">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-rose-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                      <div className="relative p-5 bg-gradient-to-br from-red-100 to-rose-100 rounded-3xl">
                        <Clock className="h-12 w-12 text-red-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900">Prazo Encerrado</h3>
                      <p className="text-sm text-slate-500">Esta avaliação não está mais disponível.</p>
                    </div>
                  </div>
                ) : futuro ? (
                  <div className="text-center space-y-5">
                    <div className="relative mx-auto w-fit">
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full blur-2xl opacity-20 animate-pulse" />
                      <div className="relative p-5 bg-gradient-to-br from-amber-100 to-orange-100 rounded-3xl">
                        <Calendar className="h-12 w-12 text-amber-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900">Em Breve</h3>
                      <p className="text-sm text-slate-500">Aguarde o horário de abertura para iniciar.</p>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <p className="text-xs uppercase text-amber-600 font-bold tracking-wider mb-1">Abre em</p>
                      <p className="text-sm font-bold text-amber-700">
                        {format(dataInicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    <div className="relative mx-auto w-fit">
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                      <div className="relative p-5 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
                        <HelpCircle className="h-12 w-12 text-indigo-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900">Tudo pronto?</h3>
                      <p className="text-sm text-slate-500">
                        O tempo começará a contar assim que você clicar no botão abaixo.
                      </p>
                    </div>

                    {emAndamento && (
                      <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 text-left">
                        <div className="flex gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-amber-900">Em Andamento</p>
                            <p className="text-xs text-amber-700 leading-relaxed">
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
        </div>
      </div>
    </div>
  );
}

// ── InstructionItem ──────────────────────────────────────────
function InstructionItem({
  icon: Icon,
  gradient,
  text,
}: {
  icon: React.ElementType;
  gradient: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 bg-slate-50/80 rounded-xl hover:bg-slate-100/80 transition-colors">
      <div className={cn("p-2 rounded-xl shadow-sm bg-gradient-to-br flex-shrink-0", gradient)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
    </div>
  );
}
