"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import JoinTurmaModal from "./JoinTurmaModal"; 
import { useRouter } from "next/navigation";

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
        className={className || (variant === 'default' ? "bg-indigo-600 hover:bg-indigo-700" : "")}
      >
        {variant !== 'link' && <PlusCircle className="mr-2 h-4 w-4" />}
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