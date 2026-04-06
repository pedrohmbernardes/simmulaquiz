"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { 
  Loader2, 
  Save, 
  Archive, 
  ArchiveRestore, 
  AlertTriangle,
  FileText,
  CheckCircle2,
  Info,
  Shield
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres").max(50, "Máximo 50 caracteres"),
  descricao: z.string().max(200, "Máximo 200 caracteres").optional(),
});

export function ConfigurarTurmaForm({ turma, turmaId }: { turma: any; turmaId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Formulário para dados básicos
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: turma.nome,
      descricao: turma.descricao || "",
    },
  });

  // 1. Atualizar Dados Básicos
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/professor/turmas/${turma.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) throw new Error("Erro ao atualizar");

      toast.success("Informações atualizadas com sucesso!", {
        description: "As alterações foram salvas e estão visíveis para os alunos.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Falha ao salvar alterações.", {
        description: "Tente novamente ou entre em contato com o suporte.",
      });
    } finally {
      setLoading(false);
    }
  }

  // 2. Alternar Status (Arquivar/Reativar)
  async function toggleStatus() {
    setIsArchiving(true);
    try {
      const novoStatus = !turma.ativo;
      const res = await fetch(`/api/professor/turmas/${turma.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: novoStatus }),
      });

      if (!res.ok) throw new Error("Erro ao alterar status");

      toast.success(
        novoStatus ? "Turma reativada com sucesso!" : "Turma arquivada com sucesso!",
        {
          description: novoStatus 
            ? "A turma está visível novamente para os alunos."
            : "A turma foi ocultada dos alunos, mas o histórico foi preservado.",
        }
      );
      router.refresh();
      router.push(`/professor/turmas/${turmaId}`);
    } catch (error) {
      toast.error("Falha ao alterar status da turma.", {
        description: "Tente novamente mais tarde.",
      });
    } finally {
      setIsArchiving(false);
    }
  }

  const hasChanges = form.formState.isDirty;

  return (
    <div className="space-y-6">
      
      {/* SEÇÃO 1: Informações Básicas */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">
                Informações da Turma
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Atualize o nome e descrição visualizados pelos alunos
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold text-slate-900">
                      Nome da Turma *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        className="h-12 text-base"
                        placeholder="Ex: Automação Industrial - Módulo I"
                      />
                    </FormControl>
                    <FormDescription>
                      Nome principal exibido no dashboard e nas listagens
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold text-slate-900">
                      Descrição (Opcional)
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        className="resize-none min-h-28 text-base"
                        placeholder="Adicione informações adicionais sobre a turma, como objetivos, período letivo, ou instruções gerais..."
                      />
                    </FormControl>
                    <FormDescription>
                      Máximo de 200 caracteres · {field.value?.length || 0}/200
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between pt-6 border-t">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  {hasChanges ? (
                    <>
                      <Info className="h-4 w-4 text-amber-500" />
                      <span>Você tem alterações não salvas</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Todas as alterações estão salvas</span>
                    </>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  disabled={loading || !hasChanges}
                  size="lg"
                  className={cn(
                    "gap-2 px-8 font-semibold transition-all",
                    hasChanges
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: Código de Acesso */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50/50 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">
                Código de Acesso
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Compartilhe este código com os alunos para que eles possam se matricular
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex items-center justify-between p-6 bg-gradient-to-br from-purple-50 to-pink-50/30 rounded-2xl border-2 border-purple-200/60">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">
                Código da Turma
              </p>
              <p className="text-4xl font-bold font-mono text-purple-700 tracking-wider">
                {turma.codigo}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(turma.codigo);
                toast.success("Código copiado!", {
                  description: "O código foi copiado para a área de transferência.",
                });
              }}
              className="border-purple-300 hover:bg-purple-50 hover:border-purple-400"
            >
              Copiar Código
            </Button>
          </div>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Como os alunos usam este código?</p>
                <p className="text-blue-700 leading-relaxed">
                  Os alunos devem acessar a plataforma, ir em "Minhas Turmas" e clicar em "Entrar em uma Turma". 
                  Ao inserir este código, eles serão matriculados automaticamente.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 3: Zona de Perigo */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <div className={cn(
          "relative overflow-hidden",
          turma.ativo 
            ? "bg-gradient-to-br from-red-50 via-orange-50 to-red-50/50" 
            : "bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50/50"
        )}>
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          </div>
          
          <CardContent className="p-8 relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-3 rounded-2xl shadow-lg",
                    turma.ativo 
                      ? "bg-gradient-to-br from-red-500 to-orange-500" 
                      : "bg-gradient-to-br from-emerald-500 to-teal-500"
                  )}>
                    {turma.ativo ? (
                      <Archive className="h-6 w-6 text-white" />
                    ) : (
                      <ArchiveRestore className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <h3 className={cn(
                    "text-2xl font-bold",
                    turma.ativo ? "text-red-900" : "text-emerald-900"
                  )}>
                    {turma.ativo ? "Arquivar Turma" : "Turma Arquivada"}
                  </h3>
                </div>
                
                <p className={cn(
                  "text-base leading-relaxed",
                  turma.ativo ? "text-red-700" : "text-emerald-700"
                )}>
                  {turma.ativo 
                    ? "Ao arquivar, a turma ficará oculta para os alunos e impedirá novas interações. Todo o histórico, incluindo simulados, notas e materiais, será preservado e poderá ser reativado a qualquer momento."
                    : "Esta turma está arquivada e não está visível para os alunos. Reative-a para que os alunos possam acessá-la novamente e retomar as atividades."}
                </p>

                {/* Stats quando ativo (aviso) */}
                {turma.ativo && (
                  <div className="flex items-center gap-2 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl mt-4">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-900 font-medium">
                      Esta ação afetará {turma._count?.alunos || 0} aluno(s) ativo(s)
                    </p>
                  </div>
                )}
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    size="lg"
                    className={cn(
                      "gap-2 px-8 py-6 text-base font-semibold shadow-xl hover:shadow-2xl transition-all flex-shrink-0",
                      turma.ativo 
                        ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white" 
                        : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                    )}
                  >
                    {turma.ativo ? (
                      <>
                        <Archive className="h-5 w-5" />
                        Arquivar Turma
                      </>
                    ) : (
                      <>
                        <ArchiveRestore className="h-5 w-5" />
                        Reativar Turma
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                
                <AlertDialogContent className="max-w-md bg-white/95 backdrop-blur-sm border-slate-200 shadow-2xl">
                  {/* Icon Header */}
                  <div className="flex justify-center mb-4">
                    <div className={cn(
                      "p-4 rounded-2xl",
                      turma.ativo 
                        ? "bg-gradient-to-br from-red-100 to-orange-100" 
                        : "bg-gradient-to-br from-emerald-100 to-teal-100"
                    )}>
                      {turma.ativo ? (
                        <AlertTriangle className="h-10 w-10 text-red-600" />
                      ) : (
                        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                      )}
                    </div>
                  </div>
                  
                  <AlertDialogHeader className="text-center space-y-3">
                    <AlertDialogTitle className="text-2xl font-bold text-slate-900">
                      {turma.ativo ? "Arquivar esta turma?" : "Reativar esta turma?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-base text-slate-600 leading-relaxed">
                      {turma.ativo 
                        ? "Os alunos não poderão mais ver ou acessar esta turma até que ela seja reativada. Todos os dados serão preservados."
                        : "A turma ficará visível imediatamente para todos os alunos matriculados e eles poderão retomar as atividades."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  
                  {turma.ativo && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-amber-900">
                            Impacto
                          </p>
                          <p className="text-xs text-amber-700 leading-relaxed">
                            Esta ação afetará {turma._count?.alunos || 0} aluno(s) ativo(s). 
                            Eles perderão acesso aos materiais e simulados até a reativação.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
                    <AlertDialogCancel 
                      disabled={isArchiving}
                      className="w-full sm:w-auto border-slate-300 hover:bg-slate-50 font-medium"
                    >
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={(e) => {
                        e.preventDefault();
                        toggleStatus();
                      }}
                      disabled={isArchiving}
                      className={cn(
                        "w-full sm:w-auto shadow-lg hover:shadow-xl transition-all font-semibold",
                        turma.ativo 
                          ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700" 
                          : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                      )}
                    >
                      {isArchiving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processando...
                        </>
                      ) : turma.ativo ? (
                        <>
                          <Archive className="h-4 w-4 mr-2" />
                          Sim, arquivar turma
                        </>
                      ) : (
                        <>
                          <ArchiveRestore className="h-4 w-4 mr-2" />
                          Sim, reativar turma
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
