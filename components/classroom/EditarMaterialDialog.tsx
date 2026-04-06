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

interface EditarMaterialDialogProps {
  turmaId: number;
  material: {
    id: number;
    titulo: string;
    descricao: string | null;
    tipo: string;
    url: string;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode; 
}

export function EditarMaterialDialog({ 
  turmaId, 
  material,
  trigger 
}: EditarMaterialDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch(); 

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: material.titulo,
      descricao: material.descricao || "",
      tipo: material.tipo as any,
      url: material.url,
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/materiais/${material.id}`, {
        method: "PATCH",
        body: values,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao atualizar material");
      }

      toast.success("Material atualizado com sucesso!");
      
      // 1. Fecha o modal primeiro para melhor UX
      setOpen(false);
      
      // 2. Força o refresh dos dados na página
      // O startTransition é implícito no refresh, mas garante que a UI atualize
      router.refresh();

    } catch (error: any) {
      toast.error("Erro ao atualizar material", {
        description: error.message || "Tente novamente mais tarde.",
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
            className="h-8 w-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
          >
            <Edit size={16} />
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Editar Material
          </DialogTitle>
          <DialogDescription className="text-base">
            Atualize as informações do material
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
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