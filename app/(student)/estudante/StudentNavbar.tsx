'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { 
  LogOut, GraduationCap, Trophy, Star, 
  LayoutDashboard, User, ChevronDown,
  Flame, Crown, X
} from 'lucide-react';
import { useCsrf } from '@/lib/hooks/use-csrf';

interface StudentNavbarProps {
  session: {
    name?: string;
    email?: string;
    role?: string | 'ALUNO' | 'PROFESSOR' | 'SUPER_ADMIN';
    nivel?: number;
    pontos?: number;
    streak?: number;
    avatarUrl?: string | null;
  } | null;
}

// ── 1. COMPONENTE EXTRAÍDO PARA FORA ──────────────────────
interface AvatarCircleProps {
  size?: 'sm' | 'md' | 'lg';
  avatarUrl: string | null;
  initials: string;
}

function AvatarCircle({ size = 'md', avatarUrl, initials }: AvatarCircleProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-xl',
  };
  return (
    <div className={`relative ${sizeClasses[size]} rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 border-2 border-white shadow-md overflow-hidden flex items-center justify-center shrink-0`}>
      {avatarUrl ? (
        <Image src={avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
      ) : (
        <span className="font-bold text-white">{initials}</span>
      )}
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────
export default function StudentNavbar({ session }: StudentNavbarProps) {
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const csrfToken = useCsrf();

  const userName = session?.name || 'Estudante';
  const userRole = session?.role || 'ALUNO'; 
  const canAccessAdmin = userRole === 'SUPER_ADMIN' || userRole === 'PROFESSOR';
  
  const nivel = session?.nivel ?? 1;
  const pontos = session?.pontos ?? 0;
  const streak = session?.streak ?? 0;
  
  const avatarUrl = session?.avatarUrl && session.avatarUrl.trim() !== '' ? session.avatarUrl : null;
  const initials = userName.charAt(0).toUpperCase();

  const isInSimulado = /^\/estudante\/simulado\/\d+$/.test(pathname);

  // ── 2. TODOS OS HOOKS ANTES DO RETURN CONDICIONAL ───────
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isMobileSheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMobileSheetOpen]);

  // Retorno condicional executado apenas APÓS os hooks acima
  if (isInSimulado) return null;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken || '' }
      });
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao sair:', error);
      window.location.href = '/login';
    }
  };

  return (
    <>
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 md:h-16">
            
            {/* LEFT: Logo */}
            <Link href="/estudante" className="flex items-center gap-2.5 group">
              <div className="relative w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/20 group-hover:shadow-xl group-hover:shadow-violet-500/30 transition-all group-hover:scale-105">
                <GraduationCap className="h-5 w-5 md:h-[22px] md:w-[22px]" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-slate-800 text-sm md:text-base leading-none tracking-tight group-hover:text-violet-700 transition-colors">
                  <span className="hidden sm:inline">Painel do Estudante</span>
                  <span className="sm:hidden">Painel</span>
                </span>
                <span className="text-[9px] md:text-[10px] font-bold text-violet-500 tracking-widest uppercase mt-0.5">
                  SimmulaQuiz
                </span>
              </div>
            </Link>

            {/* CENTER: Gamification Stats (Desktop) */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-50/80 px-2 py-1.5 rounded-xl border border-slate-200/50">
              <StatChip icon={Trophy} value={nivel} label="Nível" color="text-amber-600" bg="bg-amber-50" />
              <div className="w-px h-6 bg-slate-200 mx-1" />
              <StatChip icon={Star} value={pontos.toLocaleString('pt-BR')} label="XP" color="text-violet-600" bg="bg-violet-50" />
              <div className="w-px h-6 bg-slate-200 mx-1" />
              <StatChip icon={Flame} value={streak} label="Streak" color="text-orange-600" bg="bg-orange-50" />
            </div>

            {/* RIGHT: Actions */}
            <div className="flex items-center gap-2">
              
              {canAccessAdmin && (
                <Link 
                  href="/admin/" 
                  className="hidden md:flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white px-3 py-2 rounded-lg text-[11px] font-bold transition-all shadow-sm hover:shadow-md border border-slate-700"
                >
                  <LayoutDashboard size={14} />
                  <span className="hidden xl:inline tracking-wide">ADMIN</span>
                </Link>
              )}

              {/* Desktop Profile Dropdown */}
              <div className="relative hidden md:block" ref={dropdownRef}>
                <button 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl hover:bg-slate-100 transition-all group"
                >
                  <div className="flex flex-col items-end mr-0.5">
                    <span className="text-sm font-bold text-slate-700 leading-none group-hover:text-violet-700 transition-colors">{userName.split(' ')[0]}</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-0.5">
                      {nivel >= 10 && <Crown size={9} className="text-amber-500" />}
                      Nível {nivel}
                    </span>
                  </div>
                  {/* 3. Passando as props para o AvatarCircle */}
                  <AvatarCircle size="md" avatarUrl={avatarUrl} initials={initials} />
                  <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 z-50">
                    <div className="px-4 py-3 bg-gradient-to-br from-violet-600 to-indigo-600">
                      <div className="flex items-center gap-3">
                        <AvatarCircle size="md" avatarUrl={avatarUrl} initials={initials} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{userName}</p>
                          <p className="text-[11px] text-violet-200 truncate">{session?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/20">
                        <div className="flex items-center gap-1 px-2 py-1 bg-white/15 rounded-md flex-1 justify-center">
                          <Trophy size={11} className="text-amber-300" />
                          <span className="text-[11px] font-bold text-white">Nv.{nivel}</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-white/15 rounded-md flex-1 justify-center">
                          <Star size={11} className="text-violet-200" />
                          <span className="text-[11px] font-bold text-white">{pontos}</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-white/15 rounded-md flex-1 justify-center">
                          <Flame size={11} className="text-orange-300" />
                          <span className="text-[11px] font-bold text-white">{streak}</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-1.5">
                      <Link 
                        href="/estudante/perfil" 
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-600 hover:text-violet-700 hover:bg-violet-50 text-sm font-medium transition-colors"
                      >
                        <User size={16} />
                        Meu Perfil
                      </Link>
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
                      >
                        <LogOut size={16} />
                        Sair
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile: Avatar → bottom sheet */}
              <button
                onClick={() => setIsMobileSheetOpen(true)}
                className="md:hidden relative"
              >
                <AvatarCircle size="sm" avatarUrl={avatarUrl} initials={initials} />
                {streak > 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center h-4 w-4 rounded-full bg-orange-500 border-2 border-white text-[8px] font-bold text-white">
                    {streak > 9 ? '9+' : streak}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MOBILE PROFILE BOTTOM SHEET */}
      {isMobileSheetOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileSheetOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 safe-area-bottom">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="px-5 pt-2 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-base">Minha Conta</h3>
                <button onClick={() => setIsMobileSheetOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600">
                <AvatarCircle size="lg" avatarUrl={avatarUrl} initials={initials} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base truncate">{userName}</p>
                  <p className="text-violet-200 text-xs truncate mt-0.5">{session?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="flex flex-col items-center py-2.5 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-center gap-1">
                    <Trophy size={13} className="text-amber-600" />
                    <span className="text-lg font-bold text-amber-700">{nivel}</span>
                  </div>
                  <span className="text-[10px] text-amber-600/70 font-medium mt-0.5">Nível</span>
                </div>
                <div className="flex flex-col items-center py-2.5 bg-violet-50 rounded-xl border border-violet-100">
                  <div className="flex items-center gap-1">
                    <Star size={13} className="text-violet-600" />
                    <span className="text-lg font-bold text-violet-700">{pontos}</span>
                  </div>
                  <span className="text-[10px] text-violet-600/70 font-medium mt-0.5">Pontos</span>
                </div>
                <div className="flex flex-col items-center py-2.5 bg-orange-50 rounded-xl border border-orange-100">
                  <div className="flex items-center gap-1">
                    <Flame size={13} className="text-orange-600" />
                    <span className="text-lg font-bold text-orange-700">{streak}</span>
                  </div>
                  <span className="text-[10px] text-orange-600/70 font-medium mt-0.5">Streak</span>
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100 mx-5" />
            <div className="px-4 py-3 space-y-1">
              <Link href="/estudante/perfil" onClick={() => setIsMobileSheetOpen(false)} className="flex items-center gap-3.5 px-3 py-3 rounded-xl text-slate-700 active:bg-slate-50 transition-colors">
                <div className="p-2 rounded-lg bg-violet-100"><User size={18} className="text-violet-600" /></div>
                <div>
                  <span className="font-semibold text-sm">Meu Perfil</span>
                  <p className="text-[11px] text-slate-400">Configurações da conta</p>
                </div>
              </Link>
              {canAccessAdmin && (
                <Link href="/admin/questoes" onClick={() => setIsMobileSheetOpen(false)} className="flex items-center gap-3.5 px-3 py-3 rounded-xl text-slate-700 active:bg-slate-50 transition-colors">
                  <div className="p-2 rounded-lg bg-slate-800"><LayoutDashboard size={18} className="text-white" /></div>
                  <div>
                    <span className="font-semibold text-sm">Painel Admin</span>
                    <p className="text-[11px] text-slate-400">Gerenciar questões e turmas</p>
                  </div>
                </Link>
              )}
              <div className="h-px bg-slate-100 my-1" />
              <button onClick={handleLogout} className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-red-600 active:bg-red-50 transition-colors">
                <div className="p-2 rounded-lg bg-red-100"><LogOut size={18} className="text-red-600" /></div>
                <span className="font-semibold text-sm">Sair da conta</span>
              </button>
            </div>
            <div className="h-2" />
          </div>
        </div>
      )}
    </>
  );
}

// ── Compact stat chip for desktop center bar ──
function StatChip({ icon: Icon, value, label, color, bg }: {
  icon: React.ElementType; value: string | number; label: string; color: string; bg: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/80 transition-colors cursor-default" title={label}>
      <div className={`p-1.5 ${bg} rounded-lg`}><Icon size={14} className={color} /></div>
      <div className="flex flex-col">
        <span className={`text-sm font-bold leading-none ${color}`}>{value}</span>
        <span className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">{label}</span>
      </div>
    </div>
  );
}