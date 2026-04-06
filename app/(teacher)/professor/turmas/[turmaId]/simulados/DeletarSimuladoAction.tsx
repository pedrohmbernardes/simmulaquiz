"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

interface DeletarSimuladoActionProps {
  simuladoId: number;
  turmaId: number;
}

export function DeletarSimuladoAction({ simuladoId, turmaId }: DeletarSimuladoActionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/agendamentos/${simuladoId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao excluir simulado.");
      }

      toast.success("Simulado excluído com sucesso!", {
        description: "O agendamento foi removido permanentemente.",
      });
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error("Não foi possível excluir este agendamento.", {
        description: error.message || "Tente novamente mais tarde ou entre em contato com o suporte.",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem 
          onSelect={(e) => e.preventDefault()} 
          className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer flex items-center gap-2 font-medium"
        >
          <Trash2 size={16} className="text-red-600" /> 
          Excluir Agendamento
        </DropdownMenuItem>
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
            Excluir Simulado?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-slate-600 leading-relaxed">
            Esta ação é <strong className="text-slate-900">permanente e irreversível</strong>. 
            O agendamento será removido e os alunos perderão o acesso a esta prova.
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
                Todos os dados relacionados a este simulado serão perdidos permanentemente.
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
            className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all font-semibold"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Sim, excluir permanentemente
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
