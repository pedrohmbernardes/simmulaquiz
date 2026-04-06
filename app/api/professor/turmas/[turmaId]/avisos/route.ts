import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { sanitizeString } from "@/lib/sanitize";
import { verifyCSRFToken } from "@/lib/csrf"; 

// Validação dos dados do aviso
const criarAvisoSchema = z.object({
  titulo: z.string().min(3, "O título deve ter pelo menos 3 caracteres").max(100),
  conteudo: z.string().min(1, "O conteúdo não pode estar vazio"),
  mensagem: z.string().optional(), // Aceita campo alternativo 'mensagem' se o front enviar
  fixado: z.boolean().default(false),
  
  // Lista opcional de anexos
  anexos: z.array(z.object({
    url: z.string().url("URL do anexo inválida"),
    nome: z.string().optional(),
    tipo: z.string().optional(), 
  })).optional().default([]),
});

// --- POST: Criar Novo Aviso ---
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 0. Resolução de Params (Next.js 15)
    // Deve ser a primeira coisa a ser aguardada para garantir acesso aos IDs
    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);

    // 1. Autenticação & RBAC
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. 🛡️ CSRF Check (Defense in Depth)
    const csrfTokenHeader = req.headers.get("x-csrf-token");
    const isCsrfValid = await verifyCSRFToken(csrfTokenHeader);

    if (!isCsrfValid) {
      console.error("[CSRF_FAIL] Falha na validação CSRF:", {
        usuarioId: session.sub,
        headerRecebido: csrfTokenHeader ? "SIM" : "NÃO",
        tokenHeader: csrfTokenHeader?.substring(0, 10) + "...", // Log parcial para debug
        url: req.url
      });

      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "POST /api/professor/.../avisos",
      });
      return NextResponse.json({ error: "Sessão inválida (Token de Segurança)" }, { status: 403 });
    }

    // Validação básica do ID da turma
    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID de turma inválido" }, { status: 400 });
    }

    const professorId = Number(session.sub);

    // 3. Rate Limit (Evitar spam no feed)
    const ip = await getClientIp(req);
    const { success, reset } = await adminContentRateLimit.limit(`create_aviso:${professorId}:${ip}`);
    
    if (!success) {
      return NextResponse.json(
        { error: "Muitas publicações. Aguarde um momento." },
        { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
      );
    }

    // 4. Validação de Propriedade (Strong FK)
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

    // 5. Validação e Sanitização do Input
    const body = await req.json();
    const validation = criarAvisoSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Suporte híbrido para campos 'conteudo' ou 'mensagem' (caso o front envie um ou outro)
    const { titulo, conteudo, mensagem, fixado, anexos } = validation.data;
    const textoFinal = conteudo || mensagem || "";

    // SANITIZAÇÃO
    const conteudoSeguro = sanitizeString(textoFinal);
    const tituloSeguro = sanitizeString(titulo);

    // 6. Criação do Aviso + Anexos (Transação implícita)
    const novoAviso = await prisma.avisoTurma.create({
      data: {
        turmaId: turmaIdInt,
        autorId: professorId,
        titulo: tituloSeguro,
        conteudo: conteudoSeguro,
        fixado: fixado,
        anexos: {
          create: anexos.map((anexo) => ({
            url: anexo.url,
            nome: anexo.nome ? sanitizeString(anexo.nome) : null,
            tipo: anexo.tipo,
          })),
        },
      },
      include: {
        anexos: true,
      },
    });

    // 7. Auditoria
    await registrarLog({
      acao: AuditAction.AVISO_CRIAR,
      usuarioId: professorId,
      usuarioNome: session.name,
      recurso: `Aviso: ${novoAviso.id}`,
      detalhes: {
        turmaId: turmaIdInt,
        titulo: novoAviso.titulo,
        anexosCount: anexos.length,
        fixado: fixado
      },
    });

    return NextResponse.json(novoAviso, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao publicar aviso.");
  }
}

// --- GET: Listar Avisos da Turma ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);

    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

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

    // Busca com ordenação
    const avisos = await prisma.avisoTurma.findMany({
      where: { turmaId: turmaIdInt },
      orderBy: [
        { fixado: "desc" },    
        { createdAt: "desc" }, 
      ],
      include: {
        anexos: true,
        autor: {
          select: {
            nome: true,
            fotoUrl: true,
          },
        },
        _count: {
          select: { comentarios: true },
        },
      },
    });

    return NextResponse.json(avisos);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar o mural.");
  }
}