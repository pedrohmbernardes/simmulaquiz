'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SimuladoSAEP() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleStart = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/simulados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'SAEP',
          // Não precisa enviar curso ou unidade, o backend sabe filtrar por SAEP=true
          qtdeQuestoes: 50 // Backend força 50, mas enviamos por padrão
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        router.push(`/simulado/${data.id}`);
      } else {
        alert(data.error || "Erro ao criar simulado SAEP (Verifique se há questões SAEP no banco)");
      }
    } catch (error) {
      alert("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-10 rounded-2xl shadow-xl text-center border-t-8 border-red-600">
        
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Simulado SAEP</h1>
        
        <div className="bg-red-50 p-4 rounded-lg text-left mb-8 border border-red-100">
          <h3 className="font-bold text-red-800 mb-2">Instruções da Prova:</h3>
          <ul className="text-sm text-red-700 space-y-2 list-disc pl-5">
            <li>Você terá <strong>120 minutos</strong> (2 horas).</li>
            <li>A prova contém <strong>50 questões</strong> objetivas.</li>
            <li>O conteúdo abrange todas as Unidades Curriculares.</li>
            <li>Não é permitido pausar o cronômetro.</li>
          </ul>
        </div>

        <button 
          onClick={handleStart}
          disabled={submitting}
          className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition transform hover:scale-105 shadow-lg text-lg"
        >
          {submitting ? 'Gerando Prova...' : 'COMEÇAR AGORA'}
        </button>
        
        <p className="mt-4 text-xs text-gray-400">Boa sorte!</p>
      </div>
    </div>
  );
}