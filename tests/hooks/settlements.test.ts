// @vitest-environment jsdom
//
// jsdom só neste diretório: o resto da suíte roda em node, que é mais rápido.
import { describe, it, expect, afterEach } from 'vitest';
import { createHarness, waitFor, type Harness } from '../support/hookHarness';
import {
  useSettlements,
  useMarkAsPaid,
  useUnmarkAsPaid,
  useConfirmReceived,
  useRecordReceipt,
} from '@/hooks/useSettlements';

const GROUP = 'g1';
const ANA = 'ana';
const BRUNO = 'bruno';

/** Uma dívida viva de Ana → Bruno, para os testes de leitura. */
const withDebt = (rows: Record<string, unknown>[] = []) => ({
  tables: {
    expenses: [{ id: 'e1', group_id: GROUP, amount: 100, paid_by: BRUNO, split_type: 'equal' }],
    expense_participants: [
      { expense_id: 'e1', user_id: ANA, shares: null, exact_amount: null },
      { expense_id: 'e1', user_id: BRUNO, shares: null, exact_amount: null },
    ],
    group_members: [
      { group_id: GROUP, user_id: ANA, role: 'member' },
      { group_id: GROUP, user_id: BRUNO, role: 'admin' },
    ],
    payments: [],
    settlements: rows,
  },
});

let h: Harness;
afterEach(() => h?.dispose());

describe('useSettlements — leitura', () => {
  it('sem linha de acerto, a transferência nasce pendente', async () => {
    h = createHarness(withDebt());
    const { result } = h.run(() => useSettlements(GROUP));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.transfers).toHaveLength(1);
    expect(result.current.transfers[0]).toMatchObject({
      fromUserId: ANA, toUserId: BRUNO, status: 'pending', settlementId: null,
    });
  });

  it('linha marked_paid casa com a dívida e vira "marcado"', async () => {
    h = createHarness(withDebt([
      { id: 's1', group_id: GROUP, from_user: ANA, to_user: BRUNO, amount: 50, status: 'marked_paid', proof_path: null, confirmed_at: null },
    ]));
    const { result } = h.run(() => useSettlements(GROUP));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.transfers[0]).toMatchObject({ status: 'marked_paid', settlementId: 's1' });
  });

  it('marcação STALE (valor não bate mais) volta pra pendente', async () => {
    // Despesa nova mudou o saldo depois de a pessoa marcar "Já paguei".
    h = createHarness(withDebt([
      { id: 's1', group_id: GROUP, from_user: ANA, to_user: BRUNO, amount: 42, status: 'marked_paid', proof_path: null, confirmed_at: null },
    ]));
    const { result } = h.run(() => useSettlements(GROUP));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.transfers[0].status).toBe('pending');
    expect(result.current.transfers[0].settlementId).toBeNull();
  });

  it('acerto CONFIRMADO não casa com dívida viva — vai pra "settled"', async () => {
    // Sem esse filtro, uma dívida nova de valor idêntico a um acerto antigo
    // casava com ele e o card travava em "Confirmado".
    h = createHarness(withDebt([
      { id: 's1', group_id: GROUP, from_user: ANA, to_user: BRUNO, amount: 50, status: 'confirmed', proof_path: null, confirmed_at: '2026-01-01T00:00:00Z' },
    ]));
    const { result } = h.run(() => useSettlements(GROUP));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.transfers[0].status).toBe('pending');
    expect(result.current.settled).toHaveLength(1);
    expect(result.current.settled[0].id).toBe('s1');
  });

  it('acertos confirmados vêm do mais recente pro mais antigo', async () => {
    h = createHarness(withDebt([
      { id: 'velho', group_id: GROUP, from_user: ANA, to_user: BRUNO, amount: 10, status: 'confirmed', proof_path: null, confirmed_at: '2026-01-01T00:00:00Z' },
      { id: 'novo', group_id: GROUP, from_user: ANA, to_user: BRUNO, amount: 20, status: 'confirmed', proof_path: null, confirmed_at: '2026-06-01T00:00:00Z' },
    ]));
    const { result } = h.run(() => useSettlements(GROUP));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settled.map(s => s.id)).toEqual(['novo', 'velho']);
  });

  it('sem groupId não consulta o banco', async () => {
    h = createHarness(withDebt());
    h.run(() => useSettlements(undefined));
    await new Promise(r => setTimeout(r, 20));
    expect(h.mock.of('select').filter(c => c.table === 'settlements')).toHaveLength(0);
  });
});

describe('useRecordReceipt — o "Já recebi"', () => {
  it('vai pela RPC record_receipt, nunca insere em payments', async () => {
    h = createHarness({ rpc: { record_receipt: () => ({ data: null }) } });
    const { result } = h.run(() => useRecordReceipt());

    await result.current.recordReceipt(GROUP, ANA, 50);

    expect(h.mock.rpcNames()).toEqual(['record_receipt']);
    expect(h.mock.of('insert').filter(c => c.table === 'payments')).toHaveLength(0);
  });

  it('manda group, devedor e valor com os nomes que a RPC espera', async () => {
    h = createHarness({ rpc: { record_receipt: () => ({ data: null }) } });
    const { result } = h.run(() => useRecordReceipt());

    await result.current.recordReceipt(GROUP, ANA, 50);

    expect(h.mock.of('rpc')[0].args).toEqual({ p_group_id: GROUP, p_from_user: ANA, p_amount: 50 });
  });

  it('invalida o conjunto de dinheiro inteiro', async () => {
    h = createHarness({ rpc: { record_receipt: () => ({ data: null }) } });
    const { result } = h.run(() => useRecordReceipt());

    await result.current.recordReceipt(GROUP, ANA, 50);

    expect(h.invalidatedNames()).toEqual(
      ['expenses', 'group-balances', 'group-history', 'my-groups', 'settlements', 'wallet'],
    );
  });

  it('erro da RPC propaga e NÃO invalida nada', async () => {
    // Invalidar num caminho que falhou faria a tela recarregar o mesmo dado e
    // parecer que deu certo.
    h = createHarness({ rpc: { record_receipt: () => ({ error: { message: 'sem permissão' } }) } });
    const { result } = h.run(() => useRecordReceipt());

    await expect(result.current.recordReceipt(GROUP, ANA, 50)).rejects.toMatchObject({ message: 'sem permissão' });
    expect(h.invalidatedNames()).toEqual([]);
  });
});

describe('useConfirmReceived — o credor confirmando', () => {
  it('vai pela RPC confirm_settlement com o id da linha', async () => {
    h = createHarness({ rpc: { confirm_settlement: () => ({ data: null }) } });
    const { result } = h.run(() => useConfirmReceived());

    await result.current.confirmReceived('s1', GROUP, ANA, BRUNO, 50);

    expect(h.mock.rpcNames()).toEqual(['confirm_settlement']);
    expect(h.mock.of('rpc')[0].args).toEqual({ p_settlement_id: 's1' });
  });

  it('não escreve em payments pelo client', async () => {
    // O par settlements→payments é atômico DENTRO da RPC (0072).
    h = createHarness({ rpc: { confirm_settlement: () => ({ data: null }) } });
    const { result } = h.run(() => useConfirmReceived());

    await result.current.confirmReceived('s1', GROUP, ANA, BRUNO, 50);

    expect(h.mock.of('insert')).toHaveLength(0);
    expect(h.mock.of('update')).toHaveLength(0);
  });

  it('invalida o conjunto de dinheiro inteiro', async () => {
    h = createHarness({ rpc: { confirm_settlement: () => ({ data: null }) } });
    const { result } = h.run(() => useConfirmReceived());

    await result.current.confirmReceived('s1', GROUP, ANA, BRUNO, 50);

    expect(h.invalidatedNames()).toEqual(
      ['expenses', 'group-balances', 'group-history', 'my-groups', 'settlements', 'wallet'],
    );
  });
});

describe('useMarkAsPaid / useUnmarkAsPaid — o devedor marcando', () => {
  it('marcar grava em settlements com status marked_paid', async () => {
    h = createHarness({ tables: { settlements: [] } });
    const { result } = h.run(() => useMarkAsPaid());

    await result.current.markAsPaid(GROUP, ANA, BRUNO, 50);

    const ins = h.mock.of('insert');
    expect(ins).toHaveLength(1);
    expect(ins[0].table).toBe('settlements');
    expect(ins[0].rows[0]).toMatchObject({
      group_id: GROUP, from_user: ANA, to_user: BRUNO, amount: 50, status: 'marked_paid', proof_path: null,
    });
  });

  it('marcar com comprovante guarda o caminho do arquivo', async () => {
    h = createHarness({ tables: { settlements: [] } });
    const { result } = h.run(() => useMarkAsPaid());

    await result.current.markAsPaid(GROUP, ANA, BRUNO, 50, 'provas/x.jpg');

    expect(h.mock.of('insert')[0].rows[0]).toMatchObject({ proof_path: 'provas/x.jpg' });
  });

  it('marcar NÃO invalida saldo nem histórico — não criou pagamento', async () => {
    // O evento e o push penduram na confirmação (0027, 0068). Invalidar saldo
    // aqui seria rede à toa em toda marcação.
    h = createHarness({ tables: { settlements: [] } });
    const { result } = h.run(() => useMarkAsPaid());

    await result.current.markAsPaid(GROUP, ANA, BRUNO, 50);

    expect(h.invalidatedNames()).toEqual(['settlements', 'wallet']);
  });

  it('desmarcar apaga a linha pelo id', async () => {
    h = createHarness({
      tables: { settlements: [{ id: 's1', group_id: GROUP, from_user: ANA, to_user: BRUNO, amount: 50, status: 'marked_paid', proof_path: null, confirmed_at: null }] },
    });
    const { result } = h.run(() => useUnmarkAsPaid());

    await result.current.unmarkAsPaid('s1', GROUP);

    const del = h.mock.of('delete');
    expect(del).toHaveLength(1);
    expect(del[0].table).toBe('settlements');
    expect(del[0].filters).toEqual([{ op: 'eq', column: 'id', value: 's1' }]);
  });

  it('erro ao inserir propaga e não invalida', async () => {
    h = createHarness({ tables: { settlements: [] }, fail: { 'settlements:insert': 'RLS negou' } });
    const { result } = h.run(() => useMarkAsPaid());

    await expect(result.current.markAsPaid(GROUP, ANA, BRUNO, 50)).rejects.toMatchObject({ message: 'RLS negou' });
    expect(h.invalidatedNames()).toEqual([]);
  });
});
