import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime, formatDayLabel } from '@/lib/formatRelativeTime';

// Congelado num horário do meio do dia pra `formatDayLabel` não escorregar de
// dia por causa de fuso, e num ano NÃO bissexto.
const NOW = new Date(2026, 5, 15, 12, 0, 0);

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** ISO de um instante `ms` no passado, relativo ao NOW congelado. */
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('formatRelativeTime', () => {
  it('menos de um minuto é "agora"', () => {
    expect(formatRelativeTime(ago(0), 'pt-BR')).toBe('agora');
    expect(formatRelativeTime(ago(59_000), 'pt-BR')).toBe('agora');
  });

  it('minutos e horas', () => {
    expect(formatRelativeTime(ago(MIN), 'pt-BR')).toBe('há 1min');
    expect(formatRelativeTime(ago(5 * MIN), 'pt-BR')).toBe('há 5min');
    expect(formatRelativeTime(ago(59 * MIN), 'pt-BR')).toBe('há 59min');
    expect(formatRelativeTime(ago(HOUR), 'pt-BR')).toBe('há 1h');
    expect(formatRelativeTime(ago(23 * HOUR), 'pt-BR')).toBe('há 23h');
  });

  it('um dia é "ontem", não "há 1 dias"', () => {
    expect(formatRelativeTime(ago(DAY), 'pt-BR')).toBe('ontem');
  });

  it('dias e a fronteira com mês', () => {
    expect(formatRelativeTime(ago(2 * DAY), 'pt-BR')).toBe('há 2 dias');
    expect(formatRelativeTime(ago(29 * DAY), 'pt-BR')).toBe('há 29 dias');
    expect(formatRelativeTime(ago(30 * DAY), 'pt-BR')).toBe('há 1 mês');
    expect(formatRelativeTime(ago(60 * DAY), 'pt-BR')).toBe('há 2 meses');
  });

  it('singular e plural nunca saem trocados', () => {
    expect(formatRelativeTime(ago(30 * DAY), 'pt-BR')).toBe('há 1 mês');
    expect(formatRelativeTime(ago(365 * DAY), 'pt-BR')).toBe('há 1 ano');
    expect(formatRelativeTime(ago(730 * DAY), 'pt-BR')).toBe('há 2 anos');
  });

  it('nunca devolve uma quantidade zerada', () => {
    // A faixa de 360 a 364 dias cai entre "12 meses" e "1 ano": o mês já não
    // serve (months < 12 falhou) e o ano ainda não chegou (floor(364/365) = 0).
    for (const days of [355, 358, 360, 362, 364, 365, 370]) {
      const out = formatRelativeTime(ago(days * DAY), 'pt-BR');
      expect(out, `${days} dias virou "${out}"`).not.toMatch(/\b0\b/);
    }
  });
});

describe('formatDayLabel', () => {
  it('hoje e ontem por nome', () => {
    expect(formatDayLabel(NOW, 'pt-BR')).toBe('Hoje');
    expect(formatDayLabel(new Date(NOW.getTime() - DAY), 'pt-BR')).toBe('Ontem');
  });

  it('de 2 a 6 dias usa o dia da semana, capitalizado', () => {
    const out = formatDayLabel(new Date(NOW.getTime() - 3 * DAY), 'pt-BR');
    expect(out).toMatch(/^[A-ZÁ-Ú]/);
    expect(out.toLowerCase()).toContain('feira');
  });

  it('no 7º dia vira data, pra não repetir o nome de hoje', () => {
    const out = formatDayLabel(new Date(NOW.getTime() - 7 * DAY), 'pt-BR');
    expect(out.toLowerCase()).not.toContain('feira');
    expect(out).toMatch(/\d/);
  });

  it('não escorrega de dia perto da meia-noite', () => {
    const lateToday = new Date(2026, 5, 15, 23, 50, 0);
    expect(formatDayLabel(lateToday, 'pt-BR')).toBe('Hoje');
    const earlyToday = new Date(2026, 5, 15, 0, 5, 0);
    expect(formatDayLabel(earlyToday, 'pt-BR')).toBe('Hoje');
  });
});

