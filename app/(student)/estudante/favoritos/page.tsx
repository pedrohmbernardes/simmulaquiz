import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { QuestaoCard } from "@/components/questoes/QuestaoCard";
import DOMPurify from "isomorphic-dompurify";
import { Star, Sparkles, Heart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FavoritosPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = Number(session.sub);

  const favoritos = await prisma.questaoFavorita.findMany({
    where: { usuarioId: userId },
    include: {
      questao: {
        include: { banca: true, unidadeCurricular: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header compacto com gradiente */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-8 md:px-8">
        {/* Padrão decorativo de fundo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 h-32 w-32 rounded-full bg-white blur-2xl"></div>
          <div className="absolute bottom-0 right-1/4 h-40 w-40 rounded-full bg-yellow-200 blur-2xl"></div>
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
              <Star className="h-6 w-6 text-white fill-white" />
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 drop-shadow-lg">
                Meus Favoritos
              </h1>
              
              <p className="text-white/90 text-sm">
                {favoritos.length === 0 
                  ? "Comece a salvar suas questões favoritas"
                  : `${favoritos.length} ${favoritos.length === 1 ? 'questão salva' : 'questões salvas'} para revisar`
                }
              </p>
            </div>

            {/* Contador visual compacto */}
            {favoritos.length > 0 && (
              <div className="hidden md:block rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-sm text-white font-semibold border border-white/30">
                ⭐ {favoritos.length}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-8 pb-20">
        {favoritos.length === 0 ? (
          <div className="relative">
            {/* Card de estado vazio estilizado */}
            <div className="rounded-2xl bg-white border-2 border-dashed border-amber-200 shadow-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-orange-50/50"></div>
              
              <div className="relative px-8 py-12 text-center">
                {/* Ícone decorativo */}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100">
                  <Heart className="h-8 w-8 text-amber-600" />
                </div>

                <h2 className="mb-2 text-xl font-bold text-gray-800">
                  Nenhuma questão favoritada ainda
                </h2>
                
                <p className="mx-auto max-w-md text-sm text-gray-600 mb-6">
                  Clique na estrela ⭐ nas questões que você quer salvar para revisar mais tarde.
                </p>

                {/* Dicas visuais */}
                <div className="mx-auto max-w-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
                      <div className="text-2xl mb-1">📚</div>
                      <p className="text-xs text-gray-700 font-medium">
                        Salve questões importantes
                      </p>
                    </div>
                    <div className="rounded-xl bg-orange-50 p-3 border border-orange-100">
                      <div className="text-2xl mb-1">🎯</div>
                      <p className="text-xs text-gray-700 font-medium">
                        Revise quando quiser
                      </p>
                    </div>
                    <div className="rounded-xl bg-rose-50 p-3 border border-rose-100">
                      <div className="text-2xl mb-1">✨</div>
                      <p className="text-xs text-gray-700 font-medium">
                        Organize seus estudos
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Grid de questões */}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {favoritos.map((fav, index) => (
                <div 
                  key={fav.id}
                  className="animate-in fade-in slide-in-from-bottom-4"
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    animationFillMode: 'backwards'
                  }}
                >
                  <QuestaoCard
                    id={fav.questao.id}
                    enunciado={DOMPurify.sanitize(fav.questao.enunciado)}
                    dificuldade={fav.questao.dificuldade || "MEDIO"}
                    origem={
                      fav.questao.banca?.sigla ||
                      fav.questao.unidadeCurricular?.nome ||
                      "Institucional"
                    }
                    isFavorito={true}
                  />
                </div>
              ))}
            </div>

            {/* Rodapé informativo */}
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-5 py-2 text-xs font-medium text-amber-800 border border-amber-200">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                Continue adicionando questões aos seus favoritos!
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
