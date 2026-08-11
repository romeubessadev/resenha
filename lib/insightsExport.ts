import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { CURRENCY_SYMBOL, formatMoney } from './currencies';
import type { Language, TranslationKey } from './i18n';

type Translator = (key: TranslationKey, params?: Record<string, string | number>) => string;

export type ExportExpenseRow = {
  id: string;
  title: string;
  date: string;
  categoryId: string | null;
  amount: number;
  paidByName: string;
  participantNames?: string[];
  myShare?: number;
};

export type ExportCategoryRow = {
  key: string;
  label: string;
  amount: number;
  pct: number;
};

const DIACRITICS_RANGE = String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f);
const DIACRITICS_REGEX = new RegExp('[' + DIACRITICS_RANGE + ']', 'g');

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildFileBase(groupName: string, periodLabel: string): string {
  return `insights-${slugify(groupName)}-${slugify(periodLabel)}`;
}

function formatExportDate(iso: string, language: Language): string {
  // Extrai ano/mês/dia direto da string, sem passar por new Date(iso) — esse
  // parse trata o timestamp como instante UTC, e uma despesa materializada
  // nasce à meia-noite UTC, que em fuso negativo (Brasil, EUA) já vira o dia
  // anterior no relógio local.
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(language);
}

function formatCsvNumber(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace('.', ',');
}

/** Valor com o símbolo, pras colunas de dinheiro do CSV.
 *
 *  Não usa `formatMoney` (que o PDF usa) de propósito: o Intl devolve o R$
 *  separado por espaço NÃO-QUEBRÁVEL, e planilha costuma tropeçar nesse
 *  caractere ao tentar reconhecer a célula como moeda. Aqui o espaço é comum.
 *  Também não agrupa milhar, e por isso continua saindo do `toFixed` acima:
 *  agrupar dependeria do ICU do aparelho, que num Android sem dados completos
 *  devolveria "1,234.56" — formato errado pro Excel pt-BR e pro `;` que separa
 *  as colunas. Sem agrupamento o número é o mesmo em qualquer device, e o
 *  Excel pt-BR reconhece "R$ 1234,56" como moeda igual. */
function formatCsvMoney(n: number): string {
  return `${CURRENCY_SYMBOL} ${formatCsvNumber(n)}`;
}

function escapeCsvCell(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── CSV ───────────────────────────────────────────────────────────────────────

type BuildCsvParams = {
  expenses: ExportExpenseRow[];
  categoryNameById: Map<string, string>;
  fallbackCategoryLabel: string;
  language: Language;
  t: Translator;
};

export function buildInsightsCsv({
  expenses, categoryNameById, fallbackCategoryLabel, language, t,
}: BuildCsvParams): string {

  const headers = [
    t('insight.csvHeaderDate'),
    t('insight.csvHeaderDescription'),
    t('insight.csvHeaderCategory'),
    t('insight.csvHeaderPaidBy'),
    t('insight.csvHeaderAmount'),
    t('insight.csvHeaderParticipants'),
    t('insight.csvHeaderMyShare'),
  ];

  const lines = expenses.map(e => {
    const cells = [
      formatExportDate(e.date, language),
      e.title,
      categoryNameById.get(e.categoryId ?? '') ?? fallbackCategoryLabel,
      e.paidByName,
      formatCsvMoney(e.amount),
      (e.participantNames ?? []).filter(Boolean).join(', '),
      e.myShare != null ? formatCsvMoney(e.myShare) : '',
    ];
    return cells.map(escapeCsvCell).join(';');
  });

  const bom = String.fromCharCode(0xfeff);
  return bom + [headers.map(escapeCsvCell).join(';'), ...lines].join('\n');
}

// ── PDF ───────────────────────────────────────────────────────────────────────

type BuildPdfParams = {
  groupName: string;
  periodLabel: string;
  scopeLabel: string;
  total: number;
  categories: ExportCategoryRow[];
  expenses: ExportExpenseRow[];
  /** Mesmo par do CSV, pra resolver `categoryId` em nome legível. */
  categoryNameById: Map<string, string>;
  fallbackCategoryLabel: string;
  language: Language;
  t: Translator;
};

export function buildInsightsPdfHtml({
  groupName, periodLabel, scopeLabel, total, categories, expenses,
  categoryNameById, fallbackCategoryLabel,
  language, t,
}: BuildPdfParams): string {

  const categoryRows = categories.map(c => {
    return `<tr><td>${escapeHtml(c.label)}</td><td class="num">${escapeHtml(formatMoney(c.amount))}</td><td class="num">${c.pct}%</td></tr>`;
  }).join('');

  const expenseRows = expenses.map(e => {
    // Mesma ordem de colunas do CSV: data, descrição, categoria, quem pagou,
    // valor — os dois arquivos saem do mesmo botão e são lidos lado a lado.
    return `<tr>
      <td>${formatExportDate(e.date, language)}</td>
      <td>${escapeHtml(e.title)}</td>
      <td>${escapeHtml(categoryNameById.get(e.categoryId ?? '') ?? fallbackCategoryLabel)}</td>
      <td>${escapeHtml(e.paidByName)}</td>
      <td class="num">${escapeHtml(formatMoney(e.amount))}</td>
    </tr>`;
  }).join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111111; padding: 32px; }
  .eyebrow { font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
  h1 { font-size: 22px; margin: 4px 0 2px; }
  .meta { font-size: 13px; color: #6B7280; margin: 0 0 20px; }
  .totalCard { background: #F7F7FB; border-radius: 20px; padding: 20px; margin-bottom: 24px; }
  .totalLabel { font-size: 12px; color: #6B7280; margin: 0 0 6px; }
  .totalAmount { font-size: 30px; font-weight: 700; margin: 0; }
  .totalSecondary { font-size: 13px; color: #6B7280; margin: 4px 0 0; }
  h2 { font-size: 15px; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1px solid #E5E7EB; padding: 6px 8px; }
  td { font-size: 13px; padding: 8px; border-bottom: 1px solid #E5E7EB; }
  td.num, th.num { text-align: right; }
</style>
</head>
<body>
  <p class="eyebrow">Insights</p>
  <h1>${escapeHtml(groupName)}</h1>
  <p class="meta">${escapeHtml(periodLabel)} · ${escapeHtml(scopeLabel)}</p>

  <div class="totalCard">
    <p class="totalLabel">${escapeHtml(scopeLabel)}</p>
    <p class="totalAmount">${escapeHtml(formatMoney(total))}</p>
  </div>

  <h2>${t('insight.byCategory')}</h2>
  <table>
    <thead><tr><th>${t('insight.csvHeaderCategory')}</th><th class="num">${t('insight.csvHeaderAmount')}</th><th class="num">%</th></tr></thead>
    <tbody>${categoryRows}</tbody>
  </table>

  <h2>${t('insight.pdfExpensesTitle')}</h2>
  <table>
    <thead><tr><th>${t('insight.csvHeaderDate')}</th><th>${t('insight.csvHeaderDescription')}</th><th>${t('insight.csvHeaderCategory')}</th><th>${t('insight.csvHeaderPaidBy')}</th><th class="num">${t('insight.csvHeaderAmount')}</th></tr></thead>
    <tbody>${expenseRows}</tbody>
  </table>
</body>
</html>`;
}

// ── IO ────────────────────────────────────────────────────────────────────────

export async function exportInsightsCsv(csv: string, fileBase: string): Promise<void> {
  const file = new File(Paths.cache, `${fileBase}.csv`);
  if (file.exists) file.delete();
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: fileBase });
}

export async function exportInsightsPdf(html: string, fileBase: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const dest = new File(Paths.cache, `${fileBase}.pdf`);
  if (dest.exists) dest.delete();
  new File(uri).copy(dest);
  await Sharing.shareAsync(dest.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileBase });
}
