import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import * as bcrypt from 'bcryptjs';
import { enviarEmailBoasVindas } from '@/lib/mail';
import { z } from 'zod';
import { registrarLog, AuditAction } from '@/lib/audit';
import { sanitizeObject } from '@/lib/sanitize'; 
import { randomBytes } from 'crypto'; 
import { csrfRateLimit } from '@/lib/ratelimit';
import { headers } from 'next/headers';
import { verifyCSRFToken } from '@/lib/csrf';
import { Prisma } from '@prisma/client'; // Importante para SQL Dinâmico

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- SCHEMAS DE VALIDAÇÃO (ZOD) ---
const usuarioCreateSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  tipo: z.enum(['ALUNO', 'PROFESSOR', 'SUPER_ADMIN']), 
  senhaInicial: z.string().min(10, 'A senha inicial deve ter no mínimo 10 caracteres'),
  dataNascimento: z.string().optional()
});

const usuarioUpdateSchema = z.object({
  id: z.number(),
  nome: z.string().min(3).optional(),
  email: z.string().email().optional(),
  tipo: z.enum(['ALUNO', 'PROFESSOR', 'SUPER_ADMIN']).optional(),
  ativo: z.boolean().optional(),
  resetarSenha: z.boolean().optional()
});

// --- LISTAR USUÁRIOS (GET PAGINADO) ---
export async function GET(req: NextRequest) {
  const session: any = await getSession();
  
  // 1. RBAC (Apenas Super Admin)
  if (session?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Proibido' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  
  // Parâmetros de Paginação e Busca
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') ?? '20'))); // Max 100
  const search = searchParams.get('search') ?? '';
  const offset = (page - 1) * limit;
  
  try {
    // Construção segura do WHERE com Prisma.sql (evita SQL Injection)
    const searchTerm = `%${search}%`;
    const whereClause = search 
      ? Prisma.sql`WHERE (u.nome ILIKE ${searchTerm} OR u.email ILIKE ${searchTerm})` 
      : Prisma.sql``;

    // 2. Query de Dados (Com Paginação)
    const usuarios = await prisma.$queryRaw`
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.tipo,
        u.ativo,
        u."ultimoLogin",
        u."mudancaSenhaObrigatoria",
        (SELECT COUNT(*)::int FROM "Simulado" s WHERE s."usuarioId" = u.id) as "totalSimulados",
        COALESCE(
          (SELECT COUNT(*)::int 
           FROM "SimuladosQuestao" sq 
           JOIN "Simulado" s ON sq."simuladoId" = s.id 
           WHERE s."usuarioId" = u.id 
           AND sq."alternativaMarcada" IS NOT NULL), 
        0) as "totalQuestoesRespondidas"
      FROM "Usuario" u
      ${whereClause}
      ORDER BY u.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // 3. Query de Contagem (Total para calcular páginas)
    const totalResult = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int as count FROM "Usuario" u ${whereClause}
    `;
    const total = Number(totalResult[0]?.count || 0);

    return NextResponse.json({
      data: usuarios,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Erro em admin/usuarios:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro interno ao buscar usuários.' }, { status: 500 });
  }
}

// --- CRIAR USUÁRIO (POST) ---
export async function POST(request: Request) {
  try {
    const session: any = await getSession();
    if (session?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Proibido' }, { status: 403 });

    // 🛡️ 1. CSRF
    const csrfHeader = request.headers.get('x-csrf-token');
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        usuarioNome: session.name,
        detalhes: { erro: 'CSRF create user', rota: '/api/admin/usuarios' }
      });
      return NextResponse.json({ error: 'Token de segurança inválido. Recarregue a página.' }, { status: 403 });
    }

    // 🛡️ 2. RATE LIMITING
    if (csrfRateLimit) {
        const ip = (await headers()).get("x-forwarded-for") ?? "127.0.0.1";
        const { success } = await csrfRateLimit.limit(`admin-user-create:${ip}`);
        if (!success) return NextResponse.json({ error: "Muitas criações. Aguarde." }, { status: 429 });
    }

    const bodyRaw = await request.json();
    const body = sanitizeObject(bodyRaw);
    const validacao = usuarioCreateSchema.safeParse(body);

    if (!validacao.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: validacao.error.flatten().fieldErrors }, { status: 400 });
    }

    const { nome, email, tipo, senhaInicial } = validacao.data;

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) return NextResponse.json({ error: 'E-mail já cadastrado.' }, { status: 400 });

    const senhaHash = await bcrypt.hash(senhaInicial, 10);

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        tipo,
        senhaHash,
        mudancaSenhaObrigatoria: true,
        ativo: true,
        emailVerificado: true,
        dataNascimento: new Date('2000-01-01') // Data placeholder
      }
    });

    // 📝 LOG
    await registrarLog({
      acao: AuditAction.USUARIO_CRIAR,
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Usuario:${novoUsuario.id}`,
      detalhes: { nome, email, tipo }
    });

    try {
      await enviarEmailBoasVindas(email, nome, senhaInicial);
    } catch (e) {
      console.error("Erro em admin/usuarios:", e instanceof Error ? e.message : String(e));
    }

    return NextResponse.json(novoUsuario);

  } catch (error) {
    console.error("Erro em admin/usuarios:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro ao criar usuário.' }, { status: 500 });
  }
}

// --- ATUALIZAR USUÁRIO (PUT) ---
export async function PUT(request: Request) {
  try {
    const session: any = await getSession();
    if (session?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Proibido' }, { status: 403 });

    // 🛡️ CSRF
    const csrfHeader = request.headers.get('x-csrf-token');
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) return NextResponse.json({ error: 'Token de segurança inválido.' }, { status: 403 });

    const bodyRaw = await request.json();
    const body = sanitizeObject(bodyRaw);
    const validacao = usuarioUpdateSchema.safeParse(body);

    if (!validacao.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });

    const { id, nome, email, tipo, ativo, resetarSenha } = validacao.data;

    const usuarioAtual = await prisma.usuario.findUnique({ where: { id } });
    if (!usuarioAtual) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    const dadosAtualizacao: any = {};
    if (nome) dadosAtualizacao.nome = nome;
    
    let emailMudou = false;
    if (email && email !== usuarioAtual.email) {
      const emailEmUso = await prisma.usuario.findUnique({ where: { email } });
      if (emailEmUso) return NextResponse.json({ error: 'E-mail já em uso.' }, { status: 400 });
      dadosAtualizacao.email = email;
      emailMudou = true;
    }

    if (tipo) dadosAtualizacao.tipo = tipo;
    if (typeof ativo === 'boolean') dadosAtualizacao.ativo = ativo;

    let senhaTemporaria = '';
    if (resetarSenha) {
      const randomPart = randomBytes(8).toString('hex');
      senhaTemporaria = `Reset@${randomPart}`;
      dadosAtualizacao.senhaHash = await bcrypt.hash(senhaTemporaria, 10);
      dadosAtualizacao.mudancaSenhaObrigatoria = true;
      dadosAtualizacao.tokenVersion = { increment: 1 };
    }

    await prisma.usuario.update({ where: { id }, data: dadosAtualizacao });

    await registrarLog({
      acao: AuditAction.USUARIO_ATUALIZAR,
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Usuario:${id}`,
      detalhes: { alteracoes: Object.keys(dadosAtualizacao), resetSenha: !!resetarSenha }
    });

    if (senhaTemporaria) {
      try {
        await enviarEmailBoasVindas(email || usuarioAtual.email, nome || usuarioAtual.nome, senhaTemporaria);
      } catch (e) {
        console.error("Erro em admin/usuarios:", e instanceof Error ? e.message : String(e));
      }
    }

    return NextResponse.json({ success: true, message: emailMudou ? 'Dados e E-mail atualizados.' : 'Dados atualizados.' });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar.' }, { status: 500 });
  }
}

// --- DELETAR USUÁRIO (DELETE) ---
export async function DELETE(request: Request) {
  try {
    const session: any = await getSession();
    if (session?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Proibido' }, { status: 403 });

    const csrfHeader = request.headers.get('x-csrf-token');
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) return NextResponse.json({ error: 'Token de segurança inválido.' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));

    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    if (id === Number(session.sub)) return NextResponse.json({ error: 'Auto-exclusão não permitida.' }, { status: 400 });

    const usuarioAlvo = await prisma.usuario.findUnique({ where: { id }, select: { tipo: true, email: true } });
    if (!usuarioAlvo) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    if (usuarioAlvo.tipo === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Não é possível excluir outro Super Admin.' }, { status: 403 });
    }
    
    await prisma.$transaction(async (tx) => {
        await tx.simulado.deleteMany({ where: { usuarioId: id } });
        await tx.usuarioConquista.deleteMany({ where: { usuarioId: id } }); 
        await tx.usuarioGamificacao.deleteMany({ where: { usuarioId: id } });
        await tx.usuario.delete({ where: { id } });
    });

    await registrarLog({
      acao: AuditAction.USUARIO_EXCLUIR,
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Usuario:${id}`,
      detalhes: { alvo: usuarioAlvo.email }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir usuário.' }, { status: 500 });
  }
}