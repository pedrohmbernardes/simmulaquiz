"use client";

import Image from "next/image";
import { Pin, MoreVertical, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Aviso } from "@/app/(teacher)/professor/turmas/[turmaId]/mural/page";

interface FeedItemProps {
  aviso: Aviso;
  isProfessor?: boolean;
}

export default function FeedItem({ aviso, isProfessor }: FeedItemProps) {
  
  // Formatação de data nativa (sem bibliotecas extras)
  const formatarData = (dataString: string) => {
    const data = new Date(dataString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(data);
  };

  return (
    <div className={cn(
      "bg-white rounded-xl border p-5 transition-all hover:shadow-sm",
      aviso.fixado ? "border-blue-200 bg-blue-50/30" : "border-slate-200"
    )}>
      
      {/* Cabeçalho do Post */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center border border-slate-100">
            {aviso.autor.fotoUrl ? (
              <Image 
                src={aviso.autor.fotoUrl} 
                alt={aviso.autor.nome}
                width={40}
                height={40}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="font-bold text-slate-500 text-sm">
                {aviso.autor.nome.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Info Autor + Data */}
          <div>
            <h4 className="font-semibold text-slate-900 text-sm">
              {aviso.autor.nome}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{formatarData(aviso.createdAt)}</span>
              {aviso.fixado && (
                <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                  <Pin size={10} className="fill-current" />
                  Fixado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Menu de Ações (Apenas Visual por enquanto) */}
        {isProfessor && (
          <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
            <MoreVertical size={18} />
          </button>
        )}
      </div>

      {/* Conteúdo */}
      <div className="pl-[52px]"> {/* Alinhamento visual com o texto acima (Avatar 40px + Gap 12px) */}
        <h3 className="text-lg font-bold text-slate-900 mb-1 leading-snug">
          {aviso.titulo}
        </h3>
        
        {/* whitespace-pre-wrap mantém as quebras de linha que o professor digitou */}
        <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap mb-4">
          {aviso.conteudo}
        </div>

        {/* Rodapé do Card (Comentários - Futuro) */}
        <div className="flex items-center gap-4 pt-3 border-t border-slate-100/50">
          <button className="flex items-center gap-2 text-slate-400 text-xs font-medium hover:text-blue-600 transition-colors">
            <MessageSquare size={14} />
            {(aviso._count?.comentarios ?? 0) > 0
              ? `${aviso._count?.comentarios ?? 0} comentários`
              : "Comentar"}
          </button>
        </div>
      </div>
    </div>
  );
}