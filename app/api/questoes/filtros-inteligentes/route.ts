import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !["PROFESSOR", "SUPER_ADMIN"].includes(session.role)) return NextResponse.json({}, { status: 403 });

  const { searchParams } = new URL(req.url);
  
  // Captura o estado atual dos filtros
  const cursoId = searchParams.get("cursoId");
  const unidadeId = searchParams.get("unidadeId");
  const funcaoId = searchParams.get("funcaoId");
  const subfuncaoId = searchParams.get("subfuncaoId");

  // Helper para montar o WHERE base (filtra questões ativas)
  const baseWhere: Prisma.QuestaoWhereInput = { ativa: true };

  // 1. CURSOS DISPONÍVEIS (Baseado em TODAS as questões ativas)
  // Mostra apenas cursos que têm pelo menos uma questão
  const cursosRaw = await prisma.questao.findMany({
    where: baseWhere,
    select: { cursoTecnico: { select: { id: true, nome: true } } },
    distinct: ['cursoTecnicoId']
  });
  // Remove nulos e formata
  const cursos = cursosRaw
    .map(q => q.cursoTecnico)
    .filter(c => c !== null)
    .sort((a, b) => a!.nome.localeCompare(b!.nome));

  // 2. UNIDADES DISPONÍVEIS (Baseado no Curso Selecionado)
  const whereUnidade: Prisma.QuestaoWhereInput = { ...baseWhere };
  if (cursoId && cursoId !== "TODAS") whereUnidade.cursoTecnicoId = parseInt(cursoId);

  const unidadesRaw = await prisma.questao.findMany({
    where: whereUnidade,
    select: { unidadeCurricular: { select: { id: true, nome: true } } },
    distinct: ['unidadeCurricularId']
  });
  const unidades = unidadesRaw
    .map(q => q.unidadeCurricular)
    .filter(u => u !== null)
    .sort((a, b) => a!.nome.localeCompare(b!.nome));

  // 3. FUNÇÕES DISPONÍVEIS (Baseado no Curso + Unidade Selecionados)
  const whereFuncao: Prisma.QuestaoWhereInput = { ...whereUnidade }; // Herda filtro de curso
  if (unidadeId && unidadeId !== "TODAS") whereFuncao.unidadeCurricularId = parseInt(unidadeId);

  const funcoesRaw = await prisma.questao.findMany({
    where: whereFuncao,
    select: { funcao: { select: { id: true, nome: true } } },
    distinct: ['funcaoId']
  });
  const funcoes = funcoesRaw
    .map(q => q.funcao)
    .filter(f => f !== null)
    .sort((a, b) => a!.nome.localeCompare(b!.nome));

  // 4. SUBFUNÇÕES DISPONÍVEIS (Baseado em Curso + Unidade + Função)
  const whereSub: Prisma.QuestaoWhereInput = { ...whereFuncao }; // Herda filtro de unidade
  if (funcaoId && funcaoId !== "TODAS") whereSub.funcaoId = parseInt(funcaoId);

  const subfuncoesRaw = await prisma.questao.findMany({
    where: whereSub,
    select: { subfuncao: { select: { id: true, nome: true } } },
    distinct: ['subfuncaoId']
  });
  const subfuncoes = subfuncoesRaw
    .map(q => q.subfuncao)
    .filter(s => s !== null)
    .sort((a, b) => a!.nome.localeCompare(b!.nome));

  // 5. OBJETOS DE CONHECIMENTO (Baseado em tudo acima)
  const whereConhecimento: Prisma.QuestaoWhereInput = { ...whereSub };
  if (subfuncaoId && subfuncaoId !== "TODAS") whereConhecimento.subfuncaoId = parseInt(subfuncaoId);

  const conhecimentosRaw = await prisma.questao.findMany({
    where: whereConhecimento,
    select: { conhecimento: { select: { id: true, nome: true } } },
    distinct: ['conhecimentoId']
  });
  const conhecimentos = conhecimentosRaw
    .map(q => q.conhecimento)
    .filter(c => c !== null)
    .sort((a, b) => a!.nome.localeCompare(b!.nome));

  return NextResponse.json({
    cursos,
    unidades,
    funcoes,
    subfuncoes,
    conhecimentos
  });
}