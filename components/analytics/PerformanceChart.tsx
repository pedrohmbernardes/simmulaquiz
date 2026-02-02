'use client';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell 
} from 'recharts';

interface ChartProps {
  data: {
    name: string;
    aproveitamento: number;
    total: number;
    acertos: number;
  }[];
}

export default function PerformanceChart({ data }: ChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-100 h-[300px] flex flex-col items-center justify-center text-center">
        <div className="text-4xl mb-2 opacity-30">📊</div>
        <p className="text-gray-500 font-medium">Dados insuficientes para gerar gráfico.</p>
        <p className="text-xs text-gray-400 mt-1">Complete mais simulados para ver sua análise.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800">Seu Desempenho por Competência</h2>
        <p className="text-sm text-gray-500">Aproveitamento médio nas Unidades Curriculares (Top 5)</p>
      </div>

      <div className="h-[250px] w-full text-xs">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={100} 
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              formatter={(value: number | undefined) => [`${value || 0}%`, 'Aproveitamento']}
            />
            <Bar dataKey="aproveitamento" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.aproveitamento >= 70 ? '#16a34a' : entry.aproveitamento >= 50 ? '#ca8a04' : '#dc2626'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}