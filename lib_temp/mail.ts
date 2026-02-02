import nodemailer from 'nodemailer';

// --- SEGURANÇA: FUNÇÃO DE SANITIZAÇÃO (NOVO) ---
// Previne XSS e Injection de HTML nos e-mails (Vulnerabilidade #5 da Auditoria)
function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ✅ Validação de credenciais
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('EMAIL_USER e EMAIL_PASS são obrigatórios em produção');
  }
  console.warn('⚠️ Emails não serão enviados: EMAIL_USER/EMAIL_PASS não configurados');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Definição da URL Base
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// --- Função 1: Boas Vindas ao Professor (Criado pelo Admin) ---
export async function enviarEmailBoasVindas(emailDestino: string, nome: string, senhaTemporaria: string) {
  // Sanitizamos o nome para evitar que caracteres especiais quebrem o HTML ou injetem conteúdo
  const nomeSeguro = escapeHtml(nome);
  const senhaSegura = escapeHtml(senhaTemporaria);

  const htmlContent = `
    <!-- Preheader (texto invisível em muitos clientes de e-mail) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
      Acesso liberado: entre no SimmulaQuiz e comece a montar simulados realmente personalizados.
    </div>

    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#0f172a; max-width:640px; margin:0 auto; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden; background:#ffffff;">
      <div style="background: linear-gradient(90deg, #1d4ed8, #2563eb, #16a34a); padding:22px 24px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.85);">
            SimmulaQuiz • Professor
          </div>
        </div>
        <div style="font-size:22px; font-weight:900; color:#ffffff; line-height:1.15; margin-top:8px;">
          Bem-vindo(a), ${nomeSeguro}!
        </div>
        <div style="font-size:14px; color:rgba(255,255,255,.92); margin-top:6px; line-height:1.5;">
          Seu painel está pronto — agora é só transformar conteúdo em treino <strong>do jeito certo</strong>: simulado com foco, feedback e rastreio de evolução.
        </div>
      </div>

      <div style="padding:26px 24px;">
        <p style="margin:0 0 14px 0; font-size:15px; line-height:1.7; color:#334155;">
          Sua conta de <strong>professor</strong> foi criada pelo administrador. Abaixo estão suas credenciais <strong>provisórias</strong>:
        </p>

        <div style="border:1px solid #e5e7eb; background:#f8fafc; border-radius:16px; padding:16px; margin:18px 0;">
          <div style="font-size:12px; color:#64748b; margin-bottom:10px; text-transform:uppercase; letter-spacing:.06em;">
            Credenciais provisórias
          </div>

          <div style="margin:0 0 10px 0; font-size:14px; color:#0f172a;">
            <strong style="display:inline-block; width:72px; color:#475569;">E-mail</strong>
            <span style="color:#0f172a;">${escapeHtml(emailDestino)}</span>
          </div>

          <div style="margin:0; font-size:14px; color:#0f172a;">
            <strong style="display:inline-block; width:72px; color:#475569;">Senha</strong>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace; background:#ffffff; border:1px solid #e2e8f0; padding:6px 10px; border-radius:12px; display:inline-block;">
              ${senhaSegura}
            </span>
          </div>

          <div style="margin-top:12px; font-size:12px; color:#64748b; line-height:1.55;">
            Por segurança, você será solicitado(a) a <strong>trocar esta senha no primeiro login</strong>.
          </div>
        </div>

        <div style="border:1px solid #e2e8f0; border-radius:16px; padding:14px 16px; margin:18px 0;">
          <div style="font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px;">Primeiros passos</div>
          <div style="font-size:14px; color:#334155; line-height:1.7;">
            <div style="margin:0 0 6px 0;">1) Faça login e atualize sua senha</div>
            <div style="margin:0 0 6px 0;">2) Cadastre/organize questões por Unidade Curricular</div>
            <div style="margin:0;">3) Acompanhe a evolução dos alunos e o desempenho por tema</div>
          </div>
        </div>

        <div style="text-align:center; margin:18px 0 10px 0;">
          <a href="${BASE_URL}/login"
             style="display:inline-block; background:#2563eb; color:#ffffff; padding:12px 18px; text-decoration:none; border-radius:14px; font-weight:800; font-size:14px;">
            Acessar o painel
          </a>
        </div>

        <p style="margin:14px 0 0 0; font-size:12px; color:#64748b; line-height:1.65;">
          Se você não esperava este e-mail, avise o administrador responsável.
        </p>
      </div>

      <div style="background:#f8fafc; padding:14px 18px; border-top:1px solid #e5e7eb; text-align:center;">
        <div style="font-size:12px; color:#94a3b8; line-height:1.6;">
          Mensagem automática do SimmulaQuiz • Não compartilhe suas credenciais.
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: '"Simmula Admin" <no-reply@simmulaquiz.com>',
    to: emailDestino,
    subject: 'Acesso Liberado - Simmula Quiz',
    html: htmlContent,
  });
}

// --- Função 2: Código de Verificação (Registro de Aluno) ---
export async function enviarCodigoVerificacao(emailDestino: string, codigo: string) {
  const codigoSeguro = escapeHtml(codigo);

  const htmlContent = `
    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
      Seu cadastro está quase pronto. Confirme seu e-mail com o código abaixo (expira em 15 minutos).
    </div>

    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#0f172a; max-width:560px; margin:0 auto; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden; background:#ffffff;">
      <div style="background: linear-gradient(90deg, #0f172a, #1d4ed8); padding:20px 22px;">
        <div style="font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.85);">
          Verificação de e-mail • SimmulaQuiz
        </div>
        <div style="font-size:20px; font-weight:900; color:#ffffff; margin-top:6px; line-height:1.2;">
          Falta só um passo ✨
        </div>
        <div style="font-size:13px; color:rgba(255,255,255,.9); margin-top:6px; line-height:1.55;">
          Confirme seu endereço para liberar simulados personalizados, caderno de erros e seu histórico de performance.
        </div>
      </div>

      <div style="padding:24px 22px; text-align:center;">
        <p style="margin:0 0 14px 0; font-size:15px; line-height:1.7; color:#334155;">
          Use o código abaixo para finalizar seu cadastro.
        </p>

        <div style="display:inline-block; background:#f8fafc; border:1px solid #e5e7eb; border-radius:16px; padding:14px 16px; margin:10px 0 6px 0;">
          <div style="font-size:11px; color:#64748b; letter-spacing:.06em; text-transform:uppercase; margin-bottom:8px;">
            Seu código
          </div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace; font-size:28px; font-weight:900; letter-spacing:7px; color:#0f172a;">
            ${codigoSeguro}
          </div>
        </div>

        <p style="margin:10px 0 0 0; font-size:12px; color:#64748b;">
          Expira em <strong>10 minutos</strong>.
        </p>

        <div style="margin-top:16px;">
          <a href="${BASE_URL}/login"
             style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 16px; text-decoration:none; border-radius:14px; font-weight:800; font-size:13px;">
            Abrir o SimmulaQuiz
          </a>
        </div>

        <div style="margin-top:18px; border-top:1px solid #e5e7eb; padding-top:14px;">
          <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.7;">
            Se você não solicitou este cadastro, pode ignorar este e-mail com segurança.
          </p>
        </div>
      </div>

      <div style="background:#f8fafc; padding:14px 18px; border-top:1px solid #e5e7eb; text-align:center;">
        <div style="font-size:12px; color:#94a3b8;">
          © 2026 SimmulaQuiz
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: '"Simmula Quiz" <no-reply@simmulaquiz.com>',
    to: emailDestino,
    subject: 'Seu Código de Verificação: ' + codigoSeguro,
    html: htmlContent,
  });
}

// --- Função 3: Código de Recuperação de Senha ---
export async function enviarCodigoRecuperacao(emailDestino: string, codigo: string) {
  const codigoSeguro = escapeHtml(codigo);

  const htmlContent = `
    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
      Recebemos um pedido para redefinir sua senha. Use o código abaixo (expira em 15 minutos).
    </div>

    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#0f172a; max-width:560px; margin:0 auto; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden; background:#ffffff;">
      <div style="background: linear-gradient(90deg, #0f172a, #1f2937); padding:20px 22px;">
        <div style="font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.85);">
          Segurança • SimmulaQuiz
        </div>
        <div style="font-size:20px; font-weight:900; color:#ffffff; margin-top:6px; line-height:1.2;">
          Recuperação de senha
        </div>
        <div style="font-size:13px; color:rgba(255,255,255,.9); margin-top:6px; line-height:1.55;">
          Use o código abaixo para continuar. Se não foi você, ignore este e-mail.
        </div>
      </div>

      <div style="padding:24px 22px; text-align:center;">
        <p style="margin:0 0 14px 0; font-size:15px; line-height:1.7; color:#334155;">
          Recebemos um pedido para redefinir sua senha no <strong>SimmulaQuiz</strong>.
        </p>

        <div style="display:inline-block; background:#f8fafc; border:1px solid #e5e7eb; border-radius:16px; padding:14px 16px; margin:10px 0 6px 0;">
          <div style="font-size:11px; color:#64748b; letter-spacing:.06em; text-transform:uppercase; margin-bottom:8px;">
            Código de recuperação
          </div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace; font-size:28px; font-weight:900; letter-spacing:7px; color:#0f172a;">
            ${codigoSeguro}
          </div>
        </div>

        <p style="margin:10px 0 0 0; font-size:12px; color:#64748b;">
          Expira em <strong>15 minutos</strong>.
        </p>

        <div style="margin-top:16px;">
          <a href="${BASE_URL}/login"
             style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 16px; text-decoration:none; border-radius:14px; font-weight:800; font-size:13px;">
            Voltar ao SimmulaQuiz
          </a>
        </div>

        <div style="margin-top:18px; border-top:1px solid #e5e7eb; padding-top:14px;">
          <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.7;">
            Dica: se você suspeitar de acesso indevido, redefina sua senha e evite reutilizar senhas antigas.
          </p>
        </div>
      </div>

      <div style="background:#f8fafc; padding:14px 18px; border-top:1px solid #e5e7eb; text-align:center;">
        <div style="font-size:12px; color:#94a3b8; line-height:1.6;">
          © 2026 SimmulaQuiz. Todos os direitos reservados.
        </div>
      </div>
    </div>
  `;

  return transporter.sendMail({
    from: `"Simmula Quiz" <${process.env.EMAIL_USER}>`,
    to: emailDestino,
    subject: 'Redefinição de Senha - Simmula Quiz',
    html: htmlContent,
  });
}

// --- Função 4: Boas-vindas do Aluno (após confirmar o e-mail) ---
export async function enviarEmailBoasVindas_Aluno(emailDestino: string, nome: string) {
  const nomeSeguro = escapeHtml(nome);

  const htmlContent = `
    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
      Conta confirmada! Bora montar seu primeiro simulado personalizado no SimmulaQuiz.
    </div>

    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#0f172a; max-width:640px; margin:0 auto; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden; background:#ffffff;">
      <div style="background: linear-gradient(90deg, #1d4ed8, #2563eb, #16a34a); padding:22px 24px;">
        <div style="font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.85);">
          Conta confirmada • SimmulaQuiz
        </div>
        <div style="font-size:22px; font-weight:900; color:#ffffff; margin-top:8px; line-height:1.15;">
          Bem-vindo(a), ${nomeSeguro} 👋
        </div>
        <div style="font-size:14px; color:rgba(255,255,255,.92); margin-top:6px; line-height:1.55;">
          Aqui o treino é <strong>cirúrgico</strong>: você escolhe as Unidades Curriculares, ajusta dificuldade e recebe feedback na hora.
        </div>
      </div>

      <div style="padding:26px 24px;">
        <div style="border:1px solid #e2e8f0; border-radius:16px; padding:16px; background:#f8fafc;">
          <div style="font-size:12px; color:#64748b; letter-spacing:.06em; text-transform:uppercase; margin-bottom:10px;">Seu diferencial no SimmulaQuiz</div>
          <div style="font-size:14px; color:#334155; line-height:1.75;">
            <div style="margin:0 0 6px 0;">• <strong>Simulados personalizados</strong> por UC (ou múltiplas UCs)</div>
            <div style="margin:0 0 6px 0;">• <strong>Caderno de erros</strong> pra revisar o que realmente trava você</div>
            <div style="margin:0 0 6px 0;">• <strong>Histórico de performance</strong> pra ver evolução de verdade</div>
            <div style="margin:0;">• <strong>Gamificação</strong> com títulos, pontos e conquistas</div>
          </div>
        </div>

        <div style="text-align:center; margin:18px 0 10px 0;">
          <a href="${BASE_URL}/estudante/simulados/novo"
             style="display:inline-block; background:#2563eb; color:#ffffff; padding:12px 18px; text-decoration:none; border-radius:14px; font-weight:900; font-size:14px;">
            Criar meu primeiro simulado
          </a>
        </div>

        <p style="margin:14px 0 0 0; font-size:12px; color:#64748b; line-height:1.7; text-align:center;">
          Dica rápida: escolha 1 UC, faça um simulado curto e já jogue as questões difíceis no seu caderno de erros.
        </p>
      </div>

      <div style="background:#f8fafc; padding:14px 18px; border-top:1px solid #e5e7eb; text-align:center;">
        <div style="font-size:12px; color:#94a3b8; line-height:1.6;">
          Mensagem automática do SimmulaQuiz.
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: '"Simmula Quiz" <no-reply@simmulaquiz.com>',
    to: emailDestino,
    subject: 'Conta confirmada! Bem-vindo(a) ao SimmulaQuiz',
    html: htmlContent,
  });
}

// --- Função 5: Código de Exclusão de Conta (tema vermelho + tentativa de retenção) ---
export async function enviarCodigoExclusaoConta(emailDestino: string, codigo: string, nome: string) {
  const codigoSeguro = escapeHtml(codigo);
  const nomeSeguro = escapeHtml(nome);

  const htmlContent = `
    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
      Confirmação necessária: exclusão de conta. Se não foi você, ignore este e-mail.
    </div>

    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#0f172a; max-width:640px; margin:0 auto; border:1px solid #fee2e2; border-radius:18px; overflow:hidden; background:#ffffff;">
      <div style="background: linear-gradient(90deg, #7f1d1d, #dc2626); padding:22px 24px;">
        <div style="font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.9);">
          Atenção • Exclusão de conta
        </div>
        <div style="font-size:22px; font-weight:900; color:#ffffff; margin-top:8px; line-height:1.15;">
          Tem certeza, ${nomeSeguro}?
        </div>
        <div style="font-size:14px; color:rgba(255,255,255,.92); margin-top:6px; line-height:1.55;">
          A exclusão remove seu histórico de simulados, desempenho e conquistas. Se você só quer “dar um tempo”, talvez seja melhor <strong>pausar</strong> — sem perder progresso.
        </div>
      </div>

      <div style="padding:26px 24px; text-align:center;">
        <p style="margin:0 0 14px 0; font-size:15px; line-height:1.7; color:#334155;">
          Se você realmente solicitou a exclusão, use o código abaixo para confirmar.
        </p>

        <div style="display:inline-block; background:#fff7ed; border:1px solid #fecaca; border-radius:16px; padding:14px 16px; margin:10px 0 6px 0;">
          <div style="font-size:11px; color:#991b1b; letter-spacing:.06em; text-transform:uppercase; margin-bottom:8px;">
            Código de confirmação
          </div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace; font-size:28px; font-weight:900; letter-spacing:7px; color:#7f1d1d;">
            ${codigoSeguro}
          </div>
        </div>

        <p style="margin:10px 0 0 0; font-size:12px; color:#991b1b;">
          Expira em <strong>15 minutos</strong>.
        </p>

        <div style="border:1px solid #e5e7eb; border-radius:16px; padding:14px 16px; margin:18px 0; text-align:left;">
          <div style="font-size:12px; color:#64748b; letter-spacing:.06em; text-transform:uppercase; margin-bottom:10px;">Antes de apagar…</div>
          <div style="font-size:14px; color:#334155; line-height:1.75;">
            <div style="margin:0 0 6px 0;">• Não está rendendo? Faça um simulado curto por UC e revise no caderno de erros.</div>
            <div style="margin:0 0 6px 0;">• Quer privacidade? Você pode trocar e-mail/senha e manter seu progresso.</div>
            <div style="margin:0;">• Precisa de ajuda? Responda este e-mail e a gente tenta resolver antes de você perder tudo.</div>
          </div>
        </div>

        <div style="text-align:center; margin:10px 0 0 0;">
          <a href="${BASE_URL}/login"
             style="display:inline-block; background:#111827; color:#ffffff; padding:10px 16px; text-decoration:none; border-radius:14px; font-weight:900; font-size:13px;">
            Voltar para minha conta
          </a>
        </div>

        <p style="margin:16px 0 0 0; font-size:12px; color:#94a3b8; line-height:1.7;">
          Se você não solicitou a exclusão, ignore este e-mail. Nenhuma alteração será feita.
        </p>
      </div>

      <div style="background:#fef2f2; padding:14px 18px; border-top:1px solid #fecaca; text-align:center;">
        <div style="font-size:12px; color:#991b1b; line-height:1.6;">
          SimmulaQuiz • Segurança e confirmação por e-mail
        </div>
      </div>
    </div>
  `;

  return transporter.sendMail({
    from: `"Simmula Quiz" <${process.env.EMAIL_USER}>`,
    to: emailDestino,
    subject: 'Confirme a exclusão da sua conta - Simmula Quiz',
    html: htmlContent,
  });
}

// --- Função 6: Conquista/Título Desbloqueado ---
export async function enviarEmailConquistaDesbloqueada(
  emailDestino: string,
  nome: string,
  conquista: string,
  raridade: 'Comum' | 'Incomum' | 'Raro' | 'Épico' | 'Lendário',
  pontosGanhos: number,
  pontosTotais: number
) {
  const nomeSeguro = escapeHtml(nome);
  const conquistaSegura = escapeHtml(conquista);
  const raridadeSegura = escapeHtml(raridade);
  const pontosGanhosSeguro = escapeHtml(String(pontosGanhos));
  const pontosTotaisSeguro = escapeHtml(String(pontosTotais));

  const htmlContent = `
    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
      Conquista desbloqueada! Você ganhou +${pontosGanhosSeguro} pontos no SimmulaQuiz.
    </div>

    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#0f172a; max-width:640px; margin:0 auto; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden; background:#ffffff;">
      <div style="background: linear-gradient(90deg, #2563eb, #16a34a); padding:22px 24px;">
        <div style="font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.9);">
          Conquista desbloqueada
        </div>
        <div style="font-size:22px; font-weight:900; color:#ffffff; margin-top:8px; line-height:1.15;">
          Mandou bem, ${nomeSeguro} 🏆
        </div>
        <div style="font-size:14px; color:rgba(255,255,255,.92); margin-top:6px; line-height:1.55;">
          Consistência no treino vira resultado.
        </div>
      </div>

      <div style="padding:26px 24px; text-align:center;">
        <div style="display:inline-block; border:1px solid #e5e7eb; border-radius:16px; padding:16px 16px; background:#f8fafc; text-align:left; width:100%; box-sizing:border-box;">
          <div style="font-size:12px; color:#64748b; letter-spacing:.06em; text-transform:uppercase; margin-bottom:10px;">Detalhes</div>

          <div style="font-size:16px; font-weight:900; color:#0f172a; margin-bottom:6px;">
            ${conquistaSegura}
          </div>

          <div style="font-size:13px; color:#334155; line-height:1.7;">
            <div style="margin:0 0 6px 0;"><strong>Raridade:</strong> ${raridadeSegura}</div>
            <div style="margin:0 0 6px 0;"><strong>Pontos ganhos:</strong> +${pontosGanhosSeguro}</div>
            <div style="margin:0;"><strong>Total acumulado:</strong> ${pontosTotaisSeguro}</div>
          </div>
        </div>

        <div style="text-align:center; margin:18px 0 10px 0;">
          <a href="${BASE_URL}/estudante"
             style="display:inline-block; background:#2563eb; color:#ffffff; padding:12px 18px; text-decoration:none; border-radius:14px; font-weight:900; font-size:14px;">
            Ver meu progresso
          </a>
        </div>

        <p style="margin:14px 0 0 0; font-size:12px; color:#64748b; line-height:1.7;">
          Continue: 1 simulado por dia já muda o jogo.
        </p>
      </div>

      <div style="background:#f8fafc; padding:14px 18px; border-top:1px solid #e5e7eb; text-align:center;">
        <div style="font-size:12px; color:#94a3b8; line-height:1.6;">
          Mensagem automática do SimmulaQuiz.
        </div>
      </div>
    </div>
  `;

  return transporter.sendMail({
    from: `"Simmula Quiz" <${process.env.EMAIL_USER}>`,
    to: emailDestino,
    subject: `Conquista desbloqueada: ${conquistaSegura} (+${pontosGanhosSeguro} pts)`,
    html: htmlContent,
  });
}

// --- Função 7: Simulado CONCLUÍDO (Feedback de Desempenho) ---
export async function enviarEmailSimuladoConcluido(
  emailDestino: string,
  nome: string,
  tituloSimulado: string,
  simuladoId: number,
  resultados: {
    acertos: number;
    total: number;
    xpGanho?: number; // Opcional, se quiser mostrar o XP ganho
    tempo?: string;   // Opcional, ex: "15 min"
  }
) {
  const nomeSeguro = escapeHtml(nome);
  const tituloSeguro = escapeHtml(tituloSimulado);
  const simuladoIdSeguro = escapeHtml(String(simuladoId));
  
  // Cálculos visuais
  const acertos = resultados.acertos;
  const total = resultados.total;
  const erros = total - acertos;
  const percentual = Math.round((acertos / total) * 100);
  
  // Cores dinâmicas baseadas no desempenho (Gamificação Visual)
  let corDestaque = '#2563eb'; // Azul padrão
  let fraseMotivacional = 'O segredo é a constância. Continue treinando!';
  
  if (percentual >= 80) {
    corDestaque = '#16a34a'; // Verde (Excelente)
    fraseMotivacional = 'Desempenho incrível! Você dominou esse conteúdo.';
  } else if (percentual >= 50) {
    corDestaque = '#d97706'; // Amarelo/Laranja (Bom)
    fraseMotivacional = 'Bom trabalho! Agora foque nos pontos de melhoria.';
  } else {
    corDestaque = '#dc2626'; // Vermelho (Precisa melhorar)
    fraseMotivacional = 'Não desanime! O erro de hoje é o acerto de amanhã.';
  }

  const htmlContent = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
      Resultado disponível: Você acertou ${acertos} de ${total} questões. Confira seu desempenho completo.
    </div>

    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#0f172a; max-width:640px; margin:0 auto; border:1px solid #e2e8f0; border-radius:24px; overflow:hidden; background:#ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      
      <div style="background: linear-gradient(135deg, ${corDestaque}, #1e293b); padding:32px 24px; text-align:center;">
        <div style="display:inline-block; background:rgba(255,255,255,0.2); padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#ffffff; margin-bottom:12px;">
          Simulado Concluído
        </div>
        <div style="font-size:24px; font-weight:900; color:#ffffff; margin-bottom:8px; letter-spacing:-0.5px;">
          Mais um treino pra conta, ${nomeSeguro}! 🚀
        </div>
        <div style="font-size:15px; color:rgba(255,255,255,0.9); font-weight:500;">
          "${fraseMotivacional}"
        </div>
      </div>

      <div style="padding:32px 24px;">
        
        <div style="text-align:center; margin-bottom:24px;">
          <h2 style="margin:0; font-size:18px; color:#1e293b; font-weight:800;">${tituloSeguro}</h2>
          <p style="margin:4px 0 0; color:#64748b; font-size:13px;">ID: #${simuladoIdSeguro}</p>
        </div>

        <div style="display:table; width:100%; border-collapse:separate; border-spacing:10px; margin-bottom:24px;">
            <div style="display:table-cell; width:33%; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:16px; padding:16px; text-align:center; vertical-align:middle;">
                <div style="font-size:32px; font-weight:900; color:#16a34a; line-height:1;">${acertos}</div>
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:#15803d; margin-top:4px; letter-spacing:0.5px;">Acertos</div>
            </div>
            
            <div style="display:table-cell; width:33%; background:#fef2f2; border:1px solid #fecaca; border-radius:16px; padding:16px; text-align:center; vertical-align:middle;">
                <div style="font-size:32px; font-weight:900; color:#dc2626; line-height:1;">${erros}</div>
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:#991b1b; margin-top:4px; letter-spacing:0.5px;">Erros</div>
            </div>

            <div style="display:table-cell; width:33%; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:16px; text-align:center; vertical-align:middle;">
                <div style="font-size:32px; font-weight:900; color:#334155; line-height:1;">${percentual}<span style="font-size:16px; vertical-align:super;">%</span></div>
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:#475569; margin-top:4px; letter-spacing:0.5px;">Nota</div>
            </div>
        </div>

        ${resultados.xpGanho ? `
        <div style="background:#fffbeb; border:1px solid #fcd34d; border-radius:12px; padding:12px; text-align:center; margin-bottom:24px;">
            <span style="font-size:14px; font-weight:700; color:#b45309;">🏆 Você ganhou +${resultados.xpGanho} XP com este treino!</span>
        </div>
        ` : ''}

        <div style="text-align:center; margin-bottom:24px;">
          <a href="${BASE_URL}/estudante/simulados/${simuladoIdSeguro}/resultado"
             style="display:inline-block; background:#0f172a; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:12px; font-weight:800; font-size:14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            Revisar Gabarito e Erros
          </a>
        </div>

        <p style="margin:0; font-size:13px; color:#64748b; line-height:1.6; text-align:center; max-width:400px; margin:0 auto;">
          <strong>Dica de Mestre:</strong> Revise as questões que você errou imediatamente. Entender o "porquê" do erro vale mais que o acerto em si.
        </p>

      </div>

      <div style="background:#f8fafc; padding:20px; border-top:1px solid #e2e8f0; text-align:center;">
        <div style="font-size:11px; color:#94a3b8; line-height:1.5;">
          © 2026 SimmulaQuiz • O seu parceiro de aprovação.<br>
          <a href="${BASE_URL}/estudante/dashboard" style="color:#64748b; text-decoration:underline;">Ir para Dashboard</a>
        </div>
      </div>
    </div>
  `;

  return transporter.sendMail({
    from: `"Simmula Quiz" <${process.env.EMAIL_USER}>`,
    to: emailDestino,
    subject: `Resultado do Simulado: ${tituloSeguro} (${percentual}%)`,
    html: htmlContent,
  });
}

// --- Função 8: Alerta de segurança (login/dispositivo novo) ---
export async function enviarAlertaSegurancaLogin(
  emailDestino: string,
  nome: string,
  detalhes: { ip?: string; dispositivo?: string; local?: string; horario?: string }
) {
  const nomeSeguro = escapeHtml(nome);
  const ipSeguro = escapeHtml(detalhes.ip || '—');
  const dispositivoSeguro = escapeHtml(detalhes.dispositivo || '—');
  const localSeguro = escapeHtml(detalhes.local || '—');
  const horarioSeguro = escapeHtml(detalhes.horario || '—');

  const htmlContent = `
    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
      Novo acesso detectado na sua conta SimmulaQuiz.
    </div>

    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#0f172a; max-width:640px; margin:0 auto; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden; background:#ffffff;">
      <div style="background: linear-gradient(90deg, #0f172a, #1f2937); padding:22px 24px;">
        <div style="font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.85);">
          Alerta de segurança
        </div>
        <div style="font-size:22px; font-weight:900; color:#ffffff; margin-top:8px; line-height:1.15;">
          Novo acesso na sua conta, ${nomeSeguro}
        </div>
        <div style="font-size:14px; color:rgba(255,255,255,.9); margin-top:6px; line-height:1.55;">
          Se foi você, pode ignorar. Se não reconhece, troque sua senha o quanto antes.
        </div>
      </div>

      <div style="padding:26px 24px;">
        <div style="border:1px solid #e5e7eb; border-radius:16px; padding:16px; background:#f8fafc;">
          <div style="font-size:12px; color:#64748b; letter-spacing:.06em; text-transform:uppercase; margin-bottom:10px;">Detalhes do acesso</div>
          <div style="font-size:14px; color:#334155; line-height:1.8;">
            <div><strong>Horário:</strong> ${horarioSeguro}</div>
            <div><strong>IP:</strong> ${ipSeguro}</div>
            <div><strong>Dispositivo:</strong> ${dispositivoSeguro}</div>
            <div><strong>Local aproximado:</strong> ${localSeguro}</div>
          </div>
        </div>

        <div style="text-align:center; margin:18px 0 10px 0;">
          <a href="${BASE_URL}/login"
             style="display:inline-block; background:#2563eb; color:#ffffff; padding:12px 18px; text-decoration:none; border-radius:14px; font-weight:900; font-size:14px;">
            Revisar minha conta
          </a>
        </div>

        <p style="margin:14px 0 0 0; font-size:12px; color:#64748b; line-height:1.7; text-align:center;">
          Dica: ative boas práticas (senha forte e única) e não compartilhe códigos de verificação.
        </p>
      </div>

      <div style="background:#f8fafc; padding:14px 18px; border-top:1px solid #e5e7eb; text-align:center;">
        <div style="font-size:12px; color:#94a3b8; line-height:1.6;">
          Mensagem automática do SimmulaQuiz.
        </div>
      </div>
    </div>
  `;

  return transporter.sendMail({
    from: `"Simmula Quiz" <${process.env.EMAIL_USER}>`,
    to: emailDestino,
    subject: 'Alerta de segurança: novo acesso na sua conta',
    html: htmlContent,
  });
}