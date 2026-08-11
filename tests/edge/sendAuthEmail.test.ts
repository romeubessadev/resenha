// O e-mail transacional de cadastro e recuperação de senha.
//
// É o único caminho pelo qual alguém entra na conta pela primeira vez ou volta
// pra ela — se quebrar, a pessoa não tem contorno dentro do app. E quebra em
// silêncio: quem não recebe o e-mail não gera erro em lugar nenhum.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadEdgeFunction } from './harness';
import { configurarWebhook, resetWebhook, ultimoSegredo } from '../stubs/standardwebhooks';

const ENV = {
  RESEND_API_KEY: 're_teste',
  RESEND_FROM_EMAIL: 'BROS <ola@bros.app>',
  // Como o dashboard da Supabase entrega: com o rótulo de versão na frente.
  SEND_EMAIL_HOOK_SECRET: 'v1,whsec_abc123',
  SUPABASE_URL: 'https://mock.supabase.co',
};

const payload = (over: Record<string, unknown> = {}) => ({
  user: { email: 'ana@bros.app', user_metadata: { language: 'pt-BR', name: 'Ana' } },
  email_data: {
    token: '123456', token_hash: 'h', redirect_to: 'bros://', site_url: 'https://bros.app',
    email_action_type: 'signup',
  },
  ...over,
});

const load = (opts: { recusar?: boolean; payload?: unknown; resendStatus?: number } = {}) => {
  configurarWebhook({ recusar: opts.recusar, payload: opts.payload ?? payload() });
  return loadEdgeFunction(
    'send-auth-email',
    () => import('@/supabase/functions/send-auth-email/index.ts'),
    { env: ENV, fetchResponse: { status: opts.resendStatus ?? 200, json: { id: 'email_1' } } },
  );
};

const pedido = () => new Request('https://edge.local/fn', {
  method: 'POST',
  headers: { 'webhook-id': 'x', 'webhook-signature': 'y', 'webhook-timestamp': '1' },
  body: JSON.stringify(payload()),
});

/** O corpo que foi pra API da Resend. */
const enviado = (fn: Awaited<ReturnType<typeof load>>) =>
  fn.fetchCalls.find(c => c.url.includes('resend.com'))?.body as
    { from: string; to: string; subject: string; html: string } | undefined;

beforeEach(() => resetWebhook());

describe('assinatura do webhook', () => {
  it('o prefixo "v1," do segredo é removido antes de construir o Webhook', async () => {
    // O dashboard mostra "v1,whsec_…", mas a lib espera só "whsec_…". Sem
    // tirar, `new Webhook()` estoura ao decodificar o base64 e TODA chamada
    // real da Supabase cai em "assinatura inválida" — nenhum e-mail sai.
    const fn = await load();
    await fn.call(pedido());

    expect(ultimoSegredo).toBe('whsec_abc123');
  });

  it('assinatura inválida vira 401 e NÃO manda e-mail', async () => {
    const fn = await load({ recusar: true });
    const res = await fn.call(pedido());

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { http_code: 401 } });
    expect(fn.fetchCalls).toHaveLength(0);
  });
});

describe('o e-mail que sai', () => {
  it('vai pro endereço da pessoa, com o remetente configurado', async () => {
    const fn = await load();
    await fn.call(pedido());

    expect(enviado(fn)).toMatchObject({ to: 'ana@bros.app', from: 'BROS <ola@bros.app>' });
  });

  it('carrega o código de verificação no corpo', async () => {
    const fn = await load();
    await fn.call(pedido());

    expect(enviado(fn)!.html).toContain('123456');
  });

  it('o código abre o ASSUNTO — dá pra ler sem abrir o e-mail', async () => {
    // A prévia da notificação corta o texto, então o começo é a única parte
    // garantida. É também o formato que os detectores de código do iOS e do
    // Android procuram.
    const fn = await load();
    await fn.call(pedido());

    expect(enviado(fn)!.subject.startsWith('123456')).toBe(true);
  });

  it('o assunto de recuperação também abre com o código', async () => {
    const fn = await load({
      payload: payload({
        email_data: { token: '654321', token_hash: 'h', redirect_to: '', site_url: '', email_action_type: 'recovery' },
      }),
    });
    await fn.call(pedido());

    expect(enviado(fn)!.subject.startsWith('654321')).toBe(true);
  });

  it('cadastro e recuperação têm assuntos DIFERENTES', async () => {
    const cadastro = await load({ payload: payload() });
    await cadastro.call(pedido());
    const a = enviado(cadastro)!.subject;

    const recuperacao = await load({
      payload: payload({
        email_data: { token: '654321', token_hash: 'h', redirect_to: '', site_url: '', email_action_type: 'recovery' },
      }),
    });
    await recuperacao.call(pedido());
    const b = enviado(recuperacao)!.subject;

    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
  });

  it('tipo de ação DESCONHECIDO ainda manda e-mail, em texto genérico', async () => {
    // Versão nova da API não pode impedir a pessoa de entrar na conta.
    const fn = await load({
      payload: payload({
        email_data: { token: '999', token_hash: 'h', redirect_to: '', site_url: '', email_action_type: 'coisa_nova' },
      }),
    });
    const res = await fn.call(pedido());

    expect(res.status).toBe(200);
    expect(enviado(fn)!.html).toContain('999');
  });
});

describe('idioma do destinatário', () => {
  const comIdioma = (language: unknown) => payload({
    user: { email: 'x@y.z', user_metadata: { language } },
  });

  it('pt-BR e es são respeitados', async () => {
    const pt = await load({ payload: comIdioma('pt-BR') });
    await pt.call(pedido());
    const es = await load({ payload: comIdioma('es') });
    await es.call(pedido());

    expect(enviado(pt)!.subject).not.toBe(enviado(es)!.subject);
  });

  it('idioma ausente ou desconhecido cai no inglês, não quebra', async () => {
    const semIdioma = await load({ payload: comIdioma(undefined) });
    await semIdioma.call(pedido());
    const ingles = await load({ payload: comIdioma('en') });
    await ingles.call(pedido());

    expect(enviado(semIdioma)!.subject).toBe(enviado(ingles)!.subject);

    const marciano = await load({ payload: comIdioma('tlh') });
    await marciano.call(pedido());
    expect(enviado(marciano)!.subject).toBe(enviado(ingles)!.subject);
  });
});

describe('falha do provedor', () => {
  it('Resend fora do ar vira 500 — a Supabase precisa saber que não saiu', async () => {
    // Devolver 200 faria o hook considerar entregue, e a pessoa ficaria
    // esperando um e-mail que nunca chegou.
    const fn = await load({ resendStatus: 500 });
    const res = await fn.call(pedido());

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: { http_code: 500 } });
  });

  it('entrega bem-sucedida devolve 200 com corpo vazio', async () => {
    const fn = await load();
    const res = await fn.call(pedido());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });
});
