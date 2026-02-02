import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StudentNavbar from './StudentNavbar'; 
import NextTopLoader from 'nextjs-toploader'; // ✅ UX: Barra de Carregamento

// Força verificação a cada acesso (segurança máxima)
export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Se não tem sessão ou o nome está corrompido -> Login
  if (!session || !session.sub || !session.name) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ✅ UX MELHORADA (Audit Item #9)
         Barra de progresso automática ao navegar entre páginas 
      */}
      <NextTopLoader 
        color="#2563EB" // Azul (Primary Blue)
        initialPosition={0.08}
        crawlSpeed={200}
        height={3}
        crawl={true}
        showSpinner={false} // Spinner removido para visual mais limpo
        easing="ease"
        speed={200}
        shadow="0 0 10px #2563EB,0 0 5px #2563EB"
      />

      {/* Navbar com a sessão validada */}
      <StudentNavbar session={session} />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}