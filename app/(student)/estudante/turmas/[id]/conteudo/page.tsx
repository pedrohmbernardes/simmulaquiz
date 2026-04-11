'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Loader2, BookOpen, Layers, 
  FolderOpen, AlertCircle, RefreshCw
} from 'lucide-react';

import { useSecureFetch } from '@/lib/hooks/useSecureFetch';
import { useCsrf } from '@/lib/hooks/use-csrf'; // ✅ NOVO: Importando a blindagem CSRF
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
  
  // ✅ NOVO: Pré-carrega o token CSRF ao montar a página, 
  // ativando a proteção híbrida e satisfazendo a auditoria.
  useCsrf(); 

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

  const totalModulos = modulos.length;
  const totalItens   = modulos.reduce((acc, m) => acc + m.itens.length, 0);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 lg:p-10 space-y-5 md:space-y-8 animate-in fade-in duration-700">

        {/* ── Hero Header ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-5 md:p-10 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-1/4 w-48 md:w-96 h-48 md:h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-36 md:w-72 h-36 md:h-72 bg-purple-300 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 space-y-3 md:space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/estudante/turmas/${turmaId}`)}
              className="hidden md:inline-flex text-white hover:bg-white/20 -ml-2"
            >
              <ArrowLeft size={18} className="mr-2" />
              Voltar para Turma
            </Button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6">
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="p-2 md:p-2.5 bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl shadow-lg">
                    <Layers className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 text-[10px] md:text-xs">
                    Trilha de Aprendizagem
                  </Badge>
                </div>
                <div>
                  <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white">
                    Conteúdo & Módulos
                  </h1>
                  <p className="text-blue-100 text-sm md:text-lg mt-1 md:mt-2">
                    Acesse seus materiais, tarefas e avaliações organizados por módulo
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2.5 md:gap-4 mt-4 md:mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
                <p className="text-blue-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Módulos</p>
                <p className="text-white text-xl md:text-2xl font-bold">
                  {loading ? <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" /> : totalModulos}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
                <p className="text-blue-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Total de Itens</p>
                <p className="text-white text-xl md:text-2xl font-bold">
                  {loading ? <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" /> : totalItens}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20">
                <p className="text-blue-100 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Status</p>
                <p className="text-white text-xl md:text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" />
                  ) : error ? (
                    <span className="text-red-300 text-xs md:text-sm font-semibold">Erro</span>
                  ) : (
                    <span className="text-emerald-300 text-xs md:text-sm font-semibold">Ok</span>
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
            <div className="h-1 md:h-1.5 bg-gradient-to-r from-red-500 to-rose-500" />
            <CardContent className="py-10 md:py-12">
              <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 md:space-y-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-rose-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                  <div className="relative p-4 md:p-5 bg-gradient-to-br from-red-100 to-rose-100 rounded-2xl md:rounded-3xl">
                    <AlertCircle className="h-10 w-10 md:h-12 md:w-12 text-red-600" />
                  </div>
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <h3 className="text-lg md:text-xl font-bold text-slate-900">Erro ao carregar</h3>
                  <p className="text-slate-600 text-xs md:text-sm leading-relaxed">{error}</p>
                </div>
                <Button
                  onClick={fetchConteudo}
                  size="sm"
                  className="gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg text-xs md:text-sm"
                >
                  <RefreshCw size={14} />
                  Tentar novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado de Loading */}
        {loading && !error && (
          <div className="space-y-3 md:space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
                <div className="h-1 md:h-1.5 bg-gradient-to-r from-slate-200 to-slate-300 animate-pulse" />
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 md:h-10 md:w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 md:h-4 w-1/3" />
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
            <div className="h-1 md:h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <CardContent className="py-14 md:py-20">
              <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 md:space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                  <div className="relative p-5 md:p-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl md:rounded-3xl">
                    <FolderOpen className="h-12 w-12 md:h-16 md:w-16 text-blue-600" />
                  </div>
                </div>
                <div className="space-y-2 md:space-y-3">
                  <h3 className="text-xl md:text-2xl font-bold text-slate-900">
                    Nenhum conteúdo disponível
                  </h3>
                  <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                    O professor ainda não publicou módulos para esta turma. Volte em breve!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Lista de Módulos ────────────────────────────────── */}
        {!loading && !error && modulos.length > 0 && (
          <section className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="p-1.5 md:p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg md:rounded-xl shadow-lg">
                <BookOpen className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base md:text-xl font-bold text-slate-900">Trilha de Módulos</h2>
                <p className="text-xs md:text-sm text-slate-500">
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