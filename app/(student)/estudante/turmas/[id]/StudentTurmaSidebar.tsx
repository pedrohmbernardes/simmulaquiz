"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Megaphone,
  Library,
  FileText,
  PenTool,
  MessageSquare,
  Users,
  CalendarCheck,
  ChevronRight,
  GraduationCap,
  Home,
  Sparkles,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface StudentTurmaSidebarProps {
  turmaId: string;
  turmaNome: string;
  turmaCodigo?: string;
}

type MenuItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const getTurmaMenuItems = (turmaId: string): MenuItem[] => [
  { title: "Visão Geral", href: `/estudante/turmas/${turmaId}`, icon: LayoutDashboard, exact: true },
  { title: "Mural", href: `/estudante/turmas/${turmaId}/mural`, icon: Megaphone },
  { title: "Simulados", href: `/estudante/turmas/${turmaId}/agendamentos`, icon: PenTool },
  { title: "Conteúdo", href: `/estudante/turmas/${turmaId}/conteudo`, icon: Library },
  { title: "Tarefas", href: `/estudante/turmas/${turmaId}/tarefas`, icon: FileText },
  { title: "Fórum", href: `/estudante/turmas/${turmaId}/forum`, icon: MessageSquare },
  { title: "Pessoas", href: `/estudante/turmas/${turmaId}/pessoas`, icon: Users },
  { title: "Frequência", href: `/estudante/turmas/${turmaId}/presenca`, icon: CalendarCheck },
];

// Mobile: 4 primary tabs + "Mais" button
const PRIMARY_TAB_COUNT = 4;

function ItemLabel({ isExpanded, children }: { isExpanded: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "ml-3 overflow-hidden whitespace-nowrap text-sm font-semibold leading-5",
        "transition-[opacity,max-width,transform] duration-300 ease-out",
        isExpanded
          ? "max-w-[200px] opacity-100 translate-x-0"
          : "max-w-0 opacity-0 -translate-x-2"
      )}
    >
      {children}
    </span>
  );
}

export default function StudentTurmaSidebar({ turmaId, turmaNome, turmaCodigo }: StudentTurmaSidebarProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  const menuItems = getTurmaMenuItems(turmaId);
  const primaryTabs = menuItems.slice(0, PRIMARY_TAB_COUNT);
  const secondaryTabs = menuItems.slice(PRIMARY_TAB_COUNT);

  const isActive = (item: MenuItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const isSecondaryActive = secondaryTabs.some(item => isActive(item));

// Fecha o menu mobile (sheet) imediatamente se a rota mudar
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsMoreOpen(false);
  }

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (isMoreOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMoreOpen]);

  return (
    <>
      {/* ═══════════════════════════════════════════════════ */}
      {/* DESKTOP SIDEBAR — identical to original, hidden on mobile */}
      {/* ═══════════════════════════════════════════════════ */}
      <aside
        className={cn(
          "hidden md:flex",
          "fixed left-0 top-0 h-screen shrink-0 flex-col text-white shadow-2xl z-40",
          "bg-gradient-to-br from-violet-950 via-purple-900 to-fuchsia-950",
          "transition-[width] duration-300 ease-out border-r border-white/5",
          isExpanded ? "w-72" : "w-20"
        )}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Logo / Brand */}
        <div className="flex h-20 items-center justify-center border-b border-white/10 px-4 bg-black/20">
          <div className={cn("flex w-full items-center gap-3", isExpanded ? "justify-start" : "justify-center")}>
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-violet-600 shadow-lg shadow-pink-500/50 ring-2 ring-white/20">
              <GraduationCap className="h-6 w-6" />
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-violet-950 animate-pulse"></div>
            </div>

            <div
              className={cn(
                "overflow-hidden whitespace-nowrap",
                "transition-[opacity,max-width,transform] duration-300 ease-out",
                isExpanded ? "max-w-[180px] opacity-100 translate-x-0" : "max-w-0 opacity-0 -translate-x-2"
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-pink-400">Turma Ativa</p>
              <p className="text-sm font-bold leading-tight text-white truncate">
                {turmaCodigo || turmaNome}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div
          className={cn(
            "flex-1 overflow-x-hidden scrollbar-thin scrollbar-thumb-violet-700/50 scrollbar-track-transparent hover:scrollbar-thumb-violet-600",
            isExpanded ? "overflow-y-auto" : "overflow-y-hidden"
          )}
        >
          <nav className="space-y-1.5 px-3 py-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex h-11 items-center rounded-xl px-3.5",
                    "overflow-hidden",
                    "transition-all duration-200",
                    isExpanded ? "justify-start" : "justify-center",
                    active
                      ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-500/30 scale-105"
                      : "text-violet-200 hover:bg-white/10 hover:text-white hover:scale-105"
                  )}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white shadow-lg shadow-white/50" />
                  )}

                  <span className="flex h-5 w-5 shrink-0 items-center justify-center relative">
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        active ? "text-white scale-110" : "text-pink-400 group-hover:text-white group-hover:scale-110"
                      )}
                    />
                  </span>

                  <ItemLabel isExpanded={isExpanded}>{item.title}</ItemLabel>

                  {isExpanded && (
                    <ChevronRight
                      className={cn(
                        "ml-auto h-4 w-4 shrink-0 transition-all duration-200",
                        active ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                      )}
                    />
                  )}

                  {!active && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-pink-500/0 via-purple-500/0 to-violet-500/0 group-hover:from-pink-500/10 group-hover:via-purple-500/10 group-hover:to-violet-500/10 transition-all duration-300" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mx-4 my-4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {isExpanded && (
            <div className="px-4 pb-4">
              <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 p-4 backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs font-bold text-white">Seu Progresso</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-violet-200">Atividades</span>
                    <span className="font-bold text-white">8/12</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full" style={{ width: '67%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Back Button */}
        <div className="border-t border-white/10 p-3 bg-black/20">
          <Link
            href="/estudante/turmas"
            className={cn(
              "group relative flex h-11 w-full items-center rounded-xl px-3.5",
              "overflow-hidden",
              "transition-all duration-200",
              isExpanded ? "justify-start" : "justify-center",
              "text-violet-200 hover:bg-white/10 hover:text-white hover:scale-105"
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <Home className="h-5 w-5 group-hover:scale-110 transition-transform" />
            </span>
            <ItemLabel isExpanded={isExpanded}>Minhas Turmas</ItemLabel>

            {isExpanded && (
              <ChevronRight className="ml-auto h-4 w-4 rotate-180 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            )}
          </Link>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════ */}
      {/* MOBILE BOTTOM TAB BAR — visible only on mobile     */}
      {/* ═══════════════════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Glass bar */}
        <div className="bg-white/95 backdrop-blur-xl border-t border-violet-100 shadow-[0_-4px_24px_rgba(124,58,237,0.08)] safe-area-bottom">
          <div className="flex items-stretch justify-around px-1 h-16">
            {primaryTabs.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 rounded-xl mx-0.5 transition-all duration-200 relative",
                    active
                      ? "text-violet-700"
                      : "text-slate-400 active:text-violet-500"
                  )}
                >
                  {/* Active pill indicator */}
                  {active && (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r from-pink-500 to-violet-600" />
                  )}
                  <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                  <span className={cn(
                    "text-[10px] leading-tight font-semibold truncate max-w-[64px]",
                    active && "font-bold"
                  )}>
                    {item.title}
                  </span>
                </Link>
              );
            })}

            {/* "Mais" button */}
            <button
              onClick={() => setIsMoreOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 rounded-xl mx-0.5 transition-all duration-200 relative",
                isSecondaryActive
                  ? "text-violet-700"
                  : "text-slate-400 active:text-violet-500"
              )}
            >
              {isSecondaryActive && (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r from-pink-500 to-violet-600" />
              )}
              <MoreHorizontal className={cn("h-5 w-5", isSecondaryActive && "scale-110")} />
              <span className={cn(
                "text-[10px] leading-tight font-semibold",
                isSecondaryActive && "font-bold"
              )}>
                Mais
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════ */}
      {/* MOBILE BOTTOM SHEET — secondary items               */}
      {/* ═══════════════════════════════════════════════════ */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMoreOpen(false)}
          />

          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 safe-area-bottom">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <h3 className="font-bold text-slate-800 text-base">Mais opções</h3>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Secondary menu items */}
            <div className="px-4 pb-4 space-y-1">
              {secondaryTabs.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200",
                      active
                        ? "bg-gradient-to-r from-violet-100 to-purple-50 text-violet-800"
                        : "text-slate-600 active:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "p-2.5 rounded-xl transition-colors",
                      active
                        ? "bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/20"
                        : "bg-slate-100 text-slate-500"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn("font-semibold text-sm flex-1", active && "font-bold")}>
                      {item.title}
                    </span>
                    {active && (
                      <div className="w-2 h-2 rounded-full bg-violet-600" />
                    )}
                    <ChevronRight className={cn("h-4 w-4", active ? "text-violet-400" : "text-slate-300")} />
                  </Link>
                );
              })}

              {/* Divider + Back to turmas */}
              <div className="my-2 h-px bg-slate-100" />
              <Link
                href="/estudante/turmas"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-500 active:bg-slate-50 transition-all"
              >
                <div className="p-2.5 rounded-xl bg-slate-100">
                  <Home className="h-5 w-5 text-slate-400" />
                </div>
                <span className="font-semibold text-sm">Minhas Turmas</span>
                <ChevronRight className="h-4 w-4 text-slate-300 ml-auto" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
