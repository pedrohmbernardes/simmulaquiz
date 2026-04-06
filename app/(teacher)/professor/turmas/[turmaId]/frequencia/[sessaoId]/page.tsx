import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, XCircle, User, Clock, CalendarCheck, Users } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ turmaId: string; sessaoId: string }>;
}

export default async function DetalhesSessaoPage({ params }: PageProps) {
  const { turmaId, sessaoId } = await params;
  const session = await getSession();

  if (!session || session.role !== "PROFESSOR") redirect("/login");

  const turmaIdInt  = parseInt(turmaId);
  const sessaoIdInt = parseInt(sessaoId);
  if (isNaN(sessaoIdInt)) redirect(`/professor/turmas/${turmaId}/frequencia`);

  const sessao = await prisma.sessaoCheckIn.findUnique({
    where: { id: sessaoIdInt },
    include: { registros: { select: { alunoId: true, realizadoEm: true } } },
  });

  if (!sessao) redirect(`/professor/turmas/${turmaId}/frequencia`);

  const alunosMatriculados = await prisma.turmaAluno.findMany({
    where: { turmaId: turmaIdInt, status: "ATIVO" },
    include: { aluno: { select: { id: true, nome: true, email: true, fotoUrl: true } } },
    orderBy: { aluno: { nome: "asc" } },
  });

  const listaPresenca = alunosMatriculados.map((matricula) => {
    const registro = sessao.registros.find((r) => r.alunoId === matricula.alunoId);
    return { aluno: matricula.aluno, presente: !!registro, horario: registro?.realizadoEm ?? null };
  });

  const presentesCount = listaPresenca.filter((p) => p.presente).length;
  const totalAlunos    = listaPresenca.length;
  const pct            = totalAlunos > 0 ? Math.round((presentesCount / totalAlunos) * 100) : 0;
  const isOpen         = !sessao.fechaEm || new Date(sessao.fechaEm) > new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-8 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-4">
            <Link
              href={`/professor/turmas/${turmaId}/frequencia`}
              className="inline-flex items-center text-sm text-white/80 hover:text-white transition-colors group"
            >
              <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              Voltar ao histórico
            </Link>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <CalendarCheck className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                      Frequência
                    </Badge>
                    {isOpen && (
                      <Badge className="bg-emerald-500/80 backdrop-blur-sm text-white border-emerald-400/30 gap-1.5 pl-2">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                        </span>
                        Em Andamento
                      </Badge>
                    )}
                  </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  Detalhes da Aula
                </h1>
                <p className="text-indigo-100 text-base capitalize">
                  {format(new Date(sessao.abertoEm), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>

              {/* Mini progresso no hero */}
              <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl p-4 text-center min-w-[120px]">
                <p className="text-4xl font-bold text-white">{pct}%</p>
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider mt-1">Presença</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            icon={CheckCircle2}
            label="Presentes"
            value={presentesCount}
            gradient="from-emerald-500 to-teal-500"
            description="Confirmaram presença"
          />
          <StatsCard
            icon={XCircle}
            label="Faltas"
            value={totalAlunos - presentesCount}
            gradient="from-red-500 to-rose-500"
            description="Não compareceram"
            highlight={(totalAlunos - presentesCount) > 0}
          />
          <StatsCard
            icon={Users}
            label="Total"
            value={totalAlunos}
            gradient="from-indigo-500 to-purple-500"
            description="Alunos na turma"
          />
        </div>

        {/* Lista de Chamada */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Lista de Chamada</h2>
              <p className="text-sm text-slate-500">{totalAlunos} aluno{totalAlunos !== 1 ? "s" : ""} na turma</p>
            </div>
          </div>

          <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />

            {/* Barra de progresso */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Taxa de Presença</span>
                <span className="text-sm font-bold text-indigo-600">{pct}%</span>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {listaPresenca.map(({ aluno, presente, horario }, index) => (
                <div
                  key={aluno.id}
                  className="flex items-center justify-between p-4 md:p-5 hover:bg-slate-50/80 transition-colors group"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className={cn(
                      "h-11 w-11 ring-2 shadow-sm transition-all",
                      presente ? "ring-emerald-100 group-hover:ring-emerald-200" : "ring-slate-100 group-hover:ring-red-100"
                    )}>
                      <AvatarImage src={aluno.fotoUrl || ""} />
                      <AvatarFallback className={cn(
                        "font-bold text-sm",
                        presente
                          ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                          : "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500"
                      )}>
                        {aluno.nome[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-slate-900">{aluno.nome}</p>
                      <p className="text-xs text-slate-400">{aluno.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {presente ? (
                      <div className="text-right">
                        <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1.5 px-3 py-1 shadow-sm text-xs font-bold uppercase">
                          <CheckCircle2 size={12} /> Presente
                        </Badge>
                        {horario && (
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                            <Clock size={9} />
                            {format(new Date(horario), "HH:mm:ss")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Badge className="bg-red-50 text-red-600 border border-red-200 gap-1.5 px-3 py-1 text-xs font-bold uppercase">
                        <XCircle size={12} /> Faltou
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

      </div>
    </div>
  );
}

function StatsCard({ icon: Icon, label, value, gradient, description, highlight = false }: {
  icon: any; label: string; value: number;
  gradient: string; description: string; highlight?: boolean;
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
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
