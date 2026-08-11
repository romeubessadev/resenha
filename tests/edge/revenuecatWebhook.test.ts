// A function que concede e revoga o Bros+.
//
// É o único caminho que escreve `profiles.is_premium`: a 0032 revogou o UPDATE
// dessas colunas do role `authenticated`, então virar premium só acontece aqui.
// O que mais importa nestes testes não é conceder — é NÃO revogar por engano.
import { describe, it, expect } from 'vitest';
import { loadEdgeFunction, postJson, type LoadedEdge } from './harness';

const SECRET = 'segredo-do-revenuecat';
const USER = 'user-uuid';

const load = (supabase = {}) =>
  loadEdgeFunction(
    'revenuecat-webhook',
    () => import('@/supabase/functions/revenuecat-webhook/index.ts'),
    { env: { REVENUECAT_WEBHOOK_SECRET: SECRET }, supabase },
  );

const evento = (type: string, extra: Record<string, unknown> = {}) =>
  postJson(
    { event: { type, app_user_id: USER, ...extra } },
    { Authorization: `Bearer ${SECRET}` },
  );

/** O UPDATE que a function fez em `profiles`, se fez algum. */
const updateDePerfil = (fn: LoadedEdge) => fn.mock.of('update').filter(c => c.table === 'profiles');

describe('autenticação do webhook', () => {
  it('sem Authorization, 401 — e nada é escrito', async () => {
    const fn = await load();
    const res = await fn.call(postJson({ event: { type: 'INITIAL_PURCHASE', app_user_id: USER } }));

    expect(res.status).toBe(401);
    expect(updateDePerfil(fn)).toHaveLength(0);
  });

  it('com segredo ERRADO, 401', async () => {
    const fn = await load();
    const res = await fn.call(postJson(
      { event: { type: 'INITIAL_PURCHASE', app_user_id: USER } },
      { Authorization: 'Bearer chute' },
    ));

    expect(res.status).toBe(401);
    expect(updateDePerfil(fn)).toHaveLength(0);
  });

  it('sem o segredo CONFIGURADO no ambiente, ninguém entra', async () => {
    // Sem esta guarda, um deploy sem a variável aceitaria `Bearer undefined`.
    const fn = await loadEdgeFunction(
      'revenuecat-webhook',
      () => import('@/supabase/functions/revenuecat-webhook/index.ts'),
      { env: {} },
    );
    const res = await fn.call(postJson(
      { event: { type: 'INITIAL_PURCHASE', app_user_id: USER } },
      { Authorization: 'Bearer undefined' },
    ));

    expect(res.status).toBe(401);
  });
});

describe('payload', () => {
  it('evento sem app_user_id é 400', async () => {
    const fn = await load();
    const res = await fn.call(postJson({ event: { type: 'RENEWAL' } }, { Authorization: `Bearer ${SECRET}` }));

    expect(res.status).toBe(400);
    expect(updateDePerfil(fn)).toHaveLength(0);
  });

  it('corpo que não é JSON é 400, não 500', async () => {
    const fn = await load();
    const res = await fn.call(new Request('https://edge.local/fn', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}` },
      body: 'não sou json',
    }));

    expect(res.status).toBe(400);
  });
});

describe('eventos que CONCEDEM premium', () => {
  const concedem = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE'];

  it.each(concedem)('%s liga is_premium', async type => {
    const fn = await load({ tables: { profiles: [{ id: USER, is_premium: false }] } });
    const res = await fn.call(evento(type));

    expect(res.status).toBe(200);
    const upd = updateDePerfil(fn);
    expect(upd).toHaveLength(1);
    expect(upd[0].values).toMatchObject({ is_premium: true });
    expect(upd[0].filters).toEqual([{ op: 'eq', column: 'id', value: USER }]);
  });

  it('premium_since vem da data da COMPRA quando ela veio no evento', async () => {
    const fn = await load({ tables: { profiles: [{ id: USER }] } });
    await fn.call(evento('INITIAL_PURCHASE', { purchased_at_ms: Date.UTC(2026, 2, 10, 12, 0, 0) }));

    expect(updateDePerfil(fn)[0].values).toMatchObject({ premium_since: '2026-03-10T12:00:00.000Z' });
  });

  it('sem a data da compra, grava agora em vez de deixar nulo', async () => {
    const fn = await load({ tables: { profiles: [{ id: USER }] } });
    await fn.call(evento('RENEWAL'));

    const since = updateDePerfil(fn)[0].values.premium_since;
    expect(typeof since).toBe('string');
    expect(Number.isNaN(Date.parse(String(since)))).toBe(false);
  });
});

describe('eventos que REVOGAM — e os que não revogam', () => {
  it('EXPIRATION desliga o premium', async () => {
    const fn = await load({ tables: { profiles: [{ id: USER, is_premium: true }] } });
    const res = await fn.call(evento('EXPIRATION'));

    expect(res.status).toBe(200);
    expect(updateDePerfil(fn)[0].values).toEqual({ is_premium: false });
  });

  it('EXPIRATION não mexe em premium_since — a data da compra é histórico', async () => {
    const fn = await load({ tables: { profiles: [{ id: USER, is_premium: true }] } });
    await fn.call(evento('EXPIRATION'));

    expect(updateDePerfil(fn)[0].values).not.toHaveProperty('premium_since');
  });

  it('CANCELLATION NÃO revoga — o acesso vale até expirar de fato', async () => {
    // Desligar a auto-renovação não é perder o acesso. Revogar aqui tiraria o
    // Bros+ de quem ainda pagou pelo mês corrente; a revogação chega depois,
    // como EXPIRATION.
    const fn = await load({ tables: { profiles: [{ id: USER, is_premium: true }] } });
    const res = await fn.call(evento('CANCELLATION'));

    expect(res.status).toBe(200);
    expect(updateDePerfil(fn)).toHaveLength(0);
  });

  it('BILLING_ISSUE NÃO revoga — falha de cobrança tem período de graça', async () => {
    const fn = await load({ tables: { profiles: [{ id: USER, is_premium: true }] } });
    const res = await fn.call(evento('BILLING_ISSUE'));

    expect(res.status).toBe(200);
    expect(updateDePerfil(fn)).toHaveLength(0);
  });

  it.each(['TRANSFER', 'SUBSCRIPTION_PAUSED', 'TEST'])('%s é ignorado sem erro', async type => {
    const fn = await load({ tables: { profiles: [{ id: USER }] } });
    const res = await fn.call(evento(type));

    expect(res.status).toBe(200);
    expect(updateDePerfil(fn)).toHaveLength(0);
  });
});

describe('falha do banco', () => {
  it('erro ao gravar vira 500 — o RevenueCat precisa reenviar', async () => {
    // Devolver 200 com a escrita falhada faria o RevenueCat considerar
    // entregue, e a pessoa pagaria sem receber o premium.
    const fn = await load({
      tables: { profiles: [{ id: USER }] },
      fail: { 'profiles:update': 'permissão negada' },
    });
    const res = await fn.call(evento('INITIAL_PURCHASE'));

    expect(res.status).toBe(500);
  });
});
