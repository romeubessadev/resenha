// @vitest-environment jsdom
//
// jsdom só neste diretório: o resto da suíte roda em node, que é mais rápido.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createHarness, waitFor, act, type Harness } from '../support/hookHarness';
import type { MockRow } from '../support/supabaseMock';
import { resetUUIDs } from '../stubs/expo-crypto';
import {
  useExpenses,
  sortLancamentos,
  registerExpenseMutationDefaults,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  CREATE_EXPENSE_MUTATION_KEY,
  UPDATE_EXPENSE_MUTATION_KEY,
  DELETE_EXPENSE_MUTATION_KEY,
  DESCRIBE_EXPENSE_MUTATION_KEY,
  EXPENSE_MUTATION_SCOPE,
  type LancamentoItem,
  type CreateExpenseInput,
} from '@/hooks/useExpenses';
import { queryKeys } from '@/lib/queryKeys';

const GROUP = 'g1';
const ANA = 'ana';
const BRUNO = 'bruno';

const session = { user: { id: ANA } };

/** Um rolê com Ana e Bruno e uma despesa de R$100 paga pelo Bruno, dividida
 *  igualmente — o cenário mínimo em que existe dívida.
 *
 *  Tipado como linha de mock, e não pelo literal: vários testes ajustam uma
 *  coluna do cenário (`recurrence_id`, `date`), e o tipo inferido do literal
 *  travaria o campo no valor de exemplo. */
const baseTables = (): Record<string, MockRow[]> => ({
  expenses: [{
    id: 'e1', group_id: GROUP, title: 'Bar', category_id: 'c1', amount: 100,
    paid_by: BRUNO, created_by: BRUNO, split_type: 'equal',
    date: '2026-03-10', created_at: '2026-03-10T20:00:00Z', recurrence_id: null,
  }],
  expense_participants: [
    { expense_id: 'e1', user_id: ANA, shares: null, exact_amount: null },
    { expense_id: 'e1', user_id: BRUNO, shares: null, exact_amount: null },
  ],
  payments: [],
  profiles: [{ id: ANA, name: 'Ana' }, { id: BRUNO, name: 'Bruno' }],
  expense_recurrences: [],
});

let h: Harness;
beforeEach(() => resetUUIDs());
afterEach(() => h?.dispose());

/** As mutações de despesa vivem em `setMutationDefaults`, não nos hooks — sem
 *  registrar, `mutate` sobe sem `mutationFn`. */
function withMutations(config: Parameters<typeof createHarness>[0] = {}) {
  const harness = createHarness(config);
  registerExpenseMutationDefaults(harness.queryClient);
  return harness;
}

/** Desliga só o retry, preservando mutationFn/onMutate/onError/onSuccess.
 *
 *  Os defaults pedem retry 3 com espera crescente — 7s até desistir, mais que
 *  o timeout do vitest. Testar o ROLLBACK exige chegar ao fim das tentativas,
 *  então aqui só o número de tentativas muda; o valor de 3 é conferido à parte,
 *  no bloco de configuração. */
function noRetry(harness: Harness, key: readonly unknown[]) {
  const current = harness.queryClient.getMutationDefaults(key as string[]);
  harness.queryClient.setMutationDefaults(key as string[], { ...current, retry: false });
}

const createInput = (over: Partial<CreateExpenseInput> = {}): CreateExpenseInput => ({
  groupId: GROUP,
  title: 'Uber',
  amount: 30,
  splitType: 'equal',
  memberInfo: {
    [ANA]: { name: 'Ana', photoUrl: null },
    [BRUNO]: { name: 'Bruno', photoUrl: null },
  },
  participants: [{ userId: ANA }, { userId: BRUNO }],
  date: '2026-03-11',
  ...over,
});

/** Edição mínima e válida — os blocos abaixo trocam só o que estão testando. */
const updateBase = (over: Record<string, unknown> = {}) => ({
  expenseId: 'e1',
  groupId: GROUP,
  categoryId: 'c1',
  title: 'Bar do Zé',
  amount: 120,
  splitType: 'equal' as const,
  paidById: BRUNO,
  date: '2026-03-10',
  receiptPath: null,
  participants: [{ userId: ANA }, { userId: BRUNO }],
  memberInfo: {
    [ANA]: { name: 'Ana', photoUrl: null },
    [BRUNO]: { name: 'Bruno', photoUrl: null },
  },
  recurrence: { action: 'none' as const, id: null },
  titleChanged: false,
  categoryTouched: false,
  ...over,
});

// ───────────────────────────────────────────────────────────────────────────
describe('useExpenses — a lista do rolê', () => {
  it('junta despesa e acerto numa lista só, com o nome de quem bancou', async () => {
    h = createHarness({
      session,
      tables: {
        ...baseTables(),
        payments: [{
          id: 'p1', group_id: GROUP, from_user: ANA, to_user: BRUNO,
          amount: 50, description: null, created_at: '2026-03-12T10:00:00Z',
        }],
      },
    });
    const { result } = h.run(() => useExpenses(GROUP));
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    const [acerto, despesa] = result.current.data;
    expect(acerto).toMatchObject({ type: 'payment', paidById: ANA, toUserId: BRUNO, amount: 50 });
    expect(despesa).toMatchObject({ type: 'expense', title: 'Bar', paidByName: 'Bruno' });
  });

  it('calcula a MINHA parte e a de cada participante', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = h.run(() => useExpenses(GROUP));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data[0].myShare).toBe(50);
    expect(result.current.data[0].participantShares).toEqual({ [ANA]: 50, [BRUNO]: 50 });
    expect(result.current.data[0].splitCount).toBe(2);
  });

  it('quem só divide (nunca bancou nem acertou) entra na busca de nomes', async () => {
    // Sem incluir esse id, o nome vinha vazio e o CSV exportado ficava com uma
    // vírgula solta no lugar dele.
    const t = baseTables();
    t.expense_participants.push({ expense_id: 'e1', user_id: 'carla', shares: null, exact_amount: null });
    t.profiles.push({ id: 'carla', name: 'Carla' });
    h = createHarness({ session, tables: t });
    const { result } = h.run(() => useExpenses(GROUP));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data[0].participantNames).toContain('Carla');
  });

  it('despesa sem coluna `date` cai no created_at em vez de derrubar a tela', async () => {
    // Antes da migration 0077 (ou com o cache de schema do PostgREST velho) o
    // campo vem undefined, e a ordenação estourava levando a tela junto.
    const t = baseTables();
    t.expenses[0].date = undefined as unknown as string;
    h = createHarness({ session, tables: t });
    const { result } = h.run(() => useExpenses(GROUP));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data[0].date).toBe('2026-03-10T20:00:00Z');
  });

  it('createdByMe distingue quem LANÇOU de quem bancou', async () => {
    // A RLS da 0105 é sobre quem lançou; a etiqueta da UI é sobre quem bancou.
    const t = baseTables();
    t.expenses[0].created_by = ANA;
    h = createHarness({ session, tables: t });
    const { result } = h.run(() => useExpenses(GROUP));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data[0]).toMatchObject({ createdByMe: true, paidByMe: false });
  });

  it('sem groupId não consulta o banco', async () => {
    h = createHarness({ session, tables: baseTables() });
    h.run(() => useExpenses(undefined));
    await new Promise(r => setTimeout(r, 20));
    expect(h.mock.of('select').filter(c => c.table === 'expenses')).toHaveLength(0);
  });
});

describe('sortLancamentos', () => {
  const item = (over: Partial<LancamentoItem>): LancamentoItem => ({
    id: 'x', type: 'expense', title: '', categoryId: null, amount: 0,
    paidById: ANA, paidByName: '', paidByMe: true,
    date: '2026-01-01', createdAt: '2026-01-01T00:00:00Z', ...over,
  });

  it('ordena por dia, do mais recente pro mais antigo', () => {
    const out = sortLancamentos([
      item({ id: 'velho', date: '2026-01-01' }),
      item({ id: 'novo', date: '2026-03-01' }),
    ]);
    expect(out.map(i => i.id)).toEqual(['novo', 'velho']);
  });

  it('no MESMO dia, despesa e acerto convivem pela ordem de criação', () => {
    // A despesa traz 'YYYY-MM-DD' e o acerto o timestamp inteiro. Comparar as
    // strings cruas jogaria toda despesa pra trás do acerto do mesmo dia.
    const out = sortLancamentos([
      item({ id: 'despesa', date: '2026-03-01', createdAt: '2026-03-01T23:00:00Z' }),
      item({ id: 'acerto', type: 'payment', date: '2026-03-01T08:00:00Z', createdAt: '2026-03-01T08:00:00Z' }),
    ]);
    expect(out.map(i => i.id)).toEqual(['despesa', 'acerto']);
  });

  it('não muda o array recebido', () => {
    const original = [item({ id: 'a', date: '2026-01-01' }), item({ id: 'b', date: '2026-03-01' })];
    sortLancamentos(original);
    expect(original.map(i => i.id)).toEqual(['a', 'b']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('criar despesa', () => {
  it('vai por uma RPC atômica só, e nasce SEM categoria', async () => {
    // Dois inserts separados podiam falhar no meio e deixar despesa sem
    // participante — que some do saldo de todo mundo sem aviso (0086).
    // A categoria é sempre da fila, logo depois (DESCRIBE_EXPENSE_MUTATION_KEY).
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => { result.current.createExpense(createInput()); });
    await waitFor(() => expect(h.mock.rpcNames()).toContain('create_expense_with_participants'));

    const rpc = h.mock.of('rpc').find(c => c.name === 'create_expense_with_participants')!;
    expect(rpc.args).toMatchObject({
      p_group_id: GROUP, p_title: 'Uber', p_amount: 30,
      p_paid_by: ANA, p_split_type: 'equal', p_date: '2026-03-11',
      p_category_id: null,
    });
    expect(h.mock.of('insert').filter(c => c.table === 'expenses')).toHaveLength(0);
  });

  it('o id sai do CLIENT, e é o mesmo da linha otimista', async () => {
    // Id do banco obrigaria uma ida à rede antes de a despesa existir na tela.
    h = withMutations({ session, tables: baseTables() });
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), []);
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => { result.current.createExpense(createInput()); });

    const lista = h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))!;
    const rpc = h.mock.of('rpc').find(c => c.name === 'create_expense_with_participants')!;
    expect(rpc.args.p_id).toBe(lista[0].id);
  });

  it('a despesa aparece na lista ANTES de qualquer ida à rede', async () => {
    h = withMutations({ session, tables: baseTables() });
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), []);
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => { result.current.createExpense(createInput({ title: 'Pizza' })); });

    const lista = h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))!;
    expect(lista[0]).toMatchObject({
      title: 'Pizza', amount: 30, categoryId: null, createdByMe: true, myShare: 15,
    });
  });

  it('a linha otimista entra na ORDEM certa, não no topo', async () => {
    // A lista agrupa por dia — despesa retroativa jogada no topo quebraria o
    // cabeçalho de data.
    h = withMutations({ session, tables: baseTables() });
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), [{
      id: 'recente', type: 'expense', title: 'Hoje', categoryId: null, amount: 10,
      paidById: ANA, paidByName: 'Ana', paidByMe: true,
      date: '2026-06-01', createdAt: '2026-06-01T10:00:00Z',
    }]);
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => { result.current.createExpense(createInput({ date: '2026-01-05' })); });

    const lista = h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))!;
    expect(lista.map(l => l.id)).toEqual(['recente', lista[1].id]);
    expect(lista[1].date).toBe('2026-01-05');
  });

  it('o saldo se move junto com a lista', async () => {
    // Mexer só na lista faria a despesa aparecer sem o saldo mudar, que é pior
    // do que não mostrar nada.
    h = withMutations({ session, tables: baseTables() });
    h.queryClient.setQueryData(queryKeys.groupBalances(GROUP), {
      balances: { [ANA]: 0, [BRUNO]: 0 }, transfers: [], paymentsOnlyBalances: {},
    });
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => { result.current.createExpense(createInput({ amount: 30, paidById: ANA })); });

    const snap = h.queryClient.getQueryData<{ balances: Record<string, number> }>(queryKeys.groupBalances(GROUP))!;
    // Ana bancou 30 e deve 15 → +15. Bruno só deve a parte dele → −15.
    expect(snap.balances).toEqual({ [ANA]: 15, [BRUNO]: -15 });
  });

  it('semeia o DETALHE, pra tocar na despesa recém-lançada não abrir erro', async () => {
    // fetchExpenseDetail usa .single() numa linha que ainda não existe.
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => { result.current.createExpense(createInput()); });

    const rpc = h.mock.of('rpc').find(c => c.name === 'create_expense_with_participants')!;
    const detalhe = h.queryClient.getQueryData<{ title: string; createdByMe: boolean }>(
      queryKeys.expense(rpc.args.p_id as string),
    );
    expect(detalhe).toMatchObject({ title: 'Uber', createdByMe: true });
  });

  it('emenda a categorização logo atrás, pela Edge Function', async () => {
    // O UPDATE direto falharia calado quando a despesa é paga por outra pessoa.
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => { result.current.createExpense(createInput()); });
    await waitFor(() => expect(h.mock.of('invoke')).toHaveLength(1));

    expect(h.mock.of('invoke')[0].name).toBe('categorize-expense');
  });

  it('invalida tudo que MOSTRA a despesa, não só a lista do rolê', async () => {
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => { result.current.createExpense(createInput()); });
    await waitFor(() => expect(h.invalidatedNames()).toContain('wallet'));

    expect(h.invalidatedNames()).toEqual(expect.arrayContaining([
      'category-usage', 'expense', 'expenses', 'group-balances',
      'group-history', 'group-recurrences', 'my-groups', 'wallet',
    ]));
  });

  it('divisão por partes: a soma das partes bate com o total, sem centavo sobrando', async () => {
    h = withMutations({ session, tables: baseTables() });
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), []);
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => {
      result.current.createExpense(createInput({
        amount: 10, splitType: 'shares',
        participants: [{ userId: ANA, shares: 1 }, { userId: BRUNO, shares: 2 }],
      }));
    });

    const lista = h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))!;
    const partes = Object.values(lista[0].participantShares!);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('erro definitivo desfaz a lista, o saldo e o detalhe', async () => {
    h = withMutations({
      session,
      tables: baseTables(),
      rpc: { create_expense_with_participants: () => ({ error: { message: 'RLS negou' } }) },
    });
    noRetry(h, CREATE_EXPENSE_MUTATION_KEY);
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), []);
    h.queryClient.setQueryData(queryKeys.groupBalances(GROUP), {
      balances: { [ANA]: 0, [BRUNO]: 0 }, transfers: [], paymentsOnlyBalances: {},
    });
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => { result.current.createExpense(createInput()); });
    await waitFor(() => {
      expect(h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))).toHaveLength(0);
    });

    const snap = h.queryClient.getQueryData<{ balances: Record<string, number> }>(queryKeys.groupBalances(GROUP))!;
    expect(snap.balances).toEqual({ [ANA]: 0, [BRUNO]: 0 });
    expect(h.queryClient.getQueryData(queryKeys.expense('uuid-1'))).toBeUndefined();
  });

  it('erro avisa a tela com a mensagem do servidor', async () => {
    h = withMutations({
      session,
      tables: baseTables(),
      rpc: { create_expense_with_participants: () => ({ error: { message: 'RLS negou' } }) },
    });
    noRetry(h, CREATE_EXPENSE_MUTATION_KEY);
    const { result } = await h.runReady(() => useCreateExpense());

    let msg = '';
    await act(async () => { result.current.createExpense(createInput(), m => { msg = m; }); });
    await waitFor(() => expect(msg).toBe('RLS negou'));
  });

  it('com recorrência, a receita é gravada ANTES da despesa apontar pra ela', async () => {
    // Na ordem inversa a despesa quebraria a chave estrangeira.
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => {
      result.current.createExpense(createInput({
        recurrence: { freq: 'monthly', nextRunDate: new Date(2026, 3, 11) },
      }));
    });
    await waitFor(() => expect(h.mock.rpcNames()).toContain('create_expense_with_participants'));

    const kinds = h.mock.calls.map(c => (c.kind === 'rpc' ? `rpc:${c.name}` : `${c.kind}:${'table' in c ? c.table : ''}`));
    const iReceita = kinds.indexOf('upsert:expense_recurrences');
    const iDespesa = kinds.indexOf('rpc:create_expense_with_participants');
    expect(iReceita).toBeGreaterThanOrEqual(0);
    expect(iReceita).toBeLessThan(iDespesa);
  });

  it('com recorrência, materializa as ocorrências vencidas DEPOIS da semente', async () => {
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => {
      result.current.createExpense(createInput({
        recurrence: { freq: 'monthly', nextRunDate: new Date(2026, 3, 11) },
      }));
    });
    await waitFor(() => expect(h.mock.rpcNames()).toContain('materialize_recurring_expenses'));

    const nomes = h.mock.rpcNames();
    expect(nomes.indexOf('create_expense_with_participants'))
      .toBeLessThan(nomes.indexOf('materialize_recurring_expenses'));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('editar despesa', () => {
  const updateInput = (over: Record<string, unknown> = {}) => ({
    expenseId: 'e1',
    groupId: GROUP,
    categoryId: 'c1',
    title: 'Bar do Zé',
    amount: 120,
    splitType: 'equal' as const,
    paidById: BRUNO,
    date: '2026-03-10',
    receiptPath: null,
    participants: [{ userId: ANA }, { userId: BRUNO }],
    memberInfo: {
      [ANA]: { name: 'Ana', photoUrl: null },
      [BRUNO]: { name: 'Bruno', photoUrl: null },
    },
    recurrence: { action: 'none' as const, id: null },
    titleChanged: false,
    categoryTouched: false,
    ...over,
  });

  it('vai por uma RPC atômica só (0088)', async () => {
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => { result.current.updateExpense(updateInput()); });
    await waitFor(() => expect(h.mock.rpcNames()).toContain('update_expense_with_participants'));

    expect(h.mock.of('rpc')[0].args).toMatchObject({
      p_id: 'e1', p_title: 'Bar do Zé', p_amount: 120, p_paid_by: BRUNO, p_split_type: 'equal',
    });
  });

  it('a lista e o detalhe mostram o valor novo na hora', async () => {
    h = withMutations({ session, tables: baseTables() });
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), [{
      id: 'e1', type: 'expense', title: 'Bar', categoryId: 'c1', amount: 100,
      paidById: BRUNO, paidByName: 'Bruno', paidByMe: false,
      date: '2026-03-10', createdAt: '2026-03-10T20:00:00Z',
      participantShares: { [ANA]: 50, [BRUNO]: 50 },
    }]);
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => { result.current.updateExpense(updateInput()); });

    const lista = h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))!;
    expect(lista[0]).toMatchObject({ title: 'Bar do Zé', amount: 120, myShare: 60 });
  });

  it('o saldo troca a contribuição ANTIGA pela nova, não soma a diferença', async () => {
    // Valor, pagador e rateio podem ter mudado todos de uma vez.
    h = withMutations({ session, tables: baseTables() });
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), [{
      id: 'e1', type: 'expense', title: 'Bar', categoryId: 'c1', amount: 100,
      paidById: BRUNO, paidByName: 'Bruno', paidByMe: false,
      date: '2026-03-10', createdAt: '2026-03-10T20:00:00Z',
      participantShares: { [ANA]: 50, [BRUNO]: 50 },
    }]);
    h.queryClient.setQueryData(queryKeys.groupBalances(GROUP), {
      balances: { [ANA]: -50, [BRUNO]: 50 }, transfers: [], paymentsOnlyBalances: {},
    });
    const { result } = await h.runReady(() => useUpdateExpense());

    // Agora quem banca é a Ana, e o valor virou 120.
    await act(async () => { result.current.updateExpense(updateInput({ paidById: ANA })); });

    const snap = h.queryClient.getQueryData<{ balances: Record<string, number> }>(queryKeys.groupBalances(GROUP))!;
    expect(snap.balances).toEqual({ [ANA]: 60, [BRUNO]: -60 });
  });

  it('"só esta ocorrência" NÃO vaza o valor pras próximas', async () => {
    // Antes o valor sempre vazava pro futuro: corrigir a luz de um mês mais
    // cara mudava todos os meses seguintes.
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => {
      result.current.updateExpense(updateInput({
        recurrence: {
          action: 'update', id: 'r1', freq: 'monthly', intervalDays: null,
          endDate: null, amount: 120, applyToFuture: false, paused: false,
        },
      }));
    });
    await waitFor(() => expect(h.mock.of('update').some(c => c.table === 'expense_recurrences')).toBe(true));

    const upd = h.mock.of('update').find(c => c.table === 'expense_recurrences')!;
    expect(upd.values).toEqual({ freq: 'monthly', interval_days: null, end_date: null, paused: false });
    expect(upd.values).not.toHaveProperty('amount');
  });

  it('"esta e as próximas" propaga o CONTEÚDO inteiro, não só o valor', async () => {
    // Antes só o valor ia, então corrigir o título não pegava nas futuras.
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => {
      result.current.updateExpense(updateInput({
        recurrence: {
          action: 'update', id: 'r1', freq: 'monthly', intervalDays: null,
          endDate: null, amount: 120, applyToFuture: true, paused: false,
        },
      }));
    });
    await waitFor(() => expect(h.mock.of('update').some(c => c.table === 'expense_recurrences')).toBe(true));

    expect(h.mock.of('update').find(c => c.table === 'expense_recurrences')!.values).toMatchObject({
      amount: 120, title: 'Bar do Zé', paid_by: BRUNO, split_type: 'equal', category_id: 'c1',
    });
  });

  it('a categoria acompanha a série mesmo sem mexer na recorrência', async () => {
    // Senão a correção teria que ser refeita a cada ocorrência que o cron cria.
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => {
      result.current.updateExpense(updateInput({ recurrence: { action: 'none', id: 'r1' } }));
    });
    await waitFor(() => expect(h.mock.of('update').some(c => c.table === 'expense_recurrences')).toBe(true));

    expect(h.mock.of('update').find(c => c.table === 'expense_recurrences')!.values).toEqual({ category_id: 'c1' });
  });

  it('título novo recategoriza; mexer no seletor tem a palavra final', async () => {
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => {
      result.current.updateExpense(updateInput({ titleChanged: true, categoryTouched: false }));
    });
    await waitFor(() => expect(h.mock.of('invoke')).toHaveLength(1));
    expect(h.mock.of('invoke')[0].name).toBe('categorize-expense');

    h.mock.reset();
    await act(async () => {
      result.current.updateExpense(updateInput({ titleChanged: true, categoryTouched: true }));
    });
    await new Promise(r => setTimeout(r, 30));
    expect(h.mock.of('invoke')).toHaveLength(0);
  });

  it('erro definitivo devolve lista, saldo e detalhe ao que eram', async () => {
    h = withMutations({
      session,
      tables: baseTables(),
      rpc: { update_expense_with_participants: () => ({ error: { message: 'falhou' } }) },
    });
    noRetry(h, UPDATE_EXPENSE_MUTATION_KEY);
    const antes: LancamentoItem[] = [{
      id: 'e1', type: 'expense', title: 'Bar', categoryId: 'c1', amount: 100,
      paidById: BRUNO, paidByName: 'Bruno', paidByMe: false,
      date: '2026-03-10', createdAt: '2026-03-10T20:00:00Z',
      participantShares: { [ANA]: 50, [BRUNO]: 50 },
    }];
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), antes);
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => { result.current.updateExpense(updateInput()); });
    await waitFor(() => {
      expect(h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))![0].amount).toBe(100);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('apagar despesa', () => {
  it('some da lista e do saldo antes de ir à rede', async () => {
    h = withMutations({ session, tables: baseTables() });
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), [{
      id: 'e1', type: 'expense', title: 'Bar', categoryId: 'c1', amount: 100,
      paidById: BRUNO, paidByName: 'Bruno', paidByMe: false,
      date: '2026-03-10', createdAt: '2026-03-10T20:00:00Z',
      participantShares: { [ANA]: 50, [BRUNO]: 50 },
    }]);
    h.queryClient.setQueryData(queryKeys.groupBalances(GROUP), {
      balances: { [ANA]: -50, [BRUNO]: 50 }, transfers: [], paymentsOnlyBalances: {},
    });
    const { result } = await h.runReady(() => useDeleteExpense());

    await act(async () => { result.current.deleteExpense('e1', GROUP, null, false); });

    expect(h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))).toHaveLength(0);
    const snap = h.queryClient.getQueryData<{ balances: Record<string, number> }>(queryKeys.groupBalances(GROUP))!;
    expect(snap.balances).toEqual({ [ANA]: 0, [BRUNO]: 0 });
  });

  it('despesa SEM participante não mexe no saldo ao ser apagada', async () => {
    // computeBalances ignora despesa sem participante — sem a guarda, apagar
    // uma dessas tirava do pagador um valor que nunca tinha sido somado.
    h = withMutations({ session, tables: baseTables() });
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), [{
      id: 'e1', type: 'expense', title: 'Bar', categoryId: null, amount: 100,
      paidById: BRUNO, paidByName: 'Bruno', paidByMe: false,
      date: '2026-03-10', createdAt: '2026-03-10T20:00:00Z',
      participantShares: {},
    }]);
    h.queryClient.setQueryData(queryKeys.groupBalances(GROUP), {
      balances: { [ANA]: -50, [BRUNO]: 50 }, transfers: [], paymentsOnlyBalances: {},
    });
    const { result } = await h.runReady(() => useDeleteExpense());

    await act(async () => { result.current.deleteExpense('e1', GROUP, null, false); });

    const snap = h.queryClient.getQueryData<{ balances: Record<string, number> }>(queryKeys.groupBalances(GROUP))!;
    expect(snap.balances).toEqual({ [ANA]: -50, [BRUNO]: 50 });
  });

  it('"apagar e parar de repetir" PAUSA a série antes de apagar a despesa', async () => {
    // Na ordem inversa, uma falha deixaria a despesa apagada no servidor de
    // volta na lista e a série ainda gerando ocorrência.
    h = withMutations({
      session,
      tables: { ...baseTables(), expense_recurrences: [{ id: 'r1', paused: false, deleted_at: null }] },
    });
    const { result } = await h.runReady(() => useDeleteExpense());

    await act(async () => { result.current.deleteExpense('e1', GROUP, 'r1', true); });
    await waitFor(() => expect(h.mock.of('delete')).toHaveLength(1));

    const ordem = h.mock.calls.map(c => `${c.kind}:${'table' in c ? c.table : ''}`);
    expect(ordem.indexOf('update:expense_recurrences')).toBeLessThan(ordem.indexOf('delete:expenses'));
    expect(h.mock.of('update')[0].values).toEqual({ paused: true });
  });

  it('série que ficou SEM nenhuma ocorrência é encerrada por soft delete', async () => {
    // `deleted_at` e não delete: a FK é ON DELETE SET NULL e zeraria o vínculo
    // das ocorrências passadas (0101).
    const t = baseTables();
    t.expenses[0].recurrence_id = 'r1';
    h = withMutations({
      session,
      tables: { ...t, expense_recurrences: [{ id: 'r1', paused: false, deleted_at: null }] },
    });
    const { result } = await h.runReady(() => useDeleteExpense());

    await act(async () => { result.current.deleteExpense('e1', GROUP, 'r1', false); });
    await waitFor(() => expect(h.mock.of('update').some(c => c.table === 'expense_recurrences')).toBe(true));

    const upd = h.mock.of('update').find(c => c.table === 'expense_recurrences')!;
    expect(upd.values).toHaveProperty('deleted_at');
    expect(h.mock.of('delete').filter(c => c.table === 'expense_recurrences')).toHaveLength(0);
  });

  it('série que AINDA tem ocorrência continua viva', async () => {
    const t = baseTables();
    t.expenses[0].recurrence_id = 'r1';
    t.expenses.push({
      id: 'e2', group_id: GROUP, title: 'Bar', category_id: 'c1', amount: 100,
      paid_by: BRUNO, created_by: BRUNO, split_type: 'equal',
      date: '2026-04-10', created_at: '2026-04-10T20:00:00Z', recurrence_id: 'r1',
    });
    h = withMutations({
      session,
      tables: { ...t, expense_recurrences: [{ id: 'r1', paused: false, deleted_at: null }] },
    });
    const { result } = await h.runReady(() => useDeleteExpense());

    await act(async () => { result.current.deleteExpense('e1', GROUP, 'r1', false); });
    await waitFor(() => expect(h.mock.of('delete')).toHaveLength(1));
    await new Promise(r => setTimeout(r, 30));

    expect(h.mock.of('update').filter(c => c.table === 'expense_recurrences')).toHaveLength(0);
  });

  it('erro definitivo traz a despesa de volta pra lista', async () => {
    h = withMutations({ session, tables: baseTables(), fail: { 'expenses:delete': 'RLS negou' } });
    noRetry(h, DELETE_EXPENSE_MUTATION_KEY);
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), [{
      id: 'e1', type: 'expense', title: 'Bar', categoryId: 'c1', amount: 100,
      paidById: BRUNO, paidByName: 'Bruno', paidByMe: false,
      date: '2026-03-10', createdAt: '2026-03-10T20:00:00Z',
      participantShares: { [ANA]: 50, [BRUNO]: 50 },
    }]);
    const { result } = await h.runReady(() => useDeleteExpense());

    await act(async () => { result.current.deleteExpense('e1', GROUP, null, false); });
    await waitFor(() => {
      expect(h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))).toHaveLength(1);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('nenhum erro do banco passa calado', () => {
  // Foi um erro DESCARTADO que fez todo push sair sem o nome do rolê. Aqui se
  // fixa que cada leitura e cada escrita propaga em vez de engolir.
  it.each([
    ['despesas', 'expenses:select'],
    ['acertos', 'payments:select'],
    ['participantes', 'expense_participants:select'],
    ['perfis', 'profiles:select'],
  ])('falha ao ler %s vira erro na tela', async (_nome, chave) => {
    h = createHarness({ session, tables: baseTables(), fail: { [chave]: 'boom' } });
    const { result } = h.run(() => useExpenses(GROUP));
    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.error).toBe('Erro ao carregar despesas');
  });

  it('sem sessão, criar e editar são barrados antes de tocar no banco', async () => {
    h = withMutations({ session: null, tables: baseTables() });
    const criar = await h.runReady(() => useCreateExpense());
    const editar = await h.runReady(() => useUpdateExpense());

    expect(() => criar.result.current.createExpense(createInput())).toThrow('Sessão inválida');
    expect(() => editar.result.current.updateExpense(updateBase())).toThrow('Sessão inválida');
    expect(h.mock.of('rpc')).toHaveLength(0);
  });
});

describe('recorrência ao editar — os outros caminhos', () => {
  it('CANCELAR apaga a receita e desliga a seção no detalhe na hora', async () => {
    h = withMutations({
      session,
      tables: { ...baseTables(), expense_recurrences: [{ id: 'r1', paused: false }] },
    });
    h.queryClient.setQueryData(queryKeys.expenseRecurrenceInfo('r1'), { freq: 'monthly', paused: false });
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => {
      result.current.updateExpense(updateBase({ recurrence: { action: 'cancel', id: 'r1' } }));
    });
    await waitFor(() => expect(h.mock.of('delete').some(c => c.table === 'expense_recurrences')).toBe(true));

    // null é o que o servidor devolveria pra uma receita apagada.
    expect(h.queryClient.getQueryData(queryKeys.expenseRecurrenceInfo('r1'))).toBeNull();
  });

  it('CRIAR grava a receita antes da despesa e semeia a seção', async () => {
    h = withMutations({ session, tables: { ...baseTables(), expense_recurrences: [] } });
    const { result } = await h.runReady(() => useUpdateExpense());

    const row = {
      id: 'r9', group_id: GROUP, created_by: ANA, title: 'Bar', category_id: null,
      amount: 120, split_type: 'equal', paid_by: BRUNO, receipt_path: null,
      participants: [], freq: 'monthly' as const, interval_days: null,
      next_run_date: '2026-04-10', end_date: null, anchor_day: 10,
    };
    await act(async () => {
      result.current.updateExpense(updateBase({ recurrence: { action: 'create', id: 'r9', row } }));
    });
    await waitFor(() => expect(h.mock.rpcNames()).toContain('materialize_recurring_expenses'));

    const ordem = h.mock.calls.map(c => (c.kind === 'rpc' ? `rpc:${c.name}` : `${c.kind}:${'table' in c ? c.table : ''}`));
    expect(ordem.indexOf('upsert:expense_recurrences'))
      .toBeLessThan(ordem.indexOf('rpc:update_expense_with_participants'));
    expect(h.queryClient.getQueryData(queryKeys.expenseRecurrenceInfo('r9'))).toMatchObject({ paused: false });
  });

  it('atualizar a série reflete no detalhe antes da resposta chegar', async () => {
    h = withMutations({ session, tables: { ...baseTables(), expense_recurrences: [{ id: 'r1' }] } });
    h.queryClient.setQueryData(queryKeys.expenseRecurrenceInfo('r1'), {
      freq: 'monthly', intervalDays: null, endDate: null, paused: false, active: true,
    });
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => {
      result.current.updateExpense(updateBase({
        recurrence: {
          action: 'update', id: 'r1', freq: 'weekly', intervalDays: null,
          endDate: '2026-12-31', amount: 120, applyToFuture: false, paused: true,
        },
      }));
    });

    expect(h.queryClient.getQueryData(queryKeys.expenseRecurrenceInfo('r1')))
      .toMatchObject({ freq: 'weekly', paused: true, endDate: '2026-12-31' });
  });

  it('falha ao gravar a receita aborta antes de mexer na despesa', async () => {
    h = withMutations({
      session,
      tables: { ...baseTables(), expense_recurrences: [] },
      fail: { 'expense_recurrences:upsert': 'boom' },
    });
    noRetry(h, UPDATE_EXPENSE_MUTATION_KEY);
    const { result } = await h.runReady(() => useUpdateExpense());

    const row = { id: 'r9', group_id: GROUP } as never;
    await act(async () => {
      result.current.updateExpense(updateBase({ recurrence: { action: 'create', id: 'r9', row } }));
    });
    await new Promise(r => setTimeout(r, 40));

    expect(h.mock.rpcNames()).not.toContain('update_expense_with_participants');
  });
});

describe('comprovante trocado', () => {
  it('o arquivo ANTIGO é apagado depois da despesa já apontar pro novo', async () => {
    // Na ordem inversa, uma falha da RPC deixaria a linha apontando pra um
    // arquivo que já não existe.
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => {
      result.current.updateExpense(updateBase({
        receiptPath: 'g1/novo.jpg', previousReceiptPath: 'g1/velho.jpg',
      }));
    });
    await waitFor(() => expect(h.mock.of('storage').some(c => c.op === 'remove')).toBe(true));

    const ordem = h.mock.calls.map(c => (c.kind === 'rpc' ? 'rpc' : c.kind === 'storage' ? `storage:${c.op}` : c.kind));
    expect(ordem.indexOf('rpc')).toBeLessThan(ordem.indexOf('storage:remove'));
  });

  it('comprovante que NÃO mudou não é apagado', async () => {
    h = withMutations({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => {
      result.current.updateExpense(updateBase({
        receiptPath: 'g1/mesmo.jpg', previousReceiptPath: 'g1/mesmo.jpg',
      }));
    });
    await new Promise(r => setTimeout(r, 30));

    expect(h.mock.of('storage').filter(c => c.op === 'remove')).toHaveLength(0);
  });
});

describe('apagar: falhas no meio do caminho', () => {
  it('falha ao PAUSAR a série aborta antes de apagar a despesa', async () => {
    h = withMutations({
      session,
      tables: { ...baseTables(), expense_recurrences: [{ id: 'r1', paused: false }] },
      fail: { 'expense_recurrences:update': 'boom' },
    });
    noRetry(h, DELETE_EXPENSE_MUTATION_KEY);
    const { result } = await h.runReady(() => useDeleteExpense());

    await act(async () => { result.current.deleteExpense('e1', GROUP, 'r1', true); });
    await new Promise(r => setTimeout(r, 40));

    expect(h.mock.of('delete').filter(c => c.table === 'expenses')).toHaveLength(0);
  });

  it('erro ao criar propaga a mensagem e desfaz o detalhe semeado', async () => {
    h = withMutations({
      session,
      tables: baseTables(),
      rpc: { create_expense_with_participants: () => ({ error: { message: 'boom' } }) },
    });
    noRetry(h, CREATE_EXPENSE_MUTATION_KEY);
    h.queryClient.setQueryData(queryKeys.expenses(GROUP), []);
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => {
      result.current.createExpense(createInput({
        recurrence: { freq: 'monthly', nextRunDate: new Date(2026, 3, 11) },
      }));
    });
    await waitFor(() => {
      expect(h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))).toHaveLength(0);
    });

    // O detalhe e a recorrência semeados no onMutate saem junto.
    expect(h.queryClient.getQueryData(queryKeys.expenseRecurrenceInfo('uuid-1'))).toBeUndefined();
  });
});

describe('rollback do otimista quando a mutação falha de vez', () => {
  const listaAntiga: LancamentoItem[] = [{
    id: 'e1', type: 'expense', title: 'Bar', categoryId: 'c1', amount: 100,
    paidById: BRUNO, paidByName: 'Bruno', paidByMe: false,
    date: '2026-03-10', createdAt: '2026-03-10T20:00:00Z',
    participantShares: { [ANA]: 50, [BRUNO]: 50 },
  }];
  const detalheAntigo = {
    id: 'e1', groupId: GROUP, title: 'Bar', description: null, categoryId: 'c1',
    amount: 100, splitType: 'equal', paidById: BRUNO, paidByName: 'Bruno',
    paidByPhotoUrl: null, paidByMe: false, createdByMe: true,
    date: '2026-03-10', receiptPath: null, recurrenceId: null, participants: [],
  };
  const saldoAntigo = { balances: { [ANA]: -50, [BRUNO]: 50 }, transfers: [], paymentsOnlyBalances: {} };

  const semear = (harness: Harness) => {
    harness.queryClient.setQueryData(queryKeys.expenses(GROUP), listaAntiga);
    harness.queryClient.setQueryData(queryKeys.groupBalances(GROUP), saldoAntigo);
    harness.queryClient.setQueryData(queryKeys.expense('e1'), detalheAntigo);
  };

  it('editar: o DETALHE mostra o valor novo na hora e volta ao antigo se falhar', async () => {
    h = withMutations({
      session, tables: baseTables(),
      rpc: { update_expense_with_participants: () => ({ error: { message: 'boom' } }) },
    });
    noRetry(h, UPDATE_EXPENSE_MUTATION_KEY);
    semear(h);
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => { result.current.updateExpense(updateBase()); });

    await waitFor(() => {
      expect(h.queryClient.getQueryData<{ amount: number }>(queryKeys.expense('e1'))!.amount).toBe(100);
    });
    const saldo = h.queryClient.getQueryData<{ balances: Record<string, number> }>(queryKeys.groupBalances(GROUP))!;
    expect(saldo.balances).toEqual({ [ANA]: -50, [BRUNO]: 50 });
  });

  it('editar com sucesso reescreve o detalhe com os participantes novos', async () => {
    h = withMutations({ session, tables: baseTables() });
    semear(h);
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => { result.current.updateExpense(updateBase()); });

    const det = h.queryClient.getQueryData<{ amount: number; participants: unknown[] }>(queryKeys.expense('e1'))!;
    expect(det.amount).toBe(120);
    expect(det.participants).toHaveLength(2);
  });

  it('apagar: o SALDO volta ao que era se a exclusão falhar', async () => {
    h = withMutations({ session, tables: baseTables(), fail: { 'expenses:delete': 'boom' } });
    noRetry(h, DELETE_EXPENSE_MUTATION_KEY);
    semear(h);
    const { result } = await h.runReady(() => useDeleteExpense());

    await act(async () => { result.current.deleteExpense('e1', GROUP, null, false); });

    await waitFor(() => {
      const s = h.queryClient.getQueryData<{ balances: Record<string, number> }>(queryKeys.groupBalances(GROUP))!;
      expect(s.balances).toEqual({ [ANA]: -50, [BRUNO]: 50 });
    });
  });

  it('ligar "Repetir" e falhar devolve a seção de recorrência ao estado anterior', async () => {
    h = withMutations({
      session, tables: { ...baseTables(), expense_recurrences: [] },
      rpc: { update_expense_with_participants: () => ({ error: { message: 'boom' } }) },
    });
    noRetry(h, UPDATE_EXPENSE_MUTATION_KEY);
    semear(h);
    const { result } = await h.runReady(() => useUpdateExpense());

    const row = { id: 'r9', group_id: GROUP, created_by: ANA, freq: 'monthly',
      interval_days: null, next_run_date: '2026-04-10', end_date: null, anchor_day: 10 } as never;
    await act(async () => {
      result.current.updateExpense(updateBase({ recurrence: { action: 'create', id: 'r9', row } }));
    });

    await waitFor(() => {
      expect(h.queryClient.getQueryData(queryKeys.expenseRecurrenceInfo('r9'))).toBeNull();
    });
  });
});

describe('erros nas etapas de recorrência e comprovante', () => {
  it.each([
    ['cancelar a receita', 'expense_recurrences:delete', { action: 'cancel' as const, id: 'r1' }],
    ['atualizar a série', 'expense_recurrences:update', {
      action: 'update' as const, id: 'r1', freq: 'monthly' as const, intervalDays: null,
      endDate: null, amount: 120, applyToFuture: false, paused: false,
    }],
    ['propagar a categoria pra série', 'expense_recurrences:update', { action: 'none' as const, id: 'r1' }],
  ])('falha ao %s propaga', async (_nome, chave, recurrence) => {
    h = withMutations({
      session,
      tables: { ...baseTables(), expense_recurrences: [{ id: 'r1', paused: false }] },
      fail: { [chave]: 'boom' },
    });
    noRetry(h, UPDATE_EXPENSE_MUTATION_KEY);
    let msg = '';
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => { result.current.updateExpense(updateBase({ recurrence }), m => { msg = m; }); });
    await waitFor(() => expect(msg).toBe('boom'));
  });

  it('falha ao gravar a receita na CRIAÇÃO aborta antes da despesa', async () => {
    h = withMutations({
      session, tables: { ...baseTables(), expense_recurrences: [] },
      fail: { 'expense_recurrences:upsert': 'boom' },
    });
    noRetry(h, CREATE_EXPENSE_MUTATION_KEY);
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => {
      result.current.createExpense(createInput({
        recurrence: { freq: 'monthly', nextRunDate: new Date(2026, 3, 11) },
      }));
    });
    await new Promise(r => setTimeout(r, 40));

    expect(h.mock.rpcNames()).not.toContain('create_expense_with_participants');
  });

  it('falha ao CONTAR ocorrências não encerra a série por engano', async () => {
    // A contagem decide se a série fica sem futuro. Errar pra baixo encerraria
    // uma série que ainda tem ocorrência.
    const t = baseTables();
    t.expenses[0].recurrence_id = 'r1';
    h = withMutations({
      session,
      tables: { ...t, expense_recurrences: [{ id: 'r1' }] },
      fail: { 'expenses:select': 'boom' },
    });
    noRetry(h, DELETE_EXPENSE_MUTATION_KEY);
    const { result } = await h.runReady(() => useDeleteExpense());

    await act(async () => { result.current.deleteExpense('e1', GROUP, 'r1', false); });
    await new Promise(r => setTimeout(r, 40));

    expect(h.mock.of('update').filter(c => c.table === 'expense_recurrences')).toHaveLength(0);
  });

  it('falha ao ENCERRAR a série órfã propaga', async () => {
    const t = baseTables();
    t.expenses[0].recurrence_id = 'r1';
    h = withMutations({
      session,
      tables: { ...t, expense_recurrences: [{ id: 'r1' }] },
      fail: { 'expense_recurrences:update': 'boom' },
    });
    noRetry(h, DELETE_EXPENSE_MUTATION_KEY);
    let msg = '';
    const { result } = await h.runReady(() => useDeleteExpense());

    await act(async () => { result.current.deleteExpense('e1', GROUP, 'r1', false, m => { msg = m; }); });
    await waitFor(() => expect(msg).toBe('boom'));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('configuração das mutações', () => {
  it('TODA mutação de despesa roda no mesmo escopo, em série', async () => {
    // Sem escopo elas correm em paralelo, e com retry a exclusão pode chegar
    // antes da criação — o que ressuscitaria a despesa.
    h = withMutations({ session, tables: baseTables() });

    for (const key of [CREATE_EXPENSE_MUTATION_KEY, UPDATE_EXPENSE_MUTATION_KEY, DELETE_EXPENSE_MUTATION_KEY]) {
      expect(h.queryClient.getMutationDefaults(key as unknown as string[]).scope)
        .toBe(EXPENSE_MUTATION_SCOPE);
    }
  });

  it('a descrição insiste MAIS que as outras — a despesa já está a salvo', async () => {
    // 6 tentativas, não 3: quando esta roda o insert já terminou, então
    // insistir não segura nada nem arrisca nada.
    h = withMutations({ session, tables: baseTables() });
    const d = h.queryClient.getMutationDefaults(DESCRIBE_EXPENSE_MUTATION_KEY as unknown as string[]);

    expect(d.retry).toBe(6);
    // A espera cresce, mas com teto — senão a última tentativa cairia em horas.
    const espera = d.retryDelay as (n: number) => number;
    expect(espera(0)).toBe(1000);
    expect(espera(3)).toBe(8000);
    expect(espera(20)).toBe(30000);
  });

  it('IA fora do ar não desfaz a despesa — ela já está gravada', async () => {
    // A descrição é mutação separada justamente pra isso: quando a IA falha,
    // o insert já terminou e nada é desfeito.
    h = withMutations({
      session, tables: baseTables(),
      fail: { 'invoke:categorize-expense': 'modelo indisponível' },
    });
    const atual = h.queryClient.getMutationDefaults(DESCRIBE_EXPENSE_MUTATION_KEY as unknown as string[]);
    h.queryClient.setMutationDefaults(DESCRIBE_EXPENSE_MUTATION_KEY as unknown as string[], { ...atual, retry: false });
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), []);
    const { result } = await h.runReady(() => useCreateExpense());

    await act(async () => { result.current.createExpense(createInput()); });
    await waitFor(() => expect(h.mock.of('invoke')).toHaveLength(1));
    await new Promise(r => setTimeout(r, 30));

    // A despesa continua na lista, só sem categoria.
    const lista = h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))!;
    expect(lista).toHaveLength(1);
    expect(lista[0].categoryId).toBeNull();
  });

  it('desligar "Repetir" desvincula a despesa da série na lista', async () => {
    h = withMutations({
      session,
      tables: { ...baseTables(), expense_recurrences: [{ id: 'r1', paused: false }] },
    });
    h.queryClient.setQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP), [{
      id: 'e1', type: 'expense', title: 'Bar', categoryId: 'c1', amount: 100,
      paidById: BRUNO, paidByName: 'Bruno', paidByMe: false,
      date: '2026-03-10', createdAt: '2026-03-10T20:00:00Z',
      participantShares: { [ANA]: 50, [BRUNO]: 50 }, recurrenceId: 'r1',
    }]);
    const { result } = await h.runReady(() => useUpdateExpense());

    await act(async () => {
      result.current.updateExpense(updateBase({ recurrence: { action: 'cancel', id: 'r1' } }));
    });

    const lista = h.queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(GROUP))!;
    expect(lista[0].recurrenceId).toBeNull();
  });

  it('criar, editar e apagar repetem 3 vezes antes de desistir', async () => {
    // Rede ruim não é rede ausente: sem repetir, uma oscilação de segundos
    // descartaria o lançamento. É seguro porque as RPCs são idempotentes.
    h = withMutations({ session, tables: baseTables() });

    for (const key of [CREATE_EXPENSE_MUTATION_KEY, UPDATE_EXPENSE_MUTATION_KEY, DELETE_EXPENSE_MUTATION_KEY]) {
      expect(h.queryClient.getMutationDefaults(key as unknown as string[]).retry).toBe(3);
    }
  });
});
