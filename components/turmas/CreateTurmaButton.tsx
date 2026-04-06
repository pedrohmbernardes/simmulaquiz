"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
// Importe o modal que você já tem (certifique-se que é default export)
import CreateTurmaModal from "./CreateTurmaModal"; 

export function CreateTurmaButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)} 
        className="bg-indigo-600 hover:bg-indigo-700 shadow-sm"
      >
        <Plus className="mr-2 h-4 w-4" />
        Nova Turma
      </Button>

      <CreateTurmaModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          setIsOpen(false);
          router.refresh(); // Recarrega a lista Server-Side
        }} 
      />
    </>
  );
}