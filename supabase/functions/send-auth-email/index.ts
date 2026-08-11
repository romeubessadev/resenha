// ═══════════════════════════════════════════════════════════════════════════
// send-auth-email
//
// Alvo do Send Email Hook da Supabase (Authentication → Hooks). Esse hook
// substitui 100% do envio padrão de e-mail de auth — a partir do momento
// que ele é ligado no dashboard, a Supabase para de mandar e-mail sozinha e
// só chama essa function, esperando que ela mande de verdade (aqui, via
// Resend) e responda 200. Em erro, o formato precisa ser
// `{ error: { http_code, message } }` — senão a Supabase trata como falha
// genérica e bloqueia o fluxo de auth (signup, recovery, etc.).
//
// `signup` e `recovery` usam o mesmo template ilustrado (faixa amarela +
// card + código), só heading/corpo/label/rodapé mudam — brandedCodeEmail()
// monta os dois. Os demais tipos (magiclink, email_change, reauthentication,
// invite) caem num template simples genérico, sem o card. Nenhum reaproveita
// lib/i18n.ts (Deno é outro runtime, sem acesso ao bundle do app) — os
// textos vivem só aqui.
//
// Idioma vem de `user.user_metadata.language` (gravado no signup, ver
// app/(pre-auth)/signup.tsx, e mantido em dia por hooks/useProfile.ts
// quando o usuário troca em Ajustes) — mesmo fallback pra inglês de
// `getDeviceLanguage` em lib/i18n.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { Webhook } from 'npm:standardwebhooks@1.0.0';

type Language = 'pt-BR' | 'en' | 'es';

type EmailActionType = 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' | 'reauthentication';

type HookPayload = {
  user: {
    email: string;
    user_metadata?: { language?: string; name?: string };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL')!;
// O dashboard mostra o secret como "v1,whsec_..." — o prefixo "v1," é só o
// rótulo de versão do esquema de assinatura, a lib standardwebhooks espera
// receber só a parte "whsec_...". Sem isso, `new Webhook(...)` já falha na
// hora de decodificar o secret em base64, antes mesmo de verificar qualquer
// payload — toda chamada real da Supabase cai em "assinatura inválida".
const HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET')!.replace(/^v1,/, '');

// Vem do bucket, e não do bundle: cliente de e-mail não carrega asset local —
// a imagem precisa de uma URL pública. É o mesmo arquivo de assets/, subido
// pro `email-assets`.
//
// Versão ESCURA (ink), não a amarela que o app usa: a faixa do cabeçalho aqui
// é #F5C518, e o logo amarelo em cima dela dava contraste 1,05:1 — sumia.
// Escuro sobre amarelo dá 10,5:1 e mantém a faixa, que é a assinatura da marca.
const LOGO_URL = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/email-assets/logo-resenha-preto.png`;

function normalizeLanguage(input: unknown): Language {
  if (input === 'pt-BR' || input === 'es') return input;
  return 'en';
}

function hookError(httpCode: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Wrapper visual (faixa amarela + card branco) ────────────────────────────

function wrapper(language: Language, title: string, preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#FDF9EE; font-family:Helvetica,Arial,sans-serif; color:#1F2233;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDF9EE; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; max-width:440px;">
          <tr>
            <td align="center" style="background-color:#F5C518; border-radius:20px 20px 0 0; padding:22px 24px 20px;">
              <img src="${LOGO_URL}" alt="Resenha" width="96" height="48" style="display:block; border:0; outline:none; text-decoration:none; height:48px; width:auto;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:#FFFFFF; border:1px solid #F0E7C7; border-top:none; border-radius:0 0 20px 20px; padding:36px 32px 32px; text-align:center;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 16px 0; font-size:13px; color:#8A8FA3;">
              — ${SIGNATURE[language]}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const SIGNATURE: Record<Language, string> = {
  'pt-BR': 'Time Resenha 💛',
  en: 'The Resenha Team 💛',
  es: 'Equipo Resenha 💛',
};

// ── Signup e Recovery (mesmo template ilustrado, textos diferentes) ────────
//
// As duas usam exatamente o mesmo layout (faixa amarela + card + código) —
// só heading/corpo/label/rodapé mudam. Um builder só (brandedCodeEmail)
// evita duplicar o HTML dos dois.

type CodeEmailText = {
  subject: string; title: string; preheader: string;
  heading: string; body: string; codeLabel: string; expiry: string; ignore: string;
};

const SIGNUP_TEXT: Record<Language, CodeEmailText> = {
  'pt-BR': {
    subject: 'Seu código de confirmação Resenha',
    title: 'Seu código Resenha',
    preheader: 'Use este código pra confirmar seu e-mail na Resenha. Ele vale por poucos minutos.',
    heading: 'Bora confirmar seu e-mail',
    body: 'Use o código abaixo pra terminar seu cadastro na Resenha. Não compartilha com ninguém, tá?',
    codeLabel: 'SEU CÓDIGO',
    expiry: 'O código expira em alguns minutos.',
    ignore: 'Se não foi você que pediu, pode ignorar esse e-mail.',
  },
  en: {
    subject: 'Your Resenha confirmation code',
    title: 'Your Resenha code',
    preheader: 'Use this code to confirm your email on Resenha. It expires in a few minutes.',
    heading: "Let's confirm your email",
    body: 'Use the code below to finish signing up on Resenha. Keep it to yourself.',
    codeLabel: 'YOUR CODE',
    expiry: 'This code expires in a few minutes.',
    ignore: "If you didn't request this, you can ignore this email.",
  },
  es: {
    subject: 'Tu código de confirmación de Resenha',
    title: 'Tu código Resenha',
    preheader: 'Usa este código para confirmar tu correo en Resenha. Vence en unos minutos.',
    heading: 'Vamos a confirmar tu correo',
    body: 'Usa el código de abajo para terminar tu registro en Resenha. No lo compartas con nadie.',
    codeLabel: 'TU CÓDIGO',
    expiry: 'El código vence en unos minutos.',
    ignore: 'Si no fuiste tú quien lo pidió, puedes ignorar este correo.',
  },
};

const RECOVERY_TEXT: Record<Language, CodeEmailText> = {
  'pt-BR': {
    subject: 'Seu código pra redefinir a senha',
    title: 'Redefinir senha na Resenha',
    preheader: 'Use este código no app para criar uma nova senha. Ele vale por poucos minutos.',
    heading: 'Redefinir sua senha',
    body: 'Recebemos um pedido para redefinir a senha da sua conta. Use o código abaixo no app para criar uma nova senha.',
    codeLabel: 'CÓDIGO DE RECUPERAÇÃO',
    expiry: 'O código expira em alguns minutos.',
    ignore: 'Se você não solicitou a troca de senha, ignore este e-mail. Sua senha continuará a mesma.',
  },
  en: {
    subject: 'Your password reset code',
    title: 'Reset your Resenha password',
    preheader: 'Use this code in the app to create a new password. It expires in a few minutes.',
    heading: 'Reset your password',
    body: "We received a request to reset your account's password. Use the code below in the app to create a new password.",
    codeLabel: 'RECOVERY CODE',
    expiry: 'This code expires in a few minutes.',
    ignore: "If you didn't request this change, ignore this email — your password will stay the same.",
  },
  es: {
    subject: 'Tu código para restablecer la contraseña',
    title: 'Restablecer contraseña en Resenha',
    preheader: 'Usa este código en la app para crear una contraseña nueva. Vence en unos minutos.',
    heading: 'Restablece tu contraseña',
    body: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa el código de abajo en la app para crear una contraseña nueva.',
    codeLabel: 'CÓDIGO DE RECUPERACIÓN',
    expiry: 'El código vence en unos minutos.',
    ignore: 'Si no solicitaste este cambio, ignora este correo — tu contraseña seguirá igual.',
  },
};

function brandedCodeEmail(text: CodeEmailText, language: Language, token: string): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 10px; font-size:22px; font-weight:700; color:#1F2233; line-height:1.25;">${text.heading}</h1>
    <p style="margin:0 0 26px; font-size:15px; line-height:1.55; color:#5A5F72;">${text.body}</p>
    <div style="font-size:11px; font-weight:700; letter-spacing:2px; color:#8A8FA3; margin-bottom:10px;">${text.codeLabel}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 26px;">
      <tr>
        <td style="background-color:#FFF4C2; border:2px solid #F5C518; border-radius:16px; padding:20px 28px; font-size:36px; font-weight:800; letter-spacing:10px; color:#1F2233; font-family:Helvetica,Arial,sans-serif;">${token}</td>
      </tr>
    </table>
    <p style="margin:0 0 4px; font-size:13px; line-height:1.55; color:#8A8FA3;">${text.expiry}<br />${text.ignore}</p>
  `;
  return { subject: text.subject, html: wrapper(language, text.title, text.preheader, body) };
}

function signupEmail(language: Language, token: string): { subject: string; html: string } {
  return brandedCodeEmail(SIGNUP_TEXT[language], language, token);
}

function recoveryEmail(language: Language, token: string): { subject: string; html: string } {
  return brandedCodeEmail(RECOVERY_TEXT[language], language, token);
}

// ── Outros tipos (template simples, mesmo código) ───────────────────────────

const GENERIC_TEXT: Record<Exclude<EmailActionType, 'signup' | 'recovery'>, Record<Language, { subject: string; heading: string; body: string }>> = {
  magiclink: {
    'pt-BR': { subject: 'Seu código de acesso Resenha', heading: 'Entrar na Resenha', body: 'Use o código abaixo pra entrar na sua conta.' },
    en: { subject: 'Your Resenha sign-in code', heading: 'Sign in to Resenha', body: 'Use the code below to sign in to your account.' },
    es: { subject: 'Tu código de acceso a Resenha', heading: 'Entrar a Resenha', body: 'Usa el código de abajo para entrar a tu cuenta.' },
  },
  email_change: {
    'pt-BR': { subject: 'Confirme seu novo e-mail', heading: 'Confirmar novo e-mail', body: 'Use o código abaixo pra confirmar a troca de e-mail da sua conta Resenha.' },
    en: { subject: 'Confirm your new email', heading: 'Confirm new email', body: 'Use the code below to confirm the email change on your Resenha account.' },
    es: { subject: 'Confirma tu nuevo correo', heading: 'Confirmar nuevo correo', body: 'Usa el código de abajo para confirmar el cambio de correo de tu cuenta Resenha.' },
  },
  reauthentication: {
    'pt-BR': { subject: 'Seu código de confirmação', heading: 'Confirmar que é você', body: 'Use o código abaixo pra confirmar essa ação na sua conta Resenha.' },
    en: { subject: 'Your confirmation code', heading: "Confirm it's you", body: 'Use the code below to confirm this action on your Resenha account.' },
    es: { subject: 'Tu código de confirmación', heading: 'Confirmar que eres tú', body: 'Usa el código de abajo para confirmar esta acción en tu cuenta Resenha.' },
  },
  invite: {
    'pt-BR': { subject: 'Você foi convidado pra Resenha', heading: 'Bem-vindo à Resenha', body: 'Use o código abaixo pra ativar seu convite.' },
    en: { subject: "You've been invited to Resenha", heading: 'Welcome to Resenha', body: 'Use the code below to activate your invite.' },
    es: { subject: 'Te invitaron a Resenha', heading: 'Bienvenido a Resenha', body: 'Usa el código de abajo para activar tu invitación.' },
  },
};

function genericEmail(actionType: Exclude<EmailActionType, 'signup' | 'recovery'>, language: Language, token: string): { subject: string; html: string } {
  const g = GENERIC_TEXT[actionType][language];
  const body = `
    <h1 style="margin:0 0 10px; font-size:22px; font-weight:700; color:#1F2233; line-height:1.25;">${g.heading}</h1>
    <p style="margin:0 0 22px; font-size:15px; line-height:1.55; color:#5A5F72;">${g.body}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
      <tr>
        <td style="background-color:#FFF4C2; border:2px solid #F5C518; border-radius:16px; padding:16px 24px; font-size:28px; font-weight:800; letter-spacing:8px; color:#1F2233; font-family:Helvetica,Arial,sans-serif;">${token}</td>
      </tr>
    </table>
  `;
  return { subject: g.subject, html: wrapper(language, 'Resenha', g.subject, body) };
}

function buildEmail(actionType: string, language: Language, token: string): { subject: string; html: string } {
  if (actionType === 'signup') return signupEmail(language, token);
  if (actionType === 'recovery') return recoveryEmail(language, token);
  if (actionType in GENERIC_TEXT) return genericEmail(actionType as Exclude<EmailActionType, 'signup' | 'recovery'>, language, token);
  // Tipo desconhecido (nova versão da API, etc.) — cai num texto genérico em vez de falhar o envio.
  return genericEmail('reauthentication', language, token);
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async req => {
  const body = await req.text();
  const headers = Object.fromEntries(req.headers);

  let payload: HookPayload;
  try {
    const wh = new Webhook(HOOK_SECRET);
    payload = wh.verify(body, headers) as HookPayload;
  } catch {
    return hookError(401, 'invalid webhook signature');
  }

  const { user, email_data } = payload;
  const language = normalizeLanguage(user.user_metadata?.language);
  const { subject, html } = buildEmail(email_data.email_action_type, language, email_data.token);

  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: user.email, subject, html }),
  });

  if (!sendRes.ok) {
    const text = await sendRes.text();
    return hookError(500, `resend error: ${text}`);
  }

  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
