import { translate, type Language } from './i18n';

export function formatRelativeTime(iso: string, language: Language): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return translate(language, 'relativeTime.now');
  if (minutes < 60) return translate(language, 'relativeTime.minutesAgo', { n: minutes });
  if (hours < 24) return translate(language, 'relativeTime.hoursAgo', { n: hours });
  if (days === 1) return translate(language, 'relativeTime.yesterday');
  if (days < 30) return translate(language, 'relativeTime.daysAgo', { n: days });

  const months = Math.floor(days / 30);
  // A fronteira é em DIAS, não em `months < 12`: o mês tem 30 dias aqui, então
  // 360 dias já dão 12 meses e caíam no ramo do ano — onde floor(360/365) é 0 e
  // o card exibia "há 0 anos". De 360 a 364 dias agora sai "há 12 meses".
  if (days < 365) return translate(language, months === 1 ? 'relativeTime.monthAgo' : 'relativeTime.monthsAgo', { n: months });

  const years = Math.floor(days / 365);
  return translate(language, years === 1 ? 'relativeTime.yearAgo' : 'relativeTime.yearsAgo', { n: years });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Cabeçalho de dia no padrão do WhatsApp: Hoje → Ontem → dia da semana por
 * extenso → data. O corte é em 6 dias porque no 7º o nome do dia repetiria o
 * de hoje ("segunda-feira" tanto pra hoje quanto pra uma semana atrás).
 *
 * Recebe a `Date` já montada de propósito: cada tela parseia a sua de um jeito
 * diferente e os dois estão certos — campo só-data precisa de parse manual pra
 * não escorregar um dia em fuso negativo, timestamptz pode ir direto.
 */
export function formatDayLabel(date: Date, language: Language): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (diffDays === 0) return translate(language, 'common.today');
  if (diffDays === 1) return translate(language, 'common.yesterday');

  const format: Intl.DateTimeFormatOptions = diffDays > 1 && diffDays < 7
    ? { weekday: 'long' }
    : { day: '2-digit', month: 'short' };
  return capitalize(date.toLocaleDateString(language, format));
}
