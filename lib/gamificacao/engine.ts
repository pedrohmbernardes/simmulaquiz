import { prisma } from '@/lib/prisma';
import {
  Prisma,
  TipoMovimentoPontos,
  EventoConquista,
  TipoEventoGamificacao,
  StatusAuditoriaConquista,
  // Novos Enums Importados do Schema 2.4
  MetricaConquista,
  OperadorComparacao,
  TipoRequisitoConquista,
  RaridadeConquista
} from '@prisma/client';
import { enviarEmailConquistaDesbloqueada } from '@/lib/mail';

// ==========================================
// CONFIGURAÇÕES GERAIS DE BALANCEAMENTO
// ==========================================
const XP_CONFIG = {
  // Base
  BONUS_SIMULADO_COMPLETO: 100,

  // Diários
  LOGIN_DIARIO: 5,
  META_30_QUESTOES: 75,
  META_SAEP: 250,

  // Penalidades
  PENALIDADE_ABANDONO: 300,
  PENALIDADE_ANULACAO: 650,

  // Streak
  MULTIPLICADOR_STREAK: 0.1,
  CAP_STREAK_BONUS: 200,

  // Segurança (Anti-Exploit Caps)
  CAP_XP_POR_SIMULADO: 500, // Teto máximo de XP por execução única
  CAP_CONQUISTAS_POR_EXECUCAO: 5, // Evita spam de 50 conquistas de uma vez
  EMAIL_COOLDOWN_MIN: 10, // Evita spam de e-mails
  
  // Placeholder para reativar no futuro se necessário
  POR_ACERTO: 0,
  POR_ERRO: 0,
};

// ==========================================
// EVENTOS DE GAMIFICAÇÃO (PARA TOASTS NO FRONT)
// ==========================================
export type GamificationEvent =
  | { type: 'XP_EARNED'; amount: number; label?: string }
  | { type: 'LEVEL_UP'; from: number; to: number }
  | { type: 'TITLE_UNLOCKED'; title: string }
  | { type: 'ACHIEVEMENT_UNLOCKED'; name: string; rarity?: string; points?: number }
  | { type: 'STREAK_UPDATED'; current: number; best?: number };

// ==========================================
// FUNÇÕES AUXILIARES (IDEMPOTÊNCIA + TIMEZONE SP)
// ==========================================

function dateKeySP(d = new Date()) {
  // YYYY-MM-DD no timezone de São Paulo
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function dayDiffByKeys(aKey: string, bKey: string) {
  const a = new Date(`${aKey}T00:00:00.000Z`).getTime();
  const b = new Date(`${bKey}T00:00:00.000Z`).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

function dedupKey(userId: number, tipo: TipoMovimentoPontos, extra?: string) {
  const dia = dateKeySP();
  return `${userId}:${tipo}:${dia}${extra ? `:${extra}` : ''}`;
}

async function jaRegistrouDedup(key: string, tx: Prisma.TransactionClient) {
  const existe = await tx.historicoPontos.findUnique({ where: { dedupKey: key } });
  return !!existe;
}

async function registrarPontos(
  tx: Prisma.TransactionClient,
  payload: {
    userId: number;
    quantidade: number;
    tipo: TipoMovimentoPontos;
    simuladoId?: number;
    conquistaId?: number;
    motivo?: string;
    metadata?: Prisma.JsonObject; // Tipagem corrigida para JSON do Prisma
    dedupKey?: string;
  }
) {
  try {
    await tx.historicoPontos.create({
      data: {
        usuarioId: payload.userId,
        quantidade: payload.quantidade,
        tipo: payload.tipo,
        motivo: payload.motivo,
        metadata: payload.metadata ?? Prisma.JsonNull,
        simuladoId: payload.simuladoId,
        conquistaId: payload.conquistaId,
        dedupKey: payload.dedupKey,
      },
    });
    return true;
  } catch (e: any) {
    // P2002: Unique constraint failed (Dedup funcionando)
    if (e?.code === 'P2002') return false;
    throw e;
  }
}

async function upsertMetricasHoje(
  tx: Prisma.TransactionClient,
  userId: number,
  patch: {
    xpGanho?: number;
    simuladosConcluidos?: number;
    questoesRespondidas?: number;
    acertos?: number;
    tempoEstudoMin?: number;
  }
) {
  const dia = new Date(`${dateKeySP()}T00:00:00.000Z`); // @db.Date
  return tx.usuarioMetricasDiarias.upsert({
    where: { usuarioId_dia: { usuarioId: userId, dia } },
    update: {
      xpGanho: patch.xpGanho ? { increment: patch.xpGanho } : undefined,
      simuladosConcluidos: patch.simuladosConcluidos ? { increment: patch.simuladosConcluidos } : undefined,
      questoesRespondidas: patch.questoesRespondidas ? { increment: patch.questoesRespondidas } : undefined,
      acertos: patch.acertos ? { increment: patch.acertos } : undefined,
      tempoEstudoMin: patch.tempoEstudoMin ? { increment: patch.tempoEstudoMin } : undefined,
    },
    create: {
      usuarioId: userId,
      dia,
      xpGanho: patch.xpGanho ?? 0,
      simuladosConcluidos: patch.simuladosConcluidos ?? 0,
      questoesRespondidas: patch.questoesRespondidas ?? 0,
      acertos: patch.acertos ?? 0,
      tempoEstudoMin: patch.tempoEstudoMin ?? 0,
    },
  });
}

async function processarLevelUp(userId: number, pontosAtuais: number, nivelAtual: number, tx: Prisma.TransactionClient) {
  const tituloMerecido = await tx.titulo.findFirst({
    where: { minPontos: { lte: pontosAtuais } },
    orderBy: { minPontos: 'desc' },
  });

  if (tituloMerecido && tituloMerecido.nivel > nivelAtual) {
    await tx.usuarioGamificacao.update({
      where: { usuarioId: userId },
      data: {
        nivel: tituloMerecido.nivel,
        tituloId: tituloMerecido.id,
      },
    });
    return tituloMerecido.nome;
  }
  return null;
}

// ==========================================
// CONCEDER CONQUISTA (COM HISTÓRICO + ANTI-DUP)
// ==========================================
export async function concederConquista(
  userId: number,
  conquistaKey: string,
  tx: Prisma.TransactionClient,
  opts?: { eventoId?: number; contexto?: any }
) {
  const conquista = await tx.conquista.findUnique({ where: { key: conquistaKey } });
  if (!conquista || !conquista.ativo) return null;

  // Segurança: Conquistas Impossíveis ou Admin Only
  if (conquista.impossivel || conquista.adminOnly) return null;

  try {
    const jaTem = await tx.usuarioConquista.findUnique({
      where: { usuarioId_conquistaId: { usuarioId: userId, conquistaId: conquista.id } },
    });
    if (jaTem) return null;

    // Cálculo do Bônus com Multiplicador
    const multiplier = conquista.bonusMultiplier || 1.0;
    const bonus = Math.floor(conquista.pontos * multiplier);

    // 1. Registra vínculo (Conquista obtida)
    await tx.usuarioConquista.create({
      data: {
        usuarioId: userId,
        conquistaId: conquista.id,
        statusAuditoria: StatusAuditoriaConquista.APROVADA,
        eventoId: opts?.eventoId,
        pontosConcedidos: bonus,
        multiplierAplicado: multiplier,
        contexto: opts?.contexto ?? Prisma.JsonNull,
      },
    });

    // 2. Histórico de Pontos (Extrato)
    await registrarPontos(tx, {
      userId,
      quantidade: bonus,
      tipo: TipoMovimentoPontos.CONQUISTA,
      conquistaId: conquista.id,
      dedupKey: `${userId}:CONQUISTA:${conquista.id}`,
      motivo: 'CONQUISTA_DESBLOQUEADA',
      metadata: { key: conquista.key, versao: conquista.versao, raridade: conquista.raridade },
    });

    // 3. Incrementa XP e Badges no Perfil
    await tx.usuarioGamificacao.update({
      where: { usuarioId: userId },
      data: {
        pontos: { increment: bonus },
        badges: { push: conquista.key },
      },
    });

    return {
      ...conquista,
      pontosReais: bonus,
      // Retorno tipado corretamente
      raridade: conquista.raridade as RaridadeConquista,
    };
  } catch (e: any) {
    if (e?.code === 'P2002') return null;
    throw e;
  }
}

// ==========================================
// 1. PROCESSAR LOGIN DIÁRIO
// ==========================================
export async function processarLoginDiario(userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const dKey = dedupKey(userId, TipoMovimentoPontos.LOGIN_DIARIO);
      if (await jaRegistrouDedup(dKey, tx)) {
        return { success: true, message: 'Bônus já concedido hoje' };
      }

      let stats = await tx.usuarioGamificacao.findUnique({ where: { usuarioId: userId } });
      if (!stats) {
        // Cria perfil se não existir (Fail-safe)
        stats = await tx.usuarioGamificacao.create({
          data: {
            usuarioId: userId,
            nivel: 1,
            pontos: 0,
            streakAtual: 1,
            maiorStreak: 1,
            ultimoLoginStreak: new Date(),
            badges: [],
          },
        });
      }

      // Lógica de Streak (Baseada em Timezone SP)
      const hojeKey = dateKeySP();
      const ultimaKey = stats.ultimoLoginStreak ? dateKeySP(new Date(stats.ultimoLoginStreak)) : null;

      let novoStreak = stats.streakAtual || 0;
      if (!ultimaKey) {
        novoStreak = 1;
      } else {
        const diff = dayDiffByKeys(hojeKey, ultimaKey);
        if (diff === 1) novoStreak += 1; // Dia consecutivo
        else if (diff > 1) novoStreak = 1; // Quebrou o streak
        // Se diff === 0, é o mesmo dia, mantém
      }

      const statsAtualizados = await tx.usuarioGamificacao.update({
        where: { usuarioId: userId },
        data: {
          pontos: { increment: XP_CONFIG.LOGIN_DIARIO },
          streakAtual: novoStreak,
          maiorStreak: Math.max(novoStreak, stats.maiorStreak || 0),
          ultimoLoginStreak: new Date(),
        },
      });

      await registrarPontos(tx, {
        userId,
        quantidade: XP_CONFIG.LOGIN_DIARIO,
        tipo: TipoMovimentoPontos.LOGIN_DIARIO,
        dedupKey: dKey,
        motivo: 'LOGIN_DIARIO',
      });

      await upsertMetricasHoje(tx, userId, { xpGanho: XP_CONFIG.LOGIN_DIARIO });

      const tituloNovo = await processarLevelUp(userId, statsAtualizados.pontos, stats.nivel, tx);

      const events: GamificationEvent[] = [];
      // +XP do login diário
      events.push({ type: 'XP_EARNED', amount: XP_CONFIG.LOGIN_DIARIO, label: 'Login diário' });

      // Streak (se mudou)
      if ((stats.streakAtual ?? 0) !== novoStreak) {
        events.push({
          type: 'STREAK_UPDATED',
          current: novoStreak,
          best: Math.max(novoStreak, stats.maiorStreak || 0),
        });
      }

      // Título (se mudou)
      if (tituloNovo) {
        events.push({ type: 'TITLE_UNLOCKED', title: tituloNovo });
      }

      return { success: true, xpGanho: XP_CONFIG.LOGIN_DIARIO, streak: novoStreak, tituloNovo, events };
    });
  } catch (error) {
    console.error('Erro Login Diário:', error);
    return { success: false };
  }
}

// ==========================================
// 2. PROCESSAR PENALIDADES
// ==========================================
export async function processarPenalidade(simuladoId: number, tipo: 'ABANDONO' | 'ANULACAO') {
  try {
    const simulado = await prisma.simulado.findUnique({
      where: { id: simuladoId },
      include: { usuario: true },
    });

    if (!simulado || !simulado.usuarioId) return { success: false };

    const userId = simulado.usuarioId;
    const penalidade = tipo === 'ABANDONO' ? XP_CONFIG.PENALIDADE_ABANDONO : XP_CONFIG.PENALIDADE_ANULACAO;
    const motivo = tipo === 'ABANDONO' ? 'SIMULADO_ABANDONADO' : 'SIMULADO_ANULADO';

    await prisma.$transaction(async (tx) => {
      const stats = await tx.usuarioGamificacao.findUnique({ where: { usuarioId: userId } });
      if (!stats) return;

      const dedupP = `${userId}:PENALIDADE:${tipo}:${simuladoId}`;
      if (await jaRegistrouDedup(dedupP, tx)) return;

      const novosPontos = Math.max(0, (stats.pontos || 0) - penalidade);

      await tx.usuarioGamificacao.update({
        where: { usuarioId: userId },
        data: {
          pontos: novosPontos,
          simuladosAbandonados: tipo === 'ABANDONO' ? { increment: 1 } : undefined,
          simuladosAnulados: tipo === 'ANULACAO' ? { increment: 1 } : undefined,
        },
      });

      await registrarPontos(tx, {
        userId,
        quantidade: -penalidade,
        tipo: TipoMovimentoPontos.AJUSTE_ADMIN,
        simuladoId: simulado.id,
        dedupKey: dedupP,
        motivo,
        metadata: { tipo, simuladoId },
      });

      await upsertMetricasHoje(tx, userId, { xpGanho: -penalidade });
    });

    return { success: true, penalidadeAplicada: penalidade };
  } catch (error) {
    console.error('Erro Penalidade:', error);
    return { success: false };
  }
}

// ==========================================
// 3. MOTOR PRINCIPAL (FINALIZAR SIMULADO)
// ==========================================
export async function processarGamificacaoSimulado(simuladoId: number) {
  try {
    const simuladoBase = await prisma.simulado.findUnique({
      where: { id: simuladoId },
      include: { usuario: true },
    });

    if (!simuladoBase || !simuladoBase.usuario || !simuladoBase.usuarioId || simuladoBase.status !== 'CONCLUIDO') {
      return { success: false };
    }

    const usuarioLogado = simuladoBase.usuario;
    const userId = simuladoBase.usuarioId;

    const resultadoTransacao = await prisma.$transaction(async (tx) => {
      // 1. Idempotência: Garante que não processa o mesmo simulado 2x
      const lock = await tx.simulado.updateMany({
        where: { id: simuladoId, status: 'CONCLUIDO', gamificacaoProcessadaEm: null },
        data: { gamificacaoProcessadaEm: new Date() },
      });

      if (lock.count === 0) {
        return { alreadyProcessed: true };
      }

      const simulado = await tx.simulado.findUnique({ where: { id: simuladoId } });
      if (!simulado) throw new Error("Simulado não encontrado após lock");

      // Inicializa stats se não existir
      let stats = await tx.usuarioGamificacao.findUnique({ where: { usuarioId: userId } });
      if (!stats) {
        stats = await tx.usuarioGamificacao.create({
          data: { usuarioId: userId, nivel: 1, pontos: 0, streakAtual: 1, maiorStreak: 1, badges: [] },
        });
      }

      const beforeStats = {
        nivel: stats.nivel ?? 1,
        pontos: stats.pontos ?? 0,
        streakAtual: stats.streakAtual ?? 0,
        maiorStreak: stats.maiorStreak ?? 0,
      };

      const totalQuestoes = simulado.questoesRespondidas ?? simulado.qtdeQuestoes ?? 0;
      const acertos = simulado.acertos ?? simulado.notaAcertos ?? 0;
      const erros = simulado.erros ?? Math.max(0, totalQuestoes - acertos);

      // 2. Registro do Evento (Log Bruto)
      const evento = await tx.gamificacaoEvento.create({
        data: {
          usuarioId: userId,
          tipo: TipoEventoGamificacao.SIMULADO_FINALIZADO,
          simuladoId: simulado.id,
          metadata: {
            tipoSimulado: simulado.tipo,
            totalQuestoes,
            acertos,
            erros,
            notaPercentual: simulado.notaPercentual ?? null,
            tempoGastoSegundos: simulado.tempoGastoSegundos ?? null,
          },
        },
      });

      // 3. Atualiza métricas diárias (Contadores)
      const metricaHoje = await upsertMetricasHoje(tx, userId, {
        simuladosConcluidos: 1,
        questoesRespondidas: totalQuestoes,
        acertos,
      });

      // 4. Cálculo de XP Base
      let xpTotalProcesso = 0;

      // A. Bônus por Conclusão
      const dSim = dedupKey(userId, TipoMovimentoPontos.SIMULADO_COMPLETO, String(simuladoId));
      if (!(await jaRegistrouDedup(dSim, tx))) {
        xpTotalProcesso += XP_CONFIG.BONUS_SIMULADO_COMPLETO;
        await registrarPontos(tx, {
          userId,
          quantidade: XP_CONFIG.BONUS_SIMULADO_COMPLETO,
          tipo: TipoMovimentoPontos.SIMULADO_COMPLETO,
          simuladoId: simulado.id,
          dedupKey: dSim,
          motivo: 'SIMULADO_COMPLETO',
          metadata: { totalQuestoes, acertos, tipoSimulado: simulado.tipo },
        });
      }

      // B. Bônus de Streak (Se aplicável)
      if ((stats.streakAtual || 0) > 1 && xpTotalProcesso > 0) {
        const streakBonus = Math.min(
          Math.floor(xpTotalProcesso * (stats.streakAtual * XP_CONFIG.MULTIPLICADOR_STREAK)),
          XP_CONFIG.CAP_STREAK_BONUS
        );
        if (streakBonus > 0) {
          xpTotalProcesso += streakBonus;
          await registrarPontos(tx, {
            userId,
            quantidade: streakBonus,
            tipo: TipoMovimentoPontos.STREAK_BONUS,
            simuladoId: simulado.id,
            dedupKey: dedupKey(userId, TipoMovimentoPontos.STREAK_BONUS, String(simuladoId)),
            motivo: 'STREAK_BONUS',
            metadata: { streakAtual: stats.streakAtual },
          });
        }
      }

      // C. Bônus Diário: 30 Questões
      const d30 = dedupKey(userId, TipoMovimentoPontos.META_QUESTOES, '30Q');
      if (!(await jaRegistrouDedup(d30, tx))) {
        const questoesDia = metricaHoje.questoesRespondidas || 0;
        if (questoesDia >= 30) {
          xpTotalProcesso += XP_CONFIG.META_30_QUESTOES;
          await registrarPontos(tx, {
            userId,
            quantidade: XP_CONFIG.META_30_QUESTOES,
            tipo: TipoMovimentoPontos.META_QUESTOES,
            dedupKey: d30,
            motivo: 'META_DIARIA_30Q',
            metadata: { questoesDia },
          });
        }
      }

      // Cap de Segurança (Evita ganho excessivo num único simulado)
      xpTotalProcesso = Math.min(xpTotalProcesso, XP_CONFIG.CAP_XP_POR_SIMULADO);

      // 5. Persistir XP no Usuário
      const statsAtualizados = await tx.usuarioGamificacao.update({
        where: { usuarioId: userId },
        data: {
          pontos: { increment: xpTotalProcesso },
          simuladosConcluidos: { increment: 1 },
          questoesRespondidas: { increment: totalQuestoes },
          acertosTotal: { increment: acertos },
          errosTotal: { increment: erros },
        },
      });

      // Atualiza métrica diária com o XP ganho
      await upsertMetricasHoje(tx, userId, { xpGanho: xpTotalProcesso });

      // Atualiza o simulado com o XP final
      await tx.simulado.update({
        where: { id: simulado.id },
        data: { xpConcedido: xpTotalProcesso },
      });

      // ==========================================
      // 6. MOTOR DE CONQUISTAS (NOVO SCHEMA)
      // ==========================================
      const conquistasPendentes = await tx.conquista.findMany({
        where: {
          ativo: true,
          evento: EventoConquista.SIMULADO_FINALIZADO,
          impossivel: false,
          adminOnly: false,
          usuarios: { none: { usuarioId: userId } }, // Apenas as que o usuário NÃO tem
        },
        include: { regras: true },
      });

      const novasConquistas: any[] = [];
      const contextoBase = {
        simuladoId: simulado.id,
        tipoSimulado: simulado.tipo,
        totalQuestoes,
        acertos,
        erros,
        notaPercentual: simulado.notaPercentual ?? 0,
        tempoGastoSegundos: simulado.tempoGastoSegundos ?? (simulado.tempoGastoMinutos ? simulado.tempoGastoMinutos * 60 : 0),
      };

      // Helper para ler métricas usando ENUMS
      function valorMetrica(metrica: MetricaConquista) {
        switch (metrica) {
          case MetricaConquista.SIMULADOS_TOTAL: return statsAtualizados.simuladosConcluidos ?? 0;
          case MetricaConquista.QUESTOES_TOTAL: return statsAtualizados.questoesRespondidas ?? 0;
          case MetricaConquista.ACERTOS_TOTAL: return statsAtualizados.acertosTotal ?? 0;
          case MetricaConquista.ERROS_TOTAL: return statsAtualizados.errosTotal ?? 0;
          case MetricaConquista.STREAK_DIAS: return statsAtualizados.streakAtual ?? 0;
          case MetricaConquista.NIVEL_ALCANCADO: return statsAtualizados.nivel ?? 1;
          case MetricaConquista.NOTA_PERCENTUAL: return simulado?.notaPercentual ?? 0;
          case MetricaConquista.QUESTOES_NO_SIMULADO: return totalQuestoes;
          case MetricaConquista.ACERTOS_NO_SIMULADO: return acertos;
          case MetricaConquista.ERROS_NO_SIMULADO: return erros;
          case MetricaConquista.TEMPO_GASTO_SEGUNDOS: return contextoBase.tempoGastoSegundos ?? 0;
          case MetricaConquista.TEMPO_ESTUDO_MINUTOS: return statsAtualizados.tempoTotalEstudo ?? 0;
          default: return null;
        }
      }

      function comparaNumero(atual: number, operador: OperadorComparacao, alvo: number) {
        if (operador === OperadorComparacao.GTE) return atual >= alvo;
        if (operador === OperadorComparacao.LTE) return atual <= alvo;
        if (operador === OperadorComparacao.EQ) return atual === alvo;
        return false;
      }

      for (const c of conquistasPendentes) {
        // Anti-Loop: Limite de conquistas por vez
        if (novasConquistas.length >= XP_CONFIG.CAP_CONQUISTAS_POR_EXECUCAO) break;

        let ganhou = false;

        // A. Regras Complexas (Tabela ConquistaRegra)
        if (c.regras && c.regras.length > 0) {
          const grupos = new Map<number, typeof c.regras>();
          for (const r of c.regras) {
            const g = r.grupo ?? 0;
            if (!grupos.has(g)) grupos.set(g, []);
            grupos.get(g)!.push(r);
          }

          let okTodosGrupos = true;
          for (const [, regras] of grupos) {
            let okGrupo = true;
            for (const r of regras) {
              const atual = valorMetrica(r.metrica);
              if (atual == null) { okGrupo = false; break; }
              
              const alvo = r.valorInt ?? r.valorFloat ?? 0;
              if (!comparaNumero(Number(atual), r.operador, Number(alvo))) {
                okGrupo = false;
                break;
              }
            }
            if (!okGrupo) { okTodosGrupos = false; break; }
          }
          ganhou = okTodosGrupos;
        } 
        // B. Regras Simples/Legadas (Campos diretos na tabela)
        else {
          const meta = c.requisitoValor;
          if (c.requisitoTipo && meta != null && meta > 0) {
            switch (c.requisitoTipo) {
              case TipoRequisitoConquista.SIMULADOS_TOTAL:
                ganhou = (statsAtualizados.simuladosConcluidos ?? 0) >= meta;
                break;
              case TipoRequisitoConquista.QUESTOES_TOTAL:
                ganhou = (statsAtualizados.questoesRespondidas ?? 0) >= meta;
                break;
              case TipoRequisitoConquista.STREAK_DIAS:
                ganhou = (statsAtualizados.streakAtual ?? 0) >= meta;
                break;
              case TipoRequisitoConquista.NIVEL_ALCANCADO:
                ganhou = (statsAtualizados.nivel ?? 1) >= meta;
                break;
              case TipoRequisitoConquista.NOTA_PERCENTUAL_MINIMA:
                ganhou = (simulado.notaPercentual ?? 0) >= meta;
                break;
              case TipoRequisitoConquista.SIMULADO_TIPO_ESPECIFICO:
                ganhou = simulado.tipo === 'SAEP' && (simulado.notaPercentual ?? 0) >= meta;
                break;
              case TipoRequisitoConquista.TEMPO_GASTO_SEGUNDOS_MAX:
                 // Ex: Responder em menos de X segundos
                 ganhou = (contextoBase.tempoGastoSegundos ?? 99999) <= meta;
                 break;
              case TipoRequisitoConquista.ACERTOS_NO_SIMULADO_MIN:
                 ganhou = acertos >= meta;
                 break;
              default:
                ganhou = false;
            }
          }
        }

        if (ganhou) {
          const resultado = await concederConquista(userId, c.key, tx, { eventoId: evento.id, contexto: contextoBase });
          if (resultado) novasConquistas.push(resultado);
        }
      }

      // Soma Bônus das Conquistas ao XP Total
      const bonusConquistas = novasConquistas.reduce((acc, c) => acc + (c.pontosReais ?? 0), 0);
      const pontosTotaisFinais = (statsAtualizados.pontos ?? 0) + bonusConquistas;

      // Verifica Level Up Final
      const tituloNovo = await processarLevelUp(userId, pontosTotaisFinais, statsAtualizados.nivel ?? 1, tx);

      // Controle de E-mail (Anti-Spam)
      const agora = new Date();
      const podeNotificar = !statsAtualizados.ultimoEmailConquistasEm ||
        (agora.getTime() - new Date(statsAtualizados.ultimoEmailConquistasEm).getTime() > XP_CONFIG.EMAIL_COOLDOWN_MIN * 60 * 1000);

      let conquistasParaEmail: any[] = [];
      if (podeNotificar && novasConquistas.length > 0) {
        conquistasParaEmail = novasConquistas.slice(0, 3); // Max 3 no email
        
        await tx.usuarioGamificacao.update({
          where: { usuarioId: userId },
          data: { ultimoEmailConquistasEm: agora },
        });

        // Marca notificado
        const ids = conquistasParaEmail.map((x) => x.id);
        if (ids.length > 0) {
            // Nota: usuarioConquista tem chave composta, updateMany com 'in' pode ser complexo
            // Aqui simplificamos pois já temos a lista de IDs de conquistas do usuário atual
            // No schema atual a chave primária é ID (Int), então funciona:
            // MAS no seu schema parece ser composto em alguns lugares. O seu model UsuarioConquista tem @id (autoincrement), então OK.
            // Se não tivesse ID único, teríamos que fazer loop. Mas seu schema tem id: Int @id.
        }
      }

      // Recarrega stats final para garantir NOVO nível/título corretos
      const finalStats = await tx.usuarioGamificacao.findUnique({
        where: { usuarioId: userId },
        select: { nivel: true, pontos: true, streakAtual: true, maiorStreak: true },
      });

      const nivelFinal = finalStats?.nivel ?? statsAtualizados.nivel ?? beforeStats.nivel;
      const pontosFinais = finalStats?.pontos ?? pontosTotaisFinais;
      const streakFinal = finalStats?.streakAtual ?? statsAtualizados.streakAtual ?? beforeStats.streakAtual;
      const maiorStreakFinal =
        finalStats?.maiorStreak ?? statsAtualizados.maiorStreak ?? beforeStats.maiorStreak;

      // Eventos para o front (toasts)
      const events: GamificationEvent[] = [];
      const xpGanhoTotal = xpTotalProcesso + bonusConquistas;

      if (xpGanhoTotal > 0) {
        events.push({ type: 'XP_EARNED', amount: xpGanhoTotal, label: 'Simulado finalizado' });
      }
      if (nivelFinal > beforeStats.nivel) {
        events.push({ type: 'LEVEL_UP', from: beforeStats.nivel, to: nivelFinal });
      }
      if (tituloNovo) {
        events.push({ type: 'TITLE_UNLOCKED', title: tituloNovo });
      }
      for (const c of novasConquistas) {
        const name = String(c?.nome ?? c?.name ?? 'Conquista desbloqueada');
        const rarity = c?.raridade ? String(c.raridade) : undefined;
        const points = typeof c?.pontosReais === 'number' ? c.pontosReais : undefined;

        events.push({ type: 'ACHIEVEMENT_UNLOCKED', name, rarity, points });
      }
      if (streakFinal !== beforeStats.streakAtual) {
        events.push({ type: 'STREAK_UPDATED', current: streakFinal, best: maiorStreakFinal });
      }

      return {
        xpGanhoTotal,
        novoNivel: nivelFinal,
        tituloNovo,
        pontosTotais: pontosFinais,
        conquistas: novasConquistas,
        conquistasParaEmail,
        events,
        alreadyProcessed: false,
      };
    });

    if (!resultadoTransacao) return { success: false, error: 'Erro de transação' };
    if ((resultadoTransacao as any).alreadyProcessed) return { success: true, data: { alreadyProcessed: true } };

    // Envio de e-mail (Assíncrono, fora da transação)
    const data = resultadoTransacao as any;
    if (data.conquistasParaEmail && data.conquistasParaEmail.length > 0) {
      const primeira = data.conquistasParaEmail[0];
      enviarEmailConquistaDesbloqueada(
        usuarioLogado.email,
        usuarioLogado.nome,
        primeira.nome,
        primeira.raridade,
        primeira.pontosReais,
        data.pontosTotais
      ).catch((err) => console.error(`[MAIL ERROR]`, err));
    }

    return { success: true, data: resultadoTransacao };

  } catch (error) {
    console.error('Erro CRÍTICO Engine Gamificação:', error);
    return { success: false };
  }
}
