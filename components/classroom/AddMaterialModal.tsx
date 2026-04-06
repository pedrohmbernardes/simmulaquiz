"use client";

import { useState } from "react";
import { 
  X, 
  Loader2, 
  Link as LinkIcon, 
  FileText, 
  Youtube,
  AlignLeft
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AddMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  turmaId: string;
  moduloId: number;
  onSuccess: () => void;
}

// Tipos exatos que o seu Backend espera
type MaterialType = "LINK_EXTERNO" | "PDF_UPLOAD" | "VIDEO_YOUTUBE" | "GOOGLE_DRIVE";

export default function AddMaterialModal({ 
  isOpen, 
  onClose, 
  turmaId,
  moduloId,
  onSuccess 
}: AddMaterialModalProps) {
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<MaterialType>("LINK_EXTERNO");
  
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    url: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.url) return;

    setLoading(true);

    try {
      // 1. Criar o Material (Usando a rota que VOCÊ já criou)
      const resMaterial = await fetch(`/api/professor/turmas/${turmaId}/materiais`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: formData.titulo,
          descricao: formData.descricao,
          tipo: tipo,
          url: formData.url
        }),
      });

      if (!resMaterial.ok) {
        const errorData = await resMaterial.json();
        throw new Error(errorData.error || "Erro ao criar material.");
      }
      
      const material = await resMaterial.json();

      // 2. Vincular ao Módulo (Essa rota nós criamos hoje mais cedo)
      const resVinculo = await fetch(`/api/professor/turmas/${turmaId}/modulos/${moduloId}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: formData.titulo, // Usa o mesmo título para o item
          tipo: "MATERIAL",
          materialId: material.id
        }),
      });

      if (!resVinculo.ok) throw new Error("Erro ao vincular ao módulo.");

      toast.success("Material adicionado com sucesso!");
      
      // Limpa e fecha
      setFormData({ titulo: "", descricao: "", url: "" });
      setTipo("LINK_EXTERNO");
      onSuccess();
      onClose();

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao salvar material.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Adicionar Material</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Seleção de Tipo (Mapeado para o seu ENUM) */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[
              { id: "LINK_EXTERNO", label: "Link", icon: LinkIcon },
              { id: "PDF_UPLOAD", label: "PDF", icon: FileText }, // Nota: Frontend aqui pede URL, assumindo upload prévio ou link direto
              { id: "VIDEO_YOUTUBE", label: "YouTube", icon: Youtube },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTipo(item.id as MaterialType)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                  tipo === item.id 
                    ? "border-blue-500 bg-blue-50 text-blue-700" 
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                )}
              >
                <item.icon size={20} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
            <input
              type="text"
              required
              placeholder={tipo === "VIDEO_YOUTUBE" ? "Ex: Aula 01 - Introdução" : "Ex: Artigo sobre React"}
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Descrição (Adicionado pois sua API suporta) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (Opcional)</label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Breve resumo..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL / Link</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="url"
                required
                placeholder={tipo === "PDF_UPLOAD" ? "Link do PDF (Drive/S3)" : "https://..."}
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {tipo === "PDF_UPLOAD" 
                ? "Cole o link direto do arquivo hospedado." 
                : "Cole o link do conteúdo."}
            </p>
          </div>

          {/* Footer */}
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.url}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Salvar Material"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}