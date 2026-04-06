"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

const formSchema = z.object({
  titulo: z.string().min(3, "Mínimo 3 caracteres"),
  descricao: z.string().optional(),
  tipo: z.enum(["VIDEO_YOUTUBE", "PDF_UPLOAD", "GOOGLE_DRIVE", "LINK_EXTERNO"]),
  url: z.string().url("URL inválida"),
});

type FormValues = z.infer<typeof formSchema>;

interface NovoMaterialDialogProps {
  turmaId: string | number;
  variant?: "default" | "cta";
  moduloId?: number; 
  triggerText?: string; 
  className?: string;
  trigger?: React.ReactNode;
  // 1. Adicionadas propriedades de controle externo
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NovoMaterialDialog({ 
  turmaId, 
  variant = "default", 
  moduloId,
  triggerText = "Novo Material",
  className,
  trigger,
  // 2. Recebendo propriedades de controle
  open: externalOpen,
  onOpenChange: setExternalOpen
}: NovoMaterialDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  // 3. Lógica para decidir quem controla o modal (Pai ou Estado Interno)
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled && setExternalOpen ? setExternalOpen : setInternalOpen;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      tipo: "LINK_EXTERNO",
      url: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const payload = {
        ...values,
        moduloId: moduloId
      };

      const res = await secureFetch(`/api/professor/turmas/${turmaId}/materiais`, {
        method: "POST",
        body: payload,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao adicionar material");
      }

      toast.success("Material adicionado com sucesso!", {
        description: moduloId 
          ? "O material foi vinculado ao módulo." 
          : "O material está disponível na biblioteca da turma.",
      });
      
      form.reset();
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error("Erro ao adicionar material", {
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* 4. Só exibe o Trigger se NÃO for controlado externamente ou se um trigger explicito for passado.
          Isso evita que o botão "Novo Material" apareça solto quando o modal é aberto via DropdownMenu. */}
      {(!isControlled || trigger) && (
        <DialogTrigger asChild>
          {trigger ? trigger : (
            variant === "cta" ? (
              <Button 
                size="lg"
                className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all px-8 py-6"
              >
                <Sparkles size={20} />
                {triggerText}
              </Button>
            ) : (
              <Button 
                size="sm"
                className={`gap-2 bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-100 shadow-sm transition-all font-semibold ${className}`}
              >
                <Plus size={16} />
                {triggerText}
              </Button>
            )
          )}
        </DialogTrigger>
      )}
      
      <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {moduloId ? "Adicionar Material ao Módulo" : "Novo Material"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {moduloId 
              ? "O material criado será adicionado automaticamente ao final deste módulo."
              : "Compartilhe vídeos, PDFs, links ou arquivos com a turma."
            }
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
                    <Input 
                      {...field} 
                      placeholder="Ex: Apostila de Automação Industrial"
                      className="h-12 text-base"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold text-slate-900">
                    Tipo de Material *
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="VIDEO_YOUTUBE">Vídeo do YouTube</SelectItem>
                      <SelectItem value="PDF_UPLOAD">PDF (Upload)</SelectItem>
                      <SelectItem value="GOOGLE_DRIVE">Google Drive</SelectItem>
                      <SelectItem value="LINK_EXTERNO">Link Externo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold text-slate-900">
                    URL *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="https://..."
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
                      placeholder="Adicione uma descrição sobre o material..."
                      className="min-h-24 resize-none text-base"
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
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  "Adicionar Material"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}