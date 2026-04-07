import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, Clock, ArrowRight, MapPin, CheckCircle2, TrendingUp } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ProfessorCheckinManager } from "@/components/turmas/professor-checkin-manager";

interface PageProps {
  params: Promise<{ turmaId: string }>;
}

export default async function FrequenciaPage({ params }: PageProps) {
  const { turmaId } = await params;
  const session = await getSession();

  // 1. Segurança e Sessão Flexível (Permite Professor e Super Admin)
  if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }
  
  const turmaIdInt = parseInt(turmaId);
  if (isNaN(turmaIdInt)) redirect("/professor/dashboard");

  const isSuperAdmin = session.role === "SUPER_ADMIN";

  // 2. Validação de Acesso (Dinâmica)
  let temAcesso = isSuperAdmin;

  if (!isSuperAdmin) {
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: parseInt(session.sub),
        },
      },
    });
    temAcesso = !!isOwner;
  }

  if (!temAcesso) redirect("/professor/dashboard");

  const sessoes = await prisma.sessaoCheckIn.findMany({
    where: { turmaId: turmaIdInt },
    orderBy: { abertoEm: "desc" },
    include: { _count: { select: { registros: true } } },
  });

  const totalAulas    = sessoes.length;
  const aulaAberta    = sessoes.find(s => !s.fechaEm || new Date(s.fechaEm) > new Date());
  const totalPresencas = sessoes.reduce((acc, s) => acc + s._count.registros, 0);

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
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                  Frequência
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                Controle de Frequência
              </h1>
              <p className="text-indigo-100 text-base md:text-lg max-w-2xl">
                Gerencie a chamada em tempo real e visualize o histórico de presença
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            icon={CalendarCheck}
            label="Total de Aulas"
            value={totalAulas}
            gradient="from-indigo-500 to-purple-500"
            description="Aulas registradas"
          />
          <StatsCard
            icon={CheckCircle2}
            label="Em Andamento"
            value={aulaAberta ? 1 : 0}
            gradient="from-emerald-500 to-teal-500"
            description="Chamada aberta agora"
            highlight={!!aulaAberta}
          />
          <StatsCard
            icon={TrendingUp}
            label="Presenças"
            value={totalPresencas}
            gradient="from-purple-500 to-pink-500"
            description="Total de registros"
          />
        </div>

        {/* Gerenciador de Check-in */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Nova Chamada</h2>
              <p className="text-sm text-slate-500">Abra uma sessão de check-in para a aula de hoje</p>
            </div>
          </div>
          <div className="max-w-3xl">
            <ProfessorCheckinManager turmaId={turmaIdInt} />
          </div>
        </section>

        {/* Histórico */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl shadow-lg">
              <CalendarCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Histórico de Aulas</h2>
              <p className="text-sm text-slate-500">{totalAulas} aula{totalAulas !== 1 ? "s" : ""} registrada{totalAulas !== 1 ? "s" : ""}</p>
            </div>
          </div>

          <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />

            {sessoes.length === 0 ? (
              <CardContent className="py-20">
                <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                    <div className="relative p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
                      <CalendarCheck className="h-14 w-14 text-indigo-600" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900">Nenhuma chamada realizada</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      Abra sua primeira sessão de check-in para começar a registrar a presença dos alunos.
                    </p>
                  </div>
                </div>
              </CardContent>
            ) : (
              <div className="divide-y divide-slate-100">
                {sessoes.map((sessao, index) => {
                  const isOpen = !sessao.fechaEm || new Date(sessao.fechaEm) > new Date();

                  return (
                    <div
                      key={sessao.id}
                      className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50/80 transition-colors gap-4 group"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-3 rounded-2xl flex-shrink-0 shadow-sm transition-all duration-300 group-hover:scale-110",
                          isOpen
                            ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                            : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500"
                        )}>
                          <Clock size={20} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                              Aula de {format(new Date(sessao.abertoEm), "dd 'de' MMMM", { locale: ptBR })}
                            </h4>
                            {isOpen && (
                              <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1.5 pl-2 pr-2.5 py-0.5 text-[10px] uppercase shadow-sm">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                                </span>
                                Em Andamento
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                            <span>
                              Início:{" "}
                              <span className="font-mono font-semibold text-slate-700">
                                {format(new Date(sessao.abertoEm), "HH:mm")}
                              </span>
                            </span>
                            <Badge variant="outline" className="text-xs font-normal text-slate-500 bg-white border-slate-200">
                              {sessao.codigo === "AUTO" ? "Automática" : `Código: ${sessao.codigo}`}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 sm:min-w-[160px]">
                        <div className="text-right">
                          <span className="block text-3xl font-bold text-slate-900 leading-none group-hover:text-indigo-700 transition-colors">
                            {sessao._count.registros}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            Presentes
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all"
                          asChild
                        >
                          <Link href={`/professor/turmas/${turmaId}/frequencia/${sessao.id}`}>
                            <ArrowRight size={18} />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
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