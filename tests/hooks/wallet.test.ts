// @vitest-environment jsdom
//
// jsdom só neste diretório: o resto da suíte roda em node, que é mais rápido.
import { describe, it, expect, afterEach } from 'vitest';
import { createHarness, waitFor, type Harness } from '../support/hookHarness';
import { useWallet } from '@/hooks/useWallet';

const G1 = 'g1';
const G2 = 'g2';
const ANA = 'ana';
const BRUNO = 'bruno';
const CARLA = 'carla';
const session = { user: { id: ANA } };

/** Ana e Bruno numa resenha, com uma despesa de R$100 que o Bruno bancou e os dois
 *  dividem — Ana deve 50 a ele. */
const umaDivida = (over: Record<string, unknown[]> = {}) => ({
  group_members: [
    { group_id: G1, user_id: ANA },
    { group_id: G1, user_id: BRUNO },
  ],
  groups: [{ id: G1, name: 'Viagem' }],
  profiles: [
    { id: ANA, name: 'Ana', whatsapp: null, avatar_path: null, pix_key: null, pix_key_type: null },
    { id: BRUNO, name: 'Bruno', whatsapp: '+5511988887777', avatar_path: null, pix_key: 'bruno@x.com', pix_key_type: 'email' },
  ],
  expenses: [{
    id: 'e1', group_id: G1, amount: 100, paid_by: BRUNO,
    split_type: 'equal', created_at: '2026-03-10T20:00:00Z',
  }],
  expense_participants: [
    { expense_id: 'e1', user_id: ANA, shares: null, exact_amount: null },
    { expense_id: 'e1', user_id: BRUNO, shares: null, exact_amount: null },
  ],
  payments: [],
  settlements: [],
  ...over,
});

let h: Harness;
afterEach(() => h?.dispose());

describe('useWallet — o que eu devo e o que me devem', () => {
  it('dívida sem acerto registrado nasce pendente, na direção "out"', async () => {
    h = createHarness({ session, tables: umaDivida() });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data[0]).toMatchObject({
      personId: BRUNO, personName: 'Bruno', groupId: G1, groupName: 'Viagem',
      amount: 50, direction: 'out', status: 'pending', settlementId: null,
    });
  });

  it('quem RECEBE vê a mesma dívida como "in"', async () => {
    const t = umaDivida();
    t.expenses[0].paid_by = ANA;
    h = createHarness({ session, tables: t });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data[0]).toMatchObject({ direction: 'in', amount: 50, personId: BRUNO });
  });

  it('marcação "Já paguei" do devedor vira "waiting", com o id do acerto', async () => {
    h = createHarness({
      session,
      tables: umaDivida({
        settlements: [{
          id: 's1', group_id: G1, from_user: ANA, to_user: BRUNO, amount: 50,
          status: 'marked_paid', marked_at: '2026-03-11T09:00:00Z', proof_path: 'provas/x.jpg',
        }],
      }),
    });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data[0]).toMatchObject({
      status: 'waiting', settlementId: 's1', proofPath: 'provas/x.jpg',
    });
  });

  it('marcação STALE (o saldo mudou depois) volta pra pendente', async () => {
    // Uma despesa nova entrou entre marcar e conferir — a linha antiga já não
    // corresponde ao que se deve.
    h = createHarness({
      session,
      tables: umaDivida({
        settlements: [{
          id: 's1', group_id: G1, from_user: ANA, to_user: BRUNO, amount: 42,
          status: 'marked_paid', marked_at: '2026-03-11T09:00:00Z', proof_path: null,
        }],
      }),
    });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data[0]).toMatchObject({ status: 'pending', settlementId: null, proofPath: null });
  });

  it('pagamento confirmado vira linha "settled" à parte da dívida', async () => {
    h = createHarness({
      session,
      tables: umaDivida({
        payments: [{
          id: 'p1', group_id: G1, from_user: ANA, to_user: BRUNO,
          amount: 50, created_at: '2026-03-12T10:00:00Z',
        }],
      }),
    });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.data.some(t => t.status === 'settled')).toBe(true));

    const pago = result.current.data.find(t => t.status === 'settled')!;
    expect(pago).toMatchObject({ id: 'p1', direction: 'out', amount: 50, personId: BRUNO });
  });

  it('pagamento entre OUTRAS duas pessoas não entra na minha carteira', async () => {
    h = createHarness({
      session,
      tables: umaDivida({
        payments: [{
          id: 'p1', group_id: G1, from_user: BRUNO, to_user: CARLA,
          amount: 20, created_at: '2026-03-12T10:00:00Z',
        }],
      }),
    });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.map(t => t.id)).not.toContain('p1');
  });

  it('junta resenhas diferentes numa lista só, do mais recente pro mais antigo', async () => {
    h = createHarness({
      session,
      tables: {
        group_members: [
          { group_id: G1, user_id: ANA }, { group_id: G1, user_id: BRUNO },
          { group_id: G2, user_id: ANA }, { group_id: G2, user_id: BRUNO },
        ],
        groups: [{ id: G1, name: 'Viagem' }, { id: G2, name: 'República' }],
        profiles: [
          { id: ANA, name: 'Ana', whatsapp: null, avatar_path: null, pix_key: null, pix_key_type: null },
          { id: BRUNO, name: 'Bruno', whatsapp: null, avatar_path: null, pix_key: null, pix_key_type: null },
        ],
        expenses: [
          { id: 'e1', group_id: G1, amount: 100, paid_by: BRUNO, split_type: 'equal', created_at: '2026-01-10T20:00:00Z' },
          { id: 'e2', group_id: G2, amount: 60, paid_by: BRUNO, split_type: 'equal', created_at: '2026-06-10T20:00:00Z' },
        ],
        expense_participants: [
          { expense_id: 'e1', user_id: ANA, shares: null, exact_amount: null },
          { expense_id: 'e1', user_id: BRUNO, shares: null, exact_amount: null },
          { expense_id: 'e2', user_id: ANA, shares: null, exact_amount: null },
          { expense_id: 'e2', user_id: BRUNO, shares: null, exact_amount: null },
        ],
        payments: [],
        settlements: [],
      },
    });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    expect(result.current.data.map(t => t.groupName)).toEqual(['República', 'Viagem']);
  });

  it('leva a chave Pix da OUTRA pessoa, pra pagar sem pedir por fora', async () => {
    h = createHarness({ session, tables: umaDivida() });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data[0]).toMatchObject({
      personPixKey: 'bruno@x.com', personPixKeyType: 'email', personWhatsapp: '+5511988887777',
    });
  });

  it('resenha sem NENHUMA despesa marca hasNoExpenses — a despesa paga foi apagada', async () => {
    h = createHarness({
      session,
      tables: umaDivida({
        expenses: [], expense_participants: [],
        payments: [{
          id: 'p1', group_id: G1, from_user: ANA, to_user: BRUNO,
          amount: 50, created_at: '2026-03-12T10:00:00Z',
        }],
      }),
    });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.data.length).toBeGreaterThan(0));

    // Toda linha dessa resenha carrega a marca — é a resenha que está sem despesa,
    // não a linha. (Sobra o pagamento quitado E o saldo que ele inverteu:
    // sem despesa pra sustentar a dívida, quem pagou vira credor.)
    expect(result.current.data.every(t => t.hasNoExpenses)).toBe(true);
    expect(result.current.data.some(t => t.status === 'settled')).toBe(true);
  });

  it('sem nenhuma resenha, devolve vazio sem ir buscar despesa', async () => {
    h = createHarness({ session, tables: { group_members: [] } });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(h.mock.of('select').some(c => c.table === 'expenses')).toBe(false);
  });

  it('erro do banco vira mensagem amigável, nunca o texto do Postgres', async () => {
    h = createHarness({
      session,
      tables: umaDivida(),
      fail: { 'group_members:select': 'new row violates row-level security policy' },
    });
    const { result } = h.run(() => useWallet());
    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.error).toBe('Erro ao carregar a carteira');
    expect(result.current.error).not.toContain('row-level security');
  });
});
