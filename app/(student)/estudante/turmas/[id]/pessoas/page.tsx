import { redirect } from "next/navigation";
import { Mail, Users, GraduationCap, UserCheck } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PessoasTurmaPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session) redirect("/login");
  const turmaId = parseInt(id);
  const userId = parseInt(session.sub);

  if (isNaN(turmaId)) redirect("/estudante/turmas");

  const turma = await prisma.turma.findUnique({
    where: {
      id: turmaId,
      alunos: { some: { alunoId: userId, status: "ATIVO" } },
    },
    include: {
      professores: {
        include: {
          professor: {
            select: { id: true, nome: true, email: true, fotoUrl: true },
          },
        },
      },
      alunos: {
        where: { status: "ATIVO" },
        orderBy: { aluno: { nome: "asc" } },
        include: {
          aluno: {
            select: {
              id: true,
              nome: true,
              fotoUrl: true,
              gamificacao: { select: { nivel: true } },
            },
          },
        },
      },
    },
  });

  if (!turma) redirect("/estudante/turmas");

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
                Conheça os professores e colegas da sua turma
              </p>
            </div>

            {/* Quick Stats no Hero */}
            <div className="flex gap-4 flex-shrink-0">
              <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl p-5 text-center shadow-lg min-w-[100px]">
                <p className="text-3xl font-bold text-white">{turma.professores.length}</p>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                  {turma.professores.length === 1 ? "Professor" : "Professores"}
                </p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl p-5 text-center shadow-lg min-w-[100px]">
                <p className="text-3xl font-bold text-white">{turma.alunos.length}</p>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                  {turma.alunos.length === 1 ? "Aluno" : "Alunos"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Professores ────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Professores</h2>
              <p className="text-sm text-slate-500">
                {turma.professores.length} professor{turma.professores.length !== 1 ? "es" : ""} na turma
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {turma.professores.map(({ professor }) => (
              <Card
                key={professor.id}
                className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
              >
                {/* Barra topo */}
                <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />

                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 ring-2 ring-indigo-100 shadow-md flex-shrink-0">
                      <AvatarImage src={professor.fotoUrl || ""} />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold text-lg">
                        {professor.nome[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                          {professor.nome}
                        </p>
                        <Badge className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 h-5 px-1.5 flex-shrink-0">
                          PROF
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-1">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        {professor.email}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Alunos ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Colegas de Turma</h2>
              <p className="text-sm text-slate-500">
                {turma.alunos.length} aluno{turma.alunos.length !== 1 ? "s" : ""} matriculado{turma.alunos.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            {/* Barra topo */}
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

            <div className="divide-y divide-slate-100">
              {turma.alunos.map(({ aluno }, index) => {
                const isMe = aluno.id === userId;
                const nivel = aluno.gamificacao?.nivel || 1;

                return (
                  <div
                    key={aluno.id}
                    className={cn(
                      "p-4 flex items-center gap-4 transition-colors group",
                      isMe ? "bg-indigo-50/60" : "hover:bg-slate-50/80"
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <Avatar
                      className={cn(
                        "h-11 w-11 ring-2 shadow-sm transition-all flex-shrink-0",
                        isMe
                          ? "ring-indigo-300"
                          : "ring-slate-100 group-hover:ring-emerald-100"
                      )}
                    >
                      <AvatarImage src={aluno.fotoUrl || ""} />
                      <AvatarFallback
                        className={cn(
                          "font-bold",
                          isMe
                            ? "bg-gradient-to-br from-indigo-400 to-purple-500 text-white"
                            : "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                        )}
                      >
                        {aluno.nome[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={cn(
                            "font-semibold truncate transition-colors",
                            isMe
                              ? "text-indigo-700"
                              : "text-slate-900 group-hover:text-emerald-700"
                          )}
                        >
                          {aluno.nome}
                        </p>
                        {isMe && (
                          <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200 h-5 px-1.5 flex-shrink-0">
                            Você
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        Nível {nivel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

      </div>
    </div>
  );
}
