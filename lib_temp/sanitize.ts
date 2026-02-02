import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitiza uma string removendo tags HTML perigosas (XSS)
 * Remove scripts, iframes e atributos de eventos (onclick, onerror),
 * mas permite texto puro seguro.
 */
export function sanitizeString(text: unknown): string {
  if (typeof text !== 'string') return '';
  // .trim() remove espaços em branco extras no início/fim
  return DOMPurify.sanitize(text.trim());
}

/**
 * Sanitiza recursivamente um objeto ou array.
 * Útil para limpar o body inteiro de uma requisição JSON antes de passar para o Zod/Prisma.
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Recursão para limpar objetos aninhados
        result[key] = sanitizeObject((obj as any)[key]);
      }
    }
    return result;
  }
  
  // Retorna números, booleanos ou null sem alteração
  return obj;
}