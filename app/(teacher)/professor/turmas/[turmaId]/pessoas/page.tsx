import { redirect } from "next/navigation";
import { 
  Users, UserPlus, ShieldAlert, Mail, UserCheck, Clock
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { AprovarAlunoButton } from "./AprovarAlunoButton";
import { CopyButton } from "@/components/ui/copy-button";

interface PageProps {
  params: Promise<{ turmaId: string }>;
}

export default async function PessoasPage({ params }: PageProps) {
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
  const whereClause = isSuperAdmin
    ? { id: turmaIdInt }
    : { id: turmaIdInt, professores: { some: { professorId: parseInt(session.sub) } } };

  const turma = await prisma.turma.findUnique({
    where: whereClause,
    select: { codigo: true, nome: true },
  });

  if (!turma) redirect("/professor/dashboard");

  const todosAlunos = await prisma.turmaAluno.findMany({
    where: { turmaId: turmaIdInt },
    include: {
      aluno: { select: { id: true, nome: true, email: true, fotoUrl: true } },
    },
    orderBy: { aluno: { nome: "asc" } },
  });

  const pendentes = todosAlunos.filter((a) => a.status === "PENDENTE");
  const ativos    = todosAlunos.filter((a) => a.status === "ATIVO");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-8 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">

        {/* ── Hero ───────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                  Turma
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                Pessoas
              </h1>
              <p className="text-indigo-100 text-base md:text-lg max-w-2xl">
                Gerencie alunos matriculados e aprove novas solicitações
              </p>
            </div>

            {/* Código de Convite */}
            <div className="flex-shrink-0 bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl p-5 flex items-center gap-4 shadow-lg">
              <div className="p-3 bg-white/20 rounded-xl">
                <UserPlus className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">
                  Código de Convite
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-mono font-bold text-white tracking-wider">
                    {turma.codigo}
                  </span>
                  <CopyButton value={turma.codigo} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            icon={UserCheck}
            label="Matriculados"
            value={ativos.length}
            gradient="from-emerald-500 to-teal-500"
            description="Alunos ativos na turma"
          />
          <StatsCard
            icon={Clock}
            label="Pendentes"
            value={pendentes.length}
            gradient="from-amber-500 to-orange-500"
            description="Aguardando aprovação"
            highlight={pendentes.length > 0}
          />
          <StatsCard
            icon={Users}
            label="Total"
            value={todosAlunos.length}
            gradient="from-indigo-500 to-purple-500"
            description="Todas as solicitações"
          />
        </div>

        {/* ── Pendentes ──────────────────────────────────────── */}
        {pendentes.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Solicitações Pendentes</h2>
                <p className="text-sm text-slate-500">{pendentes.length} aguardando sua aprovação</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendentes.map(({ aluno }) => (
                <Card
                  key={aluno.id}
                  className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Barra topo */}
                  <div className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-500" />

                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 ring-2 ring-amber-100 shadow-md">
                        <AvatarImage src={aluno.fotoUrl || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-lg">
                          {aluno.nome[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="overflow-hidden flex-1">
                        <p className="font-bold text-slate-900 truncate">{aluno.nome}</p>
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {aluno.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <AprovarAlunoButton
                          turmaId={turmaIdInt}
                          alunoId={aluno.id}
                          nome={aluno.nome}
                          tipo="REJEITAR"
                        />
                      </div>
                      <div className="flex-1">
                        <AprovarAlunoButton
                          turmaId={turmaIdInt}
                          alunoId={aluno.id}
                          nome={aluno.nome}
                          tipo="APROVAR"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ── Alunos Matriculados ────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Alunos Matriculados</h2>
              <p className="text-sm text-slate-500">{ativos.length} aluno{ativos.length !== 1 ? "s" : ""} ativo{ativos.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            {/* Barra topo */}
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

            {ativos.length === 0 ? (
              <CardContent className="py-20">
                <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                    <div className="relative p-6 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl">
                      <Users className="h-14 w-14 text-emerald-600" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900">Nenhum aluno ainda</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      Compartilhe o código{" "}
                      <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {turma.codigo}
                      </span>{" "}
                      para os alunos entrarem na turma.
                    </p>
                  </div>
                </div>
              </CardContent>
            ) : (
              <div className="divide-y divide-slate-100">
                {ativos.map(({ aluno }, index) => (
                  <div
                    key={aluno.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors group"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-11 w-11 ring-2 ring-slate-100 shadow-sm group-hover:ring-indigo-100 transition-all">
                        <AvatarImage src={aluno.fotoUrl || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold">
                          {aluno.nome[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                          {aluno.nome}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" />
                          {aluno.email}
                        </p>
                      </div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <AprovarAlunoButton
                        turmaId={turmaIdInt}
                        alunoId={aluno.id}
                        nome={aluno.nome}
                        tipo="REMOVER"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

      </div>
    </div>
  );
}

// ── StatsCard ─────────────────────────────────────────────────
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
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