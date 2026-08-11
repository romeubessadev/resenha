// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createHarness, waitFor, type Harness } from '../support/hookHarness';
import { useGroups } from '@/hooks/useGroups';

const ME = 'me';
const OUTRO = 'outro';
const G = 'g1';

type Row = Record<string, unknown>;

/**
 * Uma resenha com duas pessoas. `expenses` e `events` são os dois lados da conta de
 * recência: despesa é hard delete, então a lista de despesas VIVAS sozinha anda
 * pra trás quando a mais recente é apagada — e é o evento que segura.
 */
function scenario(opts: {
  groupCreatedAt: string;
  expenses?: { id: string; created_at: string; amount?: number }[];
  payments?: { created_at: string; amount?: number }[];
  lastEventAt?: string | null;
  groups?: Row[];
}) {
  const expenses = (opts.expenses ?? []).map(e => ({
    id: e.id, group_id: G, amount: e.amount ?? 60, paid_by: ME,
    split_type: 'equal', created_at: e.created_at,
  }));
  return {
    session: { user: { id: ME } },
    tables: {
      group_members: [
        { group_id: G, user_id: ME, archived_at: null },
        { group_id: G, user_id: OUTRO, archived_at: null },
      ],
      groups: opts.groups ?? [{ id: G, name: 'Praia', avatar_key: null, avatar_path: null, created_at: opts.groupCreatedAt }],
      profiles: [
        { id: ME, name: 'Eu', avatar_path: null },
        { id: OUTRO, name: 'Bruno', avatar_path: null },
      ],
      expenses,
      expense_participants: expenses.flatMap(e => [
        { expense_id: e.id, user_id: ME, shares: null, exact_amount: null },
        { expense_id: e.id, user_id: OUTRO, shares: null, exact_amount: null },
      ]),
      payments: (opts.payments ?? []).map(p => ({
        group_id: G, from_user: OUTRO, to_user: ME, amount: p.amount ?? 30, created_at: p.created_at,
      })),
    },
    rpc: {
      group_last_activity: () => ({
        data: opts.lastEventAt ? [{ gid: G, last_at: opts.lastEventAt }] : [],
      }),
    },
  };
}

let h: Harness;
afterEach(() => h?.dispose());

const load = async (config: Parameters<typeof createHarness>[0]) => {
  h = createHarness(config);
  const { result } = h.run(() => useGroups());
  await waitFor(() => expect(result.current.data.length + (result.current.error ? 1 : 0)).toBeGreaterThan(0));
  return result;
};

describe('useGroups — recência (migrations 0077, 0078, 0082, 0083)', () => {
  it('usa a RPC group_last_activity, não max(created_at)', async () => {
    await load(scenario({ groupCreatedAt: '2026-01-01T00:00:00Z', lastEventAt: '2026-06-01T00:00:00Z' }));
    expect(h.mock.rpcNames()).toContain('group_last_activity');
  });

  it('o evento GANHA da despesa mais recente quando é mais novo', async () => {
    const result = await load(scenario({
      groupCreatedAt: '2026-01-01T00:00:00Z',
      expenses: [{ id: 'e1', created_at: '2026-03-01T00:00:00Z' }],
      lastEventAt: '2026-06-01T00:00:00Z',
    }));
    expect(result.current.data[0].lastActivityAt).toBe('2026-06-01T00:00:00Z');
  });

  it('a despesa GANHA do evento quando é mais nova — o evento é SOMADO, não substitui', async () => {
    // Resenha anterior à 0027 não tem evento nenhum; trocar as fontes em vez de
    // somar faria a recência desses resenhas desaparecer.
    const result = await load(scenario({
      groupCreatedAt: '2026-01-01T00:00:00Z',
      expenses: [{ id: 'e1', created_at: '2026-09-01T00:00:00Z' }],
      lastEventAt: '2026-06-01T00:00:00Z',
    }));
    expect(result.current.data[0].lastActivityAt).toBe('2026-09-01T00:00:00Z');
  });

  it('APAGAR a despesa mais recente NÃO faz a recência andar pra trás', async () => {
    // O coração do bug: apagar a despesa mais nova derrubava o max pra anterior
    // e a resenha que você acabou de mexer aparecia como "há 4 dias".
    const antes = await load(scenario({
      groupCreatedAt: '2026-01-01T00:00:00Z',
      expenses: [
        { id: 'velha', created_at: '2026-03-01T00:00:00Z' },
        { id: 'nova', created_at: '2026-09-01T00:00:00Z' },
      ],
      lastEventAt: '2026-09-01T00:00:00Z',
    }));
    const recenciaAntes = antes.current.data[0].lastActivityAt;
    h.dispose();

    // Mesma situação DEPOIS do delete: a despesa nova sumiu (hard delete), mas
    // o evento de exclusão ficou e é mais recente ainda.
    const depois = await load(scenario({
      groupCreatedAt: '2026-01-01T00:00:00Z',
      expenses: [{ id: 'velha', created_at: '2026-03-01T00:00:00Z' }],
      lastEventAt: '2026-09-02T00:00:00Z',
    }));

    expect(depois.current.data[0].lastActivityAt >= recenciaAntes).toBe(true);
    expect(depois.current.data[0].lastActivityAt).toBe('2026-09-02T00:00:00Z');
  });

  it('resenha sem evento, sem despesa e sem pagamento cai na criação — nunca vazio', async () => {
    const result = await load(scenario({ groupCreatedAt: '2026-02-02T00:00:00Z', lastEventAt: null }));
    expect(result.current.data[0].lastActivityAt).toBe('2026-02-02T00:00:00Z');
  });

  it('pagamento também conta como atividade', async () => {
    const result = await load(scenario({
      groupCreatedAt: '2026-01-01T00:00:00Z',
      payments: [{ created_at: '2026-07-01T00:00:00Z' }],
      lastEventAt: null,
    }));
    expect(result.current.data[0].lastActivityAt).toBe('2026-07-01T00:00:00Z');
  });
});

describe('useGroups — ordenação e saldo', () => {
  it('ordena do mais recente pro mais antigo', async () => {
    h = createHarness({
      session: { user: { id: ME } },
      tables: {
        group_members: [
          { group_id: 'velho', user_id: ME, archived_at: null },
          { group_id: 'novo', user_id: ME, archived_at: null },
        ],
        groups: [
          { id: 'velho', name: 'Velho', avatar_key: null, avatar_path: null, created_at: '2026-01-01T00:00:00Z' },
          { id: 'novo', name: 'Novo', avatar_key: null, avatar_path: null, created_at: '2026-08-01T00:00:00Z' },
        ],
        profiles: [{ id: ME, name: 'Eu', avatar_path: null }],
        expenses: [], expense_participants: [], payments: [],
      },
      rpc: { group_last_activity: () => ({ data: [] }) },
    });
    const { result } = h.run(() => useGroups());
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    expect(result.current.data.map(g => g.id)).toEqual(['novo', 'velho']);
  });

  it('netBalance é o saldo DE QUEM ESTÁ OLHANDO', async () => {
    // Eu banquei 60 dividido entre 2 → os outros me devem 30.
    const result = await load(scenario({
      groupCreatedAt: '2026-01-01T00:00:00Z',
      expenses: [{ id: 'e1', created_at: '2026-02-01T00:00:00Z', amount: 60 }],
      lastEventAt: null,
    }));
    expect(result.current.data[0].netBalance).toBe(30);
  });

  it('pagamento recebido abate o saldo', async () => {
    const result = await load(scenario({
      groupCreatedAt: '2026-01-01T00:00:00Z',
      expenses: [{ id: 'e1', created_at: '2026-02-01T00:00:00Z', amount: 60 }],
      payments: [{ created_at: '2026-03-01T00:00:00Z', amount: 30 }],
      lastEventAt: null,
    }));
    expect(result.current.data[0].netBalance).toBe(0);
  });

  it('arquivado sai do archived_at da MINHA participação', async () => {
    h = createHarness({
      session: { user: { id: ME } },
      tables: {
        group_members: [
          { group_id: G, user_id: ME, archived_at: '2026-05-01T00:00:00Z' },
          { group_id: G, user_id: OUTRO, archived_at: null },
        ],
        groups: [{ id: G, name: 'Praia', avatar_key: null, avatar_path: null, created_at: '2026-01-01T00:00:00Z' }],
        profiles: [{ id: ME, name: 'Eu', avatar_path: null }, { id: OUTRO, name: 'Bruno', avatar_path: null }],
        expenses: [], expense_participants: [], payments: [],
      },
      rpc: { group_last_activity: () => ({ data: [] }) },
    });
    const { result } = h.run(() => useGroups());
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data[0].archived).toBe(true);
    expect(result.current.data[0].archivedAt).toBe('2026-05-01T00:00:00Z');
  });

  it('sem participação nenhuma devolve lista vazia sem consultar o resto', async () => {
    h = createHarness({
      session: { user: { id: ME } },
      tables: { group_members: [] },
      rpc: { group_last_activity: () => ({ data: [] }) },
    });
    const { result } = h.run(() => useGroups());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(h.mock.of('select').some(c => c.table === 'expenses')).toBe(false);
  });
});

describe('useGroups — erro', () => {
  it('erro do banco vira mensagem AMIGÁVEL, não o texto do Postgres', async () => {
    // Contrato de queryErrorMessage: o texto da tela é sempre o fallback.
    // O erro do Supabase É instância de Error (PostgrestError herda dela), então
    // a regra não pode depender disso — ver lib/queryError.ts.
    h = createHarness({
      session: { user: { id: ME } },
      tables: { group_members: [] },
      fail: { 'group_members:select': 'new row violates row-level security' },
    });
    const { result } = h.run(() => useGroups());
    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.error).toBe('Erro ao carregar resenhas');
    expect(result.current.error).not.toContain('row-level security');
    expect(result.current.data).toEqual([]);
  });
});
