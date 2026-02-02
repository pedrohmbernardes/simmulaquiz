'use client';

interface LevelBarProps {
  percentual: number;
  proximoTitulo?: string;
  pontosRestantes?: number;
}

export function LevelBar({ percentual, proximoTitulo, pontosRestantes }: LevelBarProps) {
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
        <span className="text-gray-400">Progresso do Nível</span>
        <span className="text-blue-600">{percentual}%</span>
      </div>
      
      {/* Barra de Progresso */}
      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200 p-0.5">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-1000 ease-out shadow-sm"
          style={{ width: `${percentual}%` }}
        />
      </div>

      {proximoTitulo && (
        <p className="text-[11px] text-gray-500 font-medium">
          Faltam <span className="text-blue-600 font-bold">{pontosRestantes} XP</span> para se tornar <span className="text-gray-800 font-bold uppercase">{proximoTitulo}</span>
        </p>
      )}
    </div>
  );
}