"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Clock } from "lucide-react";
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

interface EncerrarSimuladoActionProps {
  simuladoId: number;
  turmaId: number;
}

export function EncerrarSimuladoAction({ simuladoId, turmaId }: EncerrarSimuladoActionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  const handleEncerrar = async () => {
    setLoading(true);
    try {
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/agendamentos/${simuladoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ENCERRADO" }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao encerrar simulado.");
      }

      toast.success("Simulado encerrado com sucesso!", {
        description: "Nenhum aluno poderá mais iniciar ou continuar este simulado.",
      });
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error("Não foi possível encerrar este simulado.", {
        description: error.message || "Tente novamente mais tarde.",
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
          className="text-amber-600 focus:text-amber-700 focus:bg-amber-50 cursor-pointer flex items-center gap-2 font-medium"
        >
          <AlertCircle size={16} className="text-amber-600" /> 
          Encerrar Agora
        </DropdownMenuItem>
      </AlertDialogTrigger>
      
      <AlertDialogContent className="max-w-md bg-white/95 backdrop-blur-sm border-slate-200 shadow-2xl">
        {/* Icon Header */}
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl">
            <Clock className="h-10 w-10 text-amber-600" />
          </div>
        </div>
        
        <AlertDialogHeader className="text-center space-y-3">
          <AlertDialogTitle className="text-2xl font-bold text-slate-900">
            Encerrar Simulado?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-slate-600 leading-relaxed">
            Esta ação encerrará <strong className="text-slate-900">imediatamente</strong> o simulado. 
            Alunos que ainda não iniciaram perderão o acesso e os que estão fazendo terão suas provas finalizadas automaticamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* Warning Box */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">
                Atenção
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Esta ação não pode ser desfeita. Alunos em andamento terão suas respostas atuais salvas, mas não poderão continuar.
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
              handleEncerrar();
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Encerrando...
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Sim, encerrar agora
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
