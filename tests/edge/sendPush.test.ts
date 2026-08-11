// A function que entrega o push. Chamada por send_push_event (0068/0069) via
// pg_net, uma vez por destinatário.
//
// O caminho é todo "melhor não enviar do que enviar errado": quase toda saída
// é um `skipped` silencioso. Isso a torna fácil de quebrar sem ninguém notar —
// um push que não chega não deixa rastro na tela de ninguém.
import { describe, it, expect } from 'vitest';
import { loadEdgeFunction, postJson, type LoadedEdge } from './harness';

const EU = 'destinatario';
const OUTRO = 'ator';
const GRUPO = 'g1';

const tabelas = (over: Record<string, Record<string, unknown>[]> = {}) => ({
  profiles: [
    { id: EU, language: 'pt-BR', name: 'Ana' },
    { id: OUTRO, language: 'pt-BR', name: 'Bruno' },
  ],
  push_tokens: [{ user_id: EU, token: 'ExponentPushToken[aaa]' }],
  groups: [{ id: GRUPO, name: 'Viagem' }],
  expenses: [],
  ...over,
});

const load = (supabase: Record<string, unknown> = {}, fetchResponse?: { json?: unknown }) =>
  loadEdgeFunction(
    'send-push',
    () => import('@/supabase/functions/send-push/index.ts'),
    { supabase: { tables: tabelas(), ...supabase }, fetchResponse },
  );

const evento = (over: Record<string, unknown> = {}) =>
  postJson({
    recipientId: EU,
    actorId: OUTRO,
    kind: 'member_joined',
    groupId: GRUPO,
    metadata: {},
    ...over,
  });

/** A mensagem que foi pra API da Expo. */
const mensagemEnviada = (fn: LoadedEdge) => {
  const chamada = fn.fetchCalls.find(c => c.url.includes('exp.host'));
  return (chamada?.body as { title: string; body: string; data: unknown }[] | undefined)?.[0];
};

describe('payload e pré-condições', () => {
  it('sem recipientId ou kind, 400', async () => {
    const fn = await load();
    expect((await fn.call(postJson({ kind: 'member_joined' }))).status).toBe(400);
    expect((await fn.call(postJson({ recipientId: EU }))).status).toBe(400);
  });

  it('destinatário que não existe: não envia', async () => {
    const fn = await load();
    const res = await fn.call(evento({ recipientId: 'fantasma' }));

    expect(await res.json()).toMatchObject({ skipped: true, reason: 'recipient_not_found' });
    expect(fn.fetchCalls).toHaveLength(0);
  });

  it('sem token de push cadastrado: não envia', async () => {
    const fn = await load({ tables: tabelas({ push_tokens: [] }) });
    const res = await fn.call(evento());

    expect(await res.json()).toMatchObject({ skipped: true, reason: 'no_token' });
    expect(fn.fetchCalls).toHaveLength(0);
  });

  it('kind desconhecido: não inventa texto', async () => {
    const fn = await load();
    const res = await fn.call(evento({ kind: 'coisa_que_nao_existe' }));

    expect(await res.json()).toMatchObject({ skipped: true, reason: 'unknown_kind' });
    expect(fn.fetchCalls).toHaveLength(0);
  });
});

describe('o texto que chega no aparelho', () => {
  it('leva o nome da resenha — não uma frase pela metade', async () => {
    // Foi o que quebrou: a function pedia `groups.currency`, coluna dropada
    // pela 0099. O SELECT inteiro falhava, o erro era descartado e TODO push
    // saía sem o nome ("Nova despesa em ", "Você virou admin do ").
    const fn = await load();
    await fn.call(evento({ kind: 'member_joined' }));

    expect(mensagemEnviada(fn)).toMatchObject({ title: 'Bruno entrou na resenha', body: 'Viagem' });
  });

  it('não pede nenhuma coluna que o schema não tem mais', async () => {
    // Guarda direta contra a regressão acima: `groups` só tem `name` a oferecer
    // aqui. Pedir coluna inexistente derruba o SELECT inteiro, não só o campo.
    const fn = await load();
    await fn.call(evento());

    const select = fn.mock.of('select').find(c => c.table === 'groups')!;
    expect(select.columns).toBe('name');
  });

  it('idioma fora dos conhecidos cai no padrão em vez de sumir com o push', async () => {
    // `profiles.language` nasce de metadata do cadastro e não tem CHECK (0029).
    // Um valor inesperado fazia buildPushText devolver undefined, e o push era
    // descartado como 'unknown_kind' — a pessoa parava de receber, sem sinal.
    const fn = await load({
      tables: tabelas({ profiles: [{ id: EU, language: 'tlh', name: 'Ana' }, { id: OUTRO, name: 'Bruno' }] }),
    });
    const res = await fn.call(evento());

    expect(await res.json()).toMatchObject({ ok: true });
    expect(mensagemEnviada(fn)?.title).toBe('Bruno entrou na resenha');
  });

  it('ator desconhecido vira "Alguém", não vazio', async () => {
    const fn = await load({ tables: tabelas({ profiles: [{ id: EU, language: 'pt-BR' }] }) });
    await fn.call(evento());

    expect(mensagemEnviada(fn)?.title).toBe('Alguém entrou na resenha');
  });

  it('o push carrega o destino do toque', async () => {
    const fn = await load();
    await fn.call(evento({ kind: 'settle_paid_wait_confirm', metadata: { amount: 50 } }));

    expect(mensagemEnviada(fn)?.data).toEqual({
      route: '/(app)/grupo/[id]', params: { id: GRUPO, action: 'settle' },
    });
  });

  it('lembrete de saldo aberto aponta pra Carteira, não pra resenha', async () => {
    const fn = await load();
    await fn.call(evento({ kind: 'reminder_open_balance', metadata: { role: 'creditor', balance: 80 } }));

    expect(mensagemEnviada(fn)?.data).toEqual({ route: '/(app)/(tabs)/carteira' });
  });
});

describe('token morto', () => {
  it('DeviceNotRegistered apaga o token, pra não insistir pra sempre', async () => {
    const fn = await load(
      { tables: tabelas({ push_tokens: [{ user_id: EU, token: 'morto' }] }) },
      { json: { data: [{ details: { error: 'DeviceNotRegistered' } }] } },
    );
    await fn.call(evento());

    const del = fn.mock.of('delete').filter(c => c.table === 'push_tokens');
    expect(del).toHaveLength(1);
    expect(del[0].filters).toEqual([{ op: 'in', column: 'token', value: ['morto'] }]);
  });

  it('entrega normal não apaga token nenhum', async () => {
    const fn = await load({}, { json: { data: [{ status: 'ok' }] } });
    await fn.call(evento());

    expect(fn.mock.of('delete')).toHaveLength(0);
  });

  it('resposta ilegível da Expo não derruba a function', async () => {
    const fn = await load({}, { json: null });
    const res = await fn.call(evento());

    expect(res.status).toBe(200);
    expect(fn.mock.of('delete')).toHaveLength(0);
  });
});
