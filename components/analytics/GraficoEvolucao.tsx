"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DataPoint {
  data: string;
  acertos: number;
}

export function GraficoEvolucao({ data }: { data: DataPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center">
        <p className="text-sm text-gray-500">Faça mais simulados para ver sua evolução!</p>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAcertos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="data" 
            tick={{ fontSize: 12, fill: "#94a3b8" }} 
            axisLine={false} 
            tickLine={false} 
            tickMargin={10}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: "#94a3b8" }} 
            axisLine={false} 
            tickLine={false} 
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
            formatter={(value: any) => [`${value}%`, "Aproveitamento"]}
          />
          <Area
            type="monotone"
            dataKey="acertos"
            stroke="#2563eb"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorAcertos)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}