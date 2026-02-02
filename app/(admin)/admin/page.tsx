// app/(admin)/admin/page.tsx
import { prisma } from '@/lib/prisma';
import { Users, BookOpen, Trophy, Activity, ArrowUpRight, Brain, TrendingUp, Award, Clock, Sparkles, CheckCircle, Target } from 'lucide-react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Componente de Card de Estatística Moderno
function StatCard({ title, value, icon: Icon, gradient, trend, subtitle }: any) {
  return (
    <div className="group relative bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
      {/* Gradiente de fundo decorativo */}
      <div className={`absolute top-0 right-0 w-32 h-32 ${gradient} rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>
      
      <div className="relative">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl ${gradient} shadow-lg`}>
            <Icon size={24} className="text-white" />
          </div>
          {trend && (
            <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <TrendingUp size={12} className="mr-1" /> {trend}
            </span>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-4xl font-black text-slate-800 tracking-tight">
            {value}
          </h3>
          <p className="text-sm font-bold text-slate-600">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Card de Ação Rápida
function QuickActionCard({ title, description, href, icon: Icon, color }: any) {
  return (
    <Link 
      href={href}
      className="group relative bg-white p-5 rounded-xl border-2 border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>
      
      <div className="relative flex items-start gap-4">
        <div className={`p-3 rounded-xl ${color} shadow-md group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">
            {title}
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            {description}
          </p>
        </div>
        <ArrowUpRight className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" size={18} />
      </div>
    </Link>
  );
}

export default async function AdminDashboard() {
  const session = await getSession();
  const role = String(session?.role ?? "").toUpperCase();

  if (!session || (role !== "SUPER_ADMIN" && role !== "PROFESSOR")) {
    redirect("/auth/login");
  }

  // Buscando dados reais
  const [totalAlunos, totalQuestoes, totalSimuladosFeitos] = await Promise.all([
    prisma.usuario.count({ where: { tipo: 'ALUNO' } }),
    prisma.questao.count({ where: { ativa: true } }),
    prisma.simulado.count({ where: { status: 'CONCLUIDO' } })
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Cabeçalho com Gradiente */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          {/* Padrão decorativo de fundo */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
          </div>

          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Sparkles className="text-white" size={24} />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                      Bem-vindo de volta!
                    </h1>
                    <p className="text-indigo-100 font-medium">
                      Painel de controle administrativo
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Link 
                  href="/admin/questoes/nova" 
                  className="group inline-flex items-center gap-2 bg-white text-indigo-600 px-5 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  <BookOpen size={18} />
                  <span>Nova Questão</span>
                  <ArrowUpRight size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Link>
                <Link 
                  href="/admin/questoes/ia" 
                  className="group inline-flex items-center gap-2 bg-purple-500 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:scale-105 border-2 border-white/20"
                >
                  <Brain size={18} />
                  <span>Criar com IA</span>
                  <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Grid de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Alunos Cadastrados" 
            value={totalAlunos.toLocaleString()} 
            icon={Users} 
            gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
            trend="+12%"
            subtitle="Total de estudantes ativos" 
          />
          <StatCard 
            title="Banco de Questões" 
            value={totalQuestoes.toLocaleString()} 
            icon={BookOpen} 
            gradient="bg-gradient-to-br from-purple-500 to-pink-500" 
            trend="+8%"
            subtitle="Questões disponíveis"
          />
          <StatCard 
            title="Simulados Concluídos" 
            value={totalSimuladosFeitos.toLocaleString()} 
            icon={Trophy} 
            gradient="bg-gradient-to-br from-amber-500 to-orange-500" 
            trend="+24%"
            subtitle="Provas finalizadas"
          />
          <StatCard 
            title="Taxa de Conclusão" 
            value="87%" 
            icon={Target} 
            gradient="bg-gradient-to-br from-emerald-500 to-green-500" 
            trend="+5%"
            subtitle="Média geral de engajamento"
          />
        </div>

        {/* Seção de Conteúdo em Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Ações Rápidas - 2 colunas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="text-indigo-600" size={22} />
                Ações Rápidas
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QuickActionCard
                title="Gerenciar Questões"
                description="Visualize, edite e organize o banco de questões"
                href="/admin/questoes"
                icon={BookOpen}
                color="bg-gradient-to-br from-purple-500 to-pink-500"
              />
              
              <QuickActionCard
                title="Criar Questão Manual"
                description="Adicione uma nova questão ao sistema"
                href="/admin/questoes/nova"
                icon={Sparkles}
                color="bg-gradient-to-br from-blue-500 to-cyan-500"
              />
              
              <QuickActionCard
                title="Gerar com IA"
                description="Use inteligência artificial para criar questões"
                href="/admin/questoes/ia"
                icon={Brain}
                color="bg-gradient-to-br from-indigo-500 to-purple-500"
              />
              
              {role === 'SUPER_ADMIN' && (
                <QuickActionCard
                  title="Gerenciar Usuários"
                  description="Administre alunos e professores do sistema"
                  href="/admin/usuarios"
                  icon={Users}
                  color="bg-gradient-to-br from-emerald-500 to-green-500"
                />
              )}
            </div>
          </div>

          {/* Atividade Recente - 1 coluna */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Clock className="text-indigo-600" size={20} />
                Atividade Recente
              </h3>
            </div>
            
            <div className="space-y-4">
              {[
                { 
                  icon: CheckCircle, 
                  text: 'Nova questão adicionada', 
                  time: '5 min atrás',
                  color: 'text-green-600 bg-green-50'
                },
                { 
                  icon: Users, 
                  text: '3 novos alunos cadastrados', 
                  time: '1 hora atrás',
                  color: 'text-blue-600 bg-blue-50'
                },
                { 
                  icon: Trophy, 
                  text: '15 simulados finalizados', 
                  time: '2 horas atrás',
                  color: 'text-amber-600 bg-amber-50'
                },
                { 
                  icon: BookOpen, 
                  text: 'Banco atualizado', 
                  time: '3 horas atrás',
                  color: 'text-purple-600 bg-purple-50'
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-xl transition-all cursor-default group">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.color} group-hover:scale-110 transition-transform`}>
                    <item.icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 leading-tight mb-1">
                      {item.text}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full mt-4 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
              Ver todas as atividades →
            </button>
          </div>
        </div>

        {/* Card de Destaque - Call to Action */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 p-8 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-400 rounded-full blur-3xl"></div>
          </div>

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Award className="text-yellow-400" size={28} />
                <h3 className="text-2xl font-bold text-white">
                  Potencialize sua plataforma educacional
                </h3>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Continue criando questões de qualidade e acompanhe o desempenho dos seus alunos em tempo real.
              </p>
            </div>
            
            <Link 
              href="/admin/questoes"
              className="group shrink-0 inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <span>Explorar Questões</span>
              <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
