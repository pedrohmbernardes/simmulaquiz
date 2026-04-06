"use client";

import { useState } from "react";
import { Send, Pin, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch"; // ✅ Importando o hook seguro

interface PostComposerProps {
  turmaId: string;
  onSuccess: () => void;
}

export default function PostComposer({ turmaId, onSuccess }: PostComposerProps) {
  const secureFetch = useSecureFetch(); // ✅ Inicializa o fetch seguro

  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [fixado, setFixado] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titulo.trim() || !conteudo.trim()) return;

    setLoading(true);

    try {
      // ✅ SUBSTITUIÇÃO: fetch -> secureFetch
      // Removemos headers manuais e JSON.stringify manual
      const res = await secureFetch(`/api/professor/turmas/${turmaId}/avisos`, {
        method: "POST",
        body: {
          titulo,
          conteudo, // Mantendo o nome da variável que você usa (conteudo vs mensagem)
          mensagem: conteudo, // API pode esperar 'mensagem', então enviamos ambos por garantia ou ajuste conforme sua API
          fixado,
          anexos: [] // MVP: Anexos virão na v2
        },
      });

      // secureFetch lança erro se for 401/403, mas para outros erros (500/400) checamos o ok
      if (!res.ok) throw new Error("Erro ao publicar aviso");

      toast.success("Aviso publicado com sucesso!");
      
      // Reset do form
      setTitulo("");
      setConteudo("");
      setFixado(false);
      setIsExpanded(false);
      
      // Atualiza a lista pai
      onSuccess();

    } catch (error) {
      console.error(error); // Útil para debug
      toast.error("Não foi possível publicar o aviso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "bg-white rounded-xl border shadow-sm transition-all duration-200 overflow-hidden",
      isExpanded ? "ring-2 ring-blue-100 border-blue-200" : "border-slate-200"
    )}>
      
      {/* Estado Recolhido (Placeholder) */}
      {!isExpanded && (
        <div 
          onClick={() => setIsExpanded(true)}
          className="p-4 flex items-center gap-4 cursor-text"
        >
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <span className="font-bold text-lg">P</span>
          </div>
          <p className="text-slate-500 hover:text-slate-600 flex-1">
            Anuncie algo para a turma...
          </p>
        </div>
      )}

      {/* Estado Expandido (Formulário) */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
          
          {/* Título */}
          <input
            type="text"
            placeholder="Título do aviso"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full text-lg font-bold placeholder:text-slate-300 border-none focus:ring-0 px-0 py-1 focus:outline-none"
            required
            autoFocus
          />

          {/* Conteúdo */}
          <textarea
            placeholder="Escreva os detalhes..."
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={4}
            className="w-full resize-none text-slate-700 placeholder:text-slate-300 border-none focus:ring-0 px-0 py-0 focus:outline-none"
            required
          />

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Botão Fixar */}
              <button
                type="button"
                onClick={() => setFixado(!fixado)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  fixado 
                    ? "bg-blue-100 text-blue-700" 
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                )}
              >
                <Pin size={16} className={fixado ? "fill-current" : ""} />
                {fixado ? "Fixado no topo" : "Fixar aviso"}
              </button>

              {/* Botão Anexo (Visual apenas no MVP) */}
              <button
                type="button"
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full"
                title="Adicionar anexo (Em breve)"
                disabled
              >
                <Paperclip size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                disabled={loading || !titulo || !conteudo}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    Postar <Send size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}