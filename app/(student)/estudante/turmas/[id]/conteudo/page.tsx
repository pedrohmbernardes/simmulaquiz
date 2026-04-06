'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Loader2, BookOpen, Layers, 
  FolderOpen, AlertCircle, RefreshCw
} from 'lucide-react';

import { useSecureFetch } from '@/lib/hooks/useSecureFetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { StudentModuleList, TrilhaModulo } from '@/components/classroom/StudentModuleList';
import { StudentMaterialViewer } from '@/components/classroom/StudentMaterialViewer';

export default function ConteudoTurmaPage() {
  const params  = useParams();
  const router  = useRouter();
  const secureFetch = useSecureFetch();

  const turmaId = params.id as string;

  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [modulos, setModulos]               = useState<TrilhaModulo[]>([]);
  const [viewerOpen, setViewerOpen]         = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);

  const fetchConteudo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await secureFetch(`/api/estudante/turmas/${turmaId}/conteudo`);

      if (!res.ok) {
        if (res.status === 403) throw new Error('Você não tem permissão para acessar o conteúdo desta turma.');
        if (res.status === 404) throw new Error('Turma não encontrada.');
        throw new Error('Falha ao carregar conteúdo.');
      }

      const data = await res.json();
      setModulos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [secureFetch, turmaId]);

  useEffect(() => {
    if (turmaId) fetchConteudo();
  }, [turmaId, fetchConteudo]);

  const handleViewMaterial = (material: any) => {
    setSelectedMaterial(material);
    setViewerOpen(true);
  };

  // Estatísticas derivadas dos dados carregados
  const totalModulos = modulos.length;
  const totalItens   = modulos.reduce((acc, m) => acc + m.itens.length, 0);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700">

        {/* ── Hero Header ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 md:p-10 shadow-2xl">
          {/* Background blur decorativo */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-purple-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-4">
            <Button
              variant="ghost"
              onClick={() => router.push(`/estudante/turmas/${turmaId}`)}
              className="text-white hover:bg-white/20 -ml-2"
            >
              <ArrowLeft size={18} className="mr-2" />
              Voltar para Turma
            </Button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <Layers className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    Trilha de Aprendizagem
                  </Badge>
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                    Conteúdo & Módulos
                  </h1>
                  <p className="text-blue-100 text-base md:text-lg mt-2">
                    Acesse seus materiais, tarefas e avaliações organizados por módulo
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats — só exibe após carregar */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-blue-100 text-xs font-medium mb-1">Módulos</p>
                <p className="text-white text-2xl font-bold">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalModulos}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-blue-100 text-xs font-medium mb-1">Total de Itens</p>
                <p className="text-white text-2xl font-bold">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalItens}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <p className="text-blue-100 text-xs font-medium mb-1">Status</p>
                <p className="text-white text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : error ? (
                    <span className="text-red-300 text-sm font-semibold">Erro</span>
                  ) : (
                    <span className="text-emerald-300 text-sm font-semibold">Ok</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Área de Conteúdo ────────────────────────────────── */}

        {/* Estado de Erro */}
        {error && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-red-500 to-rose-500" />
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-rose-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                  <div className="relative p-5 bg-gradient-to-br from-red-100 to-rose-100 rounded-3xl">
                    <AlertCircle className="h-12 w-12 text-red-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Erro ao carregar</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{error}</p>
                </div>
                <Button
                  onClick={fetchConteudo}
                  className="gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg"
                >
                  <RefreshCw size={16} />
                  Tentar novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado de Loading */}
        {loading && !error && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-slate-200 to-slate-300 animate-pulse" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Estado Vazio */}
        {!loading && !error && modulos.length === 0 && (
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <CardContent className="py-20">
              <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                  <div className="relative p-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl">
                    <FolderOpen className="h-16 w-16 text-blue-600" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-slate-900">
                    Nenhum conteúdo disponível
                  </h3>
                  <p className="text-slate-600 text-base leading-relaxed">
                    O professor ainda não publicou módulos para esta turma. Volte em breve!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Lista de Módulos ────────────────────────────────── */}
        {!loading && !error && modulos.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Trilha de Módulos</h2>
                <p className="text-sm text-slate-500">
                  {totalModulos} módulo{totalModulos !== 1 ? 's' : ''} com {totalItens} item{totalItens !== 1 ? 'ns' : ''}
                </p>
              </div>
            </div>

            <StudentModuleList
              turmaId={turmaId}
              modulos={modulos}
              onViewMaterial={handleViewMaterial}
            />
          </section>
        )}
      </div>

      {/* Modal de Visualização de Material */}
      <StudentMaterialViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        material={selectedMaterial}
      />
    </div>
  );
}
