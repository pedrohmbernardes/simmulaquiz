'use client';

import Link from "next/link";
import { ArrowRight, XCircle, Star, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useCsrf } from "@/lib/hooks/use-csrf";

interface QuestaoCardProps {
  id: number;
  enunciado: string;
  dificuldade: string;
  origem?: string | null; 
  erros?: number;          
  dataErro?: Date;         
  isFavorito?: boolean;  
  csrfToken?: string;  
}

export function QuestaoCard({ 
  id, 
  enunciado, 
  dificuldade, 
  origem, 
  erros, 
  dataErro,
  isFavorito = false
}: QuestaoCardProps) {
  
  const csrfToken = useCsrf();
  
  const [favoritado, setFavoritado] = useState(isFavorito);
  const [loadingFav, setLoadingFav] = useState(false);

  const previewEnunciado = enunciado.replace(/<[^>]*>?/gm, '').slice(0, 150) + (enunciado.length > 150 ? "..." : "");

  const dificuldadeConfig = {
    MUITO_FACIL: { 
      bg: "bg-gradient-to-br from-emerald-50 to-green-50", 
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500"
    },
    FACIL: { 
      bg: "bg-gradient-to-br from-green-50 to-lime-50", 
      text: "text-green-700",
      border: "border-green-200",
      dot: "bg-green-500"
    },
    MEDIO: { 
      bg: "bg-gradient-to-br from-amber-50 to-yellow-50", 
      text: "text-amber-700",
      border: "border-amber-200",
      dot: "bg-amber-500"
    },
    DIFICIL: { 
      bg: "bg-gradient-to-br from-orange-50 to-amber-50", 
      text: "text-orange-700",
      border: "border-orange-200",
      dot: "bg-orange-500"
    },
    MUITO_DIFICIL: { 
      bg: "bg-gradient-to-br from-red-50 to-rose-50", 
      text: "text-red-700",
      border: "border-red-200",
      dot: "bg-red-500"
    },
  }[dificuldade] || { 
    bg: "bg-gradient-to-br from-gray-50 to-slate-50", 
    text: "text-gray-700",
    border: "border-gray-200",
    dot: "bg-gray-500"
  };

  const handleToggleFavorito = async () => {
    if (loadingFav) return;
    
    const estadoAnterior = favoritado;
    setFavoritado(!estadoAnterior);
    setLoadingFav(true);

    try {
      const res = await fetch('/api/estudante/favoritos/toggle', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify({ questaoId: id })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar favorito");
      }

      if (data.favoritado !== undefined) {
        setFavoritado(data.favoritado);
      }

    } catch (error: any) {
      setFavoritado(estadoAnterior);
      alert(error.message || "Não foi possível realizar a ação.");
    } finally {
      setLoadingFav(false);
    }
  };

  return (
    <div className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 bg-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-1
      ${favoritado ? 'border-amber-200' : 'border-gray-200 opacity-60'} 
    `}>
      
      {/* Barra decorativa superior com gradiente */}
      <div className={`h-1.5 w-full ${dificuldadeConfig.bg}`}></div>

      <div className="p-6">
        {/* Cabeçalho com badges */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {/* Badge de dificuldade com estilo aprimorado */}
            <span className={`inline-flex items-center gap-1.5 rounded-full ${dificuldadeConfig.bg} ${dificuldadeConfig.text} border ${dificuldadeConfig.border} px-3 py-1.5 text-xs font-bold uppercase tracking-wide shadow-sm`}>
              <span className={`h-1.5 w-1.5 rounded-full ${dificuldadeConfig.dot} animate-pulse`}></span>
              {dificuldade.replace("_", " ")}
            </span>
            
            {/* Badge de origem */}
            {origem && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-slate-100 to-gray-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 border border-slate-200 shadow-sm">
                <Sparkles className="h-3 w-3" />
                {origem}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Indicador de erros */}
            {erros && (
              <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 border border-red-200" title="Vezes que você errou">
                <XCircle size={14} />
                {erros}x
              </div>
            )}

            {/* Botão de favoritar aprimorado */}
            <button 
              onClick={handleToggleFavorito}
              disabled={loadingFav}
              className="rounded-full p-2 transition-all duration-300 hover:bg-amber-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-300"
              title={favoritado ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
            >
              {loadingFav ? (
                <Loader2 size={20} className="animate-spin text-amber-500" />
              ) : (
                <Star 
                  size={22} 
                  className={`transition-all duration-300 ${
                    favoritado 
                      ? "fill-amber-400 text-amber-400 drop-shadow-sm" 
                      : "text-gray-300 hover:text-amber-400 hover:scale-110"
                  }`} 
                />
              )}
            </button>
          </div>
        </div>

        {/* Conteúdo do enunciado */}
        <div className="mb-4 min-h-[80px]">
          <h3 className={`text-lg leading-relaxed line-clamp-4 transition-colors ${
            favoritado ? 'text-gray-800' : 'text-gray-500'
          }`}>
            {previewEnunciado}
          </h3>
        </div>
        
        {/* Data do erro (se existir) */}
        {dataErro && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 border border-red-100">
            <div className="h-2 w-2 rounded-full bg-red-400"></div>
            <p className="text-xs text-red-700 font-medium">
              Último erro em {new Date(dataErro).toLocaleDateString('pt-BR')}
            </p>
          </div>
        )}
      </div>

      {/* Rodapé com botão de ação */}
      <div className="border-t border-gray-100 bg-gradient-to-br from-gray-50 to-slate-50 px-6 py-4">
        <Link 
          href={`/estudante/questao/${id}`} 
          className="group/link flex items-center justify-between gap-2 text-sm font-bold text-blue-600 transition-colors hover:text-blue-700"
        >
          <span>Ver Questão Completa</span>
          <ArrowRight 
            size={18} 
            className="transition-transform group-hover/link:translate-x-1" 
          />
        </Link>
      </div>

      {/* Efeito de brilho ao hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-gradient-to-br from-amber-200/20 to-orange-200/20 blur-3xl"></div>
      </div>
    </div>
  );
}
