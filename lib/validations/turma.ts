import { z } from "zod";

export const criarTurmaSchema = z.object({
  nome: z
    .string()
    .min(3, "O nome da turma deve ter pelo menos 3 caracteres.")
    .max(100, "O nome da turma deve ter no máximo 100 caracteres."),
  descricao: z
    .string()
    .max(1000, "A descrição deve ter no máximo 1000 caracteres.")
    .optional(),
  imagemUrl: z
    .string()
    .url("A URL da imagem é inválida.")
    .optional()
    .or(z.literal("")), // Permite string vazia como "sem imagem"
});

export const entrarTurmaSchema = z.object({
  codigo: z
    .string()
    .min(5, "Código inválido.")
    .max(20, "Código inválido.")
    .transform((val) => val.toUpperCase().trim()), // Normaliza para caixa alta e sem espaços
});

export type CriarTurmaInput = z.infer<typeof criarTurmaSchema>;
export type EntrarTurmaInput = z.infer<typeof entrarTurmaSchema>;