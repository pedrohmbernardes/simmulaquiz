'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSecureFetch } from '@/lib/hooks/useSecureFetch';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  Send,
  Loader2,
  MessagesSquare,
  Crown,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Autor = {
  nome: string;
  avatar: string | null;
  isMe?: boolean;
};

type Resposta = {
  id: number;
  conteudo: string;
  createdAt: string;
  isSolucao: boolean;
  autor: Autor;
};

type TopicoDetalhado = {
  id: number;
  titulo: string;
  conteudo: string;
  resolvido: boolean;
  createdAt: string;
  autor: Autor;
  respostas: Resposta[];
  solucaoId: number | null;
  contexto?: { tipo: string; nome: string } | null;
  tarefa?: { titulo: string };
  agendamento?: { titulo: string };
};

export default function TopicoDetalhesPage() {
  const params      = useParams();
  const secureFetch = useSecureFetch();
  const router      = useRouter();

  const turmaId  = Array.isArray(params.id)       ? params.id[0]       : params.id;
  const topicoId = Array.isArray(params.topicoId) ? params.topicoId[0] : params.topicoId;

  const [topico, setTopico]         = useState<TopicoDetalhado | null>(null);
  const [loading, setLoading]       = useState(true);
  const [novaResposta, setNovaResposta] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetalhes = useCallback(async () => {
    if (!turmaId || !topicoId) return;
    try {
      const res = await secureFetch(`/api/estudante/turmas/${turmaId}/forum/${topicoId}`);
      if (res.ok) setTopico(await res.json());
      else {
        toast.error('Tópico não encontrado.');
        router.push(`/estudante/turmas/${turmaId}/forum`);
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }, [secureFetch, turmaId, topicoId, router]);

  useEffect(() => { fetchDetalhes(); }, [fetchDetalhes]);

  const handleSubmitResposta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaResposta.trim()) return;
    setSubmitting(true);
    try {
      const res = await secureFetch(`/api/estudante/turmas/${turmaId}/forum/${topicoId}`, {
        method: 'POST',
        body: { conteudo: novaResposta },
      });
      if (res.ok) {
        toast.success('Resposta enviada!');
        setNovaResposta('');
        fetchDetalhes();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao enviar resposta.');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
        <div className="max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10 space-y-8">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!topico) return null;

  const heroGradient = topico.resolvido
    ? 'from-emerald-600 via-teal-600 to-cyan-600'
    : 'from-indigo-600 via-purple-600 to-pink-600';

  return (
    <div className="bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700">

        {/* ── Hero Header ─────────────────────────────────────── */}
        <div className={cn("relative overflow-hidden rounded-3xl bg-gradient-to-br p-8 md:p-10 shadow-2xl", heroGradient)}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-white rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-4">
            <Button
              variant="ghost"
              onClick={() => router.push(`/estudante/turmas/${turmaId}/forum`)}
              className="text-white hover:bg-white/20 -ml-2"
            >
              <ArrowLeft size={18} className="mr-2" />
              Voltar ao Fórum
            </Button>

            <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <MessagesSquare className="w-6 h-6 text-white" />
                  </div>
                  <Badge className={cn(
                    "backdrop-blur-sm text-white border-white/30",
                    topico.resolvido ? "bg-emerald-500/80" : "bg-white/20"
                  )}>
                    {topico.resolvido ? 'Resolvido' : 'Em Aberto'}
                  </Badge>
                </div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight break-words">
                  {topico.titulo}
                </h1>

                {/* Contexto */}
                {(topico.contexto || topico.tarefa || topico.agendamento) && (
                  <div className="flex flex-wrap gap-2">
                    {topico.contexto && (
                      <span className="text-xs bg-white/15 text-white border border-white/25 px-3 py-1 rounded-full font-medium">
                        {topico.contexto.tipo}: {topico.contexto.nome}
                      </span>
                    )}
                    {!topico.contexto && topico.tarefa && (
                      <span className="text-xs bg-white/15 text-white border border-white/25 px-3 py-1 rounded-full font-medium">
                        Tarefa: {topico.tarefa.titulo}
                      </span>
                    )}
                    {!topico.contexto && topico.agendamento && (
                      <span className="text-xs bg-white/15 text-white border border-white/25 px-3 py-1 rounded-full font-medium">
                        Prova: {topico.agendamento.titulo}
                      </span>
                    )}
                  </div>
                )}

                {/* Autor */}
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7 ring-2 ring-white/30">
                    <AvatarImage src={topico.autor.avatar || ''} />
                    <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                      {topico.autor.nome[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-white/80 text-sm">
                    Por <span className="font-semibold text-white">{topico.autor.nome}</span>
                    <span className="ml-2">·</span>
                    <span className="ml-2">
                      {topico.createdAt && !isNaN(new Date(topico.createdAt).getTime()) 
                        ? formatDistanceToNow(new Date(topico.createdAt), { addSuffix: true, locale: ptBR }) 
                        : 'Data não disponível'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-white/70 text-xs font-medium mb-1">Respostas</p>
                <p className="text-white text-2xl font-bold">{topico.respostas.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-white/70 text-xs font-medium mb-1">Status</p>
                <p className={cn("text-sm font-bold", topico.resolvido ? "text-emerald-200" : "text-amber-200")}>
                  {topico.resolvido ? '✓ Resolvido' : '⏳ Em aberto'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Post Original ────────────────────────────────────── */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
          <CardHeader className="pb-4 pt-5 px-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 ring-2 ring-slate-100 shadow-sm">
                <AvatarImage src={topico.autor.avatar || ''} />
                <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold">
                  {topico.autor.nome[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-slate-900">{topico.autor.nome}</p>
                <p className="text-xs text-slate-500">
                  {topico.createdAt && !isNaN(new Date(topico.createdAt).getTime()) 
                    ? formatDistanceToNow(new Date(topico.createdAt), { addSuffix: true, locale: ptBR }) 
                    : 'Data não disponível'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">
              {topico.conteudo}
            </p>
          </CardContent>
        </Card>

        {/* ── Respostas ────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Respostas</h2>
              <p className="text-sm text-slate-500">
                {topico.respostas.length} resposta{topico.respostas.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {topico.respostas.length === 0 ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="py-16">
                <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-5">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                    <div className="relative p-5 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
                      <MessageSquare className="h-12 w-12 text-indigo-600" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900">Nenhuma resposta ainda</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Seja o primeiro a ajudar! Use o formulário abaixo.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {topico.respostas.map((resposta, index) => (
                <Card
                  key={resposta.id}
                  className={cn(
                    "overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 bg-white/80 backdrop-blur-sm",
                    resposta.isSolucao && "ring-2 ring-emerald-400 shadow-emerald-100"
                  )}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {/* Barra de status */}
                  <div className={cn(
                    "h-1.5",
                    resposta.isSolucao
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : "bg-gradient-to-r from-indigo-400 to-purple-400"
                  )} />

                  <CardContent className="p-5 md:p-6">
                    {/* Badge solução */}
                    {resposta.isSolucao && (
                      <div className="flex items-center gap-2 mb-4 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl w-fit border border-emerald-200">
                        <Crown size={14} className="text-emerald-600" />
                        <span className="text-xs font-bold uppercase tracking-wider">Solução Marcada</span>
                      </div>
                    )}

                    <div className="flex items-start gap-3 mb-4">
                      <Avatar className={cn(
                        "h-10 w-10 ring-2 shadow-sm",
                        resposta.isSolucao ? "ring-emerald-300" : "ring-slate-100"
                      )}>
                        <AvatarImage src={resposta.autor.avatar || ''} />
                        <AvatarFallback className={cn(
                          "font-bold text-sm",
                          resposta.isSolucao
                            ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                            : "bg-gradient-to-br from-indigo-400 to-purple-500 text-white"
                        )}>
                          {resposta.autor.nome[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {resposta.autor.nome}
                          </span>
                          {resposta.autor.isMe && (
                            <Badge className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-100 uppercase font-bold">
                              Você
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {resposta.createdAt && !isNaN(new Date(resposta.createdAt).getTime()) 
                            ? formatDistanceToNow(new Date(resposta.createdAt), { addSuffix: true, locale: ptBR }) 
                            : 'Data não disponível'}
                        </p>
                      </div>
                    </div>

                    <p className={cn(
                      "text-sm leading-relaxed whitespace-pre-wrap",
                      resposta.isSolucao ? "text-slate-700" : "text-slate-600"
                    )}>
                      {resposta.conteudo}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Formulário de Resposta ─────────────────────────── */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-sm">
                <Send className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Sua Resposta</h3>
                <p className="text-xs text-slate-500">Seja gentil e colaborativo</p>
              </div>
            </div>

            <form onSubmit={handleSubmitResposta} className="space-y-4">
              <Textarea
                value={novaResposta}
                onChange={(e) => setNovaResposta(e.target.value)}
                className="min-h-[130px] resize-none border-slate-200 focus-visible:ring-indigo-500 text-base"
                placeholder="Escreva sua resposta ou solução aqui..."
                disabled={submitting}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={submitting || !novaResposta.trim()}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl gap-2 min-w-[160px] font-semibold"
                >
                  {submitting
                    ? <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                    : <><Send size={16} /> Enviar Resposta</>
                  }
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
