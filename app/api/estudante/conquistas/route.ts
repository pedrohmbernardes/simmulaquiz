import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { csrfRateLimit } from '@/lib/ratelimit';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 🛡️ 1. Rate Limiting & IP
    const ip = (await headers()).get("x-forwarded-for") ?? "127.0.0.1";
    if (csrfRateLimit) {
      const { success } = await csrfRateLimit.limit(`conquistas:${ip}`);
      if (!success) {
        return NextResponse.json({ error: "Muitas requisições. Tente novamente." }, { status: 429 });
      }
    }

    // 🛡️ 2. Auth
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userId = Number(session.sub);

    // 3. Busca Dados (Agora incluindo o TIPO do usuário para permissão)
    const [usuario, todasConquistas, conquistasUsuario, stats] = await Promise.all([
      prisma.usuario.findUnique({ 
        where: { id: userId },
        select: { tipo: true } 
      }),
      prisma.conquista.findMany({ where: { ativo: true } }),
      prisma.usuarioConquista.findMany({ 
        where: { usuarioId: userId },
        select: { conquistaId: true, dataConquista: true }
      }),
      prisma.usuarioGamificacao.findUnique({
        where: { usuarioId: userId }
      })
    ]);

    if (!stats || !usuario) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    const isSuperAdmin = usuario.tipo === 'SUPER_ADMIN';

    // 4. Filtragem de Segurança (CORRIGIDO E REFORÇADO)
    const conquistasVisiveis = todasConquistas.filter(conquista => {
      const desbloqueada = conquistasUsuario.some(uc => uc.conquistaId === conquista.id);
      
      // Regra 1: Se o aluno já ganhou, mostra sempre (para ele se orgulhar).
      if (desbloqueada) return true;

      // Regra 2: Se é Super Admin, mostra tudo (visão de raio-x).
      if (isSuperAdmin) return true;

      // Regra 3: BLOQUEIO AGRESSIVO
      // Se não é admin e não ganhou:
      // Verifica se a flag 'oculta' é true OU se a categoria é explicitamente 'OCULTA'
      if (conquista.oculta === true || conquista.categoria === 'OCULTA') {
        return false; // Tchau, segredo!
      }

      return true; // Pode mostrar
    });

    // 5. Processamento
    const conquistasProcessadas = conquistasVisiveis.map((conquista) => {
      const userConquista = conquistasUsuario.find(uc => uc.conquistaId === conquista.id);
      const desbloqueada = !!userConquista;

      let progressoAtual = 0;
      const meta = conquista.requisitoValor || 1;

      if (!desbloqueada) {
        switch (conquista.requisitoTipo) {
          case 'SIMULADOS_TOTAL': progressoAtual = stats.simuladosConcluidos; break;
          case 'QUESTOES_TOTAL': progressoAtual = stats.questoesRespondidas; break;
          case 'STREAK_DIAS': progressoAtual = stats.maiorStreak; break;
          case 'NIVEL_ALCANCADO': progressoAtual = stats.nivel; break;
          default: progressoAtual = 0;
        }
      } else {
        progressoAtual = meta;
      }

      if (progressoAtual > meta) progressoAtual = meta;

      return {
        id: conquista.id,
        key: conquista.key,
        nome: conquista.nome,
        descricao: conquista.descricao,
        raridade: conquista.raridade,
        categoria: conquista.categoria,
        pontos: conquista.pontos,
        desbloqueada,
        dataConquista: userConquista?.dataConquista,
        progresso: {
          atual: progressoAtual,
          meta: meta,
          percentual: meta > 0 ? Math.round((progressoAtual / meta) * 100) : 0
        },
        // Flag visual apenas para o Admin saber que aquilo é secreto
        secret: conquista.oculta
      };
    });

    // 6. Agrupamento
    const categorias = {
      INICIO_ENGAJAMENTO: conquistasProcessadas.filter(c => c.categoria === 'INICIO_ENGAJAMENTO'),
      PERFORMANCE_VELOCIDADE: conquistasProcessadas.filter(c => c.categoria === 'PERFORMANCE_VELOCIDADE'),
      MAESTRIA_UC: conquistasProcessadas.filter(c => c.categoria === 'MAESTRIA_UC'),
      OBJETO_CONHECIMENTO: conquistasProcessadas.filter(c => c.categoria === 'OBJETO_CONHECIMENTO'),
      DESEMPENHO_AVANCADO: conquistasProcessadas.filter(c => c.categoria === 'DESEMPENHO_AVANCADO'),
      // Se o aluno não tiver nenhuma secreta desbloqueada, essa lista ficará vazia
      // e o frontend automaticamente esconderá a aba.
      OCULTA: conquistasProcessadas.filter(c => c.categoria === 'OCULTA'),
      IMPOSSIVEL: conquistasProcessadas.filter(c => c.categoria === 'IMPOSSIVEL'),
    };

    const resumo = {
      total: todasConquistas.length, // Total real do sistema (para saber o tamanho do jogo)
      desbloqueadas: conquistasUsuario.length,
      pontosTotaisPossiveis: todasConquistas.reduce((acc, curr) => acc + curr.pontos, 0),
      pontosConquistados: conquistasProcessadas
        .filter(c => c.desbloqueada)
        .reduce((acc, curr) => acc + curr.pontos, 0)
    };

    return NextResponse.json({ resumo, categorias });

  } catch (error) {
    console.error("Erro seguro api/conquistas:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}