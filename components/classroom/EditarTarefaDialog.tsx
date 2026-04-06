"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

const formSchema = z.object({
  titulo: z.string().min(3, "Título obrigatório"),
  descricao: z.string().optional(),
  dataEntrega: z.string().optional().refine((val) => {
    if (!val) return true;
    return true; 
  }, {
    message: "Data inválida.",
  }),
  notaMaxima: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = Number(val);
    return !isNaN(num) && num >= 0 && num <= 1000;
  }, {
    message: "A nota deve ser um número válido entre 0 e 1000.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface EditarTarefaDialogProps {
  turmaId: number;
  tarefa: {
    id: number;
    titulo: string;
    descricao: string | null;
    dataEntrega: Date | null;
    notaMaxima: number;
  };
  trigger?: React.ReactNode; // Permite customizar o botão de abertura
}

export function EditarTarefaDialog({ turmaId, tarefa, trigger }: EditarTarefaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  const formatDataInput = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 16);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: tarefa.titulo,
      descricao: tarefa.descricao || "",
      dataEntrega: formatDataInput(tarefa.dataEntrega),
      notaMaxima: String(tarefa.notaMaxima),
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

      const res = await secureFetch(`/api/professor/turmas/${turmaId}/tarefas/${tarefa.id}`, {
        method: "PATCH",
        body: {
          titulo: values.titulo,
          descricao: values.descricao,
          dataEntrega: dataEntregaISO,
          notaMaxima: notaFinal
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao atualizar tarefa");
      }

      toast.success("Tarefa atualizada com sucesso!");
      
      // ORDEM CRÍTICA PARA REFRESH INSTANTÂNEO
      setOpen(false);
      router.refresh();

    } catch (error: any) {
      toast.error("Erro ao atualizar", {
        description: error.message || "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? trigger : (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-slate-600 hover:text-indigo-600"
          >
            <Edit size={16} />
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] bg-white/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Editar Tarefa
          </DialogTitle>
          <DialogDescription className="text-base">
            Altere os detalhes da atividade avaliativa.
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
                      className="resize-none min-h-[120px] text-base" 
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
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Edit size={18} className="mr-2" />
                    Salvar Alterações
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