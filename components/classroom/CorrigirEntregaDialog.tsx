"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, PenTool, CheckCircle2, Award } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

const formSchema = z.object({
  nota: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "A nota deve ser um número positivo.",
  }),
  feedback: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CorrigirEntregaDialogProps {
  turmaId: number;
  tarefaId: number;
  entrega: {
    id: number;
    nota?: number | null;
    feedback?: string | null;
  };
  notaMaxima: number;
  alunoNome: string;
  trigger?: React.ReactNode;
}

export function CorrigirEntregaDialog({
  turmaId,
  tarefaId,
  entrega,
  notaMaxima,
  alunoNome,
  trigger,
}: CorrigirEntregaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nota: entrega.nota?.toString() || "",
      feedback: entrega.feedback || "",
    },
  });

  async function onSubmit(values: FormValues) {
    const notaNumerica = Number(values.nota);

    if (notaNumerica > notaMaxima) {
      form.setError("nota", {
        type: "manual",
        message: `A nota não pode ser maior que o máximo (${notaMaxima}).`,
      });
      return;
    }

    setLoading(true);
    try {
      const res = await secureFetch(
        `/api/professor/turmas/${turmaId}/tarefas/${tarefaId}/entregas/${entrega.id}`,
        {
          method: "PATCH",
          body: {
            nota: notaNumerica,
            feedback: values.feedback,
          },
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao salvar correção");
      }

      toast.success("Correção salva com sucesso!", {
        description: `Nota atribuída: ${notaNumerica}/${notaMaxima} pontos`,
      });
      
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error("Erro ao corrigir", {
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            size="sm" 
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md"
          >
            <PenTool size={14} className="mr-2" />
            Corrigir
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl">
              <Award className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-slate-900">
                Avaliar Entrega
              </DialogTitle>
              <DialogDescription className="text-base text-slate-600">
                Atribuindo nota para <strong className="text-slate-900">{alunoNome}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Info Card */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Valor máximo da atividade:</span>
            <span className="text-2xl font-bold text-blue-700">{notaMaxima} pts</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-2">
            <FormField
              control={form.control}
              name="nota"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold text-slate-900">
                    Nota Atribuída *
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="0"
                        className="h-14 text-2xl font-bold pl-6 pr-20 text-center"
                        {...field}
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg text-slate-400 font-semibold">
                        / {notaMaxima}
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="feedback"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold text-slate-900">
                    Feedback para o Aluno (Opcional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Deixe um comentário sobre o trabalho do aluno, pontos fortes, áreas de melhoria..."
                      className="resize-none min-h-[120px] text-base"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="border-slate-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all min-w-[160px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Salvar Correção
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
