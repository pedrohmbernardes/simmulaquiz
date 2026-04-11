import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError } from "@/lib/server-utils";
import { apiRateLimit, adminContentRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando os limitadores unificados
import { sanitizeObject } from "@/lib/sanitize";
import { verifyCSRFToken } from "@/lib/csrf";

// Validação da Tarefa
const criarTarefaSchema = z.object({
  titulo: z.string().min(3, "O título deve ter pelo menos 3 caracteres").max(150),
  descricao: z.string().optional(),
  
  // Data de entrega é opcional
  dataEntrega: z.coerce.date().optional().nullable(),
  
  // Nota máxima
  notaMaxima: z.number().min(0).max(1000).default(10.0),

  // ✅ CORREÇÃO: moduloId agora é opcional para permitir tarefas soltas
  moduloId: z.number().optional().nullable(),
});

// --- POST: Criar Nova Tarefa (Solta ou Vinculada) ---
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação & RBAC
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Criação de Conteúdo (Padronizado)
    const rlKey = `prof_tarefa_criar:${session.sub}`;
    const rl = await adminContentRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Muitas tarefas criadas em pouco tempo. Aguarde um instante." },
        { status: 429 }
      );
    }

    // 2. CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const userId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID de turma inválido" }, { status: 400 });
    }

    // 3. Validação de Propriedade
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: userId,
        },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // 4. Validação e Sanitização
    const body = await req.json();
    const validation = criarTarefaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const dataSanitizado = sanitizeObject(validation.data);
    const { dataEntrega, notaMaxima, moduloId } = validation.data; // Dados tipados

    // 5. Criação (Com ou Sem Módulo)
    // Se tiver moduloId, usamos transação para garantir integridade. Se não, cria direto.
    let resultado;

    if (moduloId) {
      // --- CENÁRIO 1: TAREFA VINCULADA A MÓDULO ---
      resultado = await prisma.$transaction(async (tx) => {
        // Verifica se o módulo existe e pertence à turma
        const modulo = await tx.moduloTurma.findFirst({
          where: { id: moduloId, turmaId: turmaIdInt }
        });

        if (!modulo) {
          throw new Error("Módulo não encontrado nesta turma.");
        }

        // Cria a Tarefa
        const tarefa = await tx.tarefa.create({
          data: {
            turmaId: turmaIdInt,
            criadoPorId: userId,
            titulo: dataSanitizado.titulo,
            descricao: dataSanitizado.descricao || null,
            dataEntrega: dataEntrega || null,
            notaMaxima: notaMaxima,
          },
        });

        // Descobre a última ordem
        const ultimoItem = await tx.moduloItem.findFirst({
          where: { moduloId: moduloId },
          orderBy: { ordem: 'desc' },
          select: { ordem: true }
        });
        
        const novaOrdem = (ultimoItem?.ordem ?? 0) + 1;

        // Cria o vínculo (ModuloItem)
        await tx.moduloItem.create({
          data: {
            moduloId: moduloId,
            titulo: tarefa.titulo,
            tipo: "TAREFA",
            ordem: novaOrdem,
            tarefaId: tarefa.id
          }
        });

        return tarefa;
      });
    } else {
      // --- CENÁRIO 2: TAREFA SOLTA (SEM MÓDULO) ---
      resultado = await prisma.tarefa.create({
        data: {
          turmaId: turmaIdInt,
          criadoPorId: userId,
          titulo: dataSanitizado.titulo,
          descricao: dataSanitizado.descricao || null,
          dataEntrega: dataEntrega || null,
          notaMaxima: notaMaxima,
        },
      });
    }

    // 6. Auditoria (Usando fallback de string se o enum falhar)
    await registrarLog({
      acao: (AuditAction as any).TAREFA_CRIAR || "TAREFA_CRIAR", 
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Tarefa: ${resultado.id}`,
      detalhes: {
        turmaId: turmaIdInt,
        moduloId: moduloId || null,
        titulo: resultado.titulo,
        temPrazo: !!dataEntrega
      },
    });

    return NextResponse.json(resultado, { status: 201 });

  } catch (error: any) {
    // Tratamento específico para erro de módulo não encontrado dentro da transação
    if (error.message === "Módulo não encontrado nesta turma.") {
        return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return safeApiError(error, "Erro ao criar tarefa.");
  }
}

// --- GET: Listar Tarefas da Turma ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Leitura
    const rlKey = `prof_tarefas_lista:${session.sub}`;
    const rl = await apiRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    
    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: Number(session.sub),
        },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    const tarefas = await prisma.tarefa.findMany({
      where: { turmaId: turmaIdInt },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { entregas: true },
        },
      },
    });

    return NextResponse.json(tarefas);

  } catch (error) {
    return safeApiError(error, "Erro ao listar tarefas.");
  }
}