import xss from 'xss';

/**
 * Sanitiza uma string removendo tags HTML perigosas (XSS)
 */
export function sanitizeString(text: unknown): string {
  if (typeof text !== 'string') return '';
  return xss(text.trim());
}

/**
 * Sanitiza recursivamente um objeto ou array.
 * IGNORA objetos Date para evitar corrupção de dados no Prisma.
 */
export function sanitizeObject<T>(obj: T): T {
  // 1. Se for string, sanitiza
  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }
  
  // 2. Se for data, retorna intacto (CORREÇÃO CRÍTICA)
  if (obj instanceof Date) {
    return obj;
  }
  
  // 3. Se for array, mapeia recursivamente
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }
  
  // 4. Se for objeto genérico, varre as chaves
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = sanitizeObject((obj as any)[key]);
      }
    }
    return result;
  }
  
  // Retorna números, booleanos ou null sem alteração
  return obj;
}