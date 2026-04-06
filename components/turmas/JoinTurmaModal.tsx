"use client";

import { useState } from "react";
import { X, Loader2, Hash, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useCsrf } from "@/lib/hooks/use-csrf"; // ✅ 1. Importar o hook CSRF

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
  const csrfToken = useCsrf(); // ✅ 2. Obter o token de segurança
  const [loading, setLoading] = useState(false);
  const [codigo, setCodigo] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (codigo.length < 3) {
      toast.error("O código parece muito curto.");
      return;
    }

    // ✅ 3. Validação de segurança no cliente
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
          "x-csrf-token": csrfToken // ✅ 4. Enviar o token no cabeçalho
        },
        body: JSON.stringify({ codigo: codigo.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao entrar na turma.");
      }

      toast.success("Sucesso! Você entrou na turma.");
      
      setCodigo("");
      onSuccess(); // Atualiza a lista e fecha
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Não foi possível encontrar essa turma.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header Visual */}
        <div className="bg-indigo-600 px-6 py-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-12 w-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-3">
              <Hash className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold">Participar de Turma</h2>
            <p className="text-indigo-100 text-sm mt-1">
              Insira o código compartilhado pelo seu professor.
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 pt-8">
          <div className="space-y-4">
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
                  placeholder="Ex: TUR-2026-X9Z"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  className="w-full text-center text-2xl font-mono uppercase tracking-widest rounded-xl border-2 border-slate-200 px-4 py-4 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-300 placeholder:tracking-normal transition-all"
                />
              </div>
              <p className="text-xs text-center text-slate-400 mt-2">
                O código geralmente tem letras e números.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || codigo.length < 3}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
          <p className="text-xs text-slate-500">
            Ao entrar, seu nome e foto ficarão visíveis para o professor.
          </p>
        </div>
      </div>
    </div>
  );
}