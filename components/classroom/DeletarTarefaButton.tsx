"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

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
import { Button } from "@/components/ui/button";

interface DeletarTarefaButtonProps {
  turmaId: number | string;
  tarefaId: number | string;
  titulo: string;
}

export function DeletarTarefaButton({ turmaId, tarefaId, titulo }: DeletarTarefaButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/tarefas/${tarefaId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Erro ao excluir");

      toast.success("Tarefa excluída com sucesso!", {
        description: "A tarefa e todas as entregas foram removidas.",
      });
      
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("Erro ao excluir tarefa", {
        description: "Não foi possível excluir a tarefa. Tente novamente.",
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
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-red-600" />
          ) : (
            <Trash2 size={16} className="text-slate-600 hover:text-red-600" />
          )}
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
            Excluir esta tarefa?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-slate-600 leading-relaxed">
            Você está prestes a excluir <strong className="text-slate-900">"{titulo}"</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* Warning Box */}
        <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900">
                Atenção: Esta ação é irreversível
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Isso excluirá permanentemente a tarefa e <strong>todas as entregas e notas</strong> associadas.
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
                Sim, excluir tarefa
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
