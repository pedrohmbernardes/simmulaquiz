// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Utilitário de CSS seguro para usar em qualquer lugar (Client e Server)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── LÓGICA DE EMBARALHAMENTO DETERMINÍSTICO (ANTI-COLA) ───

/**
 * Gerador de números pseudoaleatórios baseado em uma semente fixa (Linear Congruential Generator).
 * Mesma semente = Mesma sequência de números.
 */
function sfc32(a: number, b: number, c: number, d: number) {
  return function() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
}

/**
 * Gera um mapa de embaralhamento de alternativas (A-E) único e previsível
 * baseado no ID do Simulado e no ID da Questão.
 * * Exemplo de retorno: { A: 'C', B: 'A', C: 'E', D: 'B', E: 'D' }
 * Significa: A letra 'A' que o aluno vê é, na verdade, a letra 'C' do banco.
 */
export function getShuffleMap(simuladoId: number, questaoId: number): Record<string, string> {
  // Cria uma semente única combinando os dois IDs
  const seed = simuladoId * 1000000 + questaoId;
  
  // Inicializa o gerador (usamos alguns números arbitrários para as sementes iniciais)
  const rand = sfc32(seed, seed ^ 0xDEADBEEF, seed ^ 0xCAFEBABE, seed ^ 0x12345678);
  
  const originais = ["A", "B", "C", "D", "E"];
  // Cria uma cópia para não alterar a original
  const paraEmbaralhar = [...originais];
  
  // Algoritmo de Fisher-Yates usando o nosso gerador "rand()"
  for (let i = paraEmbaralhar.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [paraEmbaralhar[i], paraEmbaralhar[j]] = [paraEmbaralhar[j], paraEmbaralhar[i]];
  }

  const mapa: Record<string, string> = {};
  
  // Mapeia a letra "Visual" (A, B, C, D, E) para a letra "Real" do banco
  for (let i = 0; i < originais.length; i++) {
    // Ex: mapa["A"] = "C"
    mapa[originais[i]] = paraEmbaralhar[i];
  }

  return mapa;
}