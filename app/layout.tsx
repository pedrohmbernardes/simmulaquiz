import type { Metadata } from "next";
import { Oswald, Roboto, Lato } from "next/font/google";
import { Toaster } from "sonner";
import { cookies } from "next/headers"; // ✅ 1. Import necessário
import "./globals.css";

// 1. Configurando Oswald (Títulos Fortes)
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// 2. Configurando Roboto (UI / Interface Técnica)
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// 3. Configurando Lato (Texto Padrão / Leitura)
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Simmula Quiz",
  description: "Plataforma de simulados técnicos",
};

// ✅ 2. O componente agora é ASYNC
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ✅ 3. Lógica para pegar o token de forma segura
  const cookieStore = await cookies();
  const csrfToken = cookieStore.get('csrf-token')?.value || '';

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* ✅ 4. Injeção Global do Token CSRF */}
        <meta name="csrf-token" content={csrfToken} />
      </head>
      <body
        className={`${oswald.variable} ${roboto.variable} ${lato.variable} bg-brand-lightBlue text-gray-900 antialiased font-sans`}
      >
        {children}

        {/* ✅ Toaster global (Sonner) */}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 4500,
            classNames: {
              toast:
                "border border-zinc-200 bg-white text-zinc-900 shadow-lg rounded-2xl",
              title: "font-bold",
              description: "text-zinc-600",
              actionButton: "bg-zinc-900 text-white",
              cancelButton: "bg-zinc-100 text-zinc-900",
            },
          }}
        />
      </body>
    </html>
  );
}