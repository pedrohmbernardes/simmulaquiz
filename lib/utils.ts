// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Utilitário de CSS seguro para usar em qualquer lugar (Client e Server)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}