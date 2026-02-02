import { getSession } from '@/lib/auth';
import AdminUsuariosClient from './client';

export const metadata = {
  title: 'Gestão de Usuários | Admin',
};

export default async function AdminUsuarios() {
  const session = await getSession();
  
  // 🔒 1. Segurança Server-Side (RBAC)
  // Bloqueia o render no servidor se não for admin
  if (!session || session.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in">
         <div className="bg-red-50 p-6 rounded-full mb-4">
             <span className="text-4xl">⛔</span>
         </div>
         <h1 className="text-2xl font-bold text-red-700">Acesso Negado</h1>
         <p className="text-gray-500 mt-2">Você não tem permissão para acessar o módulo de gestão de usuários.</p>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Cabeçalho Estático */}
      <div className="mb-8">
         <h1 className="text-3xl font-black text-blue-900 uppercase font-oswald tracking-tight">
            Gestão de Usuários
         </h1>
         <p className="text-gray-500 font-medium mt-1">
            Gerencie alunos, professores e monitore o engajamento da plataforma.
         </p>
      </div>

      {/* Carrega a interface interativa (Tabela, Busca, Paginação) */}
      <AdminUsuariosClient />
    </div>
  );
}