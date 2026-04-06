import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { verifyCSRFToken } from "@/lib/csrf"; // ✅ CSRF Obrigatório
import { otpRateLimit } from "@/lib/ratelimit"; // ✅ Rate Limit Rígido (Anti-Bruteforce)

// Schema para entrar na turma
const joinTurmaSchema = z.object({
  codigo: z.string().trim().min(6, "Código muito curto").max(20),
});

// --- GET: Listar Minhas Turmas ---
export async function GET(req: NextRequest) {
  try {
    // 1. Autenticação (Apenas Alunos)
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const alunoId = Number(session.sub);

    // 2. Busca Turmas do Aluno (Anti-IDOR: where alunoId)
    // Trazemos também as PENDENTES para feedback visual
    const matriculas = await prisma.turmaAluno.findMany({
      where: {
        alunoId: alunoId,
        status: {
          in: ["ATIVO", "PENDENTE"], // Oculta BLOQUEADO/REMOVIDO
        },
        turma: {
          ativo: true, // Apenas turmas ativas
        },
      },
      orderBy: {
        entrouEm: "desc",
      },
      include: {
        turma: {
          select: {
            id: true,
            codigo: true,
            nome: true,
            descricao: true,
            imagemUrl: true,
            _count: {
              select: { alunos: true },
            },
            professores: {
              where: { role: "PROFESSOR" }, // Pega o titular
              take: 1,
              select: {
                professor: {
                  select: { nome: true, fotoUrl: true },
                },
              },
            },
          },
        },
      },
    });

    // 3. Formata o retorno
    const resultado = matriculas.map((m) => ({
      id: m.turma.id,
      nome: m.turma.nome,
      codigo: m.turma.codigo,
      descricao: m.turma.descricao,
      imagemUrl: m.turma.imagemUrl,
      status: m.status,
      entrouEm: m.entrouEm,
      totalAlunos: m.turma._count.alunos,
      professor: m.turma.professores[0]?.professor || { nome: "Professor", fotoUrl: null },
    }));

    return NextResponse.json(resultado);
  } catch (error) {
    return safeApiError(error, "Erro ao listar suas turmas.");
  }
}

// --- POST: Entrar em uma Turma (Join) ---
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Apenas alunos podem entrar em turmas." }, { status: 403 });
    }

    const alunoId = Number(session.sub);

    // 1. 🛡️ CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: alunoId,
        recurso: "POST /api/estudante/turmas (JOIN)",
      });
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    // 2. Rate Limit Rígido (Anti-Bruteforce de Códigos)
    // Usa 'otpRateLimit' (3 tentativas a cada 10 min) ou similar, pois códigos de turma são "segredos"
    const ip = await getClientIp(req);
    const { success, reset } = await otpRateLimit.limit(`join_turma:${alunoId}:${ip}`);
    
    if (!success) {
      return NextResponse.json(
        { error: "Muitas tentativas incorretas. Aguarde alguns minutos." },
        { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
      );
    }

    // 3. Validação Input
    const body = await req.json();
    const validation = joinTurmaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Código inválido." }, { status: 400 });
    }

    const { codigo } = validation.data;

    // 4. Busca Turma pelo Código
    const turma = await prisma.turma.findUnique({
      where: { codigo: codigo },
      select: { id: true, ativo: true, nome: true }
    });

    if (!turma || !turma.ativo) {
      // Retorna 404 genérico ou mensagem específica
      return NextResponse.json({ error: "Turma não encontrada ou código expirado." }, { status: 404 });
    }

    // 5. Verifica se já é membro
    const matriculaExistente = await prisma.turmaAluno.findUnique({
      where: {
        turmaId_alunoId: { turmaId: turma.id, alunoId: alunoId }
      }
    });

    if (matriculaExistente) {
      if (matriculaExistente.status === "ATIVO") {
        return NextResponse.json({ error: "Você já está nesta turma!" }, { status: 409 });
      }
      if (matriculaExistente.status === "BLOQUEADO") {
        return NextResponse.json({ error: "Você foi removido desta turma pelo professor." }, { status: 403 });
      }
      if (matriculaExistente.status === "PENDENTE") {
        return NextResponse.json({ error: "Sua solicitação já foi enviada. Aguarde aprovação." }, { status: 409 });
      }
      // Se for REMOVIDO, permitimos tentar entrar novamente (o status voltará a ser ATIVO ou PENDENTE)
    }

    // 6. Entra na Turma (Upsert para cobrir caso de readmissão)
    // Definimos status como ATIVO por padrão ao usar código, assumindo que o código é a "senha".
    // Se quiser moderação, mude para "PENDENTE".
    const novaMatricula = await prisma.turmaAluno.upsert({
      where: {
        turmaId_alunoId: { turmaId: turma.id, alunoId: alunoId }
      },
      create: {
        turmaId: turma.id,
        alunoId: alunoId,
        status: "ATIVO", // Código correto = Entrada imediata
      },
      update: {
        status: "ATIVO",
        entrouEm: new Date(), // Atualiza data de entrada
      }
    });

    // 7. Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_ENTRAR,
      usuarioId: alunoId,
      usuarioNome: session.name,
      recurso: `Turma: ${turma.id}`,
      detalhes: {
        codigoUsado: codigo,
        turmaNome: turma.nome
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Você entrou na turma ${turma.nome}!`,
      turmaId: turma.id 
    }, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao entrar na turma.");
  }
}