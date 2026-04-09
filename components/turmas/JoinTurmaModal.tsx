"use client";

import { useState } from "react";
import { X, Loader2, Hash, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useCsrf } from "@/lib/hooks/use-csrf";

interface JoinTurmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function JoinTurmaModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: JoinTurmaModalProps) {
  const csrfToken = useCsrf(); 
  const [loading, setLoading] = useState(false);
  const [codigo, setCodigo] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (codigo.length < 3) {
      toast.error("O código parece muito curto.");
      return;
    }

    if (!csrfToken) {
      toast.error("Sessão inválida ou token expirado. Recarregue a página.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/estudante/turmas/entrar", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken 
        },
        body: JSON.stringify({ codigo: codigo.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao entrar na turma.");
      }

      toast.success("Sucesso! Você entrou na turma.");
      
      setCodigo("");
      onSuccess(); 
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Não foi possível encontrar essa turma.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
        
        {/* Header Visual com Gradiente correspondente à página */}
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-14 w-14 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner flex items-center justify-center mb-4 transform rotate-3">
              <Hash className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Participar de Turma</h2>
            <p className="text-fuchsia-100 text-sm mt-1.5 font-medium">
              Insira o código compartilhado pelo professor
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8">
          <div className="space-y-6">
            <div>
              <label htmlFor="codigo" className="sr-only">
                Código da Turma
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="codigo"
                  required
                  autoFocus
                  placeholder="EX: TUR-X9Z"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  className="w-full text-center text-2xl md:text-3xl font-mono uppercase tracking-[0.2em] rounded-2xl border-2 border-slate-200 px-4 py-5 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10 placeholder:text-slate-300 placeholder:tracking-normal transition-all"
                />
              </div>
              <p className="text-[11px] md:text-xs text-center text-slate-400 mt-3">
                Dica: O código costuma ter uma mistura de letras e números.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || codigo.length < 3}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-4 text-base font-bold text-white shadow-lg shadow-violet-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  Entrar na Turma
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Seu perfil ficará visível para o professor da turma.
          </p>
        </div>
      </div>
    </div>
  );
}