import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SidebarNav from './SidebarNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session: any = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 font-sans relative">
      
      {/* Sidebar com novo design */}
      <SidebarNav session={session} />

      {/* CONTEÚDO PRINCIPAL - Container moderno com melhor espaçamento */}
      <main className="flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8 transition-all w-full">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
