// app/(student)/estudante/page.tsx
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  BrainCircuit, 
  Star, 
  Clock, 
  AlertCircle, 
  Play, 
  TrendingUp, 
  BookOpen, 
  Flame, 
  Award, 
  Trophy, 
  Target,
  ChevronRight,
  Medal,
  Zap,
  School // ✅ Novo ícone para o card de Turmas
} from 'lucide-react';

import { LevelBar } from '@/components/gamificacao/LevelBar';
import { PontosDisplay } from '@/components/gamificacao/PontosDisplay';
import { MetricCard } from '@/components/analytics/MetricCard';
import { GraficoEvolucao } from '@/components/analytics/GraficoEvolucao';

export const metadata: Metadata = {
  title: 'Dashboard | SimmulaQuiz',
  description: 'Painel geral do estudante',
};

// Definição dos Títulos de Posição (Ranking)
const POSITIONAL_TITLES = [
  { label: 'Antimatéria', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { label: 'Desafiante', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { label: 'Mestre', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { label: 'Diamante', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { label: 'Platina', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { label: 'Ouro', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { label: 'Bronze', color: 'bg-orange-50 text-orange-800 border-orange-100' },
];

export default async function StudentDashboard() {
  // 1. Segurança e Sessão
  const session = await getSession();
  if (!session) {
    redirect('/auth/login');
  }

  const userId = Number(session.sub);

  // 2. Busca de Dados Otimizada (Server-Side)
  // Adicionamos turmasCount no destructuring
  const [usuario, gamificacao, metricas, topSemana, turmasCount] = await Promise.all([
    // A: Dados do Usuário + CONQUISTAS
    prisma.usuario.findUnique({
      where: { id: userId },
      select: { 
        nome: true,
        _count: { select: { conquistas: true } }
      }
    }),
    
    // B: Gamificação e Título
    prisma.usuarioGamificacao.findUnique({
      where: { usuarioId: userId },
      include: { titulo: true }
    }),

    // C: Métricas de Simulados
    (async () => {
      const simulados = await prisma.simulado.findMany({
        where: { usuarioId: userId, status: 'CONCLUIDO' },
        orderBy: { dataConclusao: 'asc' },
        take: 20 
      });
      
      const totalSimulados = simulados.length;
      const media = totalSimulados > 0 
        ? Math.round(simulados.reduce((acc, curr) => acc + (curr.notaPercentual || 0), 0) / totalSimulados)
        : 0;
      
      const grafico = simulados.map(s => ({
        data: s.dataConclusao?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) || '',
        nota: s.notaPercentual || 0,
        acertos: s.notaAcertos || 0 
      }));

      return { totalSimulados, media, grafico };
    })(),

    // D: Top 7 Ranking Semanal
    prisma.historicoPontos.groupBy({
      by: ['usuarioId'],
      _sum: { quantidade: true },
      where: { 
        data: { 
          gte: new Date(new Date().setDate(new Date().getDate() - 7)) 
        } 
      },
      orderBy: { _sum: { quantidade: 'desc' } },
      take: 7
    }).then(async (ranks) => {
      const users = await prisma.usuario.findMany({
        where: { id: { in: ranks.map(r => r.usuarioId) } },
        select: { id: true, nome: true }
      });
      
      return ranks.map(r => ({
        id: r.usuarioId,
        nome: users.find(u => u.id === r.usuarioId)?.nome.split(' ')[0] || 'Anônimo',
        pontos: r._sum.quantidade || 0
      }));
    }),

    // ✅ E: Contagem de Turmas Ativas (NOVO)
    prisma.turmaAluno.count({
      where: { alunoId: userId, status: 'ATIVO', turma: { ativo: true } }
    })
  ]);

  if (!usuario || !gamificacao) return <div className="p-8 text-center text-red-500">Erro ao carregar perfil.</div>;

  // Lógica de Títulos e XP
  const tituloCalculado = await prisma.titulo.findFirst({
    where: { minPontos: { lte: gamificacao.pontos } },
    orderBy: { minPontos: 'desc' },
  });

  const tituloAtual = tituloCalculado || { nome: 'Iniciante', nivel: 1, minPontos: 0 };

  const proximoTitulo = await prisma.titulo.findFirst({
    where: { minPontos: { gt: tituloAtual.minPontos } },
    orderBy: { minPontos: 'asc' }
  });

  const xpPiso = tituloAtual?.minPontos || 0;
  const xpMeta = proximoTitulo?.minPontos || (gamificacao.pontos + 1000); 
  const xpGanhoNoNivel = Math.max(0, gamificacao.pontos - xpPiso);
  const xpNecessarioNoNivel = Math.max(1, xpMeta - xpPiso); 
  const percentualNivel = Math.min(100, Math.round((xpGanhoNoNivel / xpNecessarioNoNivel) * 100));

  const totalConquistas = usuario._count.conquistas;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12 font-sans px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 via-white to-white">
      
      {/* 1. HEADER GAMIFICADO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Principal */}
        <div className="lg:col-span-2 bg-white/90 p-6 md:p-8 rounded-3xl shadow-lg border border-transparent ring-1 ring-gray-100 relative overflow-hidden group hover:shadow-2xl transition-all">
          <div className="absolute top-0 right-0 p-8 opacity-6 group-hover:opacity-12 transition-opacity transform group-hover:scale-105 duration-700">
             <Trophy size={180} className="text-yellow-400/40" />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight font-oswald uppercase">
                  Olá, <span className="text-indigo-600">{usuario.nome.split(' ')[0]}</span>!
                </h1>
                <p className="text-gray-500 font-medium mt-1 font-lato">
                  Título Atual: <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 font-extrabold uppercase tracking-wide">{tituloAtual.nome || 'Iniciante'}</span>
                </p>
              </div>
              <div className="hidden sm:block">
                <PontosDisplay pontos={gamificacao.pontos} nivel={gamificacao.nivel} />
              </div>
            </div>
            
            <LevelBar 
              percentual={percentualNivel} 
              proximoTitulo={proximoTitulo?.nome || 'Nível Máximo'} 
              pontosRestantes={xpMeta - gamificacao.pontos} 
            />
          </div>
        </div>

        {/* Card Streak */}
        <div className="bg-gradient-to-br from-amber-500 to-rose-500 p-8 rounded-3xl text-white shadow-2xl flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 text-white/10 group-hover:scale-110 transition-transform duration-500">
            <Flame size={140} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-white/18 p-2.5 rounded-xl backdrop-blur-sm">
                <Flame size={28} fill="currentColor" className="animate-pulse text-white" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-90 bg-black/10 px-2 py-1 rounded-lg">Ofensiva</span>
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-6xl font-extrabold font-oswald">{gamificacao.streakAtual}</h2>
              <span className="text-xl font-semibold opacity-90">Dias</span>
            </div>
            <p className="text-sm font-medium opacity-95 mt-2">Mantenha a chama acesa e conquiste streaks!</p>
          </div>
        </div>
      </div>

      {/* ✅ 2. AÇÕES PRINCIPAIS (ATUALIZADO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* BOTÃO PRIMÁRIO: NOVO SIMULADO */}
        <Link 
          href="/estudante/novo"
          className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-teal-600 rounded-2xl p-6 shadow-2xl flex items-center justify-between group transition-transform hover:-translate-y-1 hover:shadow-2xl"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/18 p-2 rounded-lg text-white backdrop-blur-sm">
                <Play size={24} fill="currentColor" />
              </div>
              <span className="text-xs font-black text-white uppercase tracking-widest border border-white/20 px-2 py-0.5 rounded-md">
                Treino Rápido
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-white font-oswald uppercase italic">
              Começar Novo Simulado
            </h3>
            <p className="text-white/90 text-sm mt-1">Teste seus conhecimentos agora e suba no ranking.</p>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 group-hover:scale-110 transition-transform">
             <Zap size={120} className="text-white/20" />
          </div>
          <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/12 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
             <ChevronRight className="text-white" />
          </div>
        </Link>

        <Link
          href="/estudante/turmas"
          className="group relative overflow-hidden bg-white/95 border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4"
        >
          {/* Container principal com alinhamento centralizado */}
          <div className="flex gap-4 items-center">
            {/* Ícone maior e centralizado */}
            <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <School size={28} /> {/* Aumentado de 24 para 28 */}
            </div>

            {/* Bloco de texto com badge */}
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-lg font-bold text-gray-900 font-oswald uppercase group-hover:text-blue-700 transition-colors">
                  Minhas Turmas
                </h4>
                <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600 border border-gray-200 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700 whitespace-nowrap">
                  {turmasCount} Ativa{turmasCount !== 1 && 's'}
                </div>
              </div>
              <p className="text-xs text-gray-500 font-medium group-hover:text-gray-600 mt-1">
                Acesse aulas, materiais e provas dos professores.
              </p>
            </div>
          </div>

          {/* Link de ação */}
          <div className="flex items-center text-xs font-bold text-blue-600 uppercase tracking-wider group-hover:underline">
            Acessar Sala de Aula <ChevronRight size={14} className="ml-1" />
          </div>
        </Link>
      </div>

      {/* 3. ATALHOS RÁPIDOS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ShortcutCard 
          href="/estudante/caderno-erros" 
          icon={AlertCircle} 
          title="Caderno de Erros" 
          subtitle="Revise suas falhas." 
          colorClass="rose" 
        />
        <ShortcutCard 
          href="/estudante/favoritos" 
          icon={Star} 
          title="Favoritos" 
          subtitle="Sua coleção de estudos." 
          colorClass="amber" 
        />
        <ShortcutCard 
          href="/estudante/historico" 
          icon={Clock} 
          title="Histórico" 
          subtitle="Simulados anteriores." 
          colorClass="teal" 
        />
        <ShortcutCard 
          href="/estudante/conquistas" 
          icon={Medal} 
          title="Sala de Troféus" 
          subtitle={`${totalConquistas} medalhas ganhas.`} 
          colorClass="indigo" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* 4. COLUNA PRINCIPAL: MÉTRICAS E GRÁFICOS */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <MetricCard title="Simulados" value={metricas.totalSimulados} icon={BookOpen} color="blue" />
             <MetricCard title="Média Geral" value={`${metricas.media}%`} icon={TrendingUp} color="green" />
             <div className="bg-white/95 p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
               <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">XP Total</p>
                 <p className="text-2xl font-extrabold text-gray-900 mt-1 font-mono">{gamificacao.pontos.toLocaleString('pt-BR')}</p>
               </div>
               <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                 <Award size={24} />
               </div>
             </div>
          </div>

          <div className="bg-white/95 p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-extrabold text-gray-900 flex items-center gap-2 font-oswald uppercase">
                <TrendingUp className="text-indigo-600" size={20} /> Evolução de Desempenho
              </h3>
              <span className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 font-medium text-gray-600">
                Últimos 20 Simulados
              </span>
            </div>
            {metricas.grafico && metricas.grafico.length > 0 ? (
              <GraficoEvolucao data={metricas.grafico} />
            ) : (
              <div className="h-48 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
                Realize simulados para ver seu gráfico.
              </div>
            )}
          </div>
        </div>

        {/* 5. SIDEBAR: ELITE (RANKING) */}
        <div className="space-y-6">
          <div className="bg-white/95 p-6 rounded-3xl shadow-sm border border-gray-100 sticky top-4">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-extrabold text-gray-900 flex items-center gap-2 font-oswald uppercase text-lg">
                 <Trophy className="text-yellow-500" size={20} /> Elite
               </h3>
               <Link href="/estudante/ranking" className="text-[10px] font-black text-indigo-600 uppercase hover:underline tracking-wide">Ranking Geral</Link>
            </div>

            <div className="space-y-3">
              {topSemana && topSemana.length > 0 ? (
                topSemana.map((user: any, index: number) => {
                  const positionTitle = POSITIONAL_TITLES[index] || { label: 'Competidor', color: 'bg-gray-100 text-gray-500' };
                  const isMe = user.id === userId;

                  return (
                    <div key={user.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors group shadow-sm ${isMe ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100 hover:border-indigo-200'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-sm shadow-inner ${
                        index === 0 ? 'bg-yellow-400 text-white' : 
                        index === 1 ? 'bg-slate-300 text-white' :
                        index === 2 ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className={`text-xs font-bold truncate ${isMe ? 'text-indigo-700' : 'text-gray-900'}`}>
                            {user.nome} {isMe && '(Você)'}
                          </p>
                          <span className="text-[10px] font-extrabold text-gray-500">{user.pontos} XP</span>
                        </div>
                        <div className="mt-1">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${positionTitle.color}`}>
                            {positionTitle.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-gray-400 text-xs py-4">Ranking atualizando...</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Componente Helper para os Cards de Atalho (Mantido)
function ShortcutCard({ href, icon: Icon, title, subtitle, colorClass }: any) {
  const colors: any = {
    rose: {
      bgIcon: 'bg-rose-50',
      textIcon: 'text-rose-600',
      borderHover: 'hover:border-rose-200',
      bgHover: 'hover:bg-rose-50',
      arrowColor: 'text-rose-400',
      arrowHover: 'group-hover:text-rose-600',
      titleHover: 'group-hover:text-rose-700'
    },
    amber: {
      bgIcon: 'bg-amber-50',
      textIcon: 'text-amber-600',
      borderHover: 'hover:border-amber-200',
      bgHover: 'hover:bg-amber-50',
      arrowColor: 'text-amber-400',
      arrowHover: 'group-hover:text-amber-600',
      titleHover: 'group-hover:text-amber-700'
    },
    teal: {
      bgIcon: 'bg-teal-50',
      textIcon: 'text-teal-600',
      borderHover: 'hover:border-teal-200',
      bgHover: 'hover:bg-teal-50',
      arrowColor: 'text-teal-400',
      arrowHover: 'group-hover:text-teal-600',
      titleHover: 'group-hover:text-teal-700'
    },
    indigo: {
      bgIcon: 'bg-indigo-50',
      textIcon: 'text-indigo-600',
      borderHover: 'hover:border-indigo-200',
      bgHover: 'hover:bg-indigo-50',
      arrowColor: 'text-indigo-400',
      arrowHover: 'group-hover:text-indigo-600',
      titleHover: 'group-hover:text-indigo-700'
    }
  };
  
  const palette = colors[colorClass] || colors.indigo;

  return (
    <Link href={href} className={`group p-6 bg-white/95 rounded-2xl transition-all border border-gray-100 shadow-sm hover:shadow-md ${palette.borderHover} ${palette.bgHover}`}>
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${palette.bgIcon} ${palette.textIcon}`}>
          <Icon size={20} />
        </div>
        <ChevronRight size={16} className={`transition-transform group-hover:translate-x-1 ${palette.arrowColor} ${palette.arrowHover}`} />
      </div>
      <h4 className={`font-extrabold text-gray-900 font-oswald uppercase ${palette.titleHover}`}>{title}</h4>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </Link>
  );
}