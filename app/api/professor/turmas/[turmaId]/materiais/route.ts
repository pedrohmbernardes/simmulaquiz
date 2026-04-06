import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { getClientIp } from "@/lib/server-utils";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { verifyCSRFToken } from "@/lib/csrf";
import { sanitizeObject } from "@/lib/sanitize";
import { TipoMaterial } from "@prisma/client";

// Schema atualizado para aceitar moduloId
const criarMaterialSchema = z.object({
  titulo: z.string().min(3, "Mínimo 3 caracteres").max(100),
  descricao: z.string().optional(),
  tipo: z.enum([
    "LINK", "VIDEO_YOUTUBE", "PDF", "DRIVE",          
    "LINK_EXTERNO", "PDF_UPLOAD", "GOOGLE_DRIVE"      
  ]), 
  url: z.string().url("URL inválida"),
  storagePath: z.string().optional(),
  mimeType: z.string().optional(),
  tamanhoBytes: z.number().optional(),
  
  // ✅ Novo campo opcional para vincular a um módulo
  moduloId: z.number().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida (Token de Segurança)" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const userId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID de turma inválido" }, { status: 400 });
    }

    // Rate Limit
    const ip = await getClientIp(req);
    const { success, reset } = await adminContentRateLimit.limit(`create_material:${userId}:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde." },
        { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
      );
    }

    // Validação de Propriedade
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: { turmaId: turmaIdInt, professorId: userId },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    const body = await req.json();
    const validation = criarMaterialSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = sanitizeObject(validation.data);

    // Normalização de Tipo
    let tipoBanco = "LINK_EXTERNO";
    if (["LINK", "LINK_EXTERNO"].includes(data.tipo)) tipoBanco = "LINK_EXTERNO";
    else if (["DRIVE", "GOOGLE_DRIVE"].includes(data.tipo)) tipoBanco = "GOOGLE_DRIVE";
    else if (["PDF", "PDF_UPLOAD"].includes(data.tipo)) tipoBanco = "PDF_UPLOAD";
    else if (data.tipo === "VIDEO_YOUTUBE") tipoBanco = "VIDEO_YOUTUBE";

    // ✅ Lógica de Criação com Transação (Se tiver moduloId)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cria o Material
      const material = await tx.materialTurma.create({
        data: {
          turmaId: turmaIdInt,
          autorId: userId,
          titulo: data.titulo,
          descricao: data.descricao,
          tipo: tipoBanco as TipoMaterial, // Cast seguro após normalização
          url: data.url,
          storagePath: data.storagePath,
          mimeType: data.mimeType,
          tamanhoBytes: data.tamanhoBytes,
        },
      });

      // 2. Se houver moduloId, cria o vínculo ModuloItem
      if (data.moduloId) {
        // Verifica se o módulo pertence à turma (segurança extra)
        const moduloExiste = await tx.moduloTurma.findFirst({
          where: { id: data.moduloId, turmaId: turmaIdInt }
        });

        if (moduloExiste) {
          // Descobre a última ordem para inserir no fim
          const ultimoItem = await tx.moduloItem.findFirst({
            where: { moduloId: data.moduloId },
            orderBy: { ordem: 'desc' },
            select: { ordem: true }
          });
          
          const novaOrdem = (ultimoItem?.ordem ?? 0) + 1;

          await tx.moduloItem.create({
            data: {
              moduloId: data.moduloId,
              titulo: material.titulo, // Copia título para o item (padrão)
              tipo: "MATERIAL",
              ordem: novaOrdem,
              materialId: material.id
            }
          });
        }
      }

      return material;
    });

    // Auditoria
    await registrarLog({
      acao: AuditAction.MATERIAL_CRIAR,
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Material: ${result.id}`,
      detalhes: {
        turmaId: turmaIdInt,
        // CORREÇÃO: Converte undefined para null para satisfazer o tipo JsonLike
        moduloId: data.moduloId ?? null, 
        titulo: result.titulo,
        tipo: result.tipo
      },
    });

    return NextResponse.json(result, { status: 201 });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno ao processar material." }, { status: 500 });
  }
}

// --- GET: Listar Materiais ---
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

    const materiais = await prisma.materialTurma.findMany({
      where: { turmaId: turmaIdInt },
      orderBy: { createdAt: "desc" },
      include: {
        autor: { select: { nome: true } }
      }
    });

    return NextResponse.json(materiais);

  } catch (error) {
    return NextResponse.json({ error: "Erro ao listar materiais." }, { status: 500 });
  }
}