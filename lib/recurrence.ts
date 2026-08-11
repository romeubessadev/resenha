// Posição e total de ocorrências de uma série — o "3ª de 12".
//
// Vive aqui, e não na tela, porque duas superfícies fazem a MESMA conta e
// precisam chegar no mesmo número: o detalhe da despesa (posição daquela
// ocorrência) e a tela de Recorrências (progresso da série). Duas cópias
// divergiriam no primeiro ajuste de regra.
//
// Tudo é derivado do ritmo, não contado no banco: as ocorrências passadas
// podem ter sido apagadas (despesa é hard delete), então contar linhas daria
// um número menor que a realidade da série.
import { nextOccurrenceAfter, type RecurrenceFreq } from '@/hooks/useExpenseForm';
import type { TranslationKey } from './i18n';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

const FREQ_LABEL: Record<string, TranslationKey> = {
  daily: 'expenseForm.recurringSummaryDaily',
  weekly: 'expenseForm.recurringSummaryWeekly',
  monthly: 'expenseForm.recurringSummaryMonthly',
  yearly: 'expenseForm.recurringSummaryYearly',
};

/** O ritmo em palavras ("Repete todo mês"). Reaproveita as frases que o
 *  formulário já usa em vez de criar um segundo vocabulário pra dizer a mesma
 *  coisa — e mora aqui, junto do resto da série, porque três superfícies já
 *  precisam dele: o histórico, o formulário e o sheet de recorrências. */
export function rhythmLabel(freq: string, intervalDays: number | null, t: T): string {
  if (freq === 'custom') return t('expenseForm.recurringSummaryCustom', { days: intervalDays ?? 1 });
  const key = FREQ_LABEL[freq];
  return key ? t(key) : '';
}

/** O ritmo da série — o suficiente pra caminhar de uma ocorrência à próxima. */
export type RecurrencePattern = {
  freq: RecurrenceFreq;
  intervalDays: number | null;
  /** Dia do mês que ancora a série (1-31). */
  anchorDay: number;
};

// Teto da varredura, igual ao do RecurrenceSheet: cobre diário por ~27 anos.
// Estourou (término absurdamente longe), devolve "não sei" em vez de travar a
// lista — a tela some com o progresso e mostra o resto normalmente.
const MAX_SCAN_STEPS = 10000;

/** "YYYY-MM-DD" (ou ISO completo) → Date local à meia-noite. Local, não UTC:
 *  `new Date('2026-03-05')` cai no dia anterior em fuso negativo. */
export function parseDateOnly(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Quantos passos do padrão existem entre a semente e `thisDate` (inclusive,
 *  1-indexado) — a posição daquela ocorrência na série. */
export function computeOwnPosition(seedDate: Date, thisDate: Date, pattern: RecurrencePattern): number {
  let position = 1;
  let cur = seedDate;
  let steps = 0;
  while (cur < thisDate && steps++ < MAX_SCAN_STEPS) {
    cur = nextOccurrenceAfter(cur, pattern.freq, pattern.intervalDays ?? undefined, pattern.anchorDay);
    position++;
  }
  return position;
}

/** Quantas ocorrências existem entre a semente e o término (inclusive) — null
 *  quando não há término (série aberta, sem total pra mostrar). */
export function computeTotalOccurrences(
  pattern: RecurrencePattern,
  seedDate: Date,
  endDate: string | null,
): number | null {
  if (!endDate) return null;
  const end = parseDateOnly(endDate);
  let total = 0;
  let cur = seedDate;
  while (cur <= end) {
    if (total >= MAX_SCAN_STEPS) return null;
    total++;
    cur = nextOccurrenceAfter(cur, pattern.freq, pattern.intervalDays ?? undefined, pattern.anchorDay);
  }
  return total;
}
