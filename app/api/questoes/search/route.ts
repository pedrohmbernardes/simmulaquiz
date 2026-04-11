import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";
import { NivelDificuldade, NivelCognitivo, Prisma } from "@prisma/client";
import { searchFilterRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando o limitador de busca/filtros

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !["PROFESSOR", "SUPER_ADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Busca (Permite digitação fluida/debounce, mas bloqueia scraping do banco)
    const rlKey = `questoes_search:${session.sub}`;
    const rl = await searchFilterRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas buscas em sequência. Aguarde um instante." }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    
    // --- NOVO: Filtro por ID ---
    const idParam = searchParams.get("id");

    // Filtros de Texto
    const termo = searchParams.get("termo");

    // Filtros de Enum
    const dificuldade = searchParams.get("dificuldade");
    const nivelCognitivo = searchParams.get("nivelCognitivo");

    // Filtros de Relacionamento
    const cursoId = searchParams.get("cursoId");
    const unidadeId = searchParams.get("unidadeId");
    const funcaoId = searchParams.get("funcaoId");
    const subfuncaoId = searchParams.get("subfuncaoId");
    const conhecimentoId = searchParams.get("conhecimentoId");

    const where: Prisma.QuestaoWhereInput = {
      ativa: true,
    };

    // Lógica de Prioridade: Se tiver ID, busca só pelo ID (ignora o resto)
    if (idParam && !isNaN(parseInt(idParam))) {
      where.id = parseInt(idParam);
    } else {
      // Se não tiver ID, aplica os filtros normais
      if (termo) where.enunciado = { contains: termo, mode: "insensitive" };
      if (dificuldade && dificuldade !== "TODAS") where.dificuldade = dificuldade as NivelDificuldade;
      if (nivelCognitivo && nivelCognitivo !== "TODAS") where.nivelCognitivo = nivelCognitivo as NivelCognitivo;
      
      if (cursoId && cursoId !== "TODAS") where.cursoTecnicoId = parseInt(cursoId);
      if (unidadeId && unidadeId !== "TODAS") where.unidadeCurricularId = parseInt(unidadeId);
      if (funcaoId && funcaoId !== "TODAS") where.funcaoId = parseInt(funcaoId);
      if (subfuncaoId && subfuncaoId !== "TODAS") where.subfuncaoId = parseInt(subfuncaoId);
      if (conhecimentoId && conhecimentoId !== "TODAS") where.conhecimentoId = parseInt(conhecimentoId);
    }

    const questoes = await prisma.questao.findMany({
      where,
      select: {
        id: true, // Importante: retornar o ID
        enunciado: true,
        dificuldade: true,
        nivelCognitivo: true,
        unidadeCurricular: { select: { nome: true } },
        cursoTecnico: { select: { nome: true } },
        funcao: { select: { nome: true } },
        conhecimento: { select: { nome: true } },
      },
      take: 50,
      orderBy: { id: 'desc' }
    });

    return NextResponse.json(questoes);
  } catch (error) {
    return safeApiError(error, "Erro ao buscar questões");
  }
}