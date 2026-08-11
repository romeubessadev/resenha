// Saldos e transferências sugeridas não são armazenados no banco (ver
// supabase/migrations/0003_lancamentos.sql) — são derivados aqui a partir de
// expenses + expense_participants + payments.

export type BalanceExpense = {
  id: string;
  amount: number;
  paid_by: string;
  split_type: 'equal' | 'shares' | 'exact';
};

export type BalanceParticipant = {
  expense_id: string;
  user_id: string;
  shares: number | null;
  exact_amount: number | null;
};

export type BalancePayment = {
  from_user: string;
  to_user: string;
  amount: number;
};

export type Transfer = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Quanto cada participante deve de uma despesa, conforme o split_type.
 * Única fonte dessa conta — usada tanto pro saldo agregado quanto pro
 * detalhe de uma despesa, pra não duplicar (e divergir) a matemática.
 */
export function computeShares(
  amount: number,
  splitType: BalanceExpense['split_type'],
  participants: Pick<BalanceParticipant, 'user_id' | 'shares' | 'exact_amount'>[],
): Record<string, number> {
  const result: Record<string, number> = {};
  if (participants.length === 0) return result;

  if (splitType === 'exact') {
    for (const p of participants) result[p.user_id] = round2(p.exact_amount ?? 0);
  } else if (splitType === 'shares') {
    // Arredondar cada parte solta (ex.: R$10 em 3 partes iguais = 3×R$3,33 =
    // R$9,99) deixa 1 centavo sobrando, que passa da tolerância de 0,5
    // centavo do app e nunca fecha como "quitado". Mesma técnica da divisão
    // igual: base em centavos por floor, sobra distribuída 1 centavo por
    // vez pros primeiros participantes (ordem de inserção), garantindo que
    // a soma bate exatamente com `amount`.
    const totalShares = participants.reduce((s, p) => s + (p.shares ?? 1), 0) || 1;
    const totalCents = Math.round(amount * 100);
    const baseCents = participants.map(p => Math.floor((totalCents * (p.shares ?? 1)) / totalShares));
    const usedCents = baseCents.reduce((s, c) => s + c, 0);
    const remainderCents = totalCents - usedCents;
    participants.forEach((p, i) => {
      result[p.user_id] = round2((baseCents[i] + (i < remainderCents ? 1 : 0)) / 100);
    });
  } else {
    const n = participants.length;
    const base = Math.floor((amount / n) * 100) / 100;
    const remainderCents = Math.round((amount - base * n) * 100);
    participants.forEach((p, i) => {
      result[p.user_id] = round2(base + (i < remainderCents ? 0.01 : 0));
    });
  }
  return result;
}

/**
 * Saldo líquido por pessoa: positivo = os outros devem pra ela,
 * negativo = ela deve pros outros.
 */
export function computeBalances(
  memberIds: string[],
  expenses: BalanceExpense[],
  participants: BalanceParticipant[],
  payments: BalancePayment[],
): Record<string, number> {
  const balance: Record<string, number> = {};
  for (const id of memberIds) balance[id] = 0;

  const byExpense = new Map<string, BalanceParticipant[]>();
  for (const p of participants) {
    const list = byExpense.get(p.expense_id) ?? [];
    list.push(p);
    byExpense.set(p.expense_id, list);
  }

  for (const e of expenses) {
    const parts = byExpense.get(e.id) ?? [];
    if (parts.length === 0) continue;

    balance[e.paid_by] = (balance[e.paid_by] ?? 0) + e.amount;

    const shares = computeShares(e.amount, e.split_type, parts);
    for (const [userId, share] of Object.entries(shares)) {
      balance[userId] = (balance[userId] ?? 0) - share;
    }
  }

  for (const pay of payments) {
    balance[pay.from_user] = (balance[pay.from_user] ?? 0) + pay.amount;
    balance[pay.to_user] = (balance[pay.to_user] ?? 0) - pay.amount;
  }

  for (const id of Object.keys(balance)) balance[id] = round2(balance[id]);
  return balance;
}

/**
 * Simplifica os saldos num número mínimo de transferências sugeridas
 * (algoritmo guloso: sempre casa o maior credor com o maior devedor).
 */
export function simplifyDebts(balances: Record<string, number>): Transfer[] {
  const EPS = 0.005;
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, amount] of Object.entries(balances)) {
    if (amount > EPS) creditors.push({ id, amount });
    else if (amount < -EPS) debtors.push({ id, amount: -amount });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amount = round2(Math.min(c.amount, d.amount));
    if (amount > EPS) transfers.push({ fromUserId: d.id, toUserId: c.id, amount });
    c.amount = round2(c.amount - amount);
    d.amount = round2(d.amount - amount);
    if (c.amount <= EPS) ci++;
    if (d.amount <= EPS) di++;
  }
  return transfers;
}
