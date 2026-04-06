"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

interface DeletarMaterialButtonProps {
  turmaId: number;
  materialId: number;
  titulo: string;
}

export function DeletarMaterialButton({ turmaId, materialId, titulo }: DeletarMaterialButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/materiais/${materialId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao excluir material");
      }

      toast.success("Material excluído com sucesso!", {
        description: "O material foi removido da biblioteca da turma.",
      });
      
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error("Erro ao excluir material", {
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-all"
        >
          <Trash2 size={16} className="text-slate-600 hover:text-red-600" />
        </Button>
      </AlertDialogTrigger>
      
      <AlertDialogContent className="max-w-md bg-white/95 backdrop-blur-sm border-slate-200 shadow-2xl">
        {/* Icon Header */}
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-gradient-to-br from-red-100 to-orange-100 rounded-2xl">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>
        </div>
        
        <AlertDialogHeader className="text-center space-y-3">
          <AlertDialogTitle className="text-2xl font-bold text-slate-900">
            Excluir este material?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-slate-600 leading-relaxed">
            Você está prestes a excluir <strong className="text-slate-900">"{titulo}"</strong>. 
            Esta ação é <strong className="text-slate-900">permanente e irreversível</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* Warning Box */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">
                Atenção
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Os alunos não poderão mais acessar este material após a exclusão.
              </p>
            </div>
          </div>
        </div>
        
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
          <AlertDialogCancel 
            disabled={loading}
            className="w-full sm:w-auto border-slate-300 hover:bg-slate-50 font-medium"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={loading}
            className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Sim, excluir material
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
