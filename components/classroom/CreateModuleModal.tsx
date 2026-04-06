"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, FolderPlus, Sparkles } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

const formSchema = z.object({
  titulo: z.string().min(2, "O título deve ter pelo menos 2 caracteres").max(100),
  descricao: z.string().max(500).optional(),
  publicado: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateModuleModalProps {
  turmaId: string;
  variant?: "default" | "cta";
}

export function CreateModuleModal({ turmaId, variant = "default" }: CreateModuleModalProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      publicado: false,
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: FormValues) {
    try {
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/modulos`, {
        method: "POST",
        body: values,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao criar módulo");
      }

      toast.success("Módulo criado com sucesso!", {
        description: "O módulo foi adicionado à estrutura da turma.",
      });
      
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (error: any) {
      toast.error("Erro ao criar módulo", {
        description: error.message || "Tente novamente mais tarde.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* CORREÇÃO HYDRATION ERROR: 
         Movemos o DialogTrigger para dentro da condicional.
         O asChild exige um filho único e direto. Ao envolver o ternário,
         o React podia se perder na hidratação do HTML.
      */}
      {variant === "cta" ? (
        <DialogTrigger asChild>
          <Button 
            size="lg"
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all px-8 py-6"
          >
            <Sparkles size={20} />
            Criar Primeiro Módulo
          </Button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button 
            size="lg"
            className="gap-2 bg-white text-blue-700 hover:bg-blue-50 shadow-xl hover:shadow-2xl transition-all font-semibold px-6 py-6 text-base border-2 border-blue-100"
          >
            <FolderPlus size={20} />
            Novo Módulo
          </Button>
        </DialogTrigger>
      )}
      
      <DialogContent className="sm:max-w-[600px] bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Criar Novo Módulo
          </DialogTitle>
          <DialogDescription className="text-base text-slate-600">
            Organize o conteúdo da sua turma em seções lógicas.
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
                    Título do Módulo *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Ex: Introdução à Automação"
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
                    Descrição (Opcional)
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field}
                      placeholder="Breve resumo do que será abordado..." 
                      className="resize-none min-h-[100px] text-base"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="publicado"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border-2 border-slate-200 p-4 bg-slate-50">
                  <div className="space-y-1">
                    <FormLabel className="text-base font-semibold text-slate-900">
                      Publicar agora?
                    </FormLabel>
                    <div className="text-sm text-slate-600">
                      Se desmarcado, o módulo ficará visível apenas para você.
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                className="border-slate-300"
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Criar Módulo
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