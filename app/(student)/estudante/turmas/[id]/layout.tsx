"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import StudentTurmaSidebar from "./StudentTurmaSidebar";

interface TurmaDetalhes {
  id: number;
  nome: string;
  codigo?: string;
  imagemUrl?: string;
}

export default function StudentTurmaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const rawId = params?.id;
  const turmaId = (Array.isArray(rawId) ? rawId[0] : rawId) ?? "";

  const [turma, setTurma] = useState<TurmaDetalhes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTurma = async () => {
      if (!turmaId) return;
      try {
        const res = await fetch(`/api/estudante/turmas/${turmaId}`);
        if (res.ok) {
          const data = await res.json();
          setTurma(data);
        }
      } catch (error) {
        console.error("Erro ao carregar detalhes da turma", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTurma();
  }, [turmaId]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20">
      {/* Sidebar — hidden on mobile via internal classes */}
      <StudentTurmaSidebar
        turmaId={turmaId}
        turmaNome={turma?.nome || "Carregando..."}
        turmaCodigo={turma?.codigo}
      />

      {/* Content area: no margin on mobile, ml-20 on desktop. Bottom padding for mobile tab bar */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 ml-0 md:ml-20 transition-all duration-300 overflow-y-auto pb-20 md:pb-0">
        {children}
      </div>
    </div>
  );
}
