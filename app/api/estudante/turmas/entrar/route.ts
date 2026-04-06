import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiRateLimit } from "@/lib/ratelimit"; // Limite leve para evitar brute-force de códigos
import { getClientIp, safeApiError } from "@/lib/server-utils";
import { entrarTurmaSchema } from "@/lib/validations/turma";
import { registrarLog, AuditAction } from "@/lib/audit";
import { verifyCSRFToken } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação & RBAC (Apenas Alunos)
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (session.role !== "ALUNO") {
      return NextResponse.json(
        { error: "Apenas alunos podem solicitar entrada em turmas." },
        { status: 403 }
      );
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

    // 2. Rate Limiting (Proteção contra brute-force de códigos de turma)
    // Usa 'apiRateLimit' (ex: 15 reqs/2min) para impedir tentativa e erro de códigos
    const ip = getClientIp(req);
    const { success, reset } = await apiRateLimit.limit(`join_turma:${alunoId}:${ip}`);

    if (!success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde um momento." },
        { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
      );
    }

    // 3. Validação do Input (Formato do Código)
    const body = await req.json();
    const validation = entrarTurmaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Código inválido", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { codigo } = validation.data;

    // 4. Busca a Turma e Verifica Estado
    const turma = await prisma.turma.findUnique({
      where: { codigo },
      select: { id: true, nome: true, ativo: true },
    });

    if (!turma) {
      return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
    }

    if (!turma.ativo) {
      return NextResponse.json(
        { error: "Esta turma foi arquivada ou desativada pelo professor." },
        { status: 400 }
      );
    }

    // 5. Verifica se já existe vínculo (Ativo, Pendente ou Bloqueado)
    const vinculoExistente = await prisma.turmaAluno.findUnique({
      where: {
        turmaId_alunoId: {
          turmaId: turma.id,
          alunoId: alunoId,
        },
      },
    });

    if (vinculoExistente) {
      switch (vinculoExistente.status) {
        case "ATIVO":
          return NextResponse.json({ error: "Você já está matriculado nesta turma." }, { status: 409 });
        case "PENDENTE":
          return NextResponse.json(
            { error: "Solicitação já enviada. Aguarde a aprovação do professor." },
            { status: 409 }
          );
        case "BLOQUEADO":
        case "REMOVIDO":
          return NextResponse.json(
            { error: "Não foi possível entrar na turma. Contate o professor." },
            { status: 403 }
          );
        default:
          break;
      }
    }

    // 6. Criação do Vínculo (STATUS PENDENTE OBRIGATÓRIO)
    await prisma.turmaAluno.create({
      data: {
        turmaId: turma.id,
        alunoId: alunoId,
        status: "PENDENTE", // <--- Aqui está a trava de segurança que você pediu
      },
    });

    // 7. Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_ENTRAR, // Registra a tentativa/solicitação
      usuarioId: alunoId,
      usuarioNome: session.name,
      recurso: `Turma: ${turma.id}`,
      detalhes: {
        codigo: codigo,
        turmaNome: turma.nome,
        status: "PENDENTE (Solicitado)",
      },
    });

    return NextResponse.json(
      {
        message: "Solicitação enviada com sucesso!",
        detail: "Aguarde o professor aceitar sua entrada.",
        status: "PENDENTE",
      },
      { status: 201 }
    );

  } catch (error) {
    return safeApiError(error, "Erro ao solicitar entrada na turma.");
  }
}