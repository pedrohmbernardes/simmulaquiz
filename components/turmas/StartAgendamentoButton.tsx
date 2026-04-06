// components/turmas/StartAgendamentoButton.tsx
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlayCircle, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface StartAgendamentoButtonProps {
  turmaId: number;
  agendamentoId: number;
}

export function StartAgendamentoButton({
  turmaId,
  agendamentoId,
}: StartAgendamentoButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(
        `/api/estudante/turmas/${turmaId}/agendamentos/${agendamentoId}/iniciar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Se já finalizou (Conflict), avisa e talvez redirecione para resultado
        if (response.status === 409 && data.simuladoId) {
          toast.info('Você já finalizou esta avaliação.');
          router.push(`/simulado/${data.simuladoId}/resultado`);
          return;
        }

        throw new Error(data.error || 'Erro ao iniciar avaliação.');
      }

      // Sucesso: Redireciona para o Player existente
      toast.success('Avaliação iniciada! Boa sorte.');
      router.push(`/simulado/${data.simuladoId}`);
      
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
      );
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          size="lg" 
          className="w-full sm:min-w-[200px] font-semibold shadow-md transition-all hover:scale-105"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Iniciando...
            </>
          ) : (
            <>
              Iniciar Avaliação
              <PlayCircle className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Confirmar Início
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Ao confirmar, o cronômetro será iniciado imediatamente e 
              <strong> não poderá ser pausado</strong>.
            </p>
            <p>
              Tem certeza que deseja começar agora?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault(); 
                handleStart();
            }}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Sim, Começar Agora'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}