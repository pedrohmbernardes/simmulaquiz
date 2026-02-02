"use client";

import { useState, useEffect, useCallback } from "react";
import PerformanceChart from "./PerformanceChart"; // Agora na mesma pasta!

export default function FiltroAvancado() {
  const [ucId, setUcId] = useState("");
  const [unidades, setUnidades] = useState<{ id: number; nome: string }[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [singleStats, setSingleStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async (selectedUcId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stats${selectedUcId ? `?ucId=${selectedUcId}` : ""}`);
      const data = await response.json();

      if (selectedUcId) {
        // Se filtramos uma UC, preparamos o dado para o gráfico de uma barra + cards
        setSingleStats(data);
        setChartData([{
          name: unidades.find(u => u.id.toString() === selectedUcId)?.nome || "Selecionada",
          aproveitamento: data.porcentagemSucesso,
          total: data.total,
          acertos: data.acertos
        }]);
      } else {
        // Se não há filtro, recebemos o ranking (array)
        setSingleStats(null);
        setChartData(data);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [unidades]);

  useEffect(() => {
    fetch("/api/unidades").then(res => res.json()).then(setUnidades);
  }, []);

  useEffect(() => {
    loadData(ucId);
  }, [ucId, loadData]);

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-800">Filtragem Avançada</h2>
          <select
            value={ucId}
            onChange={(e) => setUcId(e.target.value)}
            className="p-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as Unidades (Ranking)</option>
            {unidades.map((uc) => (
              <option key={uc.id} value={uc.id.toString()}>{uc.nome}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="h-20 flex items-center justify-center animate-pulse text-gray-400">Processando métricas...</div>
        ) : singleStats && (
          <div className="grid grid-cols-3 gap-4">
             {/* Cards de resumo apenas quando uma UC específica é selecionada */}
             <div className="p-3 bg-blue-50 rounded-lg text-center">
                <span className="text-[10px] uppercase font-bold text-blue-500">Respondidas</span>
                <p className="text-xl font-black text-blue-900">{singleStats.total}</p>
             </div>
             <div className="p-3 bg-green-50 rounded-lg text-center">
                <span className="text-[10px] uppercase font-bold text-green-500">Acertos</span>
                <p className="text-xl font-black text-green-900">{singleStats.acertos}</p>
             </div>
             <div className="p-3 bg-purple-50 rounded-lg text-center">
                <span className="text-[10px] uppercase font-bold text-purple-500">Taxa</span>
                <p className="text-xl font-black text-purple-900">{singleStats.porcentagemSucesso}%</p>
             </div>
          </div>
        )}
      </div>

      <PerformanceChart data={chartData} />
    </div>
  );
}