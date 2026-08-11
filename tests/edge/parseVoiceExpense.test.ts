// A maior function do projeto: recebe áudio, transcreve e extrai uma despesa.
//
// Dois motivos pra ela ser a mais importante de segurar:
//
//   · é AQUI que o limite premium é imposto de verdade (o client só esconde o
//     botão), e o CLAUDE.md é explícito que limite conferido no client é
//     burlável;
//   · quase toda a aritmética foi TIRADA da IA de propósito — data relativa,
//     soma de duração e divisão de parcela são determinísticas em código,
//     porque o modelo erra conta encadeada. Se essa lógica regredir, o erro
//     volta pra dentro de uma resposta que parece plausível.
import { describe, it, expect } from 'vitest';
import { loadEdgeFunction } from './harness';

const EU = 'ana';
const BRUNO = 'bruno';
const GRUPO = 'g1';

const HOJE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

/** Desloca dias a partir de hoje no fuso de São Paulo, no mesmo formato ISO. */
function diasDeHoje(delta: number): string {
  const [y, m, d] = HOJE.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const membros = (over: Record<string, unknown>[] | null = null) => over ?? [
  { group_id: GRUPO, user_id: EU, archived_at: null, profiles: { name: 'Ana' } },
  { group_id: GRUPO, user_id: BRUNO, archived_at: null, profiles: { name: 'Bruno' } },
];

type Extraido = Record<string, unknown>;

/** Estuba as duas idas à OpenAI: a transcrição e a extração. */
const openai = (transcript: string, extraido: Extraido) => (url: string) => {
  if (url.includes('/audio/transcriptions')) return { json: { text: transcript } };
  return { json: { choices: [{ message: { content: JSON.stringify(extraido) } }] } };
};

const load = (opts: {
  premium?: boolean;
  session?: boolean;
  membros?: Record<string, unknown>[] | null;
  transcript?: string;
  extraido?: Extraido;
  openaiKey?: string | null;
} = {}) =>
  loadEdgeFunction(
    'parse-voice-expense',
    () => import('@/supabase/functions/parse-voice-expense/index.ts'),
    {
      env: opts.openaiKey === null ? {} : { OPENAI_API_KEY: opts.openaiKey ?? 'sk-teste' },
      supabase: {
        session: opts.session === false ? null : { user: { id: EU } },
        tables: {
          profiles: [{ id: EU, is_premium: opts.premium !== false }],
          group_members: membros(opts.membros),
        },
      },
      fetchResponse: openai(opts.transcript ?? 'cinquenta reais de uber ontem', opts.extraido ?? {}),
    },
  );

/** O POST que o app faz: áudio cru no corpo, grupo no header. */
const pedido = (audio = new Uint8Array([1, 2, 3]), headers: Record<string, string> = {}) =>
  new Request('https://edge.local/fn', {
    method: 'POST',
    headers: { Authorization: 'Bearer token-do-usuario', 'x-group-id': GRUPO, ...headers },
    body: audio,
  });

describe('quem pode usar', () => {
  it('sem Authorization, 401 — e a OpenAI nem é chamada', async () => {
    const fn = await load();
    const res = await fn.call(new Request('https://edge.local/fn', {
      method: 'POST', headers: { 'x-group-id': GRUPO }, body: new Uint8Array([1]),
    }));

    expect(res.status).toBe(401);
    expect(fn.fetchCalls).toHaveLength(0);
  });

  it('sem x-group-id, 400', async () => {
    const fn = await load();
    const res = await fn.call(new Request('https://edge.local/fn', {
      method: 'POST', headers: { Authorization: 'Bearer t' }, body: new Uint8Array([1]),
    }));

    expect(res.status).toBe(400);
  });

  it('token que não resolve usuário, 401', async () => {
    const fn = await load({ session: false });
    const res = await fn.call(pedido());

    expect(res.status).toBe(401);
    expect(fn.fetchCalls).toHaveLength(0);
  });

  it('NÃO premium é barrado no servidor com 403', async () => {
    // O client só esconde o botão; o limite de verdade é este. Sem ele, quem
    // chamasse a function na mão teria a ditada de graça.
    const fn = await load({ premium: false });
    const res = await fn.call(pedido());

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'premium_required' });
    expect(fn.fetchCalls).toHaveLength(0);
  });

  it('quem não é do rolê recebe 404 — a RLS não devolve membro nenhum', async () => {
    const fn = await load({ membros: [] });
    const res = await fn.call(pedido());

    expect(res.status).toBe(404);
    expect(fn.fetchCalls).toHaveLength(0);
  });
});

describe('pré-condições da chamada', () => {
  it('áudio vazio é 400, não uma ida à OpenAI', async () => {
    const fn = await load();
    const res = await fn.call(pedido(new Uint8Array([])));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'empty_audio' });
    expect(fn.fetchCalls).toHaveLength(0);
  });

  it('sem chave da OpenAI, 500 explícito', async () => {
    const fn = await load({ openaiKey: null });
    const res = await fn.call(pedido());

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'server_misconfigured' });
  });

  it('transcrição vazia vira 422 — não adianta extrair de silêncio', async () => {
    const fn = await load({ transcript: '   ' });
    const res = await fn.call(pedido());

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'empty_transcript' });
  });
});

describe('a despesa extraída', () => {
  it('devolve título, valor e categoria', async () => {
    const fn = await load({
      transcript: 'cinquenta reais de uber',
      extraido: { title: 'Uber', amount: 50, categoryKey: 'transporte' },
    });
    const res = await fn.call(pedido());

    expect(await res.json()).toMatchObject({
      transcript: 'cinquenta reais de uber',
      title: 'Uber',
      amount: 50,
      category: { id: 'transporte' },
    });
  });

  it('categoria inventada pela IA cai em "outros"', async () => {
    const fn = await load({ extraido: { title: 'X', amount: 10, categoryKey: 'viagem-espacial' } });
    const res = await fn.call(pedido());

    expect((await res.json()).category).toEqual({ id: 'outros' });
  });

  it('valor arredonda pra centavo', async () => {
    const fn = await load({ extraido: { title: 'X', amount: 10.987 } });
    expect((await (await fn.call(pedido())).json()).amount).toBe(10.99);
  });

  it('quem pagou vira EU quando a IA devolve id que não é do rolê', async () => {
    const fn = await load({ extraido: { title: 'X', amount: 10, paidById: 'nao-existe' } });
    expect((await (await fn.call(pedido())).json()).paidById).toBe(EU);
  });

  it('participante que não é do rolê é descartado', async () => {
    const fn = await load({
      extraido: { title: 'X', amount: 10, participantIds: [EU, 'intruso', BRUNO] },
    });
    expect((await (await fn.call(pedido())).json()).participantIds).toEqual([EU, BRUNO]);
  });

  it('quem ARQUIVOU o rolê não é oferecido à IA', async () => {
    // Arquivar exige estar quite; incluir a pessoa numa despesa nova a deixaria
    // devendo de novo sem ela saber.
    const fn = await load({
      membros: [
        { group_id: GRUPO, user_id: EU, archived_at: null, profiles: { name: 'Ana' } },
        { group_id: GRUPO, user_id: BRUNO, archived_at: '2026-01-01', profiles: { name: 'Bruno' } },
      ],
      extraido: { title: 'X', amount: 10, participantIds: [EU, BRUNO] },
    });
    const res = await fn.call(pedido());

    expect((await res.json()).participantIds).toEqual([EU]);
    const prompt = JSON.stringify(fn.fetchCalls.find(c => c.url.includes('chat/completions'))?.body);
    expect(prompt).not.toContain(BRUNO);
  });
});

describe('a aritmética que NÃO é da IA', () => {
  it('"ontem" na fala ganha da data que a IA calculou', async () => {
    // A IA erra conta de data com frequência; o cálculo daqui não erra.
    const fn = await load({
      transcript: 'gastei cinquenta no mercado ontem',
      extraido: { title: 'Mercado', amount: 50, date: '2020-01-01' },
    });
    const res = await fn.call(pedido());

    expect((await res.json()).date).toBe(diasDeHoje(-1));
  });

  it('"anteontem" volta dois dias', async () => {
    const fn = await load({ transcript: 'pizza anteontem', extraido: { title: 'Pizza', amount: 40 } });
    expect((await (await fn.call(pedido())).json()).date).toBe(diasDeHoje(-2));
  });

  it('sem termo relativo, vale a data da IA', async () => {
    const fn = await load({
      transcript: 'almoço no dia dez de março',
      extraido: { title: 'Almoço', amount: 30, date: '2026-03-10' },
    });
    expect((await (await fn.call(pedido())).json()).date).toBe('2026-03-10');
  });

  it('data com sobra (horário junto) ainda é aceita pelo prefixo', async () => {
    // Antes exigia formato exato, e qualquer variação virava null → "hoje".
    const fn = await load({
      transcript: 'almoço',
      extraido: { title: 'Almoço', amount: 30, date: '2026-03-10T12:00:00Z' },
    });
    expect((await (await fn.call(pedido())).json()).date).toBe('2026-03-10');
  });

  it('parcelamento divide o total em código e monta uma série mensal', async () => {
    // 3× de R$300 = R$100 por parcela, e a série dura 2 meses além da semente
    // (a própria já é a parcela 1).
    const fn = await load({
      transcript: 'comprei uma bike em três vezes',
      extraido: {
        title: 'Bike', amount: 300, date: '2026-03-10',
        installmentCount: 3, installmentTotalAmount: 300,
      },
    });
    const res = await fn.call(pedido());
    const body = await res.json();

    expect(body.amount).toBe(100);
    expect(body.recurrence).toEqual({
      freq: 'monthly', intervalDays: null, startDate: null, endDate: '2026-05-10',
    });
  });

  it('"por 10 dias" fecha a janela nas duas pontas, sem ocorrência sobrando', async () => {
    // A semente já é o dia 1, então a partir de 31/07 termina em 09/08.
    const fn = await load({
      transcript: 'café todo dia',
      extraido: {
        title: 'Café', amount: 8, date: '2026-07-31',
        recurrence: { freq: 'daily', durationValue: 10, durationUnit: 'days' },
      },
    });
    const body = await (await fn.call(pedido())).json();

    expect(body.recurrence).toMatchObject({ freq: 'daily', endDate: '2026-08-09' });
  });

  it('recorrência com freq inválida é descartada em vez de virar lixo', async () => {
    const fn = await load({
      extraido: { title: 'X', amount: 10, recurrence: { freq: 'quinzenalmente' } },
    });
    expect((await (await fn.call(pedido())).json()).recurrence).toBeNull();
  });

  it('freq "custom" sem intervalo é descartada — não dá pra repetir sem cadência', async () => {
    const fn = await load({ extraido: { title: 'X', amount: 10, recurrence: { freq: 'custom' } } });
    expect((await (await fn.call(pedido())).json()).recurrence).toBeNull();
  });
});

describe('divisão', () => {
  it('por partes preenche todo mundo, com 1 como padrão', async () => {
    const fn = await load({
      extraido: { title: 'X', amount: 30, splitType: 'shares', shares: { [EU]: 2 } },
    });
    expect((await (await fn.call(pedido())).json()).shares).toEqual({ [EU]: 2, [BRUNO]: 1 });
  });

  it('valores exatos ignoram id que não é do rolê', async () => {
    const fn = await load({
      extraido: {
        title: 'X', amount: 30, splitType: 'exact',
        exactAmounts: { [EU]: 10, [BRUNO]: 20, intruso: 999 },
      },
    });
    expect((await (await fn.call(pedido())).json()).exactAmounts).toEqual({ [EU]: 10, [BRUNO]: 20 });
  });

  it('sem valor declarado, o total vem da soma dos exatos', async () => {
    const fn = await load({
      extraido: { title: 'X', splitType: 'exact', exactAmounts: { [EU]: 10.5, [BRUNO]: 20.25 } },
    });
    expect((await (await fn.call(pedido())).json()).amount).toBe(30.75);
  });

  it('tipo de divisão desconhecido cai em igual', async () => {
    const fn = await load({ extraido: { title: 'X', amount: 10, splitType: 'aleatorio' } });
    expect((await (await fn.call(pedido())).json()).splitType).toBe('equal');
  });
});

describe('falha da IA', () => {
  it('JSON ilegível não derruba — devolve despesa vazia pra pessoa corrigir', async () => {
    const fn = await loadEdgeFunction(
      'parse-voice-expense',
      () => import('@/supabase/functions/parse-voice-expense/index.ts'),
      {
        env: { OPENAI_API_KEY: 'sk-teste' },
        supabase: {
          session: { user: { id: EU } },
          tables: { profiles: [{ id: EU, is_premium: true }], group_members: membros() },
        },
        fetchResponse: (url: string) => url.includes('/audio/transcriptions')
          ? { json: { text: 'algo' } }
          : { json: { choices: [{ message: { content: 'isso não é json' } }] } },
      },
    );
    const res = await fn.call(pedido());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: '', amount: 0, category: { id: 'outros' } });
  });

  it('OpenAI fora do ar vira 500, não resposta pela metade', async () => {
    const fn = await loadEdgeFunction(
      'parse-voice-expense',
      () => import('@/supabase/functions/parse-voice-expense/index.ts'),
      {
        env: { OPENAI_API_KEY: 'sk-teste' },
        supabase: {
          session: { user: { id: EU } },
          tables: { profiles: [{ id: EU, is_premium: true }], group_members: membros() },
        },
        fetchResponse: { status: 503, json: { error: 'indisponível' } },
      },
    );
    const res = await fn.call(pedido());

    expect(res.status).toBe(500);
  });
});
