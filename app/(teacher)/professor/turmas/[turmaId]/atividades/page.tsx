import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  FileText, 
  BookOpen, 
  Upload, 
  MoreVertical, 
  Calendar, 
  Clock,
  BarChart2,
  Eye,
  Pencil
} from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PageProps {
  params: Promise<{ turmaId: string }>;
}

export default async function ProfessorAtividadesPage({ params }: PageProps) {
  const { turmaId } = await params;
  const session = await getSession();

  if (!session || session.role !== 'PROFESSOR') {
    redirect('/login');
  }

  const turmaIdInt = parseInt(turmaId);
  if (isNaN(turmaIdInt)) redirect('/professor/turmas');

  // 1. Busca dados da turma e seus conteúdos
  const turma = await prisma.turma.findUnique({
    where: { 
      id: turmaIdInt,
      // Garante que o professor é dono
      professores: { some: { professorId: parseInt(session.sub) } }
    },
    include: {
      agendamentos: {
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { entregas: true } }
        }
      },
      materiais: {
        orderBy: { createdAt: 'desc' }
      },
      tarefas: {
        orderBy: { createdAt: 'desc' }
      },
      _count: { select: { alunos: true } }
    }
  });

  if (!turma) {
    redirect('/professor/turmas');
  }

  const totalAlunos = turma._count.alunos;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Atividades e Conteúdos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie simulados, materiais de estudo e tarefas da turma <strong>{turma.nome}</strong>.
          </p>
        </div>

        {/* Botão Criar (Dropdown) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2 shadow-lg">
              <Plus className="h-4 w-4" /> Criar Novo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Selecione o tipo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              {/* Futura rota de criação */}
              <Link href={`/professor/turmas/${turmaId}/agendamentos/novo`} className="cursor-pointer">
                <FileText className="mr-2 h-4 w-4 text-blue-600" />
                Agendamento de Simulado
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/professor/turmas/${turmaId}/materiais/novo`} className="cursor-pointer">
                <BookOpen className="mr-2 h-4 w-4 text-green-600" />
                Material de Estudo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/professor/turmas/${turmaId}/tarefas/novo`} className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4 text-orange-600" />
                Tarefa para Entrega
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Conteúdo em Abas */}
      <Tabs defaultValue="simulados" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="simulados">Simulados</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
        </TabsList>

        {/* ABA: SIMULADOS */}
        <TabsContent value="simulados" className="mt-6 space-y-4">
          {turma.agendamentos.length === 0 ? (
            <EmptyState 
              tipo="Simulado" 
              msg="Crie avaliações com questões fixas para toda a turma." 
            />
          ) : (
            turma.agendamentos.map((ag) => (
              <Card key={ag.id} className="group hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      {ag.titulo}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(ag.dataInicio, "dd/MM", { locale: ptBR })} até {format(ag.dataFim, "dd/MM", { locale: ptBR })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {ag.duracaoMinutos} min
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ag.status === 'PUBLICADO' ? 'default' : 'secondary'}>
                      {ag.status}
                    </Badge>
                    
                    {/* Menu de Ações do Item */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/professor/turmas/${turmaId}/agendamentos/${ag.id}`}>
                            <BarChart2 className="mr-2 h-4 w-4" /> Ver Resultados
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/professor/turmas/${turmaId}/agendamentos/${ag.id}/editar`}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">{ag._count.entregas}</span> de {totalAlunos} alunos entregaram
                    </div>
                    <Button variant="outline" size="sm" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/professor/turmas/${turmaId}/agendamentos/${ag.id}`}>
                        Gerenciar <Eye className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                  {/* Barra de progresso visual simples */}
                  <div className="h-1.5 w-full bg-secondary mt-3 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all" 
                      style={{ width: `${totalAlunos > 0 ? (ag._count.entregas / totalAlunos) * 100 : 0}%` }} 
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ABA: MATERIAIS */}
        <TabsContent value="materiais" className="mt-6 space-y-4">
          {turma.materiais.length === 0 ? (
            <EmptyState 
              tipo="Material" 
              msg="Compartilhe PDFs, links ou vídeos com seus alunos." 
            />
          ) : (
            turma.materiais.map((mat) => (
              <Card key={mat.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4 text-green-600" />
                    {mat.titulo}
                  </CardTitle>
                  <CardDescription>
                    Adicionado em {format(mat.createdAt, "dd 'de' MMMM", { locale: ptBR })}
                  </CardDescription>
                </CardHeader>
                {/* Futuro: Ações de material */}
              </Card>
            ))
          )}
        </TabsContent>

        {/* ABA: TAREFAS */}
        <TabsContent value="tarefas" className="mt-6 space-y-4">
          {turma.tarefas.length === 0 ? (
             <EmptyState 
               tipo="Tarefa" 
               msg="Crie atividades para upload de arquivos ou respostas de texto." 
             />
          ) : (
            turma.tarefas.map((tar) => (
              <Card key={tar.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-orange-600" />
                    {tar.titulo}
                  </CardTitle>
                  <CardDescription>
                    Entrega até {tar.dataEntrega ? format(tar.dataEntrega, "dd/MM/yyyy", { locale: ptBR }) : 'Sem prazo'}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ tipo, msg }: { tipo: string, msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Plus className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Nenhum {tipo}</h3>
      <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm">
        {msg}
      </p>
    </div>
  );
}