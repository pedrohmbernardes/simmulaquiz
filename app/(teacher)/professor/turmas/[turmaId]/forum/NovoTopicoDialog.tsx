"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

const formSchema = z.object({
  titulo:   z.string().min(5, "O título deve ter pelo menos 5 caracteres").max(100),
  conteudo: z.string().min(10, "Detalhe melhor sua dúvida ou aviso").max(2000),
});

interface NovoTopicoDialogProps {
  turmaId: number;
}

export function NovoTopicoDialog({ turmaId }: NovoTopicoDialogProps) {
  const router      = useRouter();
  const secureFetch = useSecureFetch();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { titulo: "", conteudo: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      await secureFetch(`/api/professor/turmas/${turmaId}/forum`, {
        method: "POST",
        body: values,
      });
      toast.success("Tópico criado com sucesso!");
      form.reset();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("Erro ao publicar no fórum.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="gap-2 bg-white text-indigo-700 hover:bg-indigo-50 shadow-xl hover:shadow-2xl transition-all font-semibold px-6 py-6 text-base"
        >
          <MessageSquarePlus size={20} />
          Novo Tópico
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
        {/* Header com gradiente */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-6 pt-6 pb-5">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-2xl" />
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-xl font-bold">
                Criar Novo Tópico
              </DialogTitle>
              <DialogDescription className="text-white/70 text-sm mt-0.5">
                Publique uma dúvida, aviso ou discussão para a turma.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 pt-5 pb-6 space-y-5">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold text-slate-900">Título *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Resumo do assunto..."
                      className="h-12 text-base border-slate-200 focus-visible:ring-indigo-500"
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
                  <FormLabel className="text-base font-semibold text-slate-900">Conteúdo *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Escreva os detalhes aqui..."
                      className="min-h-[150px] resize-none text-base border-slate-200 focus-visible:ring-indigo-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="border-slate-300 hover:bg-slate-50 font-medium"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold min-w-[130px]"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando...</>
                ) : (
                  <><MessageSquarePlus className="mr-2 h-4 w-4" /> Publicar</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
