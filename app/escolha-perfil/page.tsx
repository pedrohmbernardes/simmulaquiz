import { redirect } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, LayoutDashboard, ArrowRight } from 'lucide-react';
import { getSession } from '@/lib/auth'; // Importamos a sessão do servidor

export default async function EscolhaPerfilPage() {
  // 1. Busca sessão no servidor (sem fetch, sem loading)
  const session = await getSession();

  // 2. Proteção: Se não tiver sessão, manda pro login
  if (!session) {
    redirect('/login');
  }

  // 3. Proteção: Se for aluno, não deve estar aqui
  if (session.role === 'ALUNO') {
    redirect('/estudante');
  }

  const userName = session.name.split(' ')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex flex-col items-center justify-center p-6">
      
      <div className="mb-10 text-center space-y-2 animate-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight font-oswald uppercase">
          Olá, <span className="text-blue-600">{userName}</span>
        </h1>
        <p className="text-slate-500 font-medium text-lg">
          Como deseja acessar o sistema hoje?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        
        {/* CARD ESTUDANTE */}
        <Link 
          href="/estudante"
          className="group relative overflow-hidden bg-white rounded-3xl p-8 border-2 border-transparent hover:border-blue-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative z-10 w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner">
            <GraduationCap size={40} />
          </div>

          <h2 className="relative z-10 text-2xl font-bold text-slate-800 font-oswald uppercase mb-2">
            Painel do Estudante
          </h2>
          <p className="relative z-10 text-slate-500 mb-8 px-4 leading-relaxed">
            Acesse simulados, veja seu desempenho, ranking e conquistas como um aluno.
          </p>

          <div className="relative z-10 mt-auto flex items-center gap-2 text-blue-600 font-bold uppercase tracking-wider text-sm group-hover:gap-3 transition-all">
            Acessar Agora <ArrowRight size={16} />
          </div>
        </Link>

        {/* CARD ADMINISTRATIVO */}
        <Link 
          href="/admin"
          className="group relative overflow-hidden bg-slate-900 rounded-3xl p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative z-10 w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform duration-300 border border-slate-700">
            <LayoutDashboard size={40} />
          </div>

          <h2 className="relative z-10 text-2xl font-bold text-white font-oswald uppercase mb-2">
            Painel Administrativo
          </h2>
          <p className="relative z-10 text-slate-400 mb-8 px-4 leading-relaxed">
            Gerencie questões, usuários, turmas e analise métricas globais do sistema.
          </p>

          <div className="relative z-10 mt-auto flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-sm group-hover:gap-3 transition-all">
            Gerenciar Sistema <ArrowRight size={16} />
          </div>
        </Link>

      </div>

      <p className="mt-12 text-xs text-slate-400 font-bold uppercase tracking-widest">
        SimmulaQuiz • Ambiente Seguro
      </p>
    </div>
  );
}