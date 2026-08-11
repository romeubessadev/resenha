// ═══════════════════════════════════════════════════════════════════════════
// currencies
//
// O app é exclusivo do Brasil: uma moeda só, o real. Saíram daqui o catálogo
// de 166 moedas, a conversão via USD (`convert`), o tipo `FxRates` e a lente
// que mostrava "≈" na moeda do usuário — junto com a tabela `fx_rates`, o cron
// que a atualizava e o seletor de moeda.
//
// Sobrou o que o app de fato faz: formatar real.
// ═══════════════════════════════════════════════════════════════════════════

const LOCALE = 'pt-BR';
const CODE = 'BRL';

export const CURRENCY_SYMBOL = 'R$';

export function formatMoney(amount: number): string {
  // O try/catch não é paranoia: nem todo device traz dados de moeda no ICU, e
  // `style: 'currency'` LANÇA quando faltam. Como isto roda em render de tela,
  // sem a rede de proteção a tela inteira cai. Estava aqui antes do multi-moeda
  // sair e eu tinha removido junto — não é código morto.
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CODE }).format(amount);
  } catch {
    return `${CURRENCY_SYMBOL} ${amount.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
