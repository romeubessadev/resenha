import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { historyEventAmount, isVisibleHistoryEvent, groupEventsByDay, historyEventText } from '@/lib/historyText';
import { formatMoney } from '@/lib/currencies';
import { translate, type TranslationKey } from '@/lib/i18n';
import type { HistoryEvent } from '@/hooks/useGroupHistory';

const t = (key: TranslationKey, params?: Record<string, string | number>) => translate('pt-BR', key, params);

const ME = 'me';
const NOW = new Date(2026, 5, 15, 12, 0, 0);
const DAY = 86_400_000;

const base = { id: 'ev1', actorId: 'other', actorName: 'Bruno', actorAvatarPath: null, at: NOW.toISOString() };

const expenseEvent = (over: Partial<Record<string, unknown>> = {}): HistoryEvent => ({
  ...base,
  type: 'expense_created',
  payload: {
    expenseId: 'e1', title: 'Churrasco', amount: 120, prevAmount: null,
    splitType: 'equal', participants: [{ userId: ME, name: 'Você', shares: null, exactAmount: null }],
    ...over,
  },
} as HistoryEvent);

const adminEvent = (roleFrom: string, roleTo: string): HistoryEvent => ({
  ...base,
  type: 'admin_changed',
  payload: { memberUserId: 'u2', memberName: 'Ana', roleFrom, roleTo },
} as HistoryEvent);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('isVisibleHistoryEvent', () => {
  it('esconde troca de coroa entre quem já é admin — a tela mostraria o mesmo', () => {
    expect(isVisibleHistoryEvent(adminEvent('admin', 'owner'))).toBe(false);
    expect(isVisibleHistoryEvent(adminEvent('owner', 'admin'))).toBe(false);
  });

  it('mostra promoção e rebaixamento de verdade', () => {
    expect(isVisibleHistoryEvent(adminEvent('member', 'admin'))).toBe(true);
    expect(isVisibleHistoryEvent(adminEvent('admin', 'member'))).toBe(true);
  });

  it('todo outro tipo de evento aparece', () => {
    expect(isVisibleHistoryEvent(expenseEvent())).toBe(true);
  });
});

describe('historyEventAmount', () => {
  it('despesa criada e editada usam a variante padrão', () => {
    expect(historyEventAmount(expenseEvent())).toEqual({ text: formatMoney(120), variant: 'default' });
    const edited = { ...expenseEvent(), type: 'expense_edited' } as HistoryEvent;
    expect(historyEventAmount(edited)?.variant).toBe('default');
  });

  it('despesa apagada tem variante própria', () => {
    const deleted = { ...base, type: 'expense_deleted', payload: { expenseId: 'e1', title: 'X', amount: 50 } } as HistoryEvent;
    expect(historyEventAmount(deleted)).toEqual({ text: formatMoney(50), variant: 'deleted' });
  });

  it('acerto tem variante própria', () => {
    const settlement = {
      ...base, type: 'settlement',
      payload: { settlementId: 's1', fromUserId: 'a', fromName: 'Ana', toUserId: ME, toName: 'Você', amount: 30, hasProof: false },
    } as HistoryEvent;
    expect(historyEventAmount(settlement)).toEqual({ text: formatMoney(30), variant: 'settlement' });
  });

  it('evento sem dinheiro não tem valor pra mostrar', () => {
    const joined = { ...base, type: 'member_joined', payload: { memberUserId: 'u2', memberName: 'Ana' } } as HistoryEvent;
    expect(historyEventAmount(joined)).toBeNull();
    expect(historyEventAmount(adminEvent('member', 'admin'))).toBeNull();
  });
});

describe('historyEventText', () => {
  it('nomeia o autor e a despesa', () => {
    const { title } = historyEventText(expenseEvent(), ME, t);
    expect(title).toContain('Bruno');
    expect(title).toContain('Churrasco');
  });

  it('resolve "você" quando o autor é quem está olhando', () => {
    const mine = { ...expenseEvent(), actorId: ME, actorName: 'Eu' } as HistoryEvent;
    expect(historyEventText(mine, ME, t).title.toLowerCase()).toContain('você');
  });

  it('edição diz O QUE mudou (migration 0094)', () => {
    const edited = {
      ...expenseEvent({ prevAmount: 100, changed: ['amount'] }),
      type: 'expense_edited',
    } as HistoryEvent;
    const { detail } = historyEventText(edited, ME, t);
    expect(detail).not.toBeNull();
    // O "de → para" precisa dos dois valores.
    expect(detail).toContain(formatMoney(100));
    expect(detail).toContain(formatMoney(120));
  });

  it('edição de evento antigo (sem `changed`) ainda gera uma linha', () => {
    // Evento gravado antes da 0094 não tem o campo — não pode virar tela vazia.
    const edited = { ...expenseEvent(), type: 'expense_edited' } as HistoryEvent;
    const out = historyEventText(edited, ME, t);
    expect(out.title).toBeTruthy();
  });

  it('despesa apagada informa o valor que saiu', () => {
    const deleted = { ...base, type: 'expense_deleted', payload: { expenseId: 'e1', title: 'Uber', amount: 50 } } as HistoryEvent;
    const { title, detail } = historyEventText(deleted, ME, t);
    expect(title).toContain('Uber');
    expect(detail).toContain(formatMoney(50));
  });

  it('nunca devolve título vazio, em nenhum tipo', () => {
    const tipos: HistoryEvent[] = [
      expenseEvent(),
      adminEvent('member', 'admin'),
      { ...base, type: 'member_joined', payload: { memberUserId: 'u2', memberName: 'Ana' } } as HistoryEvent,
      { ...base, type: 'member_left', payload: { memberUserId: 'u2', memberName: 'Ana', removedByActor: false } } as HistoryEvent,
      { ...base, type: 'group_created', payload: {} } as HistoryEvent,
      { ...base, type: 'group_edited', payload: { nameChanged: true, avatarChanged: false, currencyChanged: false, newName: 'Praia', newCurrency: 'BRL' } } as HistoryEvent,
    ];
    for (const ev of tipos) {
      expect(historyEventText(ev, ME, t).title.trim(), `tipo ${ev.type}`).not.toBe('');
    }
  });
});

describe('groupEventsByDay', () => {
  const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  it('junta eventos do mesmo dia num grupo só', () => {
    const events = [
      { ...expenseEvent(), id: 'a', at: at(0) },
      { ...expenseEvent(), id: 'b', at: at(2 * 3_600_000) },
    ] as HistoryEvent[];
    const groups = groupEventsByDay(events, 'pt-BR');
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Hoje');
    expect(groups[0].events).toHaveLength(2);
  });

  it('separa dias diferentes e rotula cada um', () => {
    const events = [
      { ...expenseEvent(), id: 'a', at: at(0) },
      { ...expenseEvent(), id: 'b', at: at(DAY) },
      { ...expenseEvent(), id: 'c', at: at(2 * DAY) },
    ] as HistoryEvent[];
    const groups = groupEventsByDay(events, 'pt-BR');
    expect(groups).toHaveLength(3);
    expect(groups[0].label).toBe('Hoje');
    expect(groups[1].label).toBe('Ontem');
  });

  it('não perde nenhum evento no agrupamento', () => {
    const events = Array.from({ length: 9 }, (_, i) => ({
      ...expenseEvent(), id: `e${i}`, at: at(Math.floor(i / 3) * DAY),
    })) as HistoryEvent[];
    const groups = groupEventsByDay(events, 'pt-BR');
    expect(groups.flatMap(g => g.events)).toHaveLength(9);
    expect(groups).toHaveLength(3);
  });

  it('lista vazia devolve nenhum grupo', () => {
    expect(groupEventsByDay([], 'pt-BR')).toEqual([]);
  });
});
