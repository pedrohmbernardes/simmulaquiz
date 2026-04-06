"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, UserMinus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

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

interface AprovarAlunoButtonProps {
  turmaId: number;
  alunoId: number;
  nome: string;
  tipo: "APROVAR" | "REJEITAR" | "REMOVER";
}

export function AprovarAlunoButton({ turmaId, alunoId, nome, tipo }: AprovarAlunoButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const secureFetch = useSecureFetch();

  async function handleAction() {
    setLoading(true);
    try {
      let method   = "PATCH";
      let endpoint = `/api/professor/turmas/${turmaId}/alunos`;
      let body: any = { alunoId, acao: "APROVAR" };

      if (tipo === "REJEITAR" || tipo === "REMOVER") {
        method   = "DELETE";
        endpoint = `/api/professor/turmas/${turmaId}/alunos?alunoId=${alunoId}`;
        body     = undefined;
      }

      const res = await secureFetch(endpoint, { method, body });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha na operação");
      }

      toast.success(
        tipo === "APROVAR"  ? "Aluno aprovado com sucesso!" :
        tipo === "REJEITAR" ? "Solicitação rejeitada."      : "Aluno removido da turma."
      );
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar solicitação.");
    } finally {
      setLoading(false);
    }
  }

  if (tipo === "REMOVER") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <UserMinus size={16} />}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-md bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-br from-red-100 to-orange-100 rounded-2xl">
              <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
          </div>
          <AlertDialogHeader className="text-center space-y-2">
            <AlertDialogTitle className="text-2xl font-bold text-slate-900">
              Remover Aluno?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-slate-600 leading-relaxed">
              Tem certeza que deseja remover <strong className="text-slate-900">{nome}</strong> da turma?
              Ele perderá acesso a todos os materiais e atividades.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <AlertDialogCancel className="w-full sm:w-auto border-slate-300 hover:bg-slate-50 font-medium">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg font-semibold"
            >
              <UserMinus className="h-4 w-4 mr-2" />
              Confirmar Remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button
      size="sm"
      className={`w-full gap-1.5 font-semibold shadow-sm transition-all ${
        tipo === "APROVAR"
          ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-md hover:shadow-lg"
          : "bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300"
      }`}
      onClick={handleAction}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {tipo === "APROVAR" ? <Check size={15} /> : <X size={15} />}
          {tipo === "APROVAR" ? "Aprovar" : "Rejeitar"}
        </>
      )}
    </Button>
  );
}
