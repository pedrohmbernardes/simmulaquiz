import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { verifyCSRFToken } from "@/lib/csrf";

// Schema atualizado com a flag de presença automática
const abrirSessaoSchema = z.object({
  // Tempo em minutos (mínimo 1 para permitir testes rápidos)
  duracaoMinutos: z.number().int().min(1).max(240).default(30),
  // Flag para imputar presença em todos os alunos ativos
  presencaAutomatica: z.boolean().optional().default(false),
  // Data de referência (opcional, para lançamentos retroativos)
  dataReferencia: z.string().datetime().optional(),
});

function gerarCodigoCheckin(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --- POST: Abrir Sessão (Manual ou Automática) ---
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. CSRF
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "POST .../checkin",
      });
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const professorId = Number(session.sub);

    if (isNaN(turmaIdInt)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    // 3. Rate Limit
    const ip = await getClientIp(req);
    const { success, reset } = await adminContentRateLimit.limit(`checkin_open:${professorId}:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde." },
        { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
      );
    }

    // 4. Validação de Propriedade
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: { turmaId_professorId: { turmaId: turmaIdInt, professorId } },
    });
    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // 5. Validação do Body
    const body = await req.json();
    const validation = abrirSessaoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }

    const { duracaoMinutos, presencaAutomatica, dataReferencia } = validation.data;

    // 6. Fechar sessões anteriores
    // Se já existe uma ativa, o comportamento padrão aqui é fechar a anterior
    await prisma.sessaoCheckIn.updateMany({
      where: { turmaId: turmaIdInt, ativo: true },
      data: { ativo: false }
    });

    // 7. Preparar Dados da Sessão
    const agora = dataReferencia ? new Date(dataReferencia) : new Date();
    // Se for automática, fecha no mesmo instante (duração 0 efetiva)
    const fim = presencaAutomatica 
      ? agora 
      : new Date(agora.getTime() + duracaoMinutos * 60000);

    // Se for auto, o código é fixo para identificar no front, senão gera aleatório
    const codigo = presencaAutomatica ? "AUTO" : gerarCodigoCheckin();

    // 8. Transação (Sessão + Registros em Massa se for Auto)
    const resultado = await prisma.$transaction(async (tx) => {
      // A. Cria a Sessão
      const novaSessao = await tx.sessaoCheckIn.create({
        data: {
          turmaId: turmaIdInt,
          abertoPorId: professorId,
          codigo: codigo,
          // Se for automática, já nasce "inativa" pois a presença foi dada instantaneamente
          ativo: !presencaAutomatica, 
          abertoEm: agora,
          fechaEm: fim,
        },
      });

      let countRegistros = 0;

      // B. Lógica de Presença Automática
      if (presencaAutomatica) {
        // Busca alunos ativos
        const alunosAtivos = await tx.turmaAluno.findMany({
          where: { turmaId: turmaIdInt, status: "ATIVO" },
          select: { alunoId: true }
        });

        if (alunosAtivos.length > 0) {
          // Bulk Insert
          await tx.checkInRegistro.createMany({
            data: alunosAtivos.map(a => ({
              sessaoId: novaSessao.id,
              turmaId: turmaIdInt,
              alunoId: a.alunoId,
              realizadoEm: agora,
              ip: "SISTEMA", // Marca d'água
              gpsLat: null,
              gpsLong: null
            })),
            skipDuplicates: true
          });
          countRegistros = alunosAtivos.length;
        }
      }

      return { sessao: novaSessao, count: countRegistros };
    });

    // 9. Auditoria (Usando a action genérica existente ou criar CHECKIN_CRIAR)
    await registrarLog({
      acao: AuditAction.TURMA_ATUALIZAR, 
      usuarioId: professorId,
      usuarioNome: session.name,
      recurso: `Checkin: ${resultado.sessao.id}`,
      detalhes: {
        tipo: presencaAutomatica ? "AUTO_PRESENCA" : "CODIGO",
        afetados: resultado.count
      },
    });

    return NextResponse.json({
      success: true,
      sessao: resultado.sessao,
      registrosGerados: resultado.count,
      mensagem: presencaAutomatica 
        ? `Presença registrada para ${resultado.count} alunos.` 
        : "Sessão aberta. Aguardando alunos."
    }, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao abrir sessão de chamada.");
  }
}

// --- GET: Listar Histórico e Dados da Sessão Ativa ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    
    if (isNaN(turmaIdInt)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const isOwner = await prisma.turmaProfessor.findUnique({
      where: { turmaId_professorId: { turmaId: turmaIdInt, professorId: Number(session.sub) } },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    const sessoes = await prisma.sessaoCheckIn.findMany({
      where: { turmaId: turmaIdInt },
      orderBy: { abertoEm: "desc" },
      take: 50,
      include: {
        // ✅ AQUI MUDOU: Trazemos os registros e os dados do aluno
        registros: {
          include: {
            aluno: { select: { nome: true, fotoUrl: true } }
          },
          orderBy: { realizadoEm: 'desc' }
        },
        _count: { select: { registros: true } },
        abertoPor: { select: { nome: true } }
      },
    });

    const sessoesProcessadas = sessoes.map(s => ({
      ...s,
      estaExpirada: new Date() > s.fechaEm,
      tipo: s.codigo === "AUTO" ? "AUTOMATICA" : "CODIGO",
      _count: {
        checkins: s._count.registros
      },
      // ✅ NOVA PROPRIEDADE: Mapeamos para facilitar o uso no front
      listaPresentes: s.registros.map(r => ({
        nome: r.aluno.nome,
        fotoUrl: r.aluno.fotoUrl,
        horario: r.realizadoEm
      }))
    }));

    return NextResponse.json(sessoesProcessadas);

  } catch (error) {
    return safeApiError(error, "Erro ao listar histórico de chamadas.");
  }
}

// --- PATCH: Encerrar Sessão Ativa Manualmente ---
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // CSRF é obrigatório em métodos de escrita
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida (CSRF)" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);

    // Validação de Dono
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: { turmaId_professorId: { turmaId: turmaIdInt, professorId: Number(session.sub) } },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // ENCERRAMENTO REAL
    // Atualiza todas as sessões ativas desta turma para inativas e ajusta a data fim para "agora"
    const update = await prisma.sessaoCheckIn.updateMany({
      where: { 
        turmaId: turmaIdInt, 
        ativo: true 
      },
      data: { 
        ativo: false,
        fechaEm: new Date() // Força o fim imediato (bloqueia o aluno)
      }
    });

    if (update.count === 0) {
      return NextResponse.json({ error: "Nenhuma chamada ativa para encerrar." }, { status: 404 });
    }

    // Log de Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_ATUALIZAR,
      usuarioId: Number(session.sub),
      recurso: `Checkin Encerrado Manualmente`,
      detalhes: { turmaId: turmaIdInt, qtd: update.count }
    });

    return NextResponse.json({ success: true, message: "Chamada encerrada com sucesso." });

  } catch (error) {
    return safeApiError(error, "Erro ao encerrar chamada.");
  }
}