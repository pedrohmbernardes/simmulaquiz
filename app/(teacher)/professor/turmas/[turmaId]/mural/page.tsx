"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft, Megaphone, Pin, PinOff, Trash2, 
  Send, Loader2, MoreVertical, Paperclip, 
  Link as LinkIcon, Sparkles, AlertTriangle,
  MessageSquare, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";
import { cn } from "@/lib/utils";

// --- SCHEMA ---
const formSchema = z.object({
  titulo: z.string().min(3, "O título deve ter pelo menos 3 caracteres"),
  conteudo: z.string().min(1, "O conteúdo não pode estar vazio"),
  fixado: z.boolean(), 
  linkAnexo: z.string().optional(), 
});

type FormValues = z.infer<typeof formSchema>;

export type Aviso = {
  id: number;
  titulo: string;
  conteudo: string;
  fixado: boolean;
  createdAt: string;
  autor: { nome: string; fotoUrl: string | null };
  anexos: { id: number; url: string; nome: string | null; tipo: string }[];
  _count?: {
    comentarios: number;
  };
};

// Ajuste para compatibilidade com Next.js 15+ onde params é uma Promise
export default function MuralProfessorPage({ params }: { params: Promise<{ turmaId: string }> }) {
  // Desembrulha os params usando o hook 'use' (React 19/Next 15) ou useEffect manual
  // Como estamos em 'use client', o padrão recomendado é desembrulhar via `use` se disponível ou tratar como promise.
  // Vou manter a abordagem segura com state para compatibilidade geral.
  const [turmaId, setTurmaId] = useState<string>("");
  
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [avisoToDelete, setAvisoToDelete] = useState<number | null>(null);
  
  const secureFetch = useSecureFetch();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      titulo: "", 
      conteudo: "", 
      fixado: false,
      linkAnexo: "" 
    },
  });

  const fetchAvisos = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const res = await secureFetch(`/api/professor/turmas/${id}/avisos`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAvisos(data);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar avisos.");
    } finally {
      setLoading(false);
    }
  }, [secureFetch]);

  // Efeito para desembrulhar params e carregar dados inicial
  useEffect(() => {
    let isMounted = true;
    
    params.then((unwrapParams) => {
      if (isMounted) {
        setTurmaId(unwrapParams.turmaId);
        fetchAvisos(unwrapParams.turmaId);
      }
    });

    return () => { isMounted = false; };
  }, [params, fetchAvisos]);

  async function onSubmit(values: FormValues) {
    if (!turmaId) return;

    setSubmitting(true);
    try {
      const payload = {
        titulo: values.titulo,
        mensagem: values.conteudo, // Ajustado para 'mensagem' conforme padrão da API (mas mantendo conteudo no form)
        conteudo: values.conteudo, // Envia ambos para garantir compatibilidade
        fixado: values.fixado,
        anexos: values.linkAnexo && values.linkAnexo.trim() !== ""
          ? [{ url: values.linkAnexo, nome: "Link Anexo", tipo: "LINK" }] 
          : []
      };

      const res = await secureFetch(`/api/professor/turmas/${turmaId}/avisos`, {
        method: "POST",
        body: payload,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao postar");
      }

      toast.success("Aviso publicado com sucesso!", {
        description: "O comunicado está visível para todos os alunos da turma.",
      });
      
      form.reset({
        titulo: "", 
        conteudo: "", 
        fixado: false,
        linkAnexo: "" 
      });
      
      fetchAvisos(turmaId);
    } catch (error: any) {
      toast.error(error.message || "Falha ao publicar aviso.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!turmaId) return;
    try {
      await secureFetch(`/api/professor/turmas/${turmaId}/avisos/${id}`, { method: "DELETE" });
      
      setAvisos(prev => prev.filter(a => a.id !== id));
      toast.success("Aviso removido com sucesso!");
      setDeleteDialogOpen(false);
      setAvisoToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover aviso.");
    }
  }

  async function toggleFixado(id: number, atual: boolean) {
    if (!turmaId) return;
    try {
      await secureFetch(`/api/professor/turmas/${turmaId}/avisos/${id}`, {
        method: "PATCH",
        body: { fixado: !atual },
      });

      fetchAvisos(turmaId); 
      toast.success(atual ? "Aviso desafixado." : "Aviso fixado no topo!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar status.");
    }
  }

  // Separar avisos fixados e normais
  const avisosFixados = avisos.filter(a => a.fixado);
  const avisosNormais = avisos.filter(a => !a.fixado);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20">
      <div className="max-w-7xl mx-auto p-6 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700">
        
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-pink-600 to-rose-600 p-8 md:p-10 shadow-2xl">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10 space-y-4">
            <Button
              asChild
              variant="ghost"
              className="text-white hover:bg-white/20 -ml-2"
            >
              <Link href={`/professor/turmas/${turmaId}`}>
                <ArrowLeft size={18} className="mr-2" />
                Voltar para Turma
              </Link>
            </Button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <Megaphone className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    Comunicação
                  </Badge>
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                    Mural da Turma
                  </h1>
                  <p className="text-purple-100 text-base md:text-lg mt-2">
                    Publique comunicados oficiais, atualizações e avisos importantes
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-purple-100 text-xs font-medium mb-1">Total de Avisos</p>
                <p className="text-white text-2xl font-bold">{avisos.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-purple-100 text-xs font-medium mb-1">Avisos Fixados</p>
                <p className="text-white text-2xl font-bold">{avisosFixados.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          
          {/* COLUNA ESQUERDA: Formulário */}
          <div className="space-y-6">
            <Card className="sticky top-6 border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50/50 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                    <Send className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">
                      Novo Comunicado
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Compartilhe informações com a turma
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                      control={form.control}
                      name="titulo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700">
                            Título do Aviso *
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ex: Resultado do Simulado" 
                              className="h-11 text-base"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="conteudo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700">
                            Mensagem *
                          </FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Escreva sua mensagem aqui..." 
                              className="min-h-[140px] resize-none text-base" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="linkAnexo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Paperclip size={14} /> Link Anexo (Opcional)
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://..." 
                              className="h-11 text-base"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="fixado"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center space-x-3 rounded-xl border-2 border-purple-200 p-4 bg-gradient-to-r from-purple-50 to-pink-50/30 hover:border-purple-300 transition-colors">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                              />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="text-sm font-semibold cursor-pointer text-slate-900 flex items-center gap-2">
                                <Pin size={14} className="text-purple-600" />
                                Fixar no topo do mural
                              </FormLabel>
                              <p className="text-xs text-slate-600 mt-0.5">
                                Avisos fixados aparecem primeiro para todos
                              </p>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      size="lg"
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 font-semibold shadow-lg hover:shadow-xl transition-all py-6 text-base" 
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="animate-spin mr-2 h-5 w-5" />
                          Publicando...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-5 w-5" />
                          Publicar Aviso
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* COLUNA DIREITA: Feed de Avisos */}
          <div className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="text-center space-y-4">
                  <Loader2 className="animate-spin h-12 w-12 text-purple-500 mx-auto"/>
                  <p className="text-slate-600 font-medium">Carregando avisos...</p>
                </div>
              </div>
            ) : avisos.length === 0 ? (
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
                <CardContent className="py-20">
                  <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                      <div className="relative p-6 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl">
                        <Megaphone className="h-16 w-16 text-purple-600" />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold text-slate-900">
                        Mural Vazio
                      </h3>
                      <p className="text-slate-600 text-base leading-relaxed">
                        Seja o primeiro a publicar um comunicado para a turma. 
                        Mantenha seus alunos informados sobre novidades e atualizações.
                      </p>
                    </div>
                    
                    <Button 
                      size="lg"
                      className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all px-8 py-6"
                      onClick={() => form.setFocus("titulo")}
                    >
                      <Sparkles size={20} />
                      Criar Primeiro Aviso
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Avisos Fixados */}
                {avisosFixados.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-purple-700">
                      <Pin size={16} className="fill-current" />
                      Fixados no Topo
                    </div>
                    {avisosFixados.map((aviso, index) => (
                      <AvisoCard
                        key={aviso.id}
                        aviso={aviso}
                        onDelete={(id) => {
                          setAvisoToDelete(id);
                          setDeleteDialogOpen(true);
                        }}
                        onToggleFixado={toggleFixado}
                        index={index}
                      />
                    ))}
                  </div>
                )}

                {/* Avisos Normais */}
                {avisosNormais.length > 0 && (
                  <div className="space-y-4">
                    {avisosFixados.length > 0 && (
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 pt-4">
                        <MessageSquare size={16} />
                        Avisos Recentes
                      </div>
                    )}
                    {avisosNormais.map((aviso, index) => (
                      <AvisoCard
                        key={aviso.id}
                        aviso={aviso}
                        onDelete={(id) => {
                          setAvisoToDelete(id);
                          setDeleteDialogOpen(true);
                        }}
                        onToggleFixado={toggleFixado}
                        index={index + avisosFixados.length}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md bg-white/95 backdrop-blur-sm border-slate-200 shadow-2xl">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-br from-red-100 to-orange-100 rounded-2xl">
              <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
          </div>
          
          <AlertDialogHeader className="text-center space-y-3">
            <AlertDialogTitle className="text-2xl font-bold text-slate-900">
              Excluir este aviso?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-slate-600 leading-relaxed">
              Esta ação é <strong className="text-slate-900">permanente e irreversível</strong>. 
              O aviso será removido do mural e os alunos não poderão mais visualizá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900">
                  Atenção
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Esta ação não pode ser desfeita. Certifique-se antes de prosseguir.
                </p>
              </div>
            </div>
          </div>
          
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
            <AlertDialogCancel className="w-full sm:w-auto border-slate-300 hover:bg-slate-50 font-medium">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => avisoToDelete && handleDelete(avisoToDelete)}
              className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all font-semibold"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Sim, excluir aviso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Componente de Card de Aviso (Inalterado, apenas para contexto)
function AvisoCard({
  aviso,
  onDelete,
  onToggleFixado,
  index
}: {
  aviso: Aviso;
  onDelete: (id: number) => void;
  onToggleFixado: (id: number, atual: boolean) => void;
  index: number;
}) {
  return (
    <Card 
      className={cn(
        "group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-sm hover:-translate-y-1",
        aviso.fixado && "ring-2 ring-purple-200 bg-gradient-to-br from-purple-50/50 to-pink-50/30"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="relative">
        {aviso.fixado && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
        )}
        
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 flex-1 min-w-0">
              <Avatar className="h-12 w-12 border-2 border-white shadow-lg flex-shrink-0">
                <AvatarImage src={aviso.autor.fotoUrl || ""} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold">
                  {aviso.autor.nome[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg font-bold text-slate-900 leading-tight mb-2">
                  {aviso.titulo}
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <span className="font-semibold text-slate-700">{aviso.autor.nome}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>{format(new Date(aviso.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {aviso.fixado && (
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 gap-1.5 shadow-lg">
                  <Pin size={12} className="fill-current" />
                  Fixado
                </Badge>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all"
                  >
                    <MoreVertical className="h-4 w-4 text-slate-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-sm border-slate-200 shadow-xl">
                  <DropdownMenuItem 
                    onClick={() => onToggleFixado(aviso.id, aviso.fixado)}
                    className="cursor-pointer text-slate-700 hover:text-purple-700 hover:bg-purple-50"
                  >
                    {aviso.fixado ? (
                      <>
                        <PinOff className="mr-2 h-4 w-4 text-purple-600" />
                        Desafixar do topo
                      </>
                    ) : (
                      <>
                        <Pin className="mr-2 h-4 w-4 text-purple-600" />
                        Fixar no topo
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDelete(aviso.id)}
                    className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 font-medium"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir permanentemente
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-base text-slate-700 whitespace-pre-wrap leading-relaxed">
            {aviso.conteudo}
          </div>

          {aviso.anexos && aviso.anexos.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase text-slate-500 mb-3 flex items-center gap-2">
                <Paperclip size={14} /> Anexos ({aviso.anexos.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {aviso.anexos.map((anexo) => (
                  <a 
                    key={anexo.id} 
                    href={anexo.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:shadow-md transition-all"
                  >
                    <LinkIcon size={16} className="text-purple-600 group-hover:text-purple-700" />
                    <span className="text-sm font-medium text-purple-700 group-hover:text-purple-800 truncate max-w-xs">
                      {anexo.url}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}