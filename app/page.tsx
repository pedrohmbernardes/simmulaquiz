import Link from 'next/link';
import { 
  Target, 
  BrainCircuit, 
  Trophy, 
  ArrowRight, 
  CheckCircle2, 
  Layers,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Zap,
  Award,
  BarChart3
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-white via-blue-50/30 to-white">
      
      {/* === NAVBAR === */}
      <header className="fixed w-full bg-white/90 backdrop-blur-xl border-b border-gray-200/50 z-50 shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-700 to-blue-800 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200/50 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <GraduationCap size={22} className="relative z-10" />
            </div>
            <span className="font-oswald font-bold text-2xl text-gray-900 tracking-tight">
              Simmula<span className="text-blue-700">Quiz</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-roboto font-bold text-gray-700 hover:text-blue-700 transition-colors hidden sm:block"
            >
              Entrar
            </Link>
            <Link 
              href="/registrar" 
              className="bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white text-sm font-roboto font-bold px-6 py-2.5 rounded-full transition-all hover:shadow-xl shadow-blue-300/50 hover:scale-105"
            >
              Criar Conta Grátis
            </Link>
          </div>
        </div>
      </header>

      {/* === HERO SECTION === */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="container mx-auto text-center relative z-10 max-w-5xl">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-400 to-green-500 text-blue-900 px-5 py-2 rounded-full text-xs font-roboto font-black uppercase tracking-wide mb-8 shadow-lg shadow-green-200/50 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Sparkles size={14} /> Análise de Desempenho por IA • Sistema de Gamificação
          </div>
          
          <h1 className="font-oswald text-5xl md:text-7xl font-black text-gray-900 mb-8 leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-1000">
            Treine para o <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900">SAEP</span> com<br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-500">Inteligência Artificial</span>
          </h1>
          
          <p className="font-lato text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Simulados personalizados com IA, análise de desempenho em tempo real e gamificação completa. 
            <strong className="text-gray-900"> Você no controle do seu aprendizado.</strong>
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 mb-16">
            <Link 
              href="/registrar" 
              className="w-full sm:w-auto bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white px-10 py-5 rounded-2xl font-roboto font-bold text-lg shadow-2xl shadow-blue-300/50 transition-all hover:scale-105 hover:-translate-y-1 flex items-center justify-center gap-3 group"
            >
              Começar Agora 
              <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              href="/login" 
              className="w-full sm:w-auto bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-800 px-10 py-5 rounded-2xl font-roboto font-bold text-lg transition-all hover:border-gray-300 hover:shadow-lg"
            >
              Já tenho conta
            </Link>
          </div>

          {/* Stats rápidos */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="text-center">
              <div className="text-3xl font-oswald font-bold text-blue-800 mb-1">5.000+</div>
              <div className="text-sm font-lato text-gray-600">Questões</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-oswald font-bold text-green-500 mb-1">IA</div>
              <div className="text-sm font-lato text-gray-600">Análise Inteligente</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-oswald font-bold text-blue-800 mb-1">100%</div>
              <div className="text-sm font-lato text-gray-600">Personalizável</div>
            </div>
          </div>
        </div>

        {/* Background Decorativo Melhorado */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl -z-10 opacity-50 pointer-events-none">
            <div className="absolute top-20 left-10 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
            <div className="absolute top-20 right-10 w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* === DIFERENCIAIS === */}
      <section className="py-24 bg-white border-y border-gray-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-xs font-roboto font-bold uppercase tracking-wide mb-4">
              <Zap size={14} /> Por que escolher o SimmulaQuiz?
            </div>
            <h2 className="font-oswald text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Muito além de questões aleatórias
            </h2>
            <p className="font-lato text-gray-600 max-w-2xl mx-auto text-lg">
              Nossa plataforma usa tecnologia de ponta para transformar sua preparação em resultados concretos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 - Personalização */}
            <div className="bg-gradient-to-br from-blue-50 to-white p-8 rounded-3xl border-2 border-blue-100 hover:border-blue-300 transition-all hover:shadow-xl hover:-translate-y-2 group">
              <div className="bg-gradient-to-br from-blue-700 to-blue-800 w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-blue-200/50 group-hover:scale-110 transition-transform">
                <Target size={26} />
              </div>
              <h3 className="font-oswald text-xl font-bold text-gray-900 mb-3">Personalização Total</h3>
              <p className="font-lato text-gray-600 text-sm leading-relaxed">
                Escolha as Unidades Curriculares, dificuldade e nível cognitivo (Bloom) para criar o simulado perfeito.
              </p>
            </div>

            {/* Card 2 - IA */}
            <div className="bg-gradient-to-br from-green-50 to-white p-8 rounded-3xl border-2 border-green-100 hover:border-green-300 transition-all hover:shadow-xl hover:-translate-y-2 group">
              <div className="bg-gradient-to-br from-green-400 to-green-500 w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-green-200/50 group-hover:scale-110 transition-transform">
                <BrainCircuit size={26} />
              </div>
              <h3 className="font-oswald text-xl font-bold text-gray-900 mb-3">Análise com IA</h3>
              <p className="font-lato text-gray-600 text-sm leading-relaxed">
                Inteligência artificial identifica seus pontos fracos e sugere estudos direcionados para máxima eficiência.
              </p>
            </div>

            {/* Card 3 - Métricas */}
            <div className="bg-gradient-to-br from-purple-50 to-white p-8 rounded-3xl border-2 border-purple-100 hover:border-purple-300 transition-all hover:shadow-xl hover:-translate-y-2 group">
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-purple-200/50 group-hover:scale-110 transition-transform">
                <TrendingUp size={26} />
              </div>
              <h3 className="font-oswald text-xl font-bold text-gray-900 mb-3">Métricas Detalhadas</h3>
              <p className="font-lato text-gray-600 text-sm leading-relaxed">
                Acompanhe sua evolução com gráficos e relatórios que mostram seu progresso em cada matéria.
              </p>
            </div>

            {/* Card 4 - Gamificação */}
            <div className="bg-gradient-to-br from-orange-50 to-white p-8 rounded-3xl border-2 border-orange-100 hover:border-orange-300 transition-all hover:shadow-xl hover:-translate-y-2 group">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-orange-200/50 group-hover:scale-110 transition-transform">
                <Trophy size={26} />
              </div>
              <h3 className="font-oswald text-xl font-bold text-gray-900 mb-3">Gamificação Completa</h3>
              <p className="font-lato text-gray-600 text-sm leading-relaxed">
                Ganhe pontos, conquistas, títulos e mantenha sua streak de estudos. Aprender pode ser divertido!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === COMO FUNCIONA === */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="font-oswald text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Como funciona?
            </h2>
            <p className="font-lato text-gray-600 max-w-2xl mx-auto text-lg">
              Três passos simples para começar a treinar de forma inteligente
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Passo 1 */}
            <div className="relative">
              <div className="bg-white p-10 rounded-3xl shadow-lg border border-gray-100 hover:shadow-2xl transition-all hover:-translate-y-2">
                <div className="absolute -top-4 -left-4 bg-gradient-to-br from-blue-700 to-blue-800 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-oswald font-bold text-2xl shadow-lg">
                  1
                </div>
                <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center text-blue-700 mb-6 mx-auto">
                  <Target size={32} />
                </div>
                <h3 className="font-oswald text-2xl font-bold text-gray-900 mb-4 text-center">Personalize</h3>
                <p className="font-lato text-gray-600 text-center leading-relaxed">
                  Escolha as Unidades Curriculares, número de questões e nível de dificuldade ideal para você.
                </p>
              </div>
            </div>

            {/* Passo 2 */}
            <div className="relative">
              <div className="bg-white p-10 rounded-3xl shadow-lg border border-gray-100 hover:shadow-2xl transition-all hover:-translate-y-2">
                <div className="absolute -top-4 -left-4 bg-gradient-to-br from-green-400 to-green-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-oswald font-bold text-2xl shadow-lg">
                  2
                </div>
                <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center text-green-600 mb-6 mx-auto">
                  <BrainCircuit size={32} />
                </div>
                <h3 className="font-oswald text-2xl font-bold text-gray-900 mb-4 text-center">Treine</h3>
                <p className="font-lato text-gray-600 text-center leading-relaxed">
                  Resolva as questões do seu simulado e receba feedback instantâneo com explicações detalhadas.
                </p>
              </div>
            </div>

            {/* Passo 3 */}
            <div className="relative">
              <div className="bg-white p-10 rounded-3xl shadow-lg border border-gray-100 hover:shadow-2xl transition-all hover:-translate-y-2">
                <div className="absolute -top-4 -left-4 bg-gradient-to-br from-purple-600 to-purple-700 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-oswald font-bold text-2xl shadow-lg">
                  3
                </div>
                <div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center text-purple-600 mb-6 mx-auto">
                  <BarChart3 size={32} />
                </div>
                <h3 className="font-oswald text-2xl font-bold text-gray-900 mb-4 text-center">Evolua</h3>
                <p className="font-lato text-gray-600 text-center leading-relaxed">
                  Acompanhe suas métricas, veja seu progresso e receba insights da IA para melhorar continuamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === RECURSOS PREMIUM === */}
      <section className="py-24 px-6 bg-white">
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-6xl">
          
          {/* Coluna Esquerda - Features */}
          <div className="space-y-10">
            <div>
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-xs font-roboto font-bold uppercase tracking-wide mb-6">
                <Award size={14} /> Recursos Premium
              </div>
              <h2 className="font-oswald text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Tudo que você precisa em um só lugar
              </h2>
            </div>
            
            <div className="space-y-6">
              <div className="flex gap-5 items-start group">
                <div className="mt-1 bg-green-100 p-3 rounded-2xl group-hover:bg-green-500 transition-colors">
                  <CheckCircle2 className="text-green-600 group-hover:text-white transition-colors" size={24} />
                </div>
                <div>
                  <h4 className="font-roboto font-bold text-gray-900 text-lg mb-2">Banco Validado de Questões</h4>
                  <p className="font-lato text-gray-600 leading-relaxed">
                    Mais de 5.000 questões organizadas por professores e alinhadas com a matriz do SAEP e SENAI.
                  </p>
                </div>
              </div>

              <div className="flex gap-5 items-start group">
                <div className="mt-1 bg-blue-100 p-3 rounded-2xl group-hover:bg-blue-700 transition-colors">
                  <CheckCircle2 className="text-blue-700 group-hover:text-white transition-colors" size={24} />
                </div>
                <div>
                  <h4 className="font-roboto font-bold text-gray-900 text-lg mb-2">Caderno de Erros Inteligente</h4>
                  <p className="font-lato text-gray-600 leading-relaxed">
                    Salve questões difíceis automaticamente e a IA cria simulados focados nas suas dificuldades.
                  </p>
                </div>
              </div>

              <div className="flex gap-5 items-start group">
                <div className="mt-1 bg-purple-100 p-3 rounded-2xl group-hover:bg-purple-600 transition-colors">
                  <CheckCircle2 className="text-purple-600 group-hover:text-white transition-colors" size={24} />
                </div>
                <div>
                  <h4 className="font-roboto font-bold text-gray-900 text-lg mb-2">Relatórios de Performance</h4>
                  <p className="font-lato text-gray-600 leading-relaxed">
                    Gráficos detalhados mostram sua evolução, tempo médio e taxa de acerto por matéria.
                  </p>
                </div>
              </div>

              <div className="flex gap-5 items-start group">
                <div className="mt-1 bg-orange-100 p-3 rounded-2xl group-hover:bg-orange-500 transition-colors">
                  <CheckCircle2 className="text-orange-500 group-hover:text-white transition-colors" size={24} />
                </div>
                <div>
                  <h4 className="font-roboto font-bold text-gray-900 text-lg mb-2">Sistema de Conquistas</h4>
                  <p className="font-lato text-gray-600 leading-relaxed">
                    Desbloqueie badges, suba de nível e mantenha sua streak de estudos para ficar motivado.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Direita - Mockup Visual */}
          <div className="relative">
            <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-blue-900 rounded-3xl p-8 shadow-2xl transform hover:scale-105 transition-transform duration-500">
              
              {/* Header do Card */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-roboto font-bold text-white text-sm">Simulado Personalizado</span>
                  <span className="bg-green-400 text-blue-900 px-3 py-1 rounded-full text-xs font-bold">IA Ativa</span>
                </div>
                <div className="flex gap-2">
                  <span className="bg-white/20 text-white text-xs px-2 py-1 rounded">Automação</span>
                  <span className="bg-white/20 text-white text-xs px-2 py-1 rounded">Eletrônica</span>
                  <span className="bg-white/20 text-white text-xs px-2 py-1 rounded">Média</span>
                </div>
              </div>

              {/* Questão Mockup */}
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">UC-AUT-15</span>
                  <span className="text-xs text-gray-500 font-lato">⚡ Aplicar • Bloom Nível 3</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full w-full mb-2"></div>
                <div className="h-3 bg-gray-100 rounded-full w-5/6 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded-full w-4/6 mb-6"></div>
                
                <div className="space-y-3">
                  <div className="h-12 border-2 border-gray-200 rounded-xl flex items-center px-4 text-sm text-gray-400 font-lato hover:border-gray-300 transition-colors cursor-pointer">
                    A) Alternativa exemplo
                  </div>
                  <div className="h-12 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-400 rounded-xl flex items-center px-4 text-sm font-bold text-green-700 justify-between shadow-sm">
                    <span className="font-lato">B) Resposta correta ✓</span>
                    <Sparkles size={16} className="text-green-500" />
                  </div>
                  <div className="h-12 border-2 border-gray-200 rounded-xl flex items-center px-4 text-sm text-gray-400 font-lato hover:border-gray-300 transition-colors cursor-pointer">
                    C) Alternativa exemplo
                  </div>
                </div>
              </div>

              {/* Stats rápidos */}
              <div className="grid grid-cols-3 gap-3 mt-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
                  <div className="text-green-400 font-oswald font-bold text-lg">85%</div>
                  <div className="text-white/70 text-xs font-lato">Acerto</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
                  <div className="text-green-400 font-oswald font-bold text-lg">12</div>
                  <div className="text-white/70 text-xs font-lato">Dias Streak</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
                  <div className="text-green-400 font-oswald font-bold text-lg">Nível 7</div>
                  <div className="text-white/70 text-xs font-lato">Ranking</div>
                </div>
              </div>
            </div>

            {/* Elementos flutuantes decorativos */}
            <div className="absolute -top-6 -right-6 bg-green-400 w-20 h-20 rounded-2xl opacity-80 animate-bounce"></div>
            <div className="absolute -bottom-6 -left-6 bg-blue-500 w-16 h-16 rounded-2xl opacity-80 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* === CTA FINAL === */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-700 via-blue-800 to-blue-900 relative overflow-hidden">
        <div className="container mx-auto text-center relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-green-400 text-blue-900 px-5 py-2 rounded-full text-xs font-roboto font-black uppercase tracking-wide mb-8">
            <Trophy size={14} /> Comece grátis hoje
          </div>
          
          <h2 className="font-oswald text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            Pronto para dominar suas provas técnicas?
          </h2>
          
          <p className="font-lato text-xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            Junte-se a nós! Seja um estudante que treine de forma inteligente com o SimmulaQuiz.
          </p>
          
          <Link 
            href="/registrar" 
            className="inline-flex items-center gap-3 bg-green-400 hover:bg-green-500 text-blue-900 px-12 py-6 rounded-2xl font-roboto font-black text-xl shadow-2xl transition-all hover:scale-105 hover:-translate-y-1 group"
          >
            Criar Conta Gratuita
            <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
          </Link>

          {/* <p className="font-lato text-blue-200 text-sm mt-6">
            ✨ Sem cartão de crédito • Acesso imediato • Cancele quando quiser
          </p> */}
        </div>

        {/* Background decorativo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-green-400 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400 rounded-full filter blur-3xl"></div>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-700 to-blue-800 rounded-2xl flex items-center justify-center text-white">
                  <GraduationCap size={22} />
                </div>
                <span className="font-oswald font-bold text-white text-xl tracking-tight">
                  Simmula<span className="text-green-400">Quiz</span>
                </span>
              </div>
              <p className="font-lato text-sm text-gray-500 max-w-md">
                Plataforma de simulados técnicos com IA, gamificação e análise de desempenho para estudantes técnicos.
              </p>
            </div>

            <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-lato text-sm text-gray-500">
              &copy; {new Date().getFullYear()} SimmulaQuiz. Todos os direitos reservados.
            </p>
            </div>
            {/*<div className="flex gap-12">
              <div>
                <h4 className="font-roboto font-bold text-white text-sm mb-4">Produto</h4>
                <ul className="space-y-2 font-lato text-sm">
                  <li><Link href="#" className="hover:text-green-400 transition-colors">Funcionalidades</Link></li>
                  <li><Link href="#" className="hover:text-green-400 transition-colors">Preços</Link></li>
                  <li><Link href="#" className="hover:text-green-400 transition-colors">FAQ</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-roboto font-bold text-white text-sm mb-4">Empresa</h4>
                <ul className="space-y-2 font-lato text-sm">
                  <li><Link href="#" className="hover:text-green-400 transition-colors">Sobre</Link></li>
                  <li><Link href="#" className="hover:text-green-400 transition-colors">Contato</Link></li>
                  <li><Link href="#" className="hover:text-green-400 transition-colors">Blog</Link></li>
                </ul>
              </div>
            </div>*/}
          </div>

          {/*<div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-lato text-sm text-gray-500">
              &copy; {new Date().getFullYear()} SimmulaQuiz. Todos os direitos reservados.
            </p>
            {/*<div className="flex gap-6 font-lato text-sm">
              <Link href="#" className="hover:text-green-400 transition-colors">Privacidade</Link>
              <Link href="#" className="hover:text-green-400 transition-colors">Termos</Link>
              <Link href="#" className="hover:text-green-400 transition-colors">Cookies</Link>
            </div>
          </div>*/}
        </div>
      </footer>

    </div>
  );
}
