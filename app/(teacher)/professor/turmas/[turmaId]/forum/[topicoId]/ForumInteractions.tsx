"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

// ── Formulário de Resposta ────────────────────────────────────

interface RespostaFormProps {
  turmaId: number;
  topicoId: number;
}

export function RespostaForm({ turmaId, topicoId }: RespostaFormProps) {
  const router      = useRouter();
  const secureFetch = useSecureFetch();
  const [loading, setLoading]   = useState(false);
  const [conteudo, setConteudo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!conteudo.trim()) return;

    setLoading(true);
    try {
      await secureFetch(`/api/professor/turmas/${turmaId}/forum/${topicoId}`, {
        method: "POST",
        body: { conteudo },
      });
      toast.success("Resposta enviada!");
      setConteudo("");
      router.refresh();
    } catch {
      toast.error("Não foi possível enviar sua resposta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      {/* Barra topo decorativa */}
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />

      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Sua Resposta</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="Escreva sua resposta ou solução aqui..."
            className="min-h-[120px] resize-none text-base border-slate-200 focus-visible:ring-indigo-500"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading || !conteudo.trim()}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold gap-2 min-w-[160px]"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="h-4 w-4" /> Enviar Resposta</>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Botão Marcar Solução ──────────────────────────────────────

interface BotaoSolucaoProps {
  turmaId: number;
  topicoId: number;
  respostaId: number;
  isSolucao: boolean;
  podeGerenciar: boolean;
}

export function BotaoSolucao({
  turmaId, topicoId, respostaId, isSolucao, podeGerenciar,
}: BotaoSolucaoProps) {
  const router      = useRouter();
  const secureFetch = useSecureFetch();
  const [loading, setLoading] = useState(false);

  async function toggleSolucao() {
    if (!podeGerenciar) return;
    setLoading(true);
    try {
      await secureFetch(`/api/professor/turmas/${turmaId}/forum/${topicoId}`, {
        method: "PATCH",
        body: { respostaId, acao: "TOGGLE_SOLUCAO" },
      });
      toast.success(isSolucao ? "Solução desmarcada." : "Resposta marcada como solução!");
      router.refresh();
    } catch {
      toast.error("Falha ao alterar status da solução.");
    } finally {
      setLoading(false);
    }
  }

  if (isSolucao) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
          <CheckCircle2 className="h-4 w-4" />
          Solução Oficial
        </div>
        {podeGerenciar && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
            onClick={toggleSolucao}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Desmarcar"}
          </Button>
        )}
      </div>
    );
  }

  if (podeGerenciar) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3 text-xs text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all font-medium gap-1.5 border border-transparent hover:border-emerald-200"
        onClick={toggleSolucao}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        Marcar como Solução
      </Button>
    );
  }

  return null;
}
