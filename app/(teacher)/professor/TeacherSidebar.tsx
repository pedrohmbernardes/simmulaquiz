"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  LogOut,
  Settings,
  ChevronRight,
  Megaphone,
  Library,
  PenTool,
  MessageSquare,
  CalendarCheck,
  GraduationCap,
} from "lucide-react";
import { useState } from "react";
import { useSecureFetch } from "@/lib/hooks/useSecureFetch";

interface TeacherSidebarProps {
  turmaContext?: {
    id: string;
    nome: string;
    codigo: string;
  } | null;
}

type MenuItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const mainMenuItems: MenuItem[] = [
  { title: "Visão Geral", href: "/admin", icon: LayoutDashboard },
  { title: "Minhas Turmas", href: "/professor/turmas", icon: Users },
  { title: "Banco de Questões", href: "/admin/questoes", icon: BookOpen },
];

const getTurmaMenuItems = (turmaId: string): MenuItem[] => [
  { title: "Visão Geral", href: `/professor/turmas/${turmaId}`, icon: LayoutDashboard, exact: true },
  { title: "Mural", href: `/professor/turmas/${turmaId}/mural`, icon: Megaphone },
  { title: "Conteúdo", href: `/professor/turmas/${turmaId}/conteudo`, icon: Library },
  { title: "Tarefas", href: `/professor/turmas/${turmaId}/tarefas`, icon: FileText },
  { title: "Simulados", href: `/professor/turmas/${turmaId}/simulados`, icon: PenTool },
  { title: "Fórum", href: `/professor/turmas/${turmaId}/forum`, icon: MessageSquare },
  { title: "Pessoas", href: `/professor/turmas/${turmaId}/pessoas`, icon: Users },
  { title: "Frequência", href: `/professor/turmas/${turmaId}/frequencia`, icon: CalendarCheck },
  { title: "Configurações", href: `/professor/turmas/${turmaId}/configuracoes`, icon: Settings }, 
];

function ItemLabel({ isExpanded, children }: { isExpanded: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "ml-3 overflow-hidden whitespace-nowrap text-sm font-medium leading-5",
        "transition-[opacity,max-width,transform] duration-200 ease-out",
        isExpanded
          ? "max-w-[180px] opacity-100 translate-x-0"
          : "max-w-0 opacity-0 -translate-x-1"
      )}
    >
      {children}
    </span>
  );
}

export default function TeacherSidebar({ turmaContext }: TeacherSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const secureFetch = useSecureFetch();
  const [isExpanded, setIsExpanded] = useState(false);

  const isInTurma = !!turmaContext;
  const turmaMenuItems = isInTurma && turmaContext ? getTurmaMenuItems(turmaContext.id) : [];

  const mainIsActive = (item: MenuItem) => {
    if (item.href === "/professor/turmas") {
      return !isInTurma && (pathname === item.href || pathname.startsWith(`${item.href}/`));
    }

    if (item.href === "/professor") {
      return pathname === "/professor";
    }

    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const turmaIsActive = (item: MenuItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const handleLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await secureFetch('/api/auth/logout', { method: 'POST' });
      
      if (response.ok) {
        router.push('/login');
      } else {
        console.error("Falha ao processar o logout.");
      }
    } catch (error) {
      console.error("Erro na requisição de logout:", error);
    }
  };

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-[100dvh] min-h-[100dvh] shrink-0 flex-col text-white shadow-2xl",
        "bg-gradient-to-b from-slate-900 to-slate-800",
        "transition-[width] duration-200 ease-out",
        isExpanded ? "w-64" : "w-20"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Header / Logo */}
      <div className="flex h-16 items-center border-b border-white/10 px-3">
        <div className={cn("flex w-full items-center", isExpanded ? "justify-start" : "justify-center")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
            <span className="text-lg font-bold">S</span>
          </div>

          <div
            className={cn(
              "overflow-hidden whitespace-nowrap",
              "transition-[opacity,max-width,transform] duration-200 ease-out",
              isExpanded ? "ml-3 max-w-[180px] opacity-100 translate-x-0" : "max-w-0 opacity-0 -translate-x-1"
            )}
          >
            <span className="text-lg font-bold">
              <span className="text-blue-400">Simmula</span>
              <span className="text-white">Prof</span>
            </span>
          </div>
        </div>
      </div>

      {/* Scroll container */}
      <div
        className={cn(
          "flex-1 overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent",
          isExpanded ? "overflow-y-auto" : "overflow-y-hidden"
        )}
      >
        {/* Menu principal */}
        <nav className="space-y-1 px-3 py-6">
          {mainMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = mainIsActive(item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex h-10 min-h-10 items-center rounded-xl px-3",
                  "overflow-hidden leading-5",
                  "transition-colors duration-150",
                  isExpanded ? "justify-start" : "justify-center",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/40"
                    : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-white" />
                )}

                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                    )}
                  />
                </span>

                <ItemLabel isExpanded={isExpanded}>{item.title}</ItemLabel>

                {isExpanded && (
                  <ChevronRight
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0 transition-opacity duration-150",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Seção turma */}
        {isInTurma && turmaContext && (
          <>
            <div className="px-3 py-4">
              <div className="border-t border-emerald-500/30 pt-4">
                <div className={cn("flex items-center", isExpanded ? "justify-start gap-3 px-3" : "justify-center")}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
                    <GraduationCap className="h-5 w-5" />
                  </div>

                  <div
                    className={cn(
                      "overflow-hidden whitespace-nowrap",
                      "transition-[opacity,max-width,transform] duration-200 ease-out",
                      isExpanded ? "max-w-[180px] opacity-100 translate-x-0" : "max-w-0 opacity-0 -translate-x-1"
                    )}
                  >
                    <p className="text-xs font-semibold text-emerald-400">Turma</p>
                    <p className="text-sm font-bold leading-tight text-white">{turmaContext.codigo}</p>
                  </div>
                </div>
              </div>
            </div>

            <nav className="space-y-1 px-3 pb-6">
              {turmaMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = turmaIsActive(item);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex h-10 min-h-10 items-center rounded-xl px-3",
                      "overflow-hidden leading-5",
                      "transition-colors duration-150",
                      isExpanded ? "justify-start" : "justify-center",
                      isActive
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/40"
                        : "text-slate-300 hover:bg-emerald-700/20 hover:text-white"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-emerald-300" />
                    )}

                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isActive ? "text-white" : "text-emerald-400 group-hover:text-white"
                        )}
                      />
                    </span>

                    <ItemLabel isExpanded={isExpanded}>{item.title}</ItemLabel>

                    {isExpanded && (
                      <ChevronRight
                        className={cn(
                          "ml-auto h-4 w-4 shrink-0 transition-opacity duration-150",
                          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </div>

      {/* Rodapé (Limpo, apenas com o botão de Logout) */}
      <div className="space-y-1 border-t border-white/10 p-3">
        <form onSubmit={handleLogout}>
          <button
            type="submit"
            className={cn(
              "group relative flex h-10 min-h-10 w-full items-center rounded-xl px-3",
              "overflow-hidden leading-5",
              "transition-colors duration-150",
              isExpanded ? "justify-start" : "justify-center",
              "text-red-400 hover:bg-red-500/10 hover:text-red-300"
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <LogOut className="h-5 w-5" />
            </span>
            <ItemLabel isExpanded={isExpanded}>Sair</ItemLabel>
          </button>
        </form>
      </div>
    </aside>
  );
}