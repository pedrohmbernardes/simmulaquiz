import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StudentNavbar from "@/app/(student)/estudante/StudentNavbar";
import NextTopLoader from 'nextjs-toploader';
import { prisma } from '@/lib/prisma';
import { resolveFotoUrl } from '@/lib/storage/supabase';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || !session.sub || !session.name) {
    redirect('/login');
  }

  // Fonte da verdade é o banco (fotoUrl = path puro), não o cookie.
  // Gera uma URL assinada fresca a cada navegação, em vez de confiar
  // no snapshot que ficou congelado na sessão.
  let avatarUrlFresco: string | null = session.avatarUrl ?? null;
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: Number(session.sub) },
      select: { fotoUrl: true },
    });
    avatarUrlFresco = await resolveFotoUrl(usuario?.fotoUrl ?? null, 60 * 60);
  } catch {
    // Se a chamada ao Supabase falhar por qualquer motivo, cai no valor
    // antigo do cookie — nunca quebra a navegação por causa do avatar.
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <NextTopLoader
        color="#2563EB"
        initialPosition={0.08}
        crawlSpeed={200}
        height={3}
        crawl={true}
        showSpinner={false}
        easing="ease"
        speed={200}
        shadow="0 0 10px #2563EB,0 0 5px #2563EB"
      />

      <StudentNavbar session={{ ...session, avatarUrl: avatarUrlFresco }} />

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="container mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}