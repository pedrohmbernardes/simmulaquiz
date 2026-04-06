import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, MessageCircle, Calendar, FileText, 
  BookOpen, MoreVertical, Trash2, CheckCircle2, MessageSquare
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { RespostaForm, BotaoSolucao } from "./ForumInteractions";

interface PageProps {
  params: Promise<{ turmaId: string; topicoId: string }>;
}

export default async function DetalhesTopicoPage({ params }: PageProps) {
  const { turmaId, topicoId } = await params;
  const session = await getSession();

  if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const turmaIdInt  = parseInt(turmaId);
  const topicoIdInt = parseInt(topicoId);
  if (isNaN(turmaIdInt) || isNaN(topicoIdInt)) redirect("/professor/turmas");

  // SUPER_ADMIN não tem registro em turmaProfessor — pula verificação de ownership
  if (session.role !== "SUPER_ADMIN") {
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: { turmaId_professorId: { turmaId: turmaIdInt, professorId: parseInt(session.sub) } },
    });
    if (!isOwner) redirect("/professor/turmas");
  }

  const topico = await prisma.topicoForum.findUnique({
    where: { id: topicoIdInt, turmaId: turmaIdInt },
    include: {
      autor: { select: { nome: true, fotoUrl: true, tipo: true } },
      agendamento: { select: { titulo: true } },
      tarefa: { select: { titulo: true } },
      material: { select: { titulo: true } },
      respostas: {
        orderBy: { createdAt: "asc" },
        include: { autor: { select: { nome: true, fotoUrl: true, tipo: true } } },
      },
    },
  });

  if (!topico) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex flex-col items-center justify-center p-8">
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
          <div className="relative p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
            <MessageCircle className="h-16 w-16 text-indigo-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Tópico não encontrado</h2>
        <p className="text-slate-600 mb-6">Este tópico pode ter sido excluído.</p>
        <Link href={`/professor/turmas/${turmaId}/forum`}>
          <Button variant="outline">Voltar para o Fórum</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-6 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-4xl mx-auto">

        {/* Voltar */}
        <Link
          href={`/professor/turmas/${turmaId}/forum`}
          className="inline-flex items-center text-sm text-slate-500 hover:text-indigo-600 transition-colors group"
        >
          <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar para lista de tópicos
        </Link>

        {/* Post principal */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          {/* Status bar */}
          <div className={cn(
            "h-1.5",
            topico.resolvido
              ? "bg-gradient-to-r from-emerald-500 to-teal-500"
              : "bg-gradient-to-r from-indigo-500 to-purple-500"
          )} />

          <CardContent className="p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="space-y-3 flex-1">
                {/* Badges de contexto */}
                <div className="flex flex-wrap gap-2">
                  {topico.resolvido && (
                    <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1.5 px-3 py-1 shadow-sm">
                      <CheckCircle2 className="h-3 w-3" /> Resolvido
                    </Badge>
                  )}
                  {topico.agendamento && (
                    <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                      <Calendar className="h-3 w-3 mr-1" /> {topico.agendamento.titulo}
                    </Badge>
                  )}
                  {topico.tarefa && (
                    <Badge variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-700">
                      <FileText className="h-3 w-3 mr-1" /> {topico.tarefa.titulo}
                    </Badge>
                  )}
                  {topico.material && (
                    <Badge variant="outline" className="text-xs border-purple-200 bg-purple-50 text-purple-700">
                      <BookOpen className="h-3 w-3 mr-1" /> {topico.material.titulo}
                    </Badge>
                  )}
                </div>

                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                  {topico.titulo}
                </h1>

                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8 ring-2 ring-indigo-100">
                    <AvatarImage src={topico.autor.fotoUrl || undefined} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                      {topico.autor.nome.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn("text-sm font-semibold", topico.autor.tipo === 'PROFESSOR' ? 'text-indigo-600' : 'text-slate-700')}>
                    {topico.autor.nome}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-sm text-slate-500">
                    {formatDistanceToNow(new Date(topico.createdAt), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                    <MoreVertical className="h-4 w-4 text-slate-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-sm shadow-xl border-slate-200">
                  <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer font-medium">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir Tópico
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="prose prose-slate max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed border-t border-slate-100 pt-4">
              {topico.conteudo}
            </div>
          </CardContent>
        </Card>

        {/* Divisor de respostas */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border-0 shadow-md">
            <MessageSquare className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-600">
              {topico.respostas.length} {topico.respostas.length === 1 ? 'resposta' : 'respostas'}
            </span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>

        {/* Respostas */}
        <div className="space-y-4">
          {topico.respostas.map((resposta, index) => {
            const isSolucao = topico.solucaoRespostaId === resposta.id;
            return (
              <Card
                key={resposta.id}
                className={cn(
                  "overflow-hidden border-0 shadow-lg transition-all duration-300 bg-white/80 backdrop-blur-sm",
                  isSolucao && "ring-2 ring-emerald-400/50"
                )}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* Status bar */}
                <div className={cn(
                  "h-1",
                  isSolucao
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : "bg-gradient-to-r from-slate-200 to-slate-300"
                )} />

                <CardContent className="p-5 md:p-6">
                  <div className="flex gap-4">
                    <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-slate-100">
                      <AvatarImage src={resposta.autor.fotoUrl || undefined} />
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold text-sm">
                        {resposta.autor.nome.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-semibold text-sm",
                            resposta.autor.tipo === 'PROFESSOR' ? 'text-indigo-600' : 'text-slate-900'
                          )}>
                            {resposta.autor.nome}
                          </span>
                          {resposta.autor.tipo === 'PROFESSOR' && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                              Professor
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {formatDistanceToNow(new Date(resposta.createdAt), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        {isSolucao && (
                          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1.5 px-3 py-1 shadow-sm text-xs">
                            <CheckCircle2 className="h-3 w-3" /> Solução Oficial
                          </Badge>
                        )}
                      </div>

                      <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                        {resposta.conteudo}
                      </p>

                      <div className="pt-1">
                        <BotaoSolucao
                          turmaId={turmaIdInt}
                          topicoId={topicoIdInt}
                          respostaId={resposta.id}
                          isSolucao={isSolucao}
                          podeGerenciar={true}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Formulário de resposta */}
        <RespostaForm turmaId={turmaIdInt} topicoId={topicoIdInt} />
      </div>
    </div>
  );
}
