"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, PenLine } from "lucide-react";
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

interface EditModuleDialogProps {
  turmaId: string;
  modulo: {
    id: number;
    titulo: string;
    descricao?: string | null;
    publicado: boolean;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditModuleDialog({ turmaId, modulo, open, onOpenChange }: EditModuleDialogProps) {
  const router = useRouter();
  const secureFetch = useSecureFetch();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: modulo.titulo,
      descricao: modulo.descricao || "",
      publicado: modulo.publicado,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        titulo: modulo.titulo,
        descricao: modulo.descricao || "",
        publicado: modulo.publicado,
      });
    }
  }, [modulo, open, form]);

  async function onSubmit(values: FormValues) {
    try {
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/modulos/${modulo.id}`, {
        method: "PATCH",
        body: values,
      });

      if (!res.ok) {
        throw new Error("Erro ao atualizar módulo");
      }

      toast.success("Módulo atualizado com sucesso!");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error("Erro ao salvar alterações.", {
        description: "Tente novamente mais tarde.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Editar Módulo
          </DialogTitle>
          <DialogDescription className="text-base text-slate-600">
            Faça alterações no título, descrição ou visibilidade.
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
                    Título *
                  </FormLabel>
                  <FormControl>
                    <Input {...field} className="h-12 text-base" />
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
                      Publicado
                    </FormLabel>
                    <div className="text-sm text-slate-600">
                      Visível para os alunos?
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
                onClick={() => onOpenChange(false)}
                className="border-slate-300"
                disabled={form.formState.isSubmitting}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={form.formState.isSubmitting} 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all min-w-[140px]"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <PenLine className="mr-2 h-4 w-4" />
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
