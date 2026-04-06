import { redirect } from "next/navigation";
import { CalendarCheck, CheckCircle2, XCircle, TrendingUp, MapPin } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { StudentAttendanceHistory } from "@/components/turmas/student-attendance-history";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TurmaPresencaPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session || session.role !== "ALUNO") {
    redirect("/login");
  }

  const turmaId = parseInt(id);
  const userId  = parseInt(session.sub);

  if (isNaN(turmaId)) redirect("/estudante/turmas");

  // ── Validação de acesso ──────────────────────────────────
  const matricula = await prisma.turmaAluno.findUnique({
    where: {
      turmaId_alunoId: { turmaId, alunoId: userId },
    },
  });

  if (!matricula || matricula.status !== "ATIVO") {
    redirect("/estudante/turmas");
  }

  // ── Dados para as Stats do Hero (server-side) ────────────
  const todasSessoes = await prisma.sessaoCheckIn.findMany({
    where: { turmaId },
    select: { id: true, fechaEm: true },
  });

  const sessaoIds = todasSessoes.map((s) => s.id);

  const presencasDoAluno = await prisma.checkInRegistro.count({
    where: {
      alunoId: userId,
      sessaoId: { in: sessaoIds },
    },
  });

  const totalAulas  = todasSessoes.length;
  const presencas   = presencasDoAluno;
  const faltas      = totalAulas - presencas;
  const frequencia  = totalAulas > 0 ? Math.round((presencas / totalAulas) * 100) : 100;

  // ── Sessão ativa agora? ──────────────────────────────────
  const now = new Date();
  const sessaoAtiva = todasSessoes.some(
    (s) => !s.fechaEm || new Date(s.fechaEm) > now
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-8 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">

        {/* ── Hero ────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          {/* Blobs decorativos */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                  Frequência
                </Badge>
                {sessaoAtiva && (
                  <Badge className="bg-emerald-500/80 backdrop-blur-sm text-white border-emerald-400/30 gap-1.5 pl-2">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                    </span>
                    Chamada Aberta
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                Minha Frequência
              </h1>
              <p className="text-indigo-100 text-base md:text-lg max-w-2xl">
                Acompanhe suas presenças e registre sua presença nas aulas
              </p>
            </div>

            {/* Frequência % em destaque */}
            <div className="flex-shrink-0 bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl p-5 text-center shadow-lg min-w-[120px]">
              <p className={cn(
                "text-4xl font-bold",
                frequencia >= 75 ? "text-white" : "text-red-300"
              )}>
                {frequencia}%
              </p>
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                Frequência
              </p>
            </div>
          </div>

          {/* Stats rápidas */}
          <div className="relative z-10 grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <p className="text-indigo-100 text-xs font-medium mb-1">Total de Aulas</p>
              <p className="text-white text-2xl font-bold">{totalAulas}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <p className="text-indigo-100 text-xs font-medium mb-1">Presenças</p>
              <p className="text-white text-2xl font-bold">{presencas}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <p className="text-indigo-100 text-xs font-medium mb-1">Faltas</p>
              <p className={cn("text-2xl font-bold", faltas > 0 ? "text-red-300" : "text-white")}>
                {faltas}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            icon={CalendarCheck}
            label="Total de Aulas"
            value={totalAulas}
            gradient="from-indigo-500 to-purple-500"
            description="Aulas registradas na turma"
          />
          <StatsCard
            icon={CheckCircle2}
            label="Presenças"
            value={presencas}
            gradient="from-emerald-500 to-teal-500"
            description="Aulas que você compareceu"
          />
          <StatsCard
            icon={XCircle}
            label="Faltas"
            value={faltas}
            gradient="from-red-500 to-rose-500"
            description="Aulas que você não compareceu"
            highlight={faltas > 0}
          />
        </div>

        {/* ── Histórico + Botão de Check-in ───────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Histórico de Aulas</h2>
              <p className="text-sm text-slate-500">
                Registro detalhado de todas as aulas e suas presenças
              </p>
            </div>
          </div>

          {/* 
            StudentAttendanceHistory já contém internamente:
            - Barra de progresso de frequência
            - Histórico detalhado por aula
            - Botão "Registrar Presença" → abre StudentCheckinModal
            Não duplicamos nada aqui.
          */}
          <StudentAttendanceHistory turmaId={turmaId} />
        </section>

      </div>
    </div>
  );
}

// ── StatsCard ────────────────────────────────────────────────
function StatsCard({
  icon: Icon,
  label,
  value,
  gradient,
  description,
  highlight = false,
}: {
  icon: React.ElementType;
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
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
