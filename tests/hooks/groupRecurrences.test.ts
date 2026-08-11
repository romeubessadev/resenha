// @vitest-environment jsdom
//
// A lista de recorrências do rolê. O que ela decide e ninguém mais decide:
// em que ESTADO cada série está (ativa, pausada, encerrada), em que ponto da
// série a pessoa está, e qual despesa o "Ver despesa" abre.
import { describe, it, expect, afterEach } from 'vitest';
import { createHarness, waitFor, type Harness } from '../support/hookHarness';
import type { MockRow } from '../support/supabaseMock';
import { useGroupRecurrences } from '@/hooks/useGroupRecurrences';

const GROUP = 'g1';
const ANA = 'ana';
const BRUNO = 'bruno';
const session = { user: { id: ANA } };

const receita = (over: Record<string, unknown> = {}): MockRow => ({
  id: 'r1', group_id: GROUP, title: 'Aluguel', amount: 100, category_id: 'c1',
  paid_by: ANA, split_type: 'equal',
  participants: [{ userId: ANA, shares: null, exactAmount: null },
                 { userId: BRUNO, shares: null, exactAmount: null }],
  freq: 'monthly', interval_days: null, anchor_day: 10,
  next_run_date: '2026-06-10', end_date: null,
  active: true, paused: false, deleted_at: null, created_by: ANA,
  ...over,
});

const ocorrencia = (id: string, date: string, rid = 'r1'): MockRow =>
  ({ id, recurrence_id: rid, date });

const tabelas = (recorrencias: MockRow[], ocorrencias: MockRow[] = []) => ({
  expense_recurrences: recorrencias,
  expenses: ocorrencias,
});

let h: Harness;
afterEach(() => h?.dispose());

describe('estado de cada série', () => {
  it('série rodando é "active"', async () => {
    h = createHarness({ session, tables: tabelas([receita()]) });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(1));

    expect(result.current.recurrences[0].status).toBe('active');
  });

  it('pausada ganha "paused" mesmo continuando ativa no banco', async () => {
    // São coisas diferentes: `paused` está parada por escolha e pode voltar.
    h = createHarness({ session, tables: tabelas([receita({ paused: true, active: true })]) });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(1));

    expect(result.current.recurrences[0].status).toBe('paused');
  });

  it('série que acabou sozinha é "finished"', async () => {
    h = createHarness({ session, tables: tabelas([receita({ active: false, paused: false })]) });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(1));

    expect(result.current.recurrences[0].status).toBe('finished');
  });

  it('pausa ganha de encerrada quando as duas valem', async () => {
    // Ordem importa: quem pausou uma série que já terminou deve ver "pausada",
    // que é o estado sobre o qual ela ainda pode agir.
    h = createHarness({ session, tables: tabelas([receita({ active: false, paused: true })]) });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(1));

    expect(result.current.recurrences[0].status).toBe('paused');
  });
});

describe('ordem da lista', () => {
  it('ativa vem antes de pausada, que vem antes de encerrada', async () => {
    h = createHarness({
      session,
      tables: tabelas([
        receita({ id: 'fim', title: 'Encerrada', active: false }),
        receita({ id: 'pausa', title: 'Pausada', paused: true }),
        receita({ id: 'viva', title: 'Ativa' }),
      ]),
    });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(3));

    expect(result.current.recurrences.map(r => r.id)).toEqual(['viva', 'pausa', 'fim']);
  });

  it('dentro do mesmo estado, a próxima cobrança mais perto vem primeiro', async () => {
    h = createHarness({
      session,
      tables: tabelas([
        receita({ id: 'longe', next_run_date: '2026-12-01' }),
        receita({ id: 'perto', next_run_date: '2026-06-01' }),
      ]),
    });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(2));

    expect(result.current.recurrences.map(r => r.id)).toEqual(['perto', 'longe']);
  });
});

describe('ocorrências da série', () => {
  it('a PRIMEIRA data ancora o progresso da série', async () => {
    h = createHarness({
      session,
      tables: tabelas([receita()], [
        ocorrencia('e1', '2026-01-10'),
        ocorrencia('e2', '2026-02-10'),
        ocorrencia('e3', '2026-03-10'),
      ]),
    });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(1));

    expect(result.current.recurrences[0].firstOccurrenceDate).toBe('2026-01-10');
  });

  it('"Ver despesa" abre a ocorrência MAIS RECENTE', async () => {
    h = createHarness({
      session,
      tables: tabelas([receita()], [
        ocorrencia('e1', '2026-01-10'),
        ocorrencia('e2', '2026-02-10'),
        ocorrencia('e3', '2026-03-10'),
      ]),
    });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(1));

    expect(result.current.recurrences[0].latestExpenseId).toBe('e3');
  });

  it('série sem nenhuma ocorrência ainda não quebra', async () => {
    h = createHarness({ session, tables: tabelas([receita()], []) });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(1));

    expect(result.current.recurrences[0]).toMatchObject({
      firstOccurrenceDate: null, latestExpenseId: null,
    });
  });

  it('ocorrência de OUTRA série não entra na conta desta', async () => {
    h = createHarness({
      session,
      tables: tabelas(
        [receita({ id: 'r1' }), receita({ id: 'r2', title: 'Netflix' })],
        [ocorrencia('e1', '2026-01-10', 'r1'), ocorrencia('e9', '2026-05-10', 'r2')],
      ),
    });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(2));

    const r1 = result.current.recurrences.find(r => r.id === 'r1')!;
    expect(r1.latestExpenseId).toBe('e1');
  });
});

describe('o que cada série mostra', () => {
  it('divide o valor entre os participantes gravados na receita', async () => {
    h = createHarness({ session, tables: tabelas([receita({ amount: 100 })]) });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.recurrences).toHaveLength(1));

    expect(result.current.recurrences[0].participantShares).toEqual({ [ANA]: 50, [BRUNO]: 50 });
    expect(result.current.recurrences[0].participantCount).toBe(2);
  });

  it('série apagada (soft delete) não aparece', async () => {
    // O filtro é `deleted_at is null` — a linha some da lista sem levar junto
    // o vínculo das ocorrências passadas.
    h = createHarness({ session, tables: tabelas([receita({ deleted_at: '2026-05-01' })]) });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.recurrences).toEqual([]);
  });

  it('erro de banco vira mensagem amigável, nunca o texto do Postgres', async () => {
    h = createHarness({
      session,
      tables: tabelas([receita()]),
      fail: { 'expense_recurrences:select': 'new row violates row-level security policy' },
    });
    const { result } = h.run(() => useGroupRecurrences(GROUP));
    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.error).toBe('Erro ao carregar as recorrências');
    expect(result.current.error).not.toContain('row-level security');
  });

  it('sem groupId não consulta o banco', async () => {
    h = createHarness({ session, tables: tabelas([receita()]) });
    h.run(() => useGroupRecurrences(undefined));
    await new Promise(r => setTimeout(r, 20));

    expect(h.mock.of('select').filter(c => c.table === 'expense_recurrences')).toHaveLength(0);
  });
});
