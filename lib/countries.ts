// `/max` pelo mesmo motivo documentado em lib/whatsapp.ts — os dois precisam
// usar a MESMA metadata, senão o país detectado aqui e a validação de lá
// podem discordar sobre o mesmo número.
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

// Bandeira derivada do ISO2 via regional indicator symbols ('B' + offset = 🇧),
// então não existe tabela de emoji pra sair de sincronia com a lista de países.
const FLAG_OFFSET = 0x1f1e6 - 'A'.charCodeAt(0);

export function flagFromIso(iso: string): string {
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map(c => c.charCodeAt(0) + FLAG_OFFSET),
  );
}

/** País de um número já salvo (dígitos com DDI, sem "+"). Usa o parser do
 *  libphonenumber, que separa países de mesmo DDI pelo DDD (+1 415 → US,
 *  +1 647 → CA) — coisa que match de prefixo não faz. Devolve null se o
 *  número for inválido ou curto demais pra identificar o país. */
export function countryFromPhone(stored: string | null): CountryCode | null {
  if (!stored) return null;
  return parsePhoneNumberFromString(`+${stored.replace(/\D/g, '')}`)?.country ?? null;
}
