"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import JoinTurmaModal from "./JoinTurmaModal"; 
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface JoinTurmaButtonProps {
  text?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  className?: string;
}

export function JoinTurmaButton({ 
  text = "Participar de Turma", 
  variant = "default",
  className
}: JoinTurmaButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)} 
        variant={variant}
        className={cn(
          // Se não passar className e for default, aplica o estilo padrão
          variant === 'default' && !className ? "bg-indigo-600 hover:bg-indigo-700 text-white font-bold" : "",
          // Estilos base para garantir alinhamento do ícone
          "gap-2 h-11 md:h-12",
          className
        )}
      >
        {variant !== 'link' && <PlusCircle size={18} />}
        {text}
      </Button>

      <JoinTurmaModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          setIsOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}