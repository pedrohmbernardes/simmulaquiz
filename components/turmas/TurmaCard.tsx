"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, CheckCircle2, ChevronRight, Users, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface TurmaCardProps {
  turma: {
    id: number;
    nome: string;
    codigo: string;
    descricao?: string | null;
    imagemUrl?: string | null;
    professores: {
      professor: {
        nome: string;
        fotoUrl?: string | null;
      }
    }[];
    _count: {
      alunos: number;
    };
  };
  status: "ATIVO" | "PENDENTE" | string;
}

export function TurmaCard({ turma, status }: TurmaCardProps) {
  const isPendente = status === "PENDENTE";
  const professor = turma.professores[0]?.professor;

  const CardContentVisual = (
    <div className="relative flex flex-col h-full w-full p-5 md:p-8 z-10">
      
      {/* ── Topo: Código e Status ── */}
      <div className="flex items-start justify-between mb-6">
        <Badge variant="outline" className="bg-white/5 backdrop-blur-md text-gray-400 border-white/10 font-mono text-[10px] md:text-xs py-1 px-3 shadow-none">
          <Hash className="w-3.5 h-3.5 mr-1 text-cyan-400" />
          {turma.codigo}
        </Badge>

        {isPendente ? (
          <Badge className="bg-gray-700/50 text-gray-300 border border-gray-600/50 backdrop-blur-md shadow-none gap-1.5 py-1 px-3">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide">Pendente</span>
          </Badge>
        ) : (
          <Badge className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 backdrop-blur-md shadow-none gap-1.5 py-1 px-3">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide">Ativo</span>
          </Badge>
        )}
      </div>

      {/* ── Corpo: Título e Descrição ── */}
      <div className="flex-1">
        <h3 className="text-xl md:text-2xl font-bold text-white line-clamp-2 leading-tight group-hover:text-cyan-300 transition-colors">
          {turma.nome}
        </h3>
        <p className="text-sm text-gray-400 mt-2.5 line-clamp-2 leading-relaxed font-medium">
          {turma.descricao || "Sem descrição disponível para esta turma."}
        </p>
      </div>

      {/* ── Rodapé: Professor e Infos ── */}
      <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 md:h-11 md:w-11 ring-2 ring-white/20 shrink-0 shadow-none">
            <AvatarImage src={professor?.fotoUrl || ""} />
            <AvatarFallback className="bg-gray-800 text-gray-300 text-xs md:text-sm font-bold">
              {professor?.nome?.[0] || "P"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Professor</span>
            <span className="text-xs md:text-sm font-semibold text-gray-200 truncate max-w-[120px] md:max-w-[150px]">
              {professor?.nome || "N/A"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-gray-400 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg backdrop-blur-sm">
            <Users size={14} className="text-cyan-400" />
            <span className="text-xs font-bold text-white">{turma._count.alunos}</span>
          </div>

          {!isPendente && (
            <div className="h-9 w-9 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all shadow-none">
              <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const containerClasses = cn(
    "relative flex flex-col overflow-hidden rounded-[1.5rem] md:rounded-[2rem] bg-gradient-to-br from-gray-900 to-gray-950 shadow-lg hover:shadow-xl transition-all duration-300 h-full group border border-white/10",
    isPendente && "opacity-80 grayscale-[0.2] cursor-not-allowed hover:-translate-y-0",
    !isPendente && "md:hover:-translate-y-1.5 cursor-pointer"
  );

  // Renderização se a turma estiver Pendente (sem link)
  if (isPendente) {
    return (
      <div className={containerClasses}>
        {turma.imagemUrl && (
          <Image 
            src={turma.imagemUrl}
            alt={turma.nome}
            fill
            className="object-cover opacity-10 mix-blend-overlay pointer-events-none"
            unoptimized
          />
        )}
        {CardContentVisual}
      </div>
    );
  }

  // Renderização se a turma estiver Ativa (com link)
  return (
    <Link href={`/estudante/turmas/${turma.id}`} className={containerClasses}>
      {turma.imagemUrl && (
        <Image 
          src={turma.imagemUrl}
          alt={turma.nome}
          fill
          className="object-cover opacity-10 mix-blend-overlay pointer-events-none group-hover:opacity-20 transition-opacity duration-500"
          unoptimized
        />
      )}
      {CardContentVisual}
    </Link>
  );
}