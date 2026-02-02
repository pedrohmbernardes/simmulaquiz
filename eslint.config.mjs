import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // --- ADICIONAMOS ESTE BLOCO AQUI ---
  {
    rules: {
      // Permite usar 'any' sem o terminal reclamar
      "@typescript-eslint/no-explicit-any": "off",
      // Permite declarar variáveis (ex: 'catch(e)') e não usar
      "@typescript-eslint/no-unused-vars": "off",
      // Permite usar aspas simples/duplas no HTML sem escapar
      "react/no-unescaped-entities": "off",
      // Se tiver erros de 'e is defined but never used', isso reforça:
      "no-unused-vars": "off"
    },
  },
  // -----------------------------------

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;