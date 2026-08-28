import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveFotoUrl,
  extractPerfilPathFromUrl,
} from "@/lib/storage/supabase";
import { getSession, logout, createSession } from "@/lib/auth";
import { enviarCodigoVerificacao, enviarCodigoExclusaoConta } from "@/lib/mail";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { sanitizeObject } from "@/lib/sanitize";
import * as bcrypt from "bcryptjs";
import { csrfRateLimit, authRateLimit, otpRateLimit } from "@/lib/ratelimit"; // ✅ Novos limites importados
import { headers, cookies } from "next/headers";
import { randomInt, timingSafeEqual } from "crypto";
import { verifyCSRFToken } from "@/lib/csrf";

// --- Helpers ---
function getClientIp(h: { get(name: string): string | null }): string {
  const xff = h.get("x-forwarded-for");
  return (
    xff?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "127.0.0.1"
  );
}

function gerarOTP(): string {
  return String(randomInt(100000, 1000000));
}

// Comparação segura contra Timing Attacks
function safeCompare(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

// --- SCHEMA VALIDATION ---
const perfilUpdateSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, "Nome muito curto")
      .max(80, "Nome muito longo")
      .optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("E-mail inválido")
      .max(254)
      .optional(),
    dataNascimento: z.coerce.date().optional(),
    fotoUrl: z
      .preprocess(
        (v) => (v === "" ? null : v),
        z.union([z.string().trim().url().max(2048), z.null()]),
      )
      .optional(),
    codigoEmail: z.string().trim().min(6).max(6).optional(), // OTP fixo em 6 chars
    senhaAtual: z.string().min(1).optional(),
    novaSenha: z.string().min(8).max(72).optional(),
  })
  .superRefine((data, ctx) => {
    const temSenhaAtual =
      typeof data.senhaAtual === "string" && data.senhaAtual.length > 0;
    const temNovaSenha =
      typeof data.novaSenha === "string" && data.novaSenha.length > 0;

    if (temSenhaAtual !== temNovaSenha) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["novaSenha"],
        message: "Para trocar a senha, preencha a senha atual e a nova.",
      });
    }

    if (temSenhaAtual && temNovaSenha && data.senhaAtual === data.novaSenha) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["novaSenha"],
        message: "A nova senha deve ser diferente da atual.",
      });
    }
  });

// --- GET ---
export async function GET() {
  try {
    const sessao = await getSession();
    if (!sessao)
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { id: Number(sessao.sub) },
      select: {
        id: true,
        nome: true,
        email: true,
        dataNascimento: true,
        tipo: true,
        fotoUrl: true,
        ativo: true,
        mudancaSenhaObrigatoria: true,
        emailVerificado: true,
        gamificacao: {
          select: {
            nivel: true,
            pontos: true,
            streakAtual: true,
          },
        },
        conquistas: {
          orderBy: { dataConquista: "desc" },
          select: {
            dataConquista: true,
            conquista: {
              select: { id: true, nome: true, descricao: true, icone: true },
            },
          },
        },
      },
    });

    if (!usuario)
      return NextResponse.json(
        { error: "Usuário inexistente" },
        { status: 404 },
      );

    const fotoAssinada = await resolveFotoUrl(usuario.fotoUrl, 60 * 60);

    // Calcula o título baseando-se nos pontos atuais, em vez da relação do banco
    const tituloReal = await prisma.titulo.findFirst({
      where: { minPontos: { lte: usuario.gamificacao?.pontos ?? 0 } },
      orderBy: { minPontos: "desc" },
      select: { nome: true },
    });
    const nomeTituloAtual = tituloReal?.nome ?? "Iniciante";

    return NextResponse.json({
      perfil: { ...usuario, fotoUrl: fotoAssinada },
      progresso: {
        nivel: usuario.gamificacao?.nivel ?? 1,
        pontos: usuario.gamificacao?.pontos ?? 0,
        titulo: nomeTituloAtual,
        streak: usuario.gamificacao?.streakAtual ?? 0,
      },
      conquistas: usuario.conquistas.map((uc) => ({
        id: uc.conquista.id,
        nome: uc.conquista.nome,
        descricao: uc.conquista.descricao,
        icone: uc.conquista.icone,
        dataConquista: uc.dataConquista,
      })),
    });
  } catch (error) {
    console.error(
      "Erro perfil GET:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// --- PUT ---
export async function PUT(request: Request) {
  try {
    const h = await headers();
    const ip = getClientIp(h);

    const sessao = await getSession();
    if (!sessao)
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    const userId = Number(sessao.sub);

    // 🛡️ 1. CSRF Check
    const csrfHeader = request.headers.get("x-csrf-token");
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) {
      return NextResponse.json(
        { error: "Token de segurança inválido." },
        { status: 403 },
      );
    }

    // 🛡️ 2. Rate Limit Geral (Navegação)
    if (csrfRateLimit) {
      const { success } = await csrfRateLimit.limit(`perfil-upd:${ip}`);
      if (!success)
        return NextResponse.json(
          { error: "Muitas tentativas. Aguarde." },
          { status: 429 },
        );
    }

    const bodyJson = await request.json().catch(() => null);
    if (!bodyJson || typeof bodyJson !== "object") {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    // Sanitização
    const bodyRaw: any = bodyJson;
    const fotoUrlRaw = Object.prototype.hasOwnProperty.call(bodyRaw, "fotoUrl")
      ? bodyRaw.fotoUrl
      : undefined;
    const sanitized: any = sanitizeObject(bodyRaw);
    if (fotoUrlRaw !== undefined) sanitized.fotoUrl = fotoUrlRaw;

    const validacao = perfilUpdateSchema.safeParse(sanitized);
    if (!validacao.success) {
      return NextResponse.json(
        { error: validacao.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 },
      );
    }

    let tokenVersionAtual = sessao.tokenVersion ?? 0;

    // ======================================================
    // 🛡️ BLOCO SENSÍVEL: TROCA DE SENHA
    // ======================================================
    if (validacao.data.senhaAtual && validacao.data.novaSenha) {
      // Rate Limit Estrito para Senhas (5 tentativas/30min)
      if (authRateLimit) {
        const rlPass = await authRateLimit.limit(`pass_chg:${userId}`);
        if (!rlPass.success)
          return NextResponse.json(
            { error: "Muitas tentativas de senha. Aguarde 30 min." },
            { status: 429 },
          );
      }

      const usuarioSenha = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { senhaHash: true },
      });
      if (!usuarioSenha)
        return NextResponse.json(
          { error: "Sessão inválida." },
          { status: 401 },
        );

      const ok = await bcrypt.compare(
        validacao.data.senhaAtual,
        usuarioSenha.senhaHash,
      );
      if (!ok)
        return NextResponse.json(
          { error: "Senha atual incorreta." },
          { status: 400 },
        );

      const novaHash = await bcrypt.hash(validacao.data.novaSenha, 10);
      await prisma.usuario.update({
        where: { id: userId },
        data: {
          senhaHash: novaHash,
          tokenVersion: { increment: 1 },
          mudancaSenhaObrigatoria: false,
        },
      });
      tokenVersionAtual += 1;
      await createSession({ ...sessao, tokenVersion: tokenVersionAtual });
    }

    const dadosParaAtualizar: any = {};
    if (validacao.data.nome !== undefined)
      dadosParaAtualizar.nome = validacao.data.nome;
    if (validacao.data.dataNascimento !== undefined)
      dadosParaAtualizar.dataNascimento = validacao.data.dataNascimento;
    if (validacao.data.fotoUrl !== undefined) {
      const incoming = validacao.data.fotoUrl;
      dadosParaAtualizar.fotoUrl =
        incoming === null
          ? null
          : (extractPerfilPathFromUrl(incoming) ?? incoming);
    }
    if (validacao.data.fotoUrl !== undefined)
      dadosParaAtualizar.fotoUrl = validacao.data.fotoUrl;

    // ======================================================
    // 🛡️ BLOCO SENSÍVEL: TROCA DE E-MAIL
    // ======================================================
    if (validacao.data.email && validacao.data.email !== sessao.email) {
      const novoEmail = validacao.data.email;
      const emailExiste = await prisma.usuario.findUnique({
        where: { email: novoEmail },
        select: { id: true },
      });
      if (emailExiste && emailExiste.id !== userId)
        return NextResponse.json({ error: "E-mail em uso." }, { status: 400 });

      // ETAPA 1: Enviar Código
      if (!validacao.data.codigoEmail) {
        // Usa Rate Limit Geral aqui
        const otp = gerarOTP();
        const expiracao = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.usuario.update({
          where: { id: userId },
          data: { tokenVerificacao: otp, tokenExpiraEm: expiracao },
        });

        await enviarCodigoVerificacao(novoEmail, otp);

        const res = NextResponse.json({
          step: "EMAIL_VERIFICATION_REQUIRED",
          message: `Código enviado para ${novoEmail}`,
        });
        res.cookies.set("pending_email_change", novoEmail, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/api/estudante/perfil",
          maxAge: 600,
        });
        return res;
      }

      // ETAPA 2: Validar Código (Protegido por OTP Rate Limit)
      if (otpRateLimit) {
        const rlOtp = await otpRateLimit.limit(`otp_email:${userId}`);
        if (!rlOtp.success)
          return NextResponse.json(
            { error: "Muitas tentativas de código. Aguarde 10 min." },
            { status: 429 },
          );
      }

      const cookieStore = await cookies();
      const pendingEmail = cookieStore.get("pending_email_change")?.value;
      if (!pendingEmail || pendingEmail !== novoEmail)
        return NextResponse.json(
          { error: "Fluxo inválido. Solicite novo código." },
          { status: 400 },
        );

      const usuarioOTP = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { tokenVerificacao: true, tokenExpiraEm: true },
      });

      const expirou =
        !usuarioOTP?.tokenExpiraEm || new Date() > usuarioOTP.tokenExpiraEm;
      // Comparação Timing Safe
      const codigoOk =
        !expirou &&
        safeCompare(usuarioOTP?.tokenVerificacao, validacao.data.codigoEmail);

      if (!codigoOk)
        return NextResponse.json(
          { error: "Código inválido ou expirado." },
          { status: 400 },
        );

      dadosParaAtualizar.email = novoEmail;
      dadosParaAtualizar.emailVerificado = true;
      dadosParaAtualizar.tokenVerificacao = null;
      dadosParaAtualizar.tokenExpiraEm = null;
    }

    // Executa Update Final
    if (Object.keys(dadosParaAtualizar).length > 0) {
      await prisma.usuario.update({
        where: { id: userId },
        data: dadosParaAtualizar,
      });

      const avatarUrlSessao =
        dadosParaAtualizar.fotoUrl !== undefined
          ? await resolveFotoUrl(dadosParaAtualizar.fotoUrl, 60 * 60 * 24 * 7)
          : sessao.avatarUrl;

      await createSession({
        ...sessao,
        name: dadosParaAtualizar.nome ?? sessao.name,
        email: dadosParaAtualizar.email ?? sessao.email,
        avatarUrl: avatarUrlSessao,
        tokenVersion: tokenVersionAtual,
      });
    }

    if (dadosParaAtualizar.email) {
      const res = NextResponse.json({ success: true });
      res.cookies.set("pending_email_change", "", {
        maxAge: 0,
        path: "/api/estudante/perfil",
      });
      return res;
    }

    await registrarLog({
      acao: AuditAction.USUARIO_ATUALIZAR,
      usuarioId: userId,
      detalhes: { campos: Object.keys(dadosParaAtualizar), ip },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Erro perfil PUT:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// --- DELETE ---
export async function DELETE(request: Request) {
  try {
    const h = await headers();
    const ip = getClientIp(h);
    const sessao = await getSession();
    if (!sessao)
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const userId = Number(sessao.sub);

    // 1. CSRF
    const csrfHeader = request.headers.get("x-csrf-token");
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk)
      return NextResponse.json({ error: "CSRF inválido." }, { status: 403 });

    // 2. Rate Limit
    if (csrfRateLimit) {
      const { success } = await csrfRateLimit.limit(`perfil-del:${ip}`);
      if (!success)
        return NextResponse.json(
          { error: "Muitas tentativas. Aguarde." },
          { status: 429 },
        );
    }

    const body = await request.json().catch(() => ({}));

    // Solicitar Código
    if (!body.codigo) {
      const otp = gerarOTP();
      const expiracao = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.usuario.update({
        where: { id: userId },
        data: { tokenVerificacao: otp, tokenExpiraEm: expiracao },
      });
      await enviarCodigoExclusaoConta(sessao.email, otp, sessao.name);
      return NextResponse.json({
        step: "CONFIRMATION_REQUIRED",
        message: "Código enviado.",
      });
    }

    // Validar Código (Protegido por OTP Rate Limit)
    if (otpRateLimit) {
      const rlOtp = await otpRateLimit.limit(`otp_del:${userId}`);
      if (!rlOtp.success)
        return NextResponse.json(
          { error: "Muitas tentativas. Aguarde 10 min." },
          { status: 429 },
        );
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, tokenVerificacao: true, tokenExpiraEm: true },
    });
    const expirou =
      !usuario?.tokenExpiraEm || new Date() > usuario.tokenExpiraEm;
    // Comparação Timing Safe
    const codigoOk =
      !expirou && safeCompare(usuario?.tokenVerificacao, body.codigo);

    if (!codigoOk)
      return NextResponse.json(
        { error: "Código inválido ou expirado." },
        { status: 400 },
      );

    await registrarLog({
      acao: "USUARIO_EXCLUIR" as any,
      usuarioId: userId,
      detalhes: { ip },
    });

    await prisma.$transaction(async (tx) => {
      await tx.historicoPontos.deleteMany({ where: { usuarioId: userId } });
      await tx.simulado.deleteMany({ where: { usuarioId: userId } });
      await tx.usuarioConquista.deleteMany({ where: { usuarioId: userId } });
      await tx.usuarioGamificacao.deleteMany({ where: { usuarioId: userId } });
      await tx.usuario.delete({ where: { id: userId } });
    });

    await logout();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Erro perfil DELETE:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Erro ao excluir conta." },
      { status: 500 },
    );
  }
}
