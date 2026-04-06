"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, CheckCircle2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    <>
      <div className="relative h-32 w-full bg-slate-800 overflow-hidden">
        {turma.imagemUrl ? (
          <Image 
            src={turma.imagemUrl} 
            alt={turma.nome}
            fill
            className="object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-90" />
        )}
        
        <div className="absolute top-3 right-3 z-10">
          {isPendente ? (
            <Badge variant="secondary" className="bg-yellow-100/90 text-yellow-800 backdrop-blur-sm border-yellow-200">
              <Clock className="mr-1 h-3 w-3" /> Aguardando
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-emerald-100/90 text-emerald-800 backdrop-blur-sm border-emerald-200">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Ativo
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="outline" className="text-[10px] text-slate-500 font-mono">
            {turma.codigo}
          </Badge>
        </div>

        <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-1 group-hover:text-indigo-600 transition-colors">
          {turma.nome}
        </h3>
        <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5rem] mb-4">
          {turma.descricao || "Sem descrição disponível."}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border border-slate-200">
              <AvatarImage src={professor?.fotoUrl || ""} />
              <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">
                {professor?.nome?.[0] || "P"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Professor</span>
              <span className="text-xs font-semibold text-slate-800 line-clamp-1 max-w-[100px]">
                {professor?.nome || "N/A"}
              </span>
            </div>
          </div>
          
          {!isPendente && (
             <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <ChevronRight size={16} />
             </div>
          )}
        </div>
      </div>

      {isPendente && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
          <div className="rounded-xl bg-white p-4 shadow-xl text-center border border-slate-100 animate-in zoom-in-95">
            <Clock className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">Aprovação Pendente</p>
            <p className="text-xs text-slate-500 mt-1">O professor precisa<br/>aceitar sua entrada.</p>
          </div>
        </div>
      )}
    </>
  );

  const containerClasses = "relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all h-full group";

  if (isPendente) {
    return <div className={`${containerClasses} opacity-75 grayscale-[0.3] cursor-not-allowed`}>{CardContentVisual}</div>;
  }

  return (
    <Link href={`/estudante/turmas/${turma.id}`} className={containerClasses}>
      {CardContentVisual}
    </Link>
  );
}