'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Paperclip,
  Send,
  CheckCircle2,
  Save,
  Link as LinkIcon,
  Trash2,
  AlertTriangle,
  Star,
  MessageSquare,
  Loader2,
  ClipboardList,
} from 'lucide-react';

import { useSecureFetch } from '@/lib/hooks/useSecureFetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Arquivo {
  id?: number;
  nome: string;
  url: string;
  tipo?: string;
}

interface TarefaDetalhes {
  id: number;
  titulo: string;
  descricao: string | null;
  dataEntrega: string | null;
  notaMaxima: number;
  criadoPor: {
    nome: string;
    fotoUrl: string | null;
  };
}

interface EntregaDetalhes {
  id: number;
  status: 'PENDENTE' | 'ENTREGUE' | 'CORRIGIDO';
  textoResposta: string | null;
  arquivos: Arquivo[];
  nota: number | null;
  feedback: string | null;
  entregueEm: string | null;
  corrigidoEm: string | null;
}

export default function TarefaDetalhesPage() {
  const params      = useParams();
  const router      = useRouter();
  const secureFetch = useSecureFetch();

  const turmaId  = params.id as string;
  const tarefaId = params.tarefaId as string;

  const [loading, setLoading]                   = useState(true);
  const [tarefa, setTarefa]                     = useState<TarefaDetalhes | null>(null);
  const [entrega, setEntrega]                   = useState<EntregaDetalhes | null>(null);
  const [sending, setSending]                   = useState(false);
  const [texto, setTexto]                       = useState('');
  const [arquivosLinks, setArquivosLinks]       = useState<Arquivo[]>([]);
  const [novoLinkUrl, setNovoLinkUrl]           = useState('');
  const [novoLinkNome, setNovoLinkNome]         = useState('');

  const fetchDados = useCallback(async () => {
    try {
      setLoading(true);
      const res = await secureFetch(`/api/estudante/turmas/${turmaId}/tarefas/${tarefaId}`);
      if (!res.ok) throw new Error('Falha ao carregar tarefa');
      const data = await res.json();
      setTarefa(data.tarefa);
      setEntrega(data.entrega);
      if (data.entrega) {
        setTexto(data.entrega.textoResposta || '');
        setArquivosLinks(data.entrega.arquivos || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [secureFetch, turmaId, tarefaId]);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const handleAddLink = () => {
    if (!novoLinkUrl) return;
    let urlFinal = novoLinkUrl;
    if (!urlFinal.startsWith('http')) urlFinal = `https://${urlFinal}`;
    setArquivosLinks([...arquivosLinks, { nome: novoLinkNome || 'Link Anexo', url: urlFinal, tipo: 'link' }]);
    setNovoLinkUrl('');
    setNovoLinkNome('');
  };

  const handleRemoveLink = (index: number) => {
    setArquivosLinks(arquivosLinks.filter((_, i) => i !== index));
  };

  const handleEnviar = async () => {
    try {
      setSending(true);
      const res = await secureFetch(`/api/estudante/turmas/${turmaId}/tarefas/${tarefaId}`, {
        method: 'POST',
        body: JSON.stringify({
          textoResposta: texto,
          arquivos: arquivosLinks.map((a) => ({ url: a.url, nome: a.nome, tipo: a.tipo })),
        }),
      });
      if (!res.ok) throw new Error('Erro ao enviar');
      await fetchDados();
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar tarefa. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20">
        <div className="max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10 space-y-8">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tarefa) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20 flex items-center justify-center">
        <p className="text-slate-500">Tarefa não encontrada.</p>
      </div>
    );
  }

  // ── Variáveis calculadas ───────────────────────────────────
  const isCorrigido = entrega?.status === 'CORRIGIDO';
  const isEntregue  = entrega?.status === 'ENTREGUE';
  const isAtrasado  = !isEntregue && !isCorrigido && tarefa.dataEntrega && isPast(new Date(tarefa.dataEntrega));

  const dataEntregaFormatada = tarefa.dataEntrega
    ? format(new Date(tarefa.dataEntrega), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
    : 'Sem prazo';

  const statusGradient = isCorrigido
    ? 'from-emerald-600 via-teal-600 to-cyan-600'
    : isEntregue
    ? 'from-blue-600 via-indigo-600 to-violet-600'
    : isAtrasado
    ? 'from-red-600 via-rose-600 to-pink-600'
    : 'from-violet-600 via-purple-600 to-fuchsia-600';

  return (
    <div className="bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20">
      <div className="max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700">

        {/* ── Hero Header ───────────────────────────────────── */}
        <div className={cn(
          "relative overflow-hidden rounded-3xl bg-gradient-to-br p-8 md:p-10 shadow-2xl",
          statusGradient
        )}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-white rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-white hover:bg-white/20 -ml-2"
            >
              <ArrowLeft size={18} className="mr-2" />
              Voltar para Tarefas
            </Button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <ClipboardList className="w-6 h-6 text-white" />
                  </div>
                  <Badge className={cn(
                    "bg-white/20 backdrop-blur-sm text-white border-white/30",
                    isCorrigido && "bg-emerald-500/80",
                    isEntregue && !isCorrigido && "bg-blue-500/80",
                    isAtrasado && "bg-red-500/80"
                  )}>
                    {isCorrigido ? 'Corrigido' : isEntregue ? 'Entregue' : isAtrasado ? 'Atrasado' : 'Pendente'}
                  </Badge>
                </div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight">
                  {tarefa.titulo}
                </h1>
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7 ring-2 ring-white/30">
                    <AvatarImage src={tarefa.criadoPor.fotoUrl || ''} />
                    <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                      {tarefa.criadoPor.nome[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-white/80 text-sm">
                    Postado por{' '}
                    <span className="font-semibold text-white">{tarefa.criadoPor.nome}</span>
                  </span>
                </div>
              </div>

              {/* Nota (se corrigido) */}
              {isCorrigido && entrega?.nota !== null && (
                <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl p-5 text-center min-w-[120px]">
                  <p className="text-4xl font-bold text-white">{entrega?.nota}</p>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider mt-1">
                    / {tarefa.notaMaxima} pts
                  </p>
                </div>
              )}
            </div>

            {/* Info bar */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-white/70 text-xs font-medium mb-1">Prazo</p>
                <p className="text-white text-sm font-bold">{dataEntregaFormatada}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-white/70 text-xs font-medium mb-1">Valor</p>
                <p className="text-white text-2xl font-bold">{tarefa.notaMaxima} <span className="text-sm font-normal opacity-70">pts</span></p>
              </div>
              {isEntregue && entrega?.entregueEm && (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <p className="text-white/70 text-xs font-medium mb-1">Enviado em</p>
                  <p className="text-white text-sm font-bold">
                    {format(new Date(entrega.entregueEm), "dd/MM 'às' HH:mm")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Alerta de Atraso ──────────────────────────────── */}
        {isAtrasado && (
          <Card className="border-0 shadow-lg bg-red-50/80 backdrop-blur-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-red-500 to-rose-500" />
            <CardContent className="p-5 flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-xl mt-0.5">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-red-800">Prazo encerrado</p>
                <p className="text-red-700 text-sm mt-0.5">
                  O prazo de entrega desta tarefa expirou em{' '}
                  <span className="font-semibold">{dataEntregaFormatada}</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Grid Principal ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Coluna Esquerda: Instruções + Entrega ─────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Instruções */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-500" />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl shadow-sm">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <CardTitle className="text-lg text-slate-900">Instruções</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm prose-slate max-w-none leading-relaxed whitespace-pre-wrap text-slate-700">
                  {tarefa.descricao || 'Sem instruções adicionais.'}
                </div>
              </CardContent>
            </Card>

            {/* ── CASO 1: CORRIGIDO (Feedback) ────────────── */}
            {isCorrigido && (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-sm">
                        <Star className="h-4 w-4 text-white" />
                      </div>
                      <CardTitle className="text-lg text-slate-900">Avaliação do Professor</CardTitle>
                    </div>
                    <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 text-base px-4 py-1 shadow-md">
                      {entrega?.nota} / {tarefa.notaMaxima}
                    </Badge>
                  </div>
                  {entrega?.corrigidoEm && (
                    <CardDescription className="text-emerald-700/80 pt-1">
                      Corrigido em {format(new Date(entrega.corrigidoEm), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Feedback */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="h-4 w-4 text-emerald-600" />
                      <h4 className="font-semibold text-sm text-slate-700">Comentários do Professor</h4>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-slate-700 text-sm leading-relaxed">
                      {entrega?.feedback || 'Sem comentários adicionais.'}
                    </div>
                  </div>

                  {/* O que foi enviado */}
                  <div className="pt-2 border-t border-slate-100">
                    <h4 className="font-semibold text-sm text-slate-500 mb-3 uppercase tracking-wider">
                      O que você enviou
                    </h4>
                    {entrega?.textoResposta && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-600 mb-3 leading-relaxed">
                        {entrega.textoResposta}
                      </div>
                    )}
                    {entrega?.arquivos?.map((arq, i) => (
                      <a
                        key={i}
                        href={arq.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 transition-all group mb-2"
                      >
                        <div className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                          <Paperclip size={15} />
                        </div>
                        <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition-colors">
                          {arq.nome}
                        </span>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── CASO 2: Formulário de Entrega ────────────── */}
            {!isCorrigido && (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
                <div className={cn(
                  "h-1.5",
                  isEntregue
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                    : "bg-gradient-to-r from-violet-500 to-purple-500"
                )} />
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-xl shadow-sm",
                      isEntregue
                        ? "bg-gradient-to-br from-blue-500 to-indigo-500"
                        : "bg-gradient-to-br from-violet-500 to-purple-500"
                    )}>
                      {isEntregue ? <Save className="h-4 w-4 text-white" /> : <Send className="h-4 w-4 text-white" />}
                    </div>
                    <div>
                      <CardTitle className="text-lg text-slate-900">
                        {isEntregue ? 'Editar Envio' : 'Enviar Resposta'}
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        {isEntregue
                          ? `Enviado em ${entrega?.entregueEm ? format(new Date(entrega.entregueEm), "dd/MM 'às' HH:mm") : ''}. Você pode atualizar sua resposta.`
                          : 'Escreva sua resposta ou anexe links (Google Drive, Docs, etc).'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Texto */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-slate-900">Texto da Resposta</Label>
                    <Textarea
                      placeholder="Escreva sua resposta aqui..."
                      className="min-h-[150px] resize-none text-base border-slate-200 focus-visible:ring-violet-500"
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                    />
                  </div>

                  {/* Anexos */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-slate-900">Anexos e Links</Label>

                    {/* Lista de links adicionados */}
                    {arquivosLinks.length > 0 && (
                      <div className="space-y-2">
                        {arquivosLinks.map((arquivo, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="p-2 bg-white rounded-lg border border-slate-200 text-indigo-600">
                                <LinkIcon size={15} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-700 truncate">
                                  {arquivo.nome}
                                </p>
                                <a
                                  href={arquivo.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-slate-400 hover:text-indigo-500 truncate block"
                                >
                                  {arquivo.url}
                                </a>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              onClick={() => handleRemoveLink(idx)}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Input novo link */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Nome do arquivo (ex: Trabalho.pdf)"
                        value={novoLinkNome}
                        onChange={(e) => setNovoLinkNome(e.target.value)}
                        className="flex-1 h-11 border-slate-200"
                      />
                      <Input
                        placeholder="Cole o link aqui (Drive, Dropbox...)"
                        value={novoLinkUrl}
                        onChange={(e) => setNovoLinkUrl(e.target.value)}
                        className="flex-[2] h-11 border-slate-200"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddLink}
                        disabled={!novoLinkUrl}
                        className="h-11 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                      >
                        Adicionar
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Dica: Faça upload no Google Drive e cole o link de compartilhamento aqui.
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="flex justify-between items-center gap-3 border-t border-slate-100 pt-5 pb-5 px-6 bg-slate-50/50">
                  {isEntregue && (
                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                      <CheckCircle2 size={16} />
                      Enviado com sucesso!
                    </div>
                  )}

                  <Button
                    onClick={handleEnviar}
                    disabled={sending || (!texto && arquivosLinks.length === 0)}
                    className={cn(
                      "ml-auto min-w-[160px] shadow-lg hover:shadow-xl transition-all font-semibold",
                      isEntregue
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700",
                      "text-white"
                    )}
                  >
                    {sending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
                    ) : isEntregue ? (
                      <><Save className="h-4 w-4 mr-2" /> Atualizar Entrega</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> Entregar Tarefa</>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>

          {/* Coluna Direita: Info Lateral ─────────────────── */}
          <div className="space-y-6">

            {/* Card de Prazo */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-500" />
              <CardContent className="p-5 space-y-4">
                <h3 className="font-bold text-slate-900 text-base">Detalhes da Tarefa</h3>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="p-1.5 bg-violet-100 rounded-lg mt-0.5">
                      <Calendar className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Prazo</p>
                      <p className={cn(
                        "text-sm font-semibold mt-0.5",
                        isAtrasado ? "text-red-600" : "text-slate-700"
                      )}>
                        {dataEntregaFormatada}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="p-1.5 bg-amber-100 rounded-lg mt-0.5">
                      <Star className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor</p>
                      <p className="text-sm font-semibold text-slate-700 mt-0.5">
                        {tarefa.notaMaxima} pontos
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="p-1.5 bg-indigo-100 rounded-lg mt-0.5">
                      <Clock className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                      <p className={cn(
                        "text-sm font-bold mt-0.5 uppercase",
                        isCorrigido ? "text-emerald-600" : isEntregue ? "text-blue-600" : isAtrasado ? "text-red-600" : "text-violet-600"
                      )}>
                        {isCorrigido ? 'Corrigido' : isEntregue ? 'Entregue' : isAtrasado ? 'Atrasado' : 'Pendente'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card do Professor */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <CardContent className="p-5">
                <h3 className="font-bold text-slate-900 text-base mb-4">Professor</h3>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 ring-2 ring-slate-100 shadow-sm">
                    <AvatarImage src={tarefa.criadoPor.fotoUrl || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold">
                      {tarefa.criadoPor.nome[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-slate-900">{tarefa.criadoPor.nome}</p>
                    <p className="text-xs text-indigo-600 font-medium">Professor</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
