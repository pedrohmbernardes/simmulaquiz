'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { 
  Menu, LogOut, GraduationCap, Trophy, Star, 
  LayoutDashboard, User, ChevronDown, Settings,
  Flame, Zap, Award, Crown
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

export default function StudentNavbar({ session }: StudentNavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const csrfToken = useCsrf();

  const userName = session?.name || 'Estudante';
  const userRole = session?.role || 'ALUNO'; 
  const canAccessAdmin = userRole === 'SUPER_ADMIN' || userRole === 'PROFESSOR';
  
  const nivel = session?.nivel ?? 1;
  const pontos = session?.pontos ?? 0;
  const streak = session?.streak ?? 0;
  
  const avatarUrl = session?.avatarUrl && session.avatarUrl.trim() !== '' ? session.avatarUrl : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken || '' 
        }
      });
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao sair:', error);
      window.location.href = '/login';
    }
  };

  return (
    <nav className="bg-white/95 backdrop-blur-xl border-b border-blue-100/50 sticky top-0 z-50 shadow-lg shadow-blue-500/5 font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-20">
          
          {/* ESQUERDA: LOGO E MENU MOBILE */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-300 border border-transparent hover:border-blue-200 group"
            >
              <Menu size={24} className="group-hover:scale-110 transition-transform" />
            </button>

            <Link href="/estudante" className="flex items-center gap-2 sm:gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
                <div className="relative w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/30 group-hover:shadow-2xl group-hover:shadow-blue-500/40 transition-all duration-300 group-hover:scale-105">
                  <GraduationCap size={24} className="sm:w-[26px] sm:h-[26px]" />
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-black text-slate-800 text-base sm:text-xl md:text-2xl leading-none tracking-tight uppercase group-hover:text-blue-700 transition-colors hidden sm:block">
                  Painel do Estudante
                </span>
                <span className="font-black text-slate-800 text-base leading-none tracking-tight uppercase group-hover:text-blue-700 transition-colors sm:hidden">
                  Painel
                </span>
                <span className="text-[10px] sm:text-xs font-black bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent tracking-widest mt-0.5 sm:mt-1 uppercase">
                  SimmulaQuiz
                </span>
              </div>
            </Link>
          </div>

          {/* CENTRO: STATS GAMIFICADOS (Desktop) */}
          <div className="hidden lg:flex items-center gap-4 xl:gap-6 bg-gradient-to-r from-slate-50 via-blue-50/50 to-purple-50/30 px-5 xl:px-6 py-3 rounded-2xl border border-blue-100/50 shadow-inner backdrop-blur-sm">
             
             {/* Nível */}
             <div className="group/stat flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/70 transition-all cursor-default" title="Seu Nível Atual">
                <div className="relative">
                  <div className="absolute inset-0 bg-yellow-400 rounded-full blur-md opacity-30 group-hover/stat:opacity-50 transition-opacity"></div>
                  <div className="relative bg-gradient-to-br from-yellow-400 to-amber-500 p-2 rounded-full text-white shadow-md shadow-yellow-500/30">
                    <Trophy size={16} />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none">Nível</span>
                  <span className="text-lg font-black text-slate-800 leading-none mt-0.5 bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">{nivel}</span>
                </div>
             </div>
             
             <div className="h-8 w-[2px] bg-gradient-to-b from-transparent via-slate-300 to-transparent"></div>
             
             {/* Pontos XP */}
             <div className="group/stat flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/70 transition-all cursor-default" title="Pontos de Experiência">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-30 group-hover/stat:opacity-50 transition-opacity"></div>
                  <div className="relative bg-gradient-to-br from-blue-500 to-cyan-500 p-2 rounded-full text-white shadow-md shadow-blue-500/30">
                    <Star size={16} className="fill-white" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none">Pontos</span>
                  <span className="text-lg font-black text-slate-800 leading-none mt-0.5 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{pontos.toLocaleString('pt-BR')}</span>
                </div>
             </div>
             
             <div className="h-8 w-[2px] bg-gradient-to-b from-transparent via-slate-300 to-transparent"></div>
             
             {/* Streak */}
             <div className="group/stat flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/70 transition-all cursor-default" title="Dias Seguidos (Streak)">
                <div className="relative">
                  <div className="absolute inset-0 bg-orange-500 rounded-full blur-md opacity-40 group-hover/stat:opacity-60 transition-opacity"></div>
                  <div className="relative bg-gradient-to-br from-orange-500 to-red-500 p-2 rounded-full text-white shadow-md shadow-orange-500/30">
                    <Flame size={16} className="fill-yellow-200" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none">Streak</span>
                  <span className="text-lg font-black text-slate-800 leading-none mt-0.5 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{streak}</span>
                </div>
             </div>
          </div>

          {/* DIREITA: ADMIN + PERFIL DROPDOWN */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Botão Admin (Desktop) */}
            {canAccessAdmin && (
                <Link 
                    href="/admin/" 
                    className="hidden md:flex items-center gap-2 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white px-3 xl:px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-300 shadow-lg shadow-slate-900/30 hover:shadow-xl hover:shadow-slate-900/40 border border-slate-700 group"
                    title="Acessar Área Administrativa"
                >
                    <LayoutDashboard size={16} className="group-hover:scale-110 transition-transform" />
                    <span className="tracking-wider hidden xl:inline">ADMIN</span>
                </Link>
            )}

            {/* Dropdown de Perfil (Desktop) */}
            <div className="relative hidden md:block" ref={dropdownRef}>
                <button 
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    className="flex items-center gap-2 xl:gap-3 pl-2 xl:pl-3 pr-1.5 xl:pr-2 py-1.5 rounded-2xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-300 border border-transparent hover:border-blue-200/50 group"
                >
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-slate-800 leading-none group-hover:text-blue-700 transition-colors">{userName.split(' ')[0]}</span>
                        <div className="flex items-center gap-1 mt-1">
                          {nivel >= 10 && <Crown size={10} className="text-yellow-500" />}
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{userRole}</span>
                        </div>
                    </div>
                    
                    <div className="relative h-11 w-11 xl:h-12 xl:w-12 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 border-2 border-white shadow-lg shadow-blue-500/20 overflow-hidden flex items-center justify-center group-hover:shadow-xl group-hover:shadow-blue-500/30 transition-all duration-300 group-hover:scale-105">
                        {avatarUrl ? (
                            <Image 
                                src={avatarUrl} 
                                alt="Avatar" 
                                fill 
                                className="object-cover" 
                                unoptimized 
                            />
                        ) : (
                            <span className="text-blue-700 font-black text-lg">
                                {userName.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Conteúdo do Dropdown - Premium */}
                {isProfileDropdownOpen && (
                    <div className="absolute right-0 top-full mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-blue-100/50 p-3 animate-in fade-in slide-in-from-top-2 z-50 backdrop-blur-xl">
                        
                        {/* Header do Dropdown */}
                        <div className="px-4 py-3 mb-2 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100/50">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 border-2 border-white shadow-md overflow-hidden flex items-center justify-center">
                                  {avatarUrl ? (
                                      <Image src={avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
                                  ) : (
                                      <span className="text-blue-700 font-black text-lg">
                                          {userName.charAt(0).toUpperCase()}
                                      </span>
                                  )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-slate-800 truncate">{userName}</p>
                                <p className="text-xs text-slate-500 truncate font-medium">{session?.email}</p>
                              </div>
                            </div>
                            
                            {/* Mini Stats */}
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-200/50">
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg flex-1">
                                <Trophy size={14} className="text-yellow-600" />
                                <span className="text-xs font-bold text-slate-700">Nv. {nivel}</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg flex-1">
                                <Star size={14} className="text-blue-600 fill-blue-600" />
                                <span className="text-xs font-bold text-slate-700">{pontos}</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg flex-1">
                                <Flame size={14} className="text-orange-500" />
                                <span className="text-xs font-bold text-slate-700">{streak}</span>
                              </div>
                            </div>
                        </div>
                        
                        {/* Menu Items */}
                        <div className="space-y-1">
                          <Link 
                              href="/estudante/perfil" 
                              onClick={() => setIsProfileDropdownOpen(false)}
                              className="group/item flex items-center gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 text-slate-700 hover:text-blue-700 text-sm font-bold transition-all duration-300 border border-transparent hover:border-blue-200/50"
                          >
                              <div className="p-1.5 rounded-lg bg-slate-100 group-hover/item:bg-white transition-colors">
                                <User size={16} />
                              </div>
                              <span className="flex-1">Meu Perfil</span>
                              <ChevronDown size={14} className="opacity-0 group-hover/item:opacity-100 -rotate-90 transition-all" />
                          </Link>

                          <button 
                              onClick={handleLogout}
                              className="group/item w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 text-slate-700 hover:text-red-600 text-sm font-bold transition-all duration-300 border border-transparent hover:border-red-200/50"
                          >
                              <div className="p-1.5 rounded-lg bg-slate-100 group-hover/item:bg-white transition-colors">
                                <LogOut size={16} />
                              </div>
                              <span className="flex-1 text-left">Sair</span>
                              <ChevronDown size={14} className="opacity-0 group-hover/item:opacity-100 -rotate-90 transition-all" />
                          </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Botão Logout Mobile */}
            <button 
                onClick={handleLogout}
                className="md:hidden p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-300 border border-transparent hover:border-red-200 group"
            >
               <LogOut size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* MENU MOBILE - Design Premium */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-blue-100 bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 absolute w-full left-0 shadow-2xl p-4 space-y-3 animate-in slide-in-from-top-3 z-50 backdrop-blur-xl">
            
            {/* Card de Perfil Mobile */}
            <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 shadow-xl border border-white/20">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              <div className="relative flex items-center gap-4">
                <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-white to-blue-100 shadow-lg overflow-hidden flex items-center justify-center border-2 border-white/50">
                    {avatarUrl ? (
                        <Image src={avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
                    ) : (
                        <span className="text-blue-700 font-black text-xl">
                            {userName.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-white truncate text-lg drop-shadow-sm">{userName}</p>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/30">
                          <Trophy size={12} className="text-yellow-300" />
                          <span className="text-xs font-black text-white">Nível {nivel}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/30">
                          <Star size={12} className="text-blue-200 fill-blue-200" />
                          <span className="text-xs font-black text-white">{pontos}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/30">
                          <Flame size={12} className="text-orange-300" />
                          <span className="text-xs font-black text-white">{streak}</span>
                        </div>
                    </div>
                </div>
              </div>
            </div>
            
            {/* Menu Items Mobile */}
            <div className="space-y-2">
              <Link 
                href="/estudante/perfil" 
                className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-800 to-amber-900 hover:bg-white rounded-2xl text-slate-700 hover:text-blue-700 font-bold border border-blue-100/50 hover:border-blue-300 transition-all duration-300 text-sm shadow-sm hover:shadow-md group"
              >
                  <div className="p-2 rounded-xl bg-amber-900 group-hover:bg-blue-100 transition-colors">
                    <Settings size={18} className="text-gray-100" />
                  </div>
                  <span className="flex-1 text-gray-100">Configurar Perfil</span>
                  <ChevronDown size={16} className="opacity-0 group-hover:opacity-100 -rotate-90 transition-all" />
              </Link>

              {canAccessAdmin && (
                  <Link 
                    href="/admin/questoes" 
                    className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white rounded-2xl font-black text-sm shadow-lg shadow-slate-900/30 hover:shadow-xl transition-all duration-300 group"
                  >
                      <div className="p-2 rounded-xl bg-white/10 group-hover:bg-white/20 transition-colors">
                        <LayoutDashboard size={18} />
                      </div>
                      <span className="flex-1">Painel Admin</span>
                      <ChevronDown size={16} className="opacity-0 group-hover:opacity-100 -rotate-90 transition-all" />
                  </Link>
              )}

              <button 
                onClick={handleLogout} 
                className="w-full flex items-center gap-3 p-4 hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 rounded-2xl text-slate-700 hover:text-red-600 font-bold transition-all duration-300 text-sm border border-red-100/50 hover:border-red-300 shadow-sm hover:shadow-md group"
              >
                  <div className="p-2 rounded-xl bg-red-50 group-hover:bg-red-100 transition-colors">
                    <LogOut size={18} className="text-red-600" />
                  </div>
                  <span className="flex-1 text-left">Sair</span>
                  <ChevronDown size={16} className="opacity-0 group-hover:opacity-100 -rotate-90 transition-all" />
              </button>
            </div>
        </div>
      )}
    </nav>
  );
}
