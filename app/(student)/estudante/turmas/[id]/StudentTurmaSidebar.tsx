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
} from "lucide-react";
import { useState } from "react";

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
  { title: "Conteúdo", href: `/estudante/turmas/${turmaId}/conteudo`, icon: Library },
  { title: "Tarefas", href: `/estudante/turmas/${turmaId}/tarefas`, icon: FileText },
  { title: "Simulados", href: `/estudante/turmas/${turmaId}/agendamentos`, icon: PenTool },
  { title: "Fórum", href: `/estudante/turmas/${turmaId}/forum`, icon: MessageSquare },
  { title: "Pessoas", href: `/estudante/turmas/${turmaId}/pessoas`, icon: Users },
  { title: "Frequência", href: `/estudante/turmas/${turmaId}/presenca`, icon: CalendarCheck },
];

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

  const menuItems = getTurmaMenuItems(turmaId);

  const isActive = (item: MenuItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 flex h-screen shrink-0 flex-col text-white shadow-2xl z-40",
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
        {/* Menu Items */}
        <nav className="space-y-1.5 px-3 py-6">
          {menuItems.map((item, idx) => {
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
                {/* Active Indicator */}
                {active && (
                  <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white shadow-lg shadow-white/50" />
                )}

                {/* Icon */}
                <span className="flex h-5 w-5 shrink-0 items-center justify-center relative">
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      active ? "text-white scale-110" : "text-pink-400 group-hover:text-white group-hover:scale-110"
                    )}
                  />
                </span>

                {/* Label */}
                <ItemLabel isExpanded={isExpanded}>{item.title}</ItemLabel>

                {/* Chevron */}
                {isExpanded && (
                  <ChevronRight
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0 transition-all duration-200",
                      active ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                    )}
                  />
                )}

                {/* Glow effect on hover */}
                {!active && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-pink-500/0 via-purple-500/0 to-violet-500/0 group-hover:from-pink-500/10 group-hover:via-purple-500/10 group-hover:to-violet-500/10 transition-all duration-300" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4 my-4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Quick Stats (when expanded) */}
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
  );
}
