import { redirect } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Megaphone,
  Pin,
  Paperclip,
  FileText,
  MessageSquare,
  Bell,
  BellDot,
  TrendingUp,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AlunoMuralPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session || session.role !== "ALUNO") redirect("/login");

  const turmaId = parseInt(id);
  const alunoId = parseInt(session.sub);

  if (isNaN(turmaId)) redirect("/estudante/turmas");

  // 1. Validação de Acesso
  const matricula = await prisma.turmaAluno.findUnique({
    where: {
      turmaId_alunoId: { turmaId, alunoId },
    },
    include: {
      turma: { select: { nome: true } },
    },
  });

  if (!matricula || matricula.status !== "ATIVO") {
    redirect("/estudante/turmas");
  }

  // 2. Busca Avisos
  const avisos = await prisma.avisoTurma.findMany({
    where: { turmaId },
    orderBy: [{ fixado: "desc" }, { createdAt: "desc" }],
    include: {
      autor: {
        select: { nome: true, fotoUrl: true },
      },
      anexos: true,
      _count: {
        select: { comentarios: true },
      },
    },
  });

  // Estatísticas
  const totalAvisos = avisos.length;
  const totalFixados = avisos.filter((a) => a.fixado).length;
  const totalComentarios = avisos.reduce((acc, a) => acc + a._count.comentarios, 0);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-5 md:space-y-8 animate-in fade-in duration-700 p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto">

        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-5 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-48 md:w-96 h-48 md:h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-36 md:w-72 h-36 md:h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-3 md:space-y-4">
            <Link
              href={`/estudante/turmas/${id}`}
              className="hidden md:inline-flex items-center text-sm text-white/80 hover:text-white transition-colors group"
            >
              <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              Voltar para Dashboard
            </Link>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6">
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="p-2 md:p-2.5 bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl shadow-lg">
                    <Megaphone className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 text-[10px] md:text-xs">
                    Comunicados
                  </Badge>
                </div>
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white">
                  Mural da Turma
                </h1>
                <p className="text-indigo-100 text-sm md:text-lg max-w-2xl">
                  Avisos e comunicados de{" "}
                  <span className="font-semibold text-white">{matricula.turma.nome}</span>
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2.5 md:gap-4 mt-4 md:mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
                <p className="text-indigo-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Total</p>
                <p className="text-white text-xl md:text-2xl font-bold">{totalAvisos}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
                <p className="text-indigo-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Fixados</p>
                <p className="text-white text-xl md:text-2xl font-bold">{totalFixados}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
                <p className="text-indigo-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Comentários</p>
                <p className="text-white text-xl md:text-2xl font-bold">{totalComentarios}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards — hidden on mobile (hero already shows stats) */}
        <div className="hidden md:grid grid-cols-3 gap-6">
          <StatsCard
            icon={Bell}
            label="Avisos Publicados"
            value={totalAvisos}
            gradient="from-indigo-500 to-blue-500"
            description="Total de comunicados"
            highlight={totalAvisos > 0}
          />
          <StatsCard
            icon={Pin}
            label="Fixados"
            value={totalFixados}
            gradient="from-amber-500 to-orange-500"
            description="Avisos prioritários"
          />
          <StatsCard
            icon={TrendingUp}
            label="Interações"
            value={totalComentarios}
            gradient="from-purple-500 to-pink-500"
            description="Total de comentários"
          />
        </div>

        {/* Lista de Avisos */}
        <section className="space-y-3 md:space-y-4">
          <div className="flex items-center gap-2.5 md:gap-3">
            <div className="p-1.5 md:p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg md:rounded-xl shadow-lg">
              <BellDot className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base md:text-xl font-bold text-slate-900">Comunicados</h2>
              <p className="text-xs md:text-sm text-slate-500">
                {totalAvisos} aviso{totalAvisos !== 1 ? "s" : ""} publicado
                {totalAvisos !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {avisos.length === 0 ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="py-14 md:py-20">
                <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 md:space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                    <div className="relative p-5 md:p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl md:rounded-3xl">
                      <Megaphone className="h-12 w-12 md:h-16 md:w-16 text-indigo-600" />
                    </div>
                  </div>
                  <div className="space-y-2 md:space-y-3">
                    <h3 className="text-xl md:text-2xl font-bold text-slate-900">
                      Nenhum aviso publicado
                    </h3>
                    <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                      Ainda não há comunicados nesta turma. Quando o professor publicar um aviso, ele aparecerá aqui.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {avisos.map((aviso, index) => (
                <Card
                  key={aviso.id}
                  className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-sm md:hover:-translate-y-1"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {/* Barra de status topo */}
                  <div
                    className={cn(
                      "h-1 md:h-1.5",
                      aviso.fixado
                        ? "bg-gradient-to-r from-amber-500 to-orange-500"
                        : "bg-gradient-to-r from-indigo-500 to-purple-500"
                    )}
                  />

                  <CardHeader className="pb-2 md:pb-3 pt-4 md:pt-5 px-4 md:px-6">
                    <div className="flex justify-between items-start gap-3 md:gap-4">
                      <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                        <Avatar className="h-9 w-9 md:h-11 md:w-11 ring-2 ring-slate-100 shadow-sm shrink-0">
                          <AvatarImage src={aviso.autor.fotoUrl || ""} />
                          <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold text-xs md:text-sm">
                            {aviso.autor.nome[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm md:text-base truncate">
                            {aviso.titulo}
                          </p>
                          <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-slate-500 mt-0.5">
                            <span className="font-semibold text-indigo-600 truncate">
                              {aviso.autor.nome}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="shrink-0">
                              {formatDistanceToNow(new Date(aviso.createdAt), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                            <span className="text-slate-300 hidden sm:inline">•</span>
                            <span className="hidden sm:inline">
                              {format(new Date(aviso.createdAt), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {aviso.fixado && (
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1 md:gap-1.5 px-2 md:px-3 py-0.5 md:py-1 shadow-sm flex-shrink-0 text-[10px] md:text-xs">
                          <Pin size={10} className="fill-current" />
                          <span className="hidden sm:inline">Fixado</span>
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 md:px-6 pb-4 md:pb-5 space-y-3 md:space-y-4">
                    {/* Conteúdo */}
                    <div
                      className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: aviso.conteudo }}
                    />

                    {/* Anexos */}
                    {aviso.anexos.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <h4 className="text-[10px] md:text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                          <Paperclip size={11} /> Anexos ({aviso.anexos.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {aviso.anexos.map((anexo) => (
                            <a
                              key={anexo.id}
                              href={anexo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2.5 md:gap-3 p-2.5 md:p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 active:bg-indigo-100 transition-all group"
                            >
                              <div className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors shadow-sm shrink-0">
                                <FileText size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs md:text-sm font-semibold text-slate-700 truncate group-hover:text-indigo-700 transition-colors">
                                  {anexo.nome || "Documento Anexo"}
                                </p>
                                <p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-medium">
                                  {anexo.tipo ? anexo.tipo.split("/")[1] : "Arquivo"}
                                </p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rodapé */}
                    <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 h-7 md:h-8 text-[10px] md:text-xs gap-1.5 rounded-lg"
                        disabled
                      >
                        <MessageSquare size={13} />
                        {aviso._count.comentarios > 0
                          ? `${aviso._count.comentarios} Comentário${aviso._count.comentarios !== 1 ? "s" : ""}`
                          : "Comentar"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
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
