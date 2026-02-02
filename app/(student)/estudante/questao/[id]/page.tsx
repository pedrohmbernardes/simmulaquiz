import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { 
  ChevronLeft, 
  Hash, 
  BookOpen, 
  Brain, 
  Target, 
  Briefcase, 
  School,
  Calendar,
  FileText
} from "lucide-react";
import { sanitizeString } from '@/lib/sanitize';

interface VisualizarQuestaoPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";

// Helper para formatar Enums (ex: MUITO_DIFICIL -> Muito Difícil)
function formatEnum(text: string | null) {
  if (!text) return "Não informado";
  return text.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

export default async function VisualizarQuestaoPage({ params }: VisualizarQuestaoPageProps) {
  // 1. Segurança
  const session = await getSession();
  if (!session) redirect("/login");

  // 2. Validação ID
  const { id } = await params;
  const questaoId = Number(id);

  if (isNaN(questaoId)) return notFound();

  // 3. Busca Completa (Eager Loading)
  const questao = await prisma.questao.findUnique({
    where: { id: questaoId },
    include: {
      banca: true,
      instituicao: true,
      cursoTecnico: true,
      unidadeCurricular: true,
      funcao: true,
      subfuncao: true,
      conhecimento: true, // Objeto de Conhecimento
      capacidade: true,   // Capacidade Técnica
    }
  });

  if (!questao) return notFound();

  // 4. Tratamento de Dados
  const enunciadoLimpo = sanitizeString(questao.enunciado);
  
  const listaAlternativas = [
    { letra: 'A', texto: questao.alternativaA },
    { letra: 'B', texto: questao.alternativaB },
    { letra: 'C', texto: questao.alternativaC },
    { letra: 'D', texto: questao.alternativaD },
    { letra: 'E', texto: questao.alternativaE },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500 font-sans px-4 md:px-0 pt-6">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
        <Link 
          href="/estudante/favoritos" 
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 font-oswald uppercase">
            Visualizar Questão
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500 font-lato">
            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold">
              <Hash size={12} /> {questao.id}
            </span>
            <span className="hidden sm:inline text-gray-400">•</span>
            <span className="hidden sm:inline font-medium text-gray-700">
              {questao.unidadeCurricular?.nome || "Unidade Curricular Geral"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: A QUESTÃO (2/3 da tela) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            
            {/* Tag de Dificuldade no Topo da Questão */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
              <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide font-oswald border ${
                questao.dificuldade === 'MUITO_FACIL' || questao.dificuldade === 'FACIL' ? 'bg-green-100 text-green-700 border-green-200' :
                questao.dificuldade === 'MEDIO' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                {formatEnum(questao.dificuldade)}
              </span>
              
              {/* Ano no cabeçalho também, para referência rápida */}
              {questao.ano && (
                <span className="text-xs font-bold text-gray-400 font-oswald flex items-center gap-1">
                  <Calendar size={14} /> {questao.ano}
                </span>
              )}
            </div>

            <div className="p-6 md:p-8 space-y-8">
              {/* Enunciado */}
              <div 
                className="prose prose-gray max-w-none font-lato text-gray-800 leading-relaxed text-lg"
                dangerouslySetInnerHTML={{ __html: enunciadoLimpo }}
              />

              {/* Alternativas */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-oswald mb-4 border-b border-gray-100 pb-2">
                  Alternativas
                </h3>
                
                {listaAlternativas.map((alt) => {
                  if (!alt.texto) return null;
                  const textoAlternativa = sanitizeString(alt.texto);

                  return (
                    <div 
                      key={alt.letra}
                      className="group flex gap-4 p-4 rounded-xl border-2 border-transparent bg-gray-50 hover:bg-white hover:border-gray-200 transition-all duration-200"
                    >
                      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 font-bold font-oswald text-sm shadow-sm">
                        {alt.letra}
                      </div>
                      <div 
                        className="text-gray-700 font-lato pt-1"
                        dangerouslySetInnerHTML={{ __html: textoAlternativa }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHES TÉCNICOS (1/3 da tela) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-5 sticky top-6">
            
            {/* SEÇÃO 1: CONTEXTO PEDAGÓGICO */}
            <h3 className="text-sm font-bold text-gray-800 font-oswald uppercase border-b border-gray-100 pb-2 flex items-center gap-2">
              <BookOpen size={16} className="text-blue-600" />
              Contexto Pedagógico
            </h3>

            <div className="space-y-4">
              {/* Curso Técnico */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Curso Técnico</p>
                <p className="text-sm font-medium text-gray-800 font-lato leading-tight">
                  {questao.cursoTecnico?.nome || "Não vinculado"}
                </p>
              </div>

              {/* Unidade Curricular */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Unidade Curricular</p>
                <p className="text-sm font-medium text-gray-800 font-lato leading-tight">
                  {questao.unidadeCurricular?.nome || "Geral"}
                </p>
              </div>

              {/* Taxonomia de Bloom */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                  <Brain size={12} /> Nível Cognitivo (Bloom)
                </p>
                <span className="inline-block px-2 py-1 rounded bg-purple-50 text-purple-700 text-xs font-bold border border-purple-100">
                  {formatEnum(questao.nivelCognitivo)}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-100 my-4"></div>

            {/* SEÇÃO 2: ESPECIFICAÇÕES TÉCNICAS */}
            <h3 className="text-sm font-bold text-gray-800 font-oswald uppercase border-b border-gray-100 pb-2 flex items-center gap-2">
              <Target size={16} className="text-red-500" />
              Especificações
            </h3>

            <div className="space-y-4">
               {/* Função / Subfunção */}
               {(questao.funcao || questao.subfuncao) && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <Briefcase size={12} /> Função & Subfunção
                  </p>
                  <div className="text-sm font-medium text-gray-800 font-lato">
                    <p>{questao.funcao?.nome || "-"}</p>
                    {questao.subfuncao && (
                       <p className="text-gray-500 text-xs mt-0.5">↳ {questao.subfuncao.nome}</p>
                    )}
                  </div>
                </div>
               )}

              {/* Capacidade */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Capacidade Técnica</p>
                <p className="text-sm text-gray-600 font-lato leading-snug">
                  {questao.capacidade?.descricao || "Não especificada"}
                </p>
              </div>

              {/* Objeto de Conhecimento */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Objeto de Conhecimento</p>
                <p className="text-sm text-gray-600 font-lato leading-snug">
                  {questao.conhecimento?.nome || "Não especificado"}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 my-4"></div>

            {/* SEÇÃO 3: ORIGEM & BANCA (ATUALIZADA) */}
            <h3 className="text-sm font-bold text-gray-800 font-oswald uppercase border-b border-gray-100 pb-2 flex items-center gap-2">
              <School size={16} className="text-green-600" />
              Origem & Banca
            </h3>

            <div className="space-y-3 text-sm font-lato">
               <div className="flex flex-col gap-2">
                  
                  {/* Tipo de Origem */}
                  <div className="flex justify-between items-center">
                     <span className="text-gray-500">Origem:</span>
                     <span className="font-medium text-right text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        {formatEnum(questao.categoriaOrigem)}
                     </span>
                  </div>

                  {/* Banca */}
                  <div className="flex justify-between items-start">
                     <span className="text-gray-500">Banca:</span>
                     <span className="font-medium text-right text-blue-700">
                       {questao.banca?.sigla || questao.banca?.nome || "-"}
                     </span>
                  </div>

                  {/* Instituição */}
                  {questao.instituicao && (
                    <div className="flex justify-between items-start">
                      <span className="text-gray-500">Instituição:</span>
                      <span className="font-medium text-right text-gray-700 truncate max-w-[150px]" title={questao.instituicao.nome}>
                        {questao.instituicao.sigla || questao.instituicao.nome}
                      </span>
                    </div>
                  )}

                  {/* ✅ ANO */}
                  {questao.ano && (
                    <div className="flex justify-between items-center bg-yellow-50 p-1.5 rounded border border-yellow-100 mt-1">
                      <span className="text-gray-500 font-medium flex items-center gap-1">
                        <Calendar size={12} /> Ano:
                      </span>
                      <span className="font-bold text-right text-gray-800">
                        {questao.ano}
                      </span>
                    </div>
                  )}

                  {/* ✅ PROVA (Se houver) */}
                  {questao.prova && (
                    <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                        <FileText size={12} /> Prova Específica
                      </p>
                      <p className="text-xs text-gray-600 leading-snug italic">
                        "{questao.prova}"
                      </p>
                    </div>
                  )}

               </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}