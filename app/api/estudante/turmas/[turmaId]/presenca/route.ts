import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";
import { apiRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando o limitador de API padrão

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Leitura (Evita scraping/sobrecarga no carregamento do histórico)
    const rlKey = `presenca_historico:${session.sub}`;
    const rl = await apiRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const alunoId = Number(session.sub);

    // 1. Verifica matrícula
    const matricula = await prisma.turmaAluno.findUnique({
      where: { turmaId_alunoId: { turmaId: turmaIdInt, alunoId } }
    });

    if (!matricula) {
      return NextResponse.json({ error: "Aluno não matriculado." }, { status: 403 });
    }

    // 2. Busca SESSÕES (Apenas passadas ou em andamento)
    // CORREÇÃO CRÍTICA: Filtrar data para não contar aulas futuras como falta
    const sessoes = await prisma.sessaoCheckIn.findMany({
      where: { 
        turmaId: turmaIdInt,
        abertoEm: { lte: new Date() } // Apenas sessões que já abriram
      },
      orderBy: { abertoEm: 'desc' },
      include: {
        registros: {
          where: { alunoId },
          select: { realizadoEm: true }
        },
        abertoPor: { // Opcional: mostrar quem abriu a aula
          select: { nome: true } 
        }
      }
    });

    // 3. Processa
    const historico = sessoes.map(sessao => {
      const presente = sessao.registros.length > 0;
      return {
        id: sessao.id,
        data: sessao.abertoEm,
        fechamento: sessao.fechaEm, 
        professor: sessao.abertoPor.nome,
        tipo: sessao.codigo === 'AUTO' ? 'AUTOMATICA' : 'PRESENCIAL', // Lógica do seu código mantida
        status: presente ? 'PRESENTE' : 'AUSENTE',
        realizadoEm: presente ? sessao.registros[0].realizadoEm : null
      };
    });

    // Filtra para estatísticas apenas aulas que já encerraram o prazo de check-in
    // (Aulas em andamento não devem contar como falta ainda)
    const agora = new Date();
    const aulasEncerradas = historico.filter(h => new Date(h.fechamento) < agora);
    
    const totalAulasComputadas = aulasEncerradas.length;
    const totalPresencas = aulasEncerradas.filter(h => h.status === 'PRESENTE').length;
    
    // Evita divisão por zero
    const frequencia = totalAulasComputadas > 0 
      ? Math.round((totalPresencas / totalAulasComputadas) * 100) 
      : 100;

    return NextResponse.json({
      resumo: {
        totalAulas: totalAulasComputadas,
        totalPresencas,
        totalFaltas: totalAulasComputadas - totalPresencas,
        frequencia
      },
      historico // Retorna lista completa (incluindo aula de hoje) para visualização
    });

  } catch (error) {
    return safeApiError(error, "Erro ao buscar histórico de presença.");
  }
}