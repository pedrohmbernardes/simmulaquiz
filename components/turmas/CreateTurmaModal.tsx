"use client";

import { useState } from "react";
import { X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
// 1. Importe o seu hook customizado (ajuste o caminho se necessário)
import { useSecureFetch } from "@/lib/hooks/useSecureFetch"; 

interface CreateTurmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateTurmaModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: CreateTurmaModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    imagemUrl: "", 
  });

  // 2. Instancie o secureFetch
  const secureFetch = useSecureFetch();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 3. Substitua o 'fetch' por 'secureFetch'
      // Nota: Não precisa mais do JSON.stringify nem do Content-Type, 
      // o seu hook useSecureFetch já faz isso!
      const res = await secureFetch("/api/professor/turmas", {
        method: "POST",
        body: formData, 
      });

      const data = await res.json();

      // O secureFetch já lança erro para 401 e 403, mas mantemos sua 
      // validação original para erros de negócio (ex: Zod)
      if (!res.ok) {
        if (data.details) {
          const firstError = Object.values(data.details.fieldErrors || {})[0];
          throw new Error(Array.isArray(firstError) ? firstError[0] : "Dados inválidos");
        }
        throw new Error(data.error || "Erro ao criar turma");
      }

      toast.success(`Turma "${data.nome}" criada com sucesso!`);
      
      setFormData({ nome: "", descricao: "", imagemUrl: "" });
      onSuccess(); 
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-200 bg-white rounded-xl shadow-2xl overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Nova Turma</h2>
          <button 
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Nome */}
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-slate-700 mb-1">
              Nome da Turma <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="nome"
              required
              minLength={3}
              maxLength={100}
              placeholder="Ex: Desenvolvimento de Sistemas - Manhã"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Descrição */}
          <div>
            <label htmlFor="descricao" className="block text-sm font-medium text-slate-700 mb-1">
              Descrição (Opcional)
            </label>
            <textarea
              id="descricao"
              rows={3}
              maxLength={500}
              placeholder="Descreva o objetivo da turma..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* URL da Imagem (MVP: Input de Texto) */}
          <div>
            <label htmlFor="imagemUrl" className="block text-sm font-medium text-slate-700 mb-1">
              URL da Imagem de Capa (Opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <ImageIcon size={16} />
              </div>
              <input
                type="url"
                id="imagemUrl"
                placeholder="https://exemplo.com/imagem.jpg"
                value={formData.imagemUrl}
                onChange={(e) => setFormData({ ...formData, imagemUrl: e.target.value })}
                className="w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Deixe em branco para usar uma capa padrão aleatória.
            </p>
          </div>

          {/* Rodapé / Botões */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.nome.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Turma"
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}