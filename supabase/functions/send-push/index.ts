// ═══════════════════════════════════════════════════════════════════════════
// send-push
//
// Chamada por send_push_event via pg_net, uma vez por
// destinatário. Busca idioma + token(s) de push da pessoa, monta o texto no
// idioma dela (text.ts) e manda pra API de push da Expo. Sem SDK — a API da
// Expo é só um POST simples (https://exp.host/--/api/v2/push/send).
//
// Autenticação: mesmo padrão de refresh-fx-rates — a anon key já embutida
// no bundle público do app passa no gateway das functions; quem escreve
// (limpeza de token morto) usa a service role, não essa chave.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildPushText, type Language, type PushMeta } from './text.ts';

/** Os idiomas que `text.ts` sabe montar. Fora deles, cai no padrão. */
const LANGUAGES: Language[] = ['pt-BR', 'en', 'es'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EventBody = {
  recipientId: string;
  actorId: string | null;
  kind: string;
  groupId: string | null;
  metadata: Record<string, unknown>;
};

type PushRoute = { route: string; params?: Record<string, string> };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

// Mesmo contrato de deep link já usado no app (ex.: action=settle em
// grupo/[id].tsx) — o client (hooks/usePushToken.ts) transforma isso num
// router.push.
function buildRoute(kind: string, groupId: string | null): PushRoute {
  switch (kind) {
    case 'settle_paid_wait_confirm':
    case 'proof_attached':
      return { route: '/(app)/grupo/[id]', params: { id: groupId ?? '', action: 'settle' } };
    case 'settle_confirmed':
      return { route: '/(app)/grupo/[id]', params: { id: groupId ?? '' } };
    case 'reminder_open_balance':
      return { route: '/(app)/(tabs)/carteira' };
    case 'member_joined':
    case 'member_left':
    case 'admin_granted':
    case 'admin_revoked':
      return { route: '/(app)/grupo/participantes', params: { groupId: groupId ?? '' } };
    default:
      return { route: '/(app)/grupo/[id]', params: { id: groupId ?? '' } };
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const body = (await req.json().catch(() => null)) as EventBody | null;
    if (!body?.recipientId || !body.kind) return json({ error: 'invalid_payload' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: recipient } = await admin
      .from('profiles').select('language').eq('id', body.recipientId).maybeSingle();
    if (!recipient) return json({ skipped: true, reason: 'recipient_not_found' });

    const { data: tokenRows } = await admin
      .from('push_tokens').select('token').eq('user_id', body.recipientId);
    const tokens = (tokenRows ?? []).map(t => t.token);
    if (tokens.length === 0) return json({ skipped: true, reason: 'no_token' });

    let actorName: string | null = null;
    if (body.actorId) {
      const { data: actor } = await admin.from('profiles').select('name').eq('id', body.actorId).maybeSingle();
      actorName = actor?.name ?? null;
    }

    // Moeda única desde que `groups.currency` foi dropada. Constante, e não
    // lida da resenha: esta função continuou pedindo a coluna depois do drop, o
    // SELECT inteiro passou a falhar por 'column groups.currency does not
    // exist' e — como só o `data` era desestruturado — o erro sumia. Resultado:
    // `group` vinha null e TODO push saía sem o nome da resenha ("Nova despesa
    // em ", "Você virou admin do ").
    const groupCurrency = 'BRL';

    let groupName: string | null = null;
    if (body.groupId) {
      const { data: group, error: groupErr } = await admin
        .from('groups').select('name').eq('id', body.groupId).maybeSingle();
      // O erro não pode mais passar calado — foi o silêncio que segurou o bug
      // acima em pé.
      if (groupErr) console.error('[send-push] falha ao ler a resenha:', groupErr);
      groupName = group?.name ?? null;
    }

    let payerName: string | null = null;
    if (body.kind === 'expense_you_owe' && typeof body.metadata?.expenseId === 'string') {
      const { data: expense } = await admin.from('expenses').select('paid_by').eq('id', body.metadata.expenseId).maybeSingle();
      if (expense?.paid_by) {
        const { data: payer } = await admin.from('profiles').select('name').eq('id', expense.paid_by).maybeSingle();
        payerName = payer?.name ?? null;
      }
    }

    // Valida em vez de só afirmar o tipo: `profiles.language` nasce de
    // `raw_user_meta_data ->> 'language'` no cadastro e não tem CHECK,
    // então pode guardar qualquer texto. Um valor fora dos três fazia
    // buildPushText devolver undefined, e o push era descartado em silêncio
    // como 'unknown_kind' — a pessoa simplesmente parava de receber aviso.
    const language: Language = LANGUAGES.includes(recipient.language as Language)
      ? (recipient.language as Language)
      : 'pt-BR';
    const meta: PushMeta = { ...(body.metadata as PushMeta), actorName, groupName, payerName, groupCurrency };
    const text = buildPushText(body.kind, language, meta);
    if (!text) return json({ skipped: true, reason: 'unknown_kind' });

    const route = buildRoute(body.kind, body.groupId);

    const messages = tokens.map(to => ({
      to, title: text.title, body: text.body, data: route, sound: 'default',
    }));

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const pushJson = await pushRes.json().catch(() => null);

    const tickets = Array.isArray(pushJson?.data) ? pushJson.data : [];
    const deadTokens = tickets
      .map((ticket: { details?: { error?: string } }, i: number) =>
        (ticket?.details?.error === 'DeviceNotRegistered' ? tokens[i] : null))
      .filter((t: string | null): t is string => !!t);
    if (deadTokens.length > 0) {
      await admin.from('push_tokens').delete().in('token', deadTokens);
    }

    return json({ ok: true, sent: tokens.length });
  } catch (err) {
    console.error(err);
    return json({ error: 'internal_error' }, 500);
  }
});
