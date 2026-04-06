"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, ClipboardList, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  titulo: z.string().min(3, "Título obrigatório"),
  descricao: z.string().optional(),
  dataEntrega: z.string().optional().refine((val) => {
    if (!val) return true;
    return new Date(val) > new Date();
  }, {
    message: "A data de entrega deve ser futura.",
  }),
  notaMaxima: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = Number(val);
    return !isNaN(num) && num >= 0 && num <= 1000;
  }, {
    message: "A nota deve ser um número válido.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface NovaTarefaDialogProps {
  turmaId: string | number;
  moduloId?: number;
  trigger?: React.ReactNode;
  className?: string;
  triggerText?: string;
}

export function NovaTarefaDialog({ 
  turmaId, 
  moduloId, 
  trigger, 
  triggerText = "Nova Tarefa",
  className 
}: NovaTarefaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      dataEntrega: "", 
      notaMaxima: "10",
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const dataEntregaISO = values.dataEntrega 
        ? new Date(values.dataEntrega).toISOString() 
        : null;

      const notaFinal = values.notaMaxima && values.notaMaxima.trim() !== "" 
        ? Number(values.notaMaxima) 
        : 10;

      const payload = {
        titulo: values.titulo,
        descricao: values.descricao,
        dataEntrega: dataEntregaISO,
        notaMaxima: notaFinal,
        tipo: "ENVIO_ARQUIVO", 
        moduloId: moduloId
      };

      const res = await secureFetch(`/api/professor/turmas/${turmaId}/tarefas`, {
        method: "POST",
        body: payload,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao criar tarefa.");
      }

      toast.success("Tarefa criada com sucesso!", {
        description: moduloId ? "A tarefa foi vinculada ao módulo." : "A tarefa está disponível para os alunos.",
      });
      
      setOpen(false);
      form.reset();
      router.refresh();

    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao criar tarefa", {
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
            size="lg"
            className="gap-2 bg-white text-violet-700 hover:bg-violet-50 shadow-xl hover:shadow-2xl transition-all font-semibold px-6 py-6 text-base border-2 border-violet-100"
          >
            <ClipboardList size={20} />
            {triggerText}
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[700px] bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Nova Tarefa
          </DialogTitle>
          <DialogDescription className="text-base text-slate-600">
            Crie uma atividade avaliativa {moduloId ? "dentro deste módulo" : "para sua turma"}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold text-slate-900">
                    Título da Tarefa *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      placeholder="Ex: Redação: O Futuro da IA" 
                      value={field.value || ''} 
                      className="h-12 text-base" 
                    />
                  </FormControl>
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
                    Instruções (Opcional)
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field}
                      placeholder="Descreva o que o aluno deve fazer, critérios de avaliação, etc..." 
                      className="resize-none min-h-[120px] text-base" 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="dataEntrega"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold text-slate-900">
                      Prazo de Entrega
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field} 
                        value={field.value || ''} 
                        className="h-12 text-base" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notaMaxima"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold text-slate-900">
                      Nota Máxima
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="number" 
                          min="0" 
                          max="1000" 
                          {...field} 
                          value={field.value || ''} 
                          className="h-12 text-base pr-12"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">
                          pts
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 pt-4">
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
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus size={18} className="mr-2" />
                    Criar Tarefa
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
