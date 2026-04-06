import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { sanitizeObject } from "@/lib/sanitize"; // ✅ Padronização
import { verifyCSRFToken } from "@/lib/csrf"; // ✅ CSRF Obrigatório

// Validação rigorosa: Tipo deve bater com o ID fornecido
const adicionarItemSchema = z.object({
  titulo: z.string().min(2, "Título muito curto").max(100),
  tipo: z.enum(["MATERIAL", "AGENDAMENTO_SIMULADO", "TAREFA"]),
  
  // Apenas um destes deve ser enviado pelo front
  materialId: z.number().int().optional(),
  agendamentoId: z.number().int().optional(),
  tarefaId: z.number().int().optional(),
}).refine((data) => {
  // Validação de Integridade Lógica
  if (data.tipo === "MATERIAL") return !!data.materialId;
  if (data.tipo === "AGENDAMENTO_SIMULADO") return !!data.agendamentoId;
  if (data.tipo === "TAREFA") return !!data.tarefaId;
  return false;
}, {
  message: "O ID do recurso é obrigatório e deve corresponder ao Tipo selecionado.",
  path: ["tipo"], 
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; moduloId: string }> }
) {
  try {
    // 1. Autenticação & RBAC
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. 🛡️ CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "POST /api/professor/.../itens",
      });
      return NextResponse.json({ error: "Sessão inválida (Token de Segurança)" }, { status: 403 });
    }

    const { turmaId, moduloId } = await params;
    const turmaIdInt = Number(turmaId);
    const moduloIdInt = Number(moduloId);
    const userId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(moduloIdInt)) {
      return NextResponse.json({ error: "IDs inválidos." }, { status: 400 });
    }

    // 3. Rate Limit
    const ip = await getClientIp(req);
    const { success, reset } = await adminContentRateLimit.limit(`add_item_mod:${userId}:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um momento." },
        { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
      );
    }

    // 4. Validação de Propriedade da Turma (Anti-IDOR)
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

    // 5. Validação do Módulo (Anti-IDOR Aninhado)
    // Garante que o módulo pertence à turma indicada na URL
    const modulo = await prisma.moduloTurma.findUnique({
      where: { id: moduloIdInt },
    });

    if (!modulo || modulo.turmaId !== turmaIdInt) {
      return NextResponse.json({ error: "Módulo não encontrado nesta turma." }, { status: 404 });
    }

    // 6. Validação do Body
    const body = await req.json();
    const validation = adicionarItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { titulo, tipo, materialId, agendamentoId, tarefaId } = validation.data;

    // 7. Validação de Pertencimento do Recurso (SEGURANÇA CRÍTICA - CROSS TENANT)
    // Impede adicionar um material da Turma A no módulo da Turma B
    if (tipo === "MATERIAL" && materialId) {
      const recurso = await prisma.materialTurma.findUnique({ where: { id: materialId } });
      if (!recurso || recurso.turmaId !== turmaIdInt) {
        return NextResponse.json({ error: "O Material selecionado não pertence a esta turma." }, { status: 403 });
      }
    } else if (tipo === "AGENDAMENTO_SIMULADO" && agendamentoId) {
      const recurso = await prisma.agendamentoSimulado.findUnique({ where: { id: agendamentoId } });
      if (!recurso || recurso.turmaId !== turmaIdInt) {
        return NextResponse.json({ error: "O Agendamento selecionado não pertence a esta turma." }, { status: 403 });
      }
    } else if (tipo === "TAREFA" && tarefaId) {
      const recurso = await prisma.tarefa.findUnique({ where: { id: tarefaId } });
      if (!recurso || recurso.turmaId !== turmaIdInt) {
        return NextResponse.json({ error: "A Tarefa selecionada não pertence a esta turma." }, { status: 403 });
      }
    }

    // 8. Lógica de Ordem
    const ultimoItem = await prisma.moduloItem.findFirst({
      where: { moduloId: moduloIdInt },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });
    const novaOrdem = (ultimoItem?.ordem ?? -1) + 1;

    // 9. Criação do Item
    const novoItem = await prisma.moduloItem.create({
      data: {
        moduloId: moduloIdInt,
        titulo: sanitizeObject(titulo), // ✅ Sanitização
        tipo: tipo,
        ordem: novaOrdem,
        // Polimorfismo: Preenche apenas o campo definido
        materialId: materialId,
        agendamentoId: agendamentoId,
        tarefaId: tarefaId,
      },
    });

    // 10. Auditoria
    await registrarLog({
      acao: AuditAction.TURMA_ATUALIZAR, 
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `ModuloItem: ${novoItem.id}`,
      detalhes: {
        moduloId: moduloIdInt,
        tipoItem: tipo,
        itemId: materialId || agendamentoId || tarefaId || null,
        titulo: novoItem.titulo
      },
    });

    return NextResponse.json(novoItem, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao adicionar item ao módulo.");
  }
}