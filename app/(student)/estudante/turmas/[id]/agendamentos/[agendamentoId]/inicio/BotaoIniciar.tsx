"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

interface BotaoIniciarProps {
  agendamentoId: number;
  turmaId: number;
  disabled?: boolean;
}

export function BotaoIniciar({ agendamentoId, turmaId, disabled }: BotaoIniciarProps) {
  const router = useRouter();
  const secureFetch = useSecureFetch();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      const url = `/api/estudante/turmas/${turmaId}/agendamentos/${agendamentoId}/iniciar`;

      const res = await secureFetch(url, {
        method: "POST",
        body: {},
      });

      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));

        if (res.status === 409 && erro.simuladoId) {
          toast.info("Avaliação já finalizada. Redirecionando para resultados.");
          router.push(`/estudante/simulado/${erro.simuladoId}/resultado`);
          return;
        }

        throw new Error(erro.error || "Erro ao iniciar avaliação.");
      }

      const data = await res.json();
      router.push(`/estudante/simulado/${data.simuladoId}`);

    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
      setLoading(false);
    }
  }

  return (
    <Button
      size="lg"
      className="w-full bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black font-bold text-sm md:text-lg px-6 md:px-8 h-12 md:py-6 shadow-lg shadow-slate-900/20 transition-all hover:scale-[1.02] active:scale-100 text-cyan-50"
      onClick={handleStart}
      disabled={loading || disabled}
    >
      {loading ? (
        <><Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" /> Iniciando...</>
      ) : (
        <><Play className="mr-2 h-4 w-4 md:h-5 md:w-5 fill-current" /> Começar Avaliação</>
      )}
    </Button>
  );
}
