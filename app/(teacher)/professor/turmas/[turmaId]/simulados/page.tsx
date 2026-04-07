import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  PenTool, Calendar, CheckCircle2, FileText, 
  Plus, TrendingUp, Sparkles, ArrowRight
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SimuladoCard } from "./SimuladoCard"; // Importando o novo componente

interface PageProps {
  params: Promise<{ turmaId: string }>;
}

export default async function SimuladosPage({ params }: PageProps) {
  const { turmaId } = await params;
  const session = await getSession();

  // 1. Segurança e Sessão Flexível (Permite Professor e Super Admin)
  if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }
  
  const turmaIdInt = parseInt(turmaId);
  if (isNaN(turmaIdInt)) redirect("/professor/dashboard");

  const isSuperAdmin = session.role === "SUPER_ADMIN";

  // 2. Validação de Propriedade (Query Dinâmica)
  // Super Admin ignora a verificação na tabela pivot (TurmaProfessor)
  let temAcesso = isSuperAdmin;

  if (!isSuperAdmin) {
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: parseInt(session.sub)
        }
      }
    });
    temAcesso = !!isOwner;
  }

  if (!temAcesso) redirect("/professor/dashboard");

  // 3. Busca Agendamentos
  const agendamentos = await prisma.agendamentoSimulado.findMany({
    where: { turmaId: turmaIdInt },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { entregas: true }
      },
      entregas: {
        where: {
          status: { not: "PENDENTE" }
        },
        take: 1,
        select: { id: true }
      }
    }
  });

  // 4. Cálculo das Estatísticas
  const now = new Date();
  
  const agendados = agendamentos.filter(a => {
    const dataInicio = new Date(a.dataInicio);
    return now < dataInicio && a.status !== 'CANCELADO';
  }).length;
  
  const emAndamento = agendamentos.filter(a => {
    const dataInicio = new Date(a.dataInicio);
    const dataFim = new Date(a.dataFim);
    return now >= dataInicio && now <= dataFim && a.status !== 'CANCELADO' && a.status !== 'ENCERRADO';
  }).length;
  
  const encerrados = agendamentos.filter(a => {
    const dataFim = new Date(a.dataFim);
    return now > dataFim || a.status === 'ENCERRADO' || a.status === 'CANCELADO';
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="space-y-8 animate-in fade-in duration-700 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">
        
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-300 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <PenTool className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    Avaliações
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                  Simulados e Provas
                </h1>
                <p className="text-indigo-100 text-base md:text-lg max-w-2xl">
                  Gerencie avaliações, acompanhe o progresso e analise o desempenho da turma
                </p>
              </div>
              
              <Button 
                asChild 
                size="lg"
                className="gap-2 bg-white text-indigo-700 hover:bg-indigo-50 shadow-xl hover:shadow-2xl transition-all font-semibold px-6 py-6 text-base"
              >
                <Link href={`/professor/turmas/${turmaId}/simulados/novo`}>
                  <Plus size={20} /> Agendar Novo Simulado
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            icon={Calendar}
            label="Agendados"
            value={agendados}
            gradient="from-blue-500 to-cyan-500"
            description="Ainda não iniciados"
          />
          <StatsCard
            icon={TrendingUp}
            label="Em Andamento"
            value={emAndamento}
            gradient="from-emerald-500 to-teal-500"
            description="Acontecendo agora"
            highlight={emAndamento > 0}
          />
          <StatsCard
            icon={CheckCircle2}
            label="Finalizados"
            value={encerrados}
            gradient="from-purple-500 to-pink-500"
            description="Encerrados ou cancelados"
          />
        </div>

        {/* Lista de Simulados */}
        <div className="space-y-4">
          {agendamentos.length === 0 ? (
            <EmptyState turmaId={turmaId} />
          ) : (
            agendamentos.map((agendamento, index) => {
              const hasStarted = agendamento.entregas.length > 0;
              const isClosed = new Date() > new Date(agendamento.dataFim) || agendamento.status === 'ENCERRADO' || agendamento.status === 'CANCELADO';
              const isActive = now >= new Date(agendamento.dataInicio) && now <= new Date(agendamento.dataFim) && agendamento.status !== 'ENCERRADO' && agendamento.status !== 'CANCELADO';
              const isScheduled = now < new Date(agendamento.dataInicio) && agendamento.status !== 'ENCERRADO' && agendamento.status !== 'CANCELADO';
              
              return (
                <SimuladoCard
                  key={agendamento.id}
                  agendamento={agendamento}
                  hasStarted={hasStarted}
                  isClosed={isClosed}
                  isActive={isActive}
                  isScheduled={isScheduled}
                  turmaId={turmaIdInt}
                  index={index}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Stats Card Component (Pode ficar aqui pois é estático)
function StatsCard({ 
  icon: Icon, 
  label, 
  value, 
  gradient, 
  description,
  highlight = false
}: {
  icon: any;
  label: string;
  value: number;
  gradient: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 bg-white/80 backdrop-blur-sm group hover:-translate-y-1">
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br",
        gradient
      )} />
      
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "p-3 rounded-2xl shadow-lg bg-gradient-to-br transform group-hover:scale-110 transition-transform duration-500",
            gradient
          )}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {highlight && (
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-3xl font-bold text-slate-900 group-hover:scale-105 transition-transform duration-300">
            {value}
          </p>
          <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            {label}
          </p>
          <p className={cn(
            "text-xs font-medium bg-gradient-to-r bg-clip-text text-transparent",
            gradient
          )}>
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Empty State Component
function EmptyState({ turmaId }: { turmaId: string }) {
  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
      <CardContent className="py-20">
        <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse" />
            <div className="relative p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
              <FileText className="h-16 w-16 text-indigo-600" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-2xl font-bold text-slate-900">
              Nenhum simulado agendado
            </h3>
            <p className="text-slate-600 text-base leading-relaxed">
              Comece criando sua primeira avaliação para a turma. 
              Configure datas, duração e acompanhe o desempenho dos alunos.
            </p>
          </div>
          
          <Button 
            asChild 
            size="lg"
            className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all px-8 py-6"
          >
            <Link href={`/professor/turmas/${turmaId}/simulados/novo`}>
              <Sparkles size={20} />
              Criar Primeiro Simulado
              <ArrowRight size={18} />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}