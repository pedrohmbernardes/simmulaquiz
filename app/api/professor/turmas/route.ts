// app/api/professor/turmas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth"; 
import { prisma } from "@/lib/prisma";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { getClientIp, safeApiError } from "@/lib/server-utils";
import { criarTurmaSchema } from "@/lib/validations/turma";
import { sanitizeObject } from "@/lib/sanitize";
import { registrarLog, AuditAction } from "@/lib/audit";
import { verifyCSRFToken } from "@/lib/csrf"; // ✅ Adicionado para segurança manual

// // Gera um código único amigável: TUR-ANO-RANDOM (ex: TUR-2026-X9B)
// function gerarCodigoTurma(): string {
//   const ano = new Date().getFullYear();
//   const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
//   let randomStr = "";
//   for (let i = 0; i < 3; i++) {
//     randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
//   }
//   return `TUR-${ano}-${randomStr}`;
// }

function gerarCodigoTurma(): string {
  // Omitimos I, O, 1 e 0 para evitar erros de digitação dos alunos
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ"; 
  const numeros = "23456789"; 

  const getRandom = (chars: string, length: number) => {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const parte1 = getRandom(letras, 3);
  const parte2 = getRandom(numeros, 4);
  const parte3 = getRandom(letras, 3);

  return `${parte1}-${parte2}-${parte3}`;
  // Exemplo de saída: XBZ-4872-KPW
}

// --- GET: Listar TODAS as Turmas do Professor ---
export async function GET(req: NextRequest) {
  try {
    // 1. Autenticação & RBAC
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      // Nota: Permiti SUPER_ADMIN para fins de debug/suporte, mas mantive o filtro
      // de "minhas turmas" abaixo. Se o admin não estiver na turma, a lista vem vazia.
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const userId = Number(session.sub);

    // 2. Busca segura (Anti-IDOR)
    // Apenas turmas onde o usuário consta na tabela pivô TurmaProfessor
    const turmas = await prisma.turma.findMany({
      where: {
        professores: {
          some: {
            professorId: userId,
          },
        },
        ativo: true, // Opcional: filtrar apenas ativas por padrão? Mantive geral.
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: { alunos: true }, 
        },
      },
    });

    return NextResponse.json(turmas);

  } catch (error) {
    return safeApiError(error, "Erro ao listar turmas.");
  }
}

// --- POST: Criar Turma ---
export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2. RBAC Estrito
    if (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN") {
      await registrarLog({
        acao: AuditAction.SEGURANCA_ACESSO_NEGADO,
        usuarioId: Number(session.sub),
        usuarioNome: session.name,
        recurso: "POST /api/professor/turmas",
        detalhes: { motivo: "Tentativa de criação sem privilégio" },
      });
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 3. 🛡️ CSRF Check (Defense in Depth)
    // Obrigatório pois /api/professor não está na lista crítica do middleware
    const csrfToken = req.headers.get("x-csrf-token");
    const isValidCsrf = await verifyCSRFToken(csrfToken);
    
    if (!isValidCsrf) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        usuarioNome: session.name,
        recurso: "POST /api/professor/turmas",
      });
      return NextResponse.json({ error: "Sessão inválida (CSRF)" }, { status: 403 });
    }

    // 4. Rate Limiting
    const userId = Number(session.sub);
    const ip = await getClientIp(req);
    const { success, reset } = await adminContentRateLimit.limit(`create_turma:${userId}:${ip}`);

    if (!success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um momento." },
        { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
      );
    }

    // 5. Validação e Sanitização
    const body = await req.json();
    const validationResult = criarTurmaSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Sanitiza strings (remove XSS) antes de tocar no banco
    const data = sanitizeObject(validationResult.data);

    // 6. Geração de Código Único
    let codigo = "";
    let isUnique = false;
    let tentativas = 0;

    while (!isUnique && tentativas < 10) {
      codigo = gerarCodigoTurma();
      // Otimização: Select apenas do ID para ser mais leve
      const existe = await prisma.turma.findUnique({ 
        where: { codigo }, 
        select: { id: true } 
      });
      if (!existe) isUnique = true;
      tentativas++;
    }

    if (!isUnique) {
      throw new Error("Não foi possível gerar um código de turma único. Tente novamente.");
    }

    // 7. Transação Atômica (Nested Write)
    // Cria Turma E o vínculo na pivô TurmaProfessor simultaneamente.
    const novaTurma = await prisma.turma.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        imagemUrl: data.imagemUrl || null,
        codigo: codigo,
        ativo: true,
        professores: {
          create: {
            professorId: userId,
            role: "PROFESSOR", // Valor default do Schema
          },
        },
      },
      include: {
        _count: {
          select: { alunos: true },
        },
      },
    });

    // 8. Auditoria de Sucesso
    await registrarLog({
      acao: AuditAction.TURMA_CRIAR,
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Turma: ${novaTurma.id}`,
      detalhes: { 
        codigo: novaTurma.codigo, 
        nome: novaTurma.nome 
      },
    });

    return NextResponse.json(novaTurma, { status: 201 });

  } catch (error) {
    // Log de erro de sistema genérico
    console.error("Erro fatal ao criar turma:", error);
    return safeApiError(error, "Erro interno ao criar a turma.");
  }
}