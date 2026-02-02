import { Star } from 'lucide-react';

interface PontosDisplayProps {
  pontos: number;
  nivel: number;
  proximoNivelPontos?: number; // Opcional: quanto falta para o próximo nível
  compact?: boolean; // Se for true, mostra versão reduzida (ex: mobile)
}

export function PontosDisplay({ pontos, nivel, compact = false }: PontosDisplayProps) {
  // Formata 1200 para "1.2k" se necessário, ou usa toLocaleString
  const pontosFormatados = pontos.toLocaleString('pt-BR');

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full border border-yellow-100 shadow-sm">
        <Star size={14} className="fill-yellow-500 text-yellow-500" />
        <span className="text-xs font-black font-mono">{pontosFormatados} XP</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Ícone de Nível */}
      <div className="relative">
        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl rotate-3 flex items-center justify-center shadow-lg shadow-yellow-200">
          <span className="text-white font-black text-lg font-oswald -rotate-3">{nivel}</span>
        </div>
        <div className="absolute -bottom-2 -right-2 bg-white text-[10px] font-bold px-1.5 py-0.5 rounded text-gray-500 border shadow-sm">
          LVL
        </div>
      </div>

      {/* Detalhes de Pontos */}
      <div>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Experiência Total</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-gray-800 font-mono">{pontosFormatados}</span>
          <span className="text-xs text-yellow-600 font-bold">XP</span>
        </div>
      </div>
    </div>
  );
}