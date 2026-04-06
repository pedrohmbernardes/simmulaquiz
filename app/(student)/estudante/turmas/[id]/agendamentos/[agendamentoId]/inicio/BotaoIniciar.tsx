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
      // Rota da API que criamos e validamos (Transaction)
      const url = `/api/estudante/turmas/${turmaId}/agendamentos/${agendamentoId}/iniciar`;

      const res = await secureFetch(url, {
        method: "POST",
        // O secureFetch já injeta CSRF e Content-Type
        body: {}, 
      });

      if (!res.ok) {
        // Tenta ler o erro da API, com fallback genérico
        const erro = await res.json().catch(() => ({}));
        
        // Se for erro de "Já finalizado", redireciona para resultado (Idempotência)
        if (res.status === 409 && erro.simuladoId) {
           toast.info("Avaliação já finalizada. Redirecionando para resultados.");
           router.push(`/estudante/simulado/${erro.simuladoId}/resultado`);
           return;
        }

        throw new Error(erro.error || "Erro ao iniciar avaliação.");
      }

      const data = await res.json();
      
      // Sucesso! Redireciona para o Runner do Simulado
      // Usamos a rota global de simulado pois o Runner é o mesmo
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
      className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 font-bold text-lg px-8 py-6 shadow-lg shadow-indigo-200 transition-all hover:scale-105"
      onClick={handleStart}
      disabled={loading || disabled}
    >
      {loading ? (
        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Iniciando...</>
      ) : (
        <><Play className="mr-2 h-5 w-5 fill-current" /> Começar Avaliação Agora</>
      )}
    </Button>
  );
}