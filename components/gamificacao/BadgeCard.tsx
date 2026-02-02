import { Lock, CheckCircle2, Star, Trophy, Zap, Shield, BookOpen, Target, Crown } from 'lucide-react';
import { cn } from '@/lib/utils'; // Certifique-se de ter essa função ou use template strings simples

// Mapeamento de Cores por Raridade
const RARITY_STYLES = {
  COMUM: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', icon: 'text-slate-400', glow: '' },
  INCOMUM: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-500', glow: '' },
  RARO: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500', glow: 'shadow-blue-100' },
  EPICO: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-500', glow: 'shadow-purple-100 shadow-lg' },
  LENDARIO: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500', glow: 'shadow-amber-100 shadow-xl ring-1 ring-amber-300' },
  MITICO: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: 'text-rose-500', glow: 'shadow-rose-100 shadow-2xl ring-2 ring-rose-400 animate-pulse-slow' },
};

// Ícones Mapeados
const CATEGORY_ICONS: Record<string, any> = {
  INICIO_ENGAJAMENTO: Zap,
  PERFORMANCE_VELOCIDADE: Target, // Usar Target do lucide-react (já importado)
  MAESTRIA_UC: BookOpen,
  OBJETO_CONHECIMENTO: Star, // Ou BrainCircuit se tiver importado
  DESEMPENHO_AVANCADO: Trophy,
  OCULTA: EyeOffIcon, // Componente local
  IMPOSSIVEL: Crown
};

// Componentes de ícone auxiliares para não depender de imports externos quebrados
function TimerIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function BrainIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1 4.96.44 2.5 2.5 0 0 1 2.96-3.08 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1-1.32-4.24 2.5 2.5 0 0 1-1.98-3A2.5 2.5 0 0 1 14.5 2Z"/></svg>; }
function EyeOffIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>; }

interface BadgeCardProps {
  conquista: {
    nome: string;
    descricao: string;
    raridade: keyof typeof RARITY_STYLES;
    categoria: keyof typeof CATEGORY_ICONS;
    pontos: number;
    secret?: boolean; // Se for oculta e não conquistada
  };
  desbloqueada: boolean;
  progresso?: {
    atual: number;
    meta: number;
  };
  dataConquista?: string; // ISO Date
}

export function BadgeCard({ conquista, desbloqueada, progresso, dataConquista }: BadgeCardProps) {
  const styles = RARITY_STYLES[conquista.raridade] || RARITY_STYLES.COMUM;
  const Icon = CATEGORY_ICONS[conquista.categoria] || Star;

  // Se for secreta e bloqueada, esconde tudo
  if (conquista.secret && !desbloqueada) {
    return (
      <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 text-gray-300 h-full min-h-[180px]">
        <Lock size={32} className="mb-2 opacity-50" />
        <span className="text-xs font-bold uppercase tracking-widest">Conquista Secreta</span>
        <span className="text-[10px] text-center mt-1">Descubra para revelar</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative group flex flex-col p-5 rounded-2xl border-2 transition-all duration-300 h-full min-h-[180px]",
      desbloqueada 
        ? `${styles.bg} ${styles.border} ${styles.glow} hover:-translate-y-1` 
        : "bg-white border-gray-100 grayscale opacity-80 hover:opacity-100 hover:border-gray-300 hover:shadow-sm"
    )}>
      {/* Header: Ícone e Pontos */}
      <div className="flex justify-between items-start mb-3">
        <div className={cn(
          "p-2.5 rounded-xl border shadow-sm",
          desbloqueada ? "bg-white border-white/50" : "bg-gray-100 border-gray-200"
        )}>
          <Icon size={24} className={desbloqueada ? styles.icon : "text-gray-400"} />
        </div>
        
        <div className="flex flex-col items-end">
          <span className={cn(
            "text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
            desbloqueada 
              ? `bg-white border-white/50 ${styles.text}` 
              : "bg-gray-100 border-gray-200 text-gray-400"
          )}>
            {conquista.raridade}
          </span>
          <span className="text-[10px] font-bold text-gray-400 mt-1">{conquista.pontos} XP</span>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1">
        <h4 className={cn("font-black font-oswald text-lg uppercase leading-tight mb-1", desbloqueada ? "text-gray-800" : "text-gray-500")}>
          {conquista.nome}
        </h4>
        <p className="text-xs text-gray-500 font-lato leading-relaxed">
          {conquista.descricao}
        </p>
      </div>

      {/* Footer: Barra de Progresso ou Data */}
      <div className="mt-4 pt-3 border-t border-black/5">
        {desbloqueada ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
            <CheckCircle2 size={14} />
            <span>Conquistado em {new Date(dataConquista!).toLocaleDateString('pt-BR')}</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <span>Progresso</span>
              {progresso && <span>{Math.min(100, Math.round((progresso.atual / progresso.meta) * 100))}%</span>}
            </div>
            
            {progresso ? (
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, (progresso.atual / progresso.meta) * 100)}%` }}
                ></div>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                <Lock size={10} /> Bloqueado
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}