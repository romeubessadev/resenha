import { describe, it, expect } from 'vitest';
import { parseDateOnly, computeOwnPosition, computeTotalOccurrences, type RecurrencePattern } from '@/lib/recurrence';
import { nextOccurrenceAfter } from '@/hooks/useExpenseForm';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);

const pattern = (over: Partial<RecurrencePattern> = {}): RecurrencePattern =>
  ({ freq: 'daily', intervalDays: null, anchorDay: 1, ...over });

describe('parseDateOnly', () => {
  it('lê YYYY-MM-DD como meia-noite LOCAL, não UTC', () => {
    const d = parseDateOnly('2026-03-05');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 5]);
    expect(d.getHours()).toBe(0);
  });

  it('aceita ISO completo descartando a hora', () => {
    const d = parseDateOnly('2026-03-05T23:59:59.000Z');
    expect(iso(d)).toBe('2026-03-05');
  });
});

describe('nextOccurrenceAfter — ritmos simples', () => {
  it('diário atravessa a virada de mês', () => {
    expect(iso(nextOccurrenceAfter(at(2026, 1, 31), 'daily'))).toBe('2026-02-01');
  });

  it('semanal soma 7 dias', () => {
    expect(iso(nextOccurrenceAfter(at(2026, 1, 28), 'weekly'))).toBe('2026-02-04');
  });

  it('custom usa o intervalo', () => {
    expect(iso(nextOccurrenceAfter(at(2026, 1, 1), 'custom', 10))).toBe('2026-01-11');
  });

  it('custom com intervalo zero ou ausente não trava a série', () => {
    expect(iso(nextOccurrenceAfter(at(2026, 1, 1), 'custom', 0))).toBe('2026-01-02');
    expect(iso(nextOccurrenceAfter(at(2026, 1, 1), 'custom'))).toBe('2026-01-02');
  });
});

describe('nextOccurrenceAfter — grampeamento e âncora (migration 0076)', () => {
  it('grampeia no último dia do mês curto em vez de transbordar', () => {
    // Sem o setDate(1), o setMonth transbordaria 31/01 + 1 mês pra 03/03.
    expect(iso(nextOccurrenceAfter(at(2026, 1, 31), 'monthly'))).toBe('2026-02-28');
  });

  it('RECUPERA a âncora depois de um mês grampeado', () => {
    // Este é o bug que a âncora existe pra evitar: 29/01 → 28/02, e a partir
    // daí a série TODA seguiria em 28 se o dia de origem se perdesse.
    const feb = nextOccurrenceAfter(at(2026, 1, 29), 'monthly', undefined, 29);
    expect(iso(feb)).toBe('2026-02-28');
    expect(iso(nextOccurrenceAfter(feb, 'monthly', undefined, 29))).toBe('2026-03-29');
  });

  it('sem âncora, a série fica presa no dia grampeado — o contraste que justifica o parâmetro', () => {
    const feb = nextOccurrenceAfter(at(2026, 1, 29), 'monthly', undefined, 29);
    expect(iso(nextOccurrenceAfter(feb, 'monthly'))).toBe('2026-03-28');
  });

  it('anual grampeia 29/02 em ano não bissexto', () => {
    expect(iso(nextOccurrenceAfter(at(2024, 2, 29), 'yearly', undefined, 29))).toBe('2025-02-28');
  });

  it('anual volta ao 29/02 no bissexto seguinte, mantida a âncora', () => {
    let cur = at(2024, 2, 29);
    for (let i = 0; i < 4; i++) cur = nextOccurrenceAfter(cur, 'yearly', undefined, 29);
    expect(iso(cur)).toBe('2028-02-29');
  });
});

describe('computeOwnPosition', () => {
  it('a própria semente é a 1ª ocorrência', () => {
    expect(computeOwnPosition(at(2026, 1, 1), at(2026, 1, 1), pattern())).toBe(1);
  });

  it('conta os passos do padrão até a data', () => {
    expect(computeOwnPosition(at(2026, 1, 1), at(2026, 1, 11), pattern())).toBe(11);
    expect(computeOwnPosition(at(2026, 1, 1), at(2026, 1, 29), pattern({ freq: 'weekly' }))).toBe(5);
  });

  it('conta série mensal grampeada sem se perder', () => {
    const p = pattern({ freq: 'monthly', anchorDay: 31 });
    expect(computeOwnPosition(at(2026, 1, 31), at(2026, 3, 31), p)).toBe(3);
  });
});

describe('computeTotalOccurrences', () => {
  it('sem término não há total pra mostrar', () => {
    expect(computeTotalOccurrences(pattern(), at(2026, 1, 1), null)).toBeNull();
  });

  it('conta a semente e o término como ocorrências (inclusive nas duas pontas)', () => {
    expect(computeTotalOccurrences(pattern(), at(2026, 1, 1), '2026-01-10')).toBe(10);
  });

  it('término no mesmo dia da semente conta 1', () => {
    expect(computeTotalOccurrences(pattern(), at(2026, 1, 1), '2026-01-01')).toBe(1);
  });

  it('término antes da semente conta 0', () => {
    expect(computeTotalOccurrences(pattern(), at(2026, 1, 10), '2026-01-01')).toBe(0);
  });

  it('conta mensal atravessando meses de tamanhos diferentes', () => {
    const p = pattern({ freq: 'monthly', anchorDay: 31 });
    expect(computeTotalOccurrences(p, at(2026, 1, 31), '2026-04-30')).toBe(4);
  });

  it('devolve null em vez de travar quando o término está absurdamente longe', () => {
    expect(computeTotalOccurrences(pattern(), at(2026, 1, 1), '2200-01-01')).toBeNull();
  });
});
