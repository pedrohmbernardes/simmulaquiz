import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TeacherShellClient from './TeacherShellClient';

export default async function TeacherLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  // Mantido igual: mesma verificação de permissão
  if (!session || (session.role !== 'PROFESSOR' && session.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  return <TeacherShellClient>{children}</TeacherShellClient>;
}
