import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { verifyCSRFToken } from "@/lib/csrf"; 
import { registrarLog, AuditAction } from "@/lib/audit";

const respostaSchema = z.object({
  simuladoId: z.number().int().positive(),
  questaoId: z.number().int().positive(),
  alternativa: z.enum(["A", "B", "C", "D", "E"]),
  tempoGasto: z.number().int().min(0).optional().default(0),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    // 3. Validação do Body
    const body = await req.json();
    const validation = respostaSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { simuladoId, questaoId, alternativa, tempoGasto } = validation.data;
    const alunoId = Number(session.sub);

    // 4. SEGURANÇA: Verificação de Propriedade e Estado
    const simulado = await prisma.simulado.findUnique({
      where: { id: simuladoId },
      select: { 
        usuarioId: true, 
        status: true 
      }
    });

    if (!simulado) {
      return NextResponse.json({ error: "Simulado não encontrado" }, { status: 404 });
    }

    // Anti-IDOR
    if (simulado.usuarioId !== alunoId) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_VIOLACAO,
        usuarioId: alunoId,
        usuarioNome: session.name,
        recurso: `Simulado: ${simuladoId}`,
        detalhes: { motivo: "Tentativa de IDOR em resposta" }
      });
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // Integridade
    if (simulado.status !== "EM_ANDAMENTO") {
      return NextResponse.json({ error: "Este simulado já foi finalizado." }, { status: 403 });
    }

    // 5. Atualiza a Resposta
    // Usamos updateMany para garantir compatibilidade se a chave composta não estiver explícita no tipo
    await prisma.simuladosQuestao.updateMany({
      where: {
        simuladoId: simuladoId,
        questaoId: questaoId
      },
      data: {
        alternativaMarcada: alternativa,
        // Incrementa o tempo se o front enviar, útil para analytics depois
        tempoResposta: { increment: tempoGasto } 
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao salvar resposta." }, { status: 500 });
  }
}