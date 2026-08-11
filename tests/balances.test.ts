import { describe, it, expect } from 'vitest';
import {
  computeShares,
  computeBalances,
  simplifyDebts,
  type BalanceExpense,
  type BalanceParticipant,
} from '@/lib/balances';

const parts = (expenseId: string, ids: string[], extra?: { shares?: (number | null)[]; exact?: (number | null)[] }): BalanceParticipant[] =>
  ids.map((user_id, i) => ({
    expense_id: expenseId,
    user_id,
    shares: extra?.shares?.[i] ?? null,
    exact_amount: extra?.exact?.[i] ?? null,
  }));

const sum = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);

describe('computeShares', () => {
  it('divide igualmente sem perder centavo (o caso R$10 em 3)', () => {
    const shares = computeShares(10, 'equal', parts('e1', ['a', 'b', 'c']));
    expect(shares).toEqual({ a: 3.34, b: 3.33, c: 3.33 });
    // O ponto todo do floor + sobra: a soma tem que FECHAR com o valor.
    expect(sum(shares)).toBeCloseTo(10, 10);
  });

  it('divide por partes sem perder centavo', () => {
    const shares = computeShares(10, 'shares', parts('e1', ['a', 'b'], { shares: [2, 1] }));
    expect(shares).toEqual({ a: 6.67, b: 3.33 });
    expect(sum(shares)).toBeCloseTo(10, 10);
  });

  it('trata shares nulo como 1', () => {
    const shares = computeShares(9, 'shares', parts('e1', ['a', 'b', 'c']));
    expect(sum(shares)).toBeCloseTo(9, 10);
    expect(shares).toEqual({ a: 3, b: 3, c: 3 });
  });

  it('usa o valor exato quando o split é exact', () => {
    const shares = computeShares(10, 'exact', parts('e1', ['a', 'b'], { exact: [7.5, 2.5] }));
    expect(shares).toEqual({ a: 7.5, b: 2.5 });
  });

  it('exact sem valor preenchido conta como zero, não NaN', () => {
    const shares = computeShares(10, 'exact', parts('e1', ['a', 'b'], { exact: [10, null] }));
    expect(shares).toEqual({ a: 10, b: 0 });
  });

  it('devolve vazio sem participante', () => {
    expect(computeShares(10, 'equal', [])).toEqual({});
  });

  it('fecha a soma em valores que não dividem redondo', () => {
    for (const [amount, n] of [[100, 3], [0.03, 2], [7, 6], [1, 7], [999.99, 4]] as const) {
      const ids = Array.from({ length: n }, (_, i) => `u${i}`);
      const shares = computeShares(amount, 'equal', parts('e', ids));
      expect(sum(shares)).toBeCloseTo(amount, 10);
    }
  });
});

describe('computeBalances', () => {
  const expense = (id: string, amount: number, paid_by: string, split_type: BalanceExpense['split_type'] = 'equal'): BalanceExpense =>
    ({ id, amount, paid_by, split_type });

  it('credita quem bancou e debita cada participante', () => {
    const balances = computeBalances(
      ['a', 'b', 'c'],
      [expense('e1', 30, 'a')],
      parts('e1', ['a', 'b', 'c']),
      [],
    );
    expect(balances).toEqual({ a: 20, b: -10, c: -10 });
  });

  it('mantém a soma dos saldos em zero', () => {
    const balances = computeBalances(
      ['a', 'b', 'c'],
      [expense('e1', 30, 'a'), expense('e2', 45.55, 'b'), expense('e3', 7, 'c')],
      [...parts('e1', ['a', 'b', 'c']), ...parts('e2', ['a', 'b', 'c']), ...parts('e3', ['a', 'b'])],
      [{ from_user: 'b', to_user: 'a', amount: 5 }],
    );
    expect(sum(balances)).toBeCloseTo(0, 10);
  });

  it('pagamento move saldo do devedor pro credor', () => {
    const base = computeBalances(['a', 'b', 'c'], [expense('e1', 30, 'a')], parts('e1', ['a', 'b', 'c']), []);
    const afterPay = computeBalances(
      ['a', 'b', 'c'],
      [expense('e1', 30, 'a')],
      parts('e1', ['a', 'b', 'c']),
      [{ from_user: 'b', to_user: 'a', amount: 10 }],
    );
    expect(base.b).toBe(-10);
    expect(afterPay.b).toBe(0);
    expect(afterPay.a).toBe(10);
  });

  it('membro sem despesa nenhuma começa em zero, não undefined', () => {
    const balances = computeBalances(['a', 'b', 'z'], [expense('e1', 10, 'a')], parts('e1', ['a', 'b']), []);
    expect(balances.z).toBe(0);
  });

  it('ignora despesa sem participante (não credita quem bancou no vácuo)', () => {
    const balances = computeBalances(['a', 'b'], [expense('e1', 50, 'a')], [], []);
    expect(balances).toEqual({ a: 0, b: 0 });
  });

  it('conta pagamento em resenha já sem despesa (despesa apagada depois de paga)', () => {
    const balances = computeBalances(['a', 'b'], [], [], [{ from_user: 'b', to_user: 'a', amount: 20 }]);
    expect(balances).toEqual({ a: -20, b: 20 });
  });
});

describe('simplifyDebts', () => {
  it('casa maior credor com maior devedor', () => {
    expect(simplifyDebts({ a: 20, b: -10, c: -10 })).toEqual([
      { fromUserId: 'b', toUserId: 'a', amount: 10 },
      { fromUserId: 'c', toUserId: 'a', amount: 10 },
    ]);
  });

  it('conserva o total transferido e nunca gera transferência pra si mesmo', () => {
    const balances = { a: 45.55, b: -20.1, c: -15.45, d: -10 };
    const transfers = simplifyDebts(balances);
    const moved = transfers.reduce((s, t) => s + t.amount, 0);
    expect(moved).toBeCloseTo(45.55, 2);
    for (const t of transfers) expect(t.fromUserId).not.toBe(t.toUserId);
  });

  it('ignora resíduo abaixo de meio centavo', () => {
    expect(simplifyDebts({ a: 0.004, b: -0.004 })).toEqual([]);
  });

  it('devolve vazio com todos quitados', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });

  it('não deixa devedor nem credor sobrando', () => {
    const transfers = simplifyDebts({ a: 30, b: 12, c: -25, d: -17 });
    const net: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (const t of transfers) {
      net[t.toUserId] += t.amount;
      net[t.fromUserId] -= t.amount;
    }
    expect(net.a).toBeCloseTo(30, 2);
    expect(net.b).toBeCloseTo(12, 2);
    expect(net.c).toBeCloseTo(-25, 2);
    expect(net.d).toBeCloseTo(-17, 2);
  });
});

describe('integração: despesa → saldo → transferência', () => {
  it('quita a resenha quando as transferências sugeridas são executadas', () => {
    const expenses: BalanceExpense[] = [
      { id: 'e1', amount: 120.5, paid_by: 'a', split_type: 'equal' },
      { id: 'e2', amount: 33.33, paid_by: 'b', split_type: 'shares' },
    ];
    const participants: BalanceParticipant[] = [
      ...parts('e1', ['a', 'b', 'c']),
      ...parts('e2', ['a', 'b', 'c'], { shares: [3, 1, 1] }),
    ];
    const balances = computeBalances(['a', 'b', 'c'], expenses, participants, []);
    const transfers = simplifyDebts(balances);

    const settled = computeBalances(
      ['a', 'b', 'c'],
      expenses,
      participants,
      transfers.map(t => ({ from_user: t.fromUserId, to_user: t.toUserId, amount: t.amount })),
    );
    for (const id of ['a', 'b', 'c']) expect(Math.abs(settled[id])).toBeLessThanOrEqual(0.01);
  });
});
