// Entrypoint `/max` (e não o padrão) porque só a metadata completa valida de
// verdade: no import padrão, `isValidPhoneNumber('999999999', 'BR')` devolve
// true — ele confere formato genérico, não os prefixos reais de cada país.
// Custa ~72 KB a mais de metadata. `/mobile` seria 57 KB mais leve, mas
// recusa número fixo, e WhatsApp Business roda em fixo.
// IMPORTANTE: quem mexer com telefone deve importar deste mesmo entrypoint —
// misturar `min` e `max` faz validação e parsing discordarem entre si.
import {
  AsYouType,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max';
import examples from 'libphonenumber-js/examples.mobile.json';

/** Número é sempre brasileiro — máscara, validação e E.164 saem daqui. O DDI
 *  não aparece na UI: sem seletor de país, mostrá-lo é decoração.
 *
 *  Mora aqui, e não no sheet que edita o número, porque a linha do perfil que
 *  só EXIBE precisa da mesma premissa: foi por ela ter ficado pra trás que o
 *  perfil continuou mostrando "+55" e a bandeira depois do seletor sair. */
export const WHATSAPP_COUNTRY: CountryCode = 'BR';

/** Só dígitos — remove máscara, espaços, parênteses etc. */
export function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Formata os dígitos nacionais no padrão do país escolhido enquanto a pessoa
 *  digita — (11) 98765-4321 no Brasil, (415) 555-1234 nos EUA, 612 34 56 78
 *  na Espanha.
 *
 *  O `replace` no fim corta separador pendurado na ponta e não é cosmético: o
 *  AsYouType formata 2 dígitos de BR como "(11)", então apagar o ")" deixaria
 *  os mesmos 2 dígitos, que reformatam pra "(11)" de novo — o campo travaria
 *  no backspace. Terminando sempre em dígito, apagar um caractere sempre
 *  reduz a contagem de dígitos. */
export function formatNationalPhone(raw: string, country: CountryCode): string {
  return new AsYouType(country).input(onlyDigits(raw)).replace(/\D+$/, '');
}

/** Valida os dígitos nacionais pro país — comprimento e prefixo de verdade,
 *  não só contagem de dígitos. */
export function isValidPhone(raw: string, country: CountryCode): boolean {
  return isValidPhoneNumber(onlyDigits(raw), country);
}

/** Dígitos nacionais + país → formato salvo no banco e usado no deep link do
 *  WhatsApp: E.164 sem "+" e sem máscara (ex.: 5511987654321).
 *
 *  Sai pelo parser em vez de concatenar DDI + dígitos porque em vários países
 *  o número nacional carrega prefixo de tronco que não entra no E.164 (no
 *  Reino Unido 07911 123456 é +44 7911 123456, sem o 0) — concatenar geraria
 *  um número errado.
 *
 *  Devolve null quando o número não é válido pro país; quem chama não salva. */
export function toWhatsappNumber(raw: string, country: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(onlyDigits(raw), country);
  return parsed?.isValid() ? parsed.number.slice(1) : null;
}

/** Reverso de `toWhatsappNumber` — tira o DDI do número salvo pra reexibir e
 *  editar os dígitos nacionais no campo. */
export function fromWhatsappNumber(stored: string | null): string {
  if (!stored) return '';
  const digits = onlyDigits(stored);
  return parsePhoneNumberFromString(`+${digits}`)?.nationalNumber ?? digits;
}

/** Exemplo de celular do país, pra usar como placeholder do campo — assim ele
 *  mostra o formato que aquele país espera em vez de um número brasileiro
 *  fixo. Vem da tabela de exemplos do próprio libphonenumber (4 KB) e não do
 *  i18n: formato de telefone é característica do país, não do idioma. */
export function examplePhone(country: CountryCode): string {
  return getExampleNumber(country, examples)?.formatNational() ?? '';
}

/** Número salvo → exibição em formato internacional (ex.: +44 20 7946 0958).
 *
 *  Hoje só serve pros números salvos de OUTRO país, de quando dava pra escolher
 *  o DDI: reexibi-los no formato nacional brasileiro mostraria um número
 *  diferente do salvo. Número brasileiro se exibe pelo formatNationalPhone,
 *  igual ao campo do sheet — ver WHATSAPP_COUNTRY. */
export function formatWhatsappDisplay(stored: string | null): string {
  if (!stored) return '';
  const digits = onlyDigits(stored);
  return parsePhoneNumberFromString(`+${digits}`)?.formatInternational() ?? `+${digits}`;
}
