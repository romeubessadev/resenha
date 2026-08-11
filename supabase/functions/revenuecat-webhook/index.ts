// ═══════════════════════════════════════════════════════════════════════════
// revenuecat-webhook
//
// Alvo do webhook do RevenueCat (Project settings → Integrations → Webhooks).
// Só esta function pode escrever profiles.is_premium/premium_since — o
// banco revogou o UPDATE dessas colunas do role authenticated,
// então "virar Bros+" só acontece de verdade por aqui.
//
// PREPARADA, AINDA NÃO LIGADA: falta (1) instalar o SDK client e chamar
// Purchases.configure/logIn com o uuid do Supabase como app_user_id — é
// esse id que o RevenueCat devolve em app_user_id, e é por ele que
// encontramos a linha certa em profiles — e (2) configurar a URL desta
// function + o secret REVENUECAT_WEBHOOK_SECRET no dashboard RevenueCat.
// Até lá, ninguém vira premium de verdade — só via SQL manual, pra teste.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Eventos que significam "entitlement ativo agora" — vira/renova premium.
const ACTIVE_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE',
]);
// Só EXPIRATION significa "acesso realmente acabou". CANCELLATION (desligou
// auto-renovação) e BILLING_ISSUE (falha de cobrança) não revogam na hora —
// o RevenueCat ainda considera o entitlement ativo até a data de expiração
// de verdade, que chega depois como EXPIRATION.
const INACTIVE_EVENT_TYPES = new Set(['EXPIRATION']);

type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  purchased_at_ms?: number;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async req => {
  try {
    // RevenueCat autentica o webhook com um header Authorization fixo (valor
    // configurado em Project settings → Webhooks) — comparação simples,
    // não é assinatura HMAC (diferente do send-auth-email, que usa
    // standardwebhooks pro Send Email Hook da Supabase).
    const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
      return json({ error: 'unauthorized' }, 401);
    }

    const body = await req.json().catch(() => null);
    const event = body?.event as RevenueCatEvent | undefined;
    if (!event?.app_user_id || !event.type) return json({ error: 'invalid_payload' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    if (ACTIVE_EVENT_TYPES.has(event.type)) {
      const premiumSince = event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : new Date().toISOString();
      const { error } = await admin
        .from('profiles')
        .update({ is_premium: true, premium_since: premiumSince })
        .eq('id', event.app_user_id);
      if (error) throw error;
    } else if (INACTIVE_EVENT_TYPES.has(event.type)) {
      const { error } = await admin.from('profiles').update({ is_premium: false }).eq('id', event.app_user_id);
      if (error) throw error;
    }
    // Outros tipos (TRANSFER, SUBSCRIPTION_PAUSED, TEST, etc.) são ignorados
    // por enquanto — não mudam o estado premium.

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'internal_error' }, 500);
  }
});
