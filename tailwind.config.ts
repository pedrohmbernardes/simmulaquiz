import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#003366',        
          lightBlue: '#F0F7FF',   
          green: '#008037',       
          brightGreen: '#22C55E', 
          red: '#DC2626',         
          white: '#FFFFFF',
        }
      },
      // ⭐ FONTES ATUALIZADAS
      fontFamily: {
        // 'sans' é a fonte padrão do Tailwind. Mudamos para Lato.
        sans: ["var(--font-lato)", "sans-serif"], 
        
        // Fontes Específicas
        roboto: ["var(--font-roboto)", "sans-serif"],
        oswald: ["var(--font-oswald)", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;