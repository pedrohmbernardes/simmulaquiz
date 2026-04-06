"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import TeacherSidebar from "./TeacherSidebar";

function isTurmaDetailPath(pathname: string) {
  // Esconde sidebar padrão somente em rotas de detalhe da turma (id numérico)
  // Ex.: /professor/turmas/1, /professor/turmas/1/mural, etc.
  return /^\/professor\/turmas\/\d+(?:\/.*)?$/.test(pathname);
}

export default function TeacherShellClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideDefaultSidebar = isTurmaDetailPath(pathname);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30">
        {!hideDefaultSidebar && <TeacherSidebar turmaContext={null} />}

        <main
            className={cn(
            "flex-1 min-w-0 h-full",
            hideDefaultSidebar ? "overflow-hidden" : "overflow-y-auto"
            )}
        >
            <div className="h-full">{children}</div>
        </main>
    </div>
  );
}
