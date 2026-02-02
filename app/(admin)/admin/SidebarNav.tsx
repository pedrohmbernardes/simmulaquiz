'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCsrf } from '@/lib/hooks/use-csrf';
import { 
  Menu, X, LogOut, BookOpen, Users, ExternalLink, 
  LayoutDashboard, Sparkles, Brain, GraduationCap,
  ChevronRight, Zap, Award, TrendingUp
} from 'lucide-react';

export default function SidebarNav({ session }: { session: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const userRole = session?.role;
  const csrfToken = useCsrf();

  const getLinkClass = (path: string) => {
    let isActive = false;

    if (path === '/admin') {
      isActive = pathname === '/admin';
    } else {
      isActive = pathname.startsWith(path);
    }

    return isActive
      ? "group flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white font-semibold shadow-lg shadow-blue-500/40 transition-all duration-300 transform hover:scale-[1.02] border border-blue-400/30"
      : "group flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-700 hover:bg-gradient-to-r hover:from-slate-100 hover:to-blue-50 hover:text-blue-700 transition-all duration-300 font-medium border border-transparent hover:border-blue-200/50 hover:shadow-sm";
  };

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
      console.error('Erro ao sair', error);
      window.location.href = '/login';
    }
  };

  return (
    <>
      {/* Botão Menu Mobile - Design Premium */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 bg-white text-slate-800 p-3.5 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-blue-100 hover:border-blue-300 hover:bg-blue-50 group"
        aria-label="Abrir menu"
      >
        <Menu size={22} className="group-hover:text-blue-600 transition-colors" />
      </button>

      {/* Overlay com efeito glassmorphism */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gradient-to-br from-slate-900/70 via-blue-900/60 to-purple-900/50 z-40 md:hidden backdrop-blur-md transition-all duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Principal - Design Educacional Premium */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out border-r border-blue-100/50
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 
        md:sticky md:top-0 md:h-screen
        backdrop-blur-sm
      `}>
        
        {/* Header da Sidebar - Premium */}
        <div className="p-6 border-b border-gradient-to-r from-transparent via-blue-100 to-transparent shrink-0 bg-white/80 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6">
            <Link href="/admin" className="flex items-center gap-3 group" onClick={() => setIsOpen(false)}>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/30 group-hover:shadow-2xl group-hover:shadow-blue-500/40 transition-all duration-300 group-hover:scale-110">
                  <GraduationCap className="text-white" size={26} />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-slate-800 leading-tight tracking-tight group-hover:text-blue-700 transition-colors">
                  Simmula<span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Quiz</span>
                </span>
                <span className="text-xs text-slate-500 font-bold tracking-wider uppercase">Admin Dashboard</span>
              </div>
            </Link>
            <button 
              onClick={() => setIsOpen(false)} 
              className="md:hidden text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all duration-300 group"
            >
              <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>

          {/* Perfil do Usuário - Card Premium */}
          <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 shadow-xl shadow-blue-500/30 border border-white/20">
            {/* Efeito de brilho animado */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            
            <div className="relative flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-full blur-md opacity-30"></div>
                <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-white to-blue-100 flex items-center justify-center text-blue-700 font-black shadow-lg text-lg border-2 border-white/50">
                  {session?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate drop-shadow-sm">{session?.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Award size={12} className="text-yellow-300" />
                  <p className="text-xs text-blue-100 font-bold tracking-wide">
                    {userRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Professor'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Links de Navegação - Design Gamificado */}
        <nav className="flex-1 p-5 overflow-y-auto custom-scrollbar">
          
          {/* Seção Principal */}
          <div className="mb-6">
            <div className="flex items-center gap-2 px-4 mb-4">
              <div className="h-1 w-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"></div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Principal
              </p>
              <div className="flex-1 h-[2px] bg-gradient-to-r from-blue-200 to-transparent"></div>
            </div>
            
            <div className="space-y-2">
              <Link href="/admin" className={getLinkClass('/admin')} onClick={() => setIsOpen(false)}>
                <div className="p-1.5 rounded-lg bg-white/50 group-hover:bg-white transition-colors">
                  <LayoutDashboard size={18} />
                </div>
                <span className="flex-1 font-semibold">Dashboard</span>
                <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </Link>

              <Link href="/admin/questoes" className={getLinkClass('/admin/questoes')} onClick={() => setIsOpen(false)}>
                <div className="p-1.5 rounded-lg bg-white/50 group-hover:bg-white transition-colors">
                  <BookOpen size={18} />
                </div>
                <span className="flex-1 font-semibold">Questões</span>
                <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </Link>
            </div>
          </div>

          {/* Ações Rápidas - Cards Premium */}
          <div className="mb-6">
            <div className="flex items-center gap-2 px-4 mb-4">
              <Zap size={14} className="text-amber-500" />
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Ações Rápidas
              </p>
              <div className="flex-1 h-[2px] bg-gradient-to-r from-amber-200 to-transparent"></div>
            </div>
            
            <div className="space-y-3">
              <Link 
                href="/admin/questoes/nova" 
                className="relative group/card flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold text-blue-700 bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 transition-all duration-300 border border-blue-200/50 hover:border-blue-300 shadow-sm hover:shadow-lg hover:shadow-blue-500/20 overflow-hidden"
                onClick={() => setIsOpen(false)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/card:translate-x-full transition-transform duration-700"></div>
                <div className="relative p-1.5 rounded-lg bg-white/70 group-hover/card:bg-white transition-colors">
                  <Sparkles size={16} className="text-blue-600" />
                </div>
                <span className="relative">Criar Questão</span>
                <TrendingUp size={14} className="relative ml-auto opacity-0 group-hover/card:opacity-100 transition-opacity" />
              </Link>

              <Link 
                href="/admin/questoes/ia" 
                className="relative group/card flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold text-purple-700 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 transition-all duration-300 border border-purple-200/50 hover:border-purple-300 shadow-sm hover:shadow-lg hover:shadow-purple-500/20 overflow-hidden"
                onClick={() => setIsOpen(false)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/card:translate-x-full transition-transform duration-700"></div>
                <div className="relative p-1.5 rounded-lg bg-white/70 group-hover/card:bg-white transition-colors">
                  <Brain size={16} className="text-purple-600" />
                </div>
                <span className="relative">Questão com IA</span>
                <Sparkles size={14} className="relative ml-auto opacity-0 group-hover/card:opacity-100 transition-opacity text-purple-500" />
              </Link>
            </div>
          </div>

          {/* Visualização do Site - Card Especial */}
          <Link 
            href="/estudante" 
            className="group/external flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-700 bg-gradient-to-br from-slate-50 to-gray-50 hover:from-slate-100 hover:to-gray-100 transition-all duration-300 font-semibold border border-slate-200/50 hover:border-slate-300 mb-6 shadow-sm hover:shadow-md overflow-hidden relative"
            target="_blank" 
            onClick={() => setIsOpen(false)}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200/30 to-transparent -translate-x-full group-hover/external:translate-x-full transition-transform duration-700"></div>
            <div className="relative p-1.5 rounded-lg bg-white group-hover/external:bg-blue-50 transition-colors">
              <ExternalLink size={18} className="group-hover/external:text-blue-600 transition-colors" />
            </div>
            <span className="relative flex-1">Ver Site do Aluno</span>
            <ChevronRight size={16} className="relative opacity-0 group-hover/external:opacity-100 group-hover/external:translate-x-1 transition-all duration-300" />
          </Link>

          {/* Administração (Super Admin) */}
          {userRole === 'SUPER_ADMIN' && (
            <div>
              <div className="flex items-center gap-2 px-4 mb-4">
                <div className="h-1 w-1 rounded-full bg-gradient-to-r from-red-500 to-orange-500"></div>
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Administração
                </p>
                <div className="flex-1 h-[2px] bg-gradient-to-r from-red-200 to-transparent"></div>
              </div>
              <Link href="/admin/usuarios" className={getLinkClass('/admin/usuarios')} onClick={() => setIsOpen(false)}>
                <div className="p-1.5 rounded-lg bg-white/50 group-hover:bg-white transition-colors">
                  <Users size={18} />
                </div>
                <span className="flex-1 font-semibold">Usuários</span>
                <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </Link>
            </div>
          )}
        </nav>

        {/* Rodapé da Sidebar - Premium */}
        <div className="p-5 border-t border-gradient-to-r from-transparent via-blue-100 to-transparent shrink-0 space-y-3 bg-white/50 backdrop-blur-sm">
          <button 
            onClick={handleLogout} 
            className="group/logout relative w-full px-4 py-3.5 bg-gradient-to-r from-red-500 via-red-600 to-rose-600 hover:from-red-600 hover:via-red-700 hover:to-rose-700 text-white rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 font-black shadow-lg shadow-red-500/40 hover:shadow-xl hover:shadow-red-500/50 overflow-hidden border border-red-400/30"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/logout:translate-x-full transition-transform duration-700"></div>
            <LogOut size={18} className="relative group-hover/logout:rotate-12 transition-transform duration-300" />
            <span className="relative">Sair do Sistema</span>
          </button>
          
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200"></div>
            <span className="font-bold">SimmulaQuiz © 2026</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200"></div>
          </div>
        </div>
      </aside>
    </>
  );
}
