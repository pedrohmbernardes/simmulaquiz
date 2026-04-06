import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StudentNavbar from "@/app/(student)/estudante/StudentNavbar";
import NextTopLoader from 'nextjs-toploader';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || !session.sub || !session.name) {
    redirect('/login');
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

      <StudentNavbar session={session} />

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="container mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
