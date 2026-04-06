import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { sanitizeObject } from "@/lib/sanitize"; // ✅ Padronizado com os outros arquivos
import { verifyCSRFToken } from "@/lib/csrf"; // ✅ CSRF Obrigatório

// Validação simples para criar módulo
const criarModuloSchema = z.object({
  titulo: z.string().min(2, "O título deve ter pelo menos 2 caracteres").max(100),
  descricao: z.string().max(500).optional(),
  publicado: z.boolean().default(false), 
});

// --- POST: Criar Novo Módulo ---
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

    // 2. 🛡️ CSRF Check (Defense in Depth)
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "POST /api/professor/.../modulos",
      });
      return NextResponse.json({ error: "Sessão inválida (Token de Segurança)" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const professorId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID de turma inválido" }, { status: 400 });
    }

    // 3. Rate Limit
    const ip = await getClientIp(req);
    const { success, reset } = await adminContentRateLimit.limit(`create_mod:${professorId}:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um momento." },
        { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
      );
    }

    // 4. Validação de Propriedade
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId,
        },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // 5. Validação do Body
    const body = await req.json();
    const validation = criarModuloSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // ✅ Sanitização (XSS)
    const data = sanitizeObject(validation.data);

    // 6. Lógica de Ordem (Auto-incremento seguro)
    // Usa uma query leve (select apenas da ordem)
    const ultimoModulo = await prisma.moduloTurma.findFirst({
      where: { turmaId: turmaIdInt },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });

    const novaOrdem = (ultimoModulo?.ordem ?? -1) + 1;

    // 7. Criação do Módulo
    const novoModulo = await prisma.moduloTurma.create({
      data: {
        turmaId: turmaIdInt,
        autorId: professorId,
        titulo: data.titulo,
        descricao: data.descricao || null,
        publicado: data.publicado,
        ordem: novaOrdem,
      },
    });

    // 8. Auditoria
    await registrarLog({
      // Como não existe MODULO_CRIAR no enum original, usei TURMA_EDITAR que é semanticamente próximo
      // Se puder, adicione MODULO_CRIAR ao enum AuditAction em audit.ts
      acao: AuditAction.TURMA_EDITAR, 
      usuarioId: professorId,
      usuarioNome: session.name,
      recurso: `Módulo: ${novoModulo.id}`,
      detalhes: {
        tipo: "CRIACAO_MODULO",
        turmaId: turmaIdInt,
        titulo: novoModulo.titulo,
        ordem: novaOrdem,
      },
    });

    return NextResponse.json(novoModulo, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao criar módulo.");
  }
}

// --- GET: Listar Trilha Completa (Módulos + Itens) ---
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

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Validação de Propriedade
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

    // Busca PROFUNDA da trilha
    const modulos = await prisma.moduloTurma.findMany({
      where: { turmaId: turmaIdInt },
      orderBy: { ordem: "asc" },
      include: {
        itens: {
          orderBy: { ordem: "asc" },
          include: {
            // Polimorfismo: Traz os detalhes do item dependendo do tipo
            // Nota: O include 'true' em material traz URL/Path. Cuidado com exposição se houver dados sensíveis lá (parece ok aqui)
            material: true, 
            agendamento: {
              select: { id: true, titulo: true, status: true, dataFim: true }
            },
            tarefa: {
              select: { id: true, titulo: true, dataEntrega: true }
            }
          }
        }
      }
    });

    return NextResponse.json(modulos);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar módulos.");
  }
}