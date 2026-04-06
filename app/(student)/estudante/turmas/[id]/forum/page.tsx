'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSecureFetch } from '@/lib/hooks/useSecureFetch';
import { toast } from 'sonner';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  Plus,
  MessagesSquare,
  TrendingUp,
  X,
  Send,
  Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Topico = {
  id: number;
  titulo: string;
  conteudoResumo: string;
  resolvido: boolean;
  dataCriacao: string;
  autor: { nome: string; avatar: string | null };
  respostasCount: number;
  contexto?: { tipo: string; nome: string } | null;
  tarefa?: { titulo: string };
  agendamento?: { titulo: string };
};

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
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br", gradient)} />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-3 rounded-2xl shadow-lg bg-gradient-to-br transform group-hover:scale-110 transition-transform duration-500", gradient)}>
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
          <p className="text-3xl font-bold text-slate-900 group-hover:scale-105 transition-transform duration-300">{value}</p>
          <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{label}</p>
          <p className={cn("text-xs font-medium bg-gradient-to-r bg-clip-text text-transparent", gradient)}>{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ForumPage() {
  const params      = useParams();
  const secureFetch = useSecureFetch();
  const turmaId     = Array.isArray(params.id) ? params.id[0] : params.id;

  const [topicos, setTopicos]       = useState<Topico[]>([]);
  const [loading, setLoading]       = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoConteudo, setNovoConteudo] = useState('');
  const [submitting, setSubmitting] = useState(false);

const fetchTopicos = useCallback(async () => {
    try {
      const res = await secureFetch(`/api/estudante/turmas/${turmaId}/forum`);
      if (res.ok) {
        const data = await res.json();
        setTopicos(data);
      } else toast.error('Erro ao carregar o fórum.');
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }, [secureFetch, turmaId]);

  useEffect(() => { fetchTopicos(); }, [fetchTopicos]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo.trim() || !novoConteudo.trim()) return;
    setSubmitting(true);
    try {
      const res = await secureFetch(`/api/estudante/turmas/${turmaId}/forum`, {
        method: 'POST',
        body: { titulo: novoTitulo, conteudo: novoConteudo },
      });
      if (res.ok) {
        toast.success('Dúvida publicada!');
        setIsModalOpen(false);
        setNovoTitulo('');
        setNovoConteudo('');
        fetchTopicos();
      } else {
        toast.error('Erro ao publicar dúvida.');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalResolvidos = topicos.filter((t) => t.resolvido).length;
  const totalAbertos    = topicos.filter((t) => !t.resolvido).length;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700">

        {/* ── Hero Header ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <MessagesSquare className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    Colaboração
                  </Badge>
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                    Fórum de Dúvidas
                  </h1>
                  <p className="text-indigo-100 text-base md:text-lg mt-2">
                    Colabore com sua turma e tire dúvidas com o professor
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setIsModalOpen(true)}
                className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold shadow-lg gap-2 px-6 h-11"
              >
                <Plus size={18} />
                Nova Dúvida
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Total</p>
                <p className="text-white text-2xl font-bold">{topicos.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Resolvidos</p>
                <p className="text-white text-2xl font-bold">{totalResolvidos}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-indigo-100 text-xs font-medium mb-1">Em Aberto</p>
                <p className="text-white text-2xl font-bold">{totalAbertos}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard icon={MessagesSquare} label="Discussões" value={topicos.length} gradient="from-indigo-500 to-purple-500" description="Total de tópicos" highlight={topicos.length > 0} />
          <StatsCard icon={CheckCircle2}   label="Resolvidos"  value={totalResolvidos}  gradient="from-emerald-500 to-teal-500"   description="Dúvidas solucionadas" />
          <StatsCard icon={TrendingUp}     label="Em Aberto"   value={totalAbertos}     gradient="from-amber-500 to-orange-500"   description="Aguardando resposta" />
        </div>

        {/* ── Lista ───────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Tópicos</h2>
              <p className="text-sm text-slate-500">
                {topicos.length} tópico{topicos.length !== 1 ? 's' : ''} publicado{topicos.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-0 shadow-lg bg-white/80 overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-slate-200 to-slate-300 animate-pulse" />
                  <CardContent className="p-5">
                    <div className="flex gap-3 animate-pulse">
                      <div className="h-10 w-10 rounded-full bg-slate-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/2 bg-slate-200 rounded" />
                        <div className="h-3 w-3/4 bg-slate-100 rounded" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && topicos.length === 0 && (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="py-20">
                <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                    <div className="relative p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
                      <MessagesSquare className="h-16 w-16 text-indigo-600" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-slate-900">Nenhuma dúvida postada</h3>
                    <p className="text-slate-600 text-base leading-relaxed">
                      Seja o primeiro a iniciar uma discussão nesta turma!
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg gap-2"
                  >
                    <Plus size={16} /> Criar primeira dúvida
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cards de tópicos */}
          {!loading && topicos.length > 0 && (
            <div className="space-y-4">
              {topicos.map((topico, index) => (
                <Link
                  key={topico.id}
                  href={`/estudante/turmas/${turmaId}/forum/${topico.id}`}
                  className="block group"
                >
                  <Card
                    className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-sm hover:-translate-y-1"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    {/* Barra de status */}
                    <div className={cn(
                      "h-1.5",
                      topico.resolvido
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                        : "bg-gradient-to-r from-amber-500 to-orange-500"
                    )} />

                    <CardContent className="p-5 md:p-6">
                      <div className="flex items-start gap-4">
                        {/* Ícone de status */}
                        <div className={cn(
                          "flex-shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110",
                          topico.resolvido
                            ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                            : "bg-gradient-to-br from-amber-500 to-orange-400 text-white"
                        )}>
                          {topico.resolvido
                            ? <CheckCircle2 size={22} />
                            : <Clock size={22} />
                          }
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <h3 className="font-bold text-xl text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-1">
                              {topico.titulo}
                            </h3>
                            <Badge className={cn(
                              "flex-shrink-0 self-start font-bold text-[10px] uppercase px-3",
                              topico.resolvido
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100"
                            )}>
                              {topico.resolvido ? 'Resolvido' : 'Em Aberto'}
                            </Badge>
                          </div>

                          {/* Tags de contexto */}
                          {(topico.contexto || topico.tarefa || topico.agendamento) && (
                            <div className="flex flex-wrap gap-2">
                              {topico.contexto && (
                                <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-lg font-medium">
                                  {topico.contexto.tipo}: {topico.contexto.nome}
                                </span>
                              )}
                              {!topico.contexto && topico.tarefa && (
                                <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-lg font-medium">
                                  Tarefa: {topico.tarefa.titulo}
                                </span>
                              )}
                              {!topico.contexto && topico.agendamento && (
                                <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-lg font-medium">
                                  Prova: {topico.agendamento.titulo}
                                </span>
                              )}
                            </div>
                          )}

                          <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                            {topico.conteudoResumo || 'Sem descrição...'}
                          </p>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6 ring-1 ring-slate-200">
                                <AvatarImage src={topico.autor.avatar || ''} />
                                <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-[10px] font-bold">
                                  {topico.autor.nome[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-semibold text-slate-600">{topico.autor.nome}</span>
                              <span className="text-slate-300 text-xs">•</span>
                              <span className="text-xs text-slate-400">
                                {topico.dataCriacao && !isNaN(new Date(topico.dataCriacao).getTime()) 
                                  ? formatDistanceToNow(new Date(topico.dataCriacao), { addSuffix: true, locale: ptBR }) 
                                  : 'Data não disponível'}
                              </span>
                            </div>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                              <MessageSquare size={12} />
                              {topico.respostasCount}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Modal Nova Dúvida ───────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header do modal */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <MessagesSquare className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Nova Dúvida</h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateTopic} className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Título</Label>
                <Input
                  required
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  className="h-11 border-slate-200 focus-visible:ring-indigo-500"
                  placeholder="Resumo da sua dúvida..."
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Detalhes</Label>
                <Textarea
                  required
                  rows={5}
                  value={novoConteudo}
                  onChange={(e) => setNovoConteudo(e.target.value)}
                  className="border-slate-200 focus-visible:ring-indigo-500 resize-none"
                  placeholder="Descreva sua dúvida com detalhes..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-slate-200 hover:bg-slate-50"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg gap-2"
                >
                  {submitting
                    ? <><Loader2 size={16} className="animate-spin" /> Publicando...</>
                    : <><Send size={16} /> Publicar Dúvida</>
                  }
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
