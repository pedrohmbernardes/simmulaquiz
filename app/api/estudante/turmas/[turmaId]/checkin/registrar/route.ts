import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf";
import { registrarLog, AuditAction } from "@/lib/audit";
import { checkinRateLimit } from "@/lib/ratelimit";

const registrarCheckinSchema = z.object({
  codigo: z.string().trim().toUpperCase().min(4).max(6),
  gpsLat: z.number().optional().nullable(),
  gpsLong: z.number().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. CSRF
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const alunoId = Number(session.sub);

    // 3. Rate Limit
    const ip = await getClientIp(req);
    const rateKey = `checkin_attempt:${turmaId}:${alunoId}`;
    
    const { success } = await checkinRateLimit.limit(rateKey); 
    if (!success) return NextResponse.json({ error: "Muitas tentativas. Aguarde." }, { status: 429 });

    // 4. Validação Body
    const body = await req.json();
    const validation = registrarCheckinSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Código inválido." }, { status: 400 });
    }

    const { codigo, gpsLat, gpsLong } = validation.data;

    // 5. Validação de Acesso à Turma
    const matricula = await prisma.turmaAluno.findUnique({
      where: { turmaId_alunoId: { turmaId: turmaIdInt, alunoId: alunoId } },
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Você não é membro ativo desta turma." }, { status: 403 });
    }

    // 6. Busca Sessão Ativa (BLINDAGEM TEMPORAL)
    // Filtramos a data direto no banco. Se expirou, retorna null (igual a código errado).
    const agora = new Date();
    
    const sessao = await prisma.sessaoCheckIn.findFirst({
      where: {
        turmaId: turmaIdInt,
        codigo: codigo,
        ativo: true,
        // Garante que está DENTRO da janela. Se estiver fora, não encontra.
        abertoEm: { lte: agora },
        fechaEm: { gte: agora }
      }
    });

    if (!sessao) {
      // Log de falha para auditoria (pode ser código errado ou tempo expirado - indistinguível para o user)
      await registrarLog({
        acao: AuditAction.SEGURANCA_VIOLACAO,
        usuarioId: alunoId,
        recurso: `Checkin Falho`,
        detalhes: { codigoTentado: codigo, turmaId: turmaIdInt }
      });
      
      // Delay artificial
      await new Promise(r => setTimeout(r, 500));
      
      return NextResponse.json({ error: "Código inválido ou sessão encerrada." }, { status: 400 });
    }

    // 7. Verificação de Duplicidade
    const jaRegistrado = await prisma.checkInRegistro.findUnique({
      where: {
        sessaoId_alunoId: {
          sessaoId: sessao.id,
          alunoId: alunoId
        }
      }
    });

    if (jaRegistrado) {
      return NextResponse.json({ 
        error: "Você já confirmou presença nesta sessão.",
        tipo: "DUPLICADO" 
      }, { status: 409 });
    }

    // 8. Cria o Registro
    await prisma.checkInRegistro.create({
      data: {
        sessaoId: sessao.id,
        turmaId: turmaIdInt,
        alunoId: alunoId,
        realizadoEm: agora,
        ip: ip || "unknown",
        gpsLat: gpsLat || null,
        gpsLong: gpsLong || null,
      }
    });

    // 9. Auditoria de Sucesso
    await registrarLog({
      acao: AuditAction.CHECKIN_REGISTRAR,
      usuarioId: alunoId,
      usuarioNome: session.name,
      recurso: `Checkin: ${sessao.id}`,
      detalhes: { gps: gpsLat && gpsLong ? "SIM" : "NAO" }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Presença registrada com sucesso!" 
    }, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao registrar presença.");
  }
}