// Chave Pix: máscara, validação e o formato que vai pro banco.
//
// Telefone reaproveita lib/whatsapp.ts inteiro — é o mesmo número, com a mesma
// metadata do libphonenumber, e ter duas validações de telefone no app seria
// pedir pra elas discordarem sobre o mesmo dígito.
import {
  WHATSAPP_COUNTRY,
  formatNationalPhone,
  fromWhatsappNumber,
  isValidPhone,
  onlyDigits,
  toWhatsappNumber,
} from './whatsapp';

/** Os 4 tipos que o Pix aceita — mesmos valores do check no banco. */
export type PixKeyType = 'cpf' | 'email' | 'phone' | 'random';

export const PIX_KEY_TYPES: PixKeyType[] = ['cpf', 'email', 'phone', 'random'];

// Mesma regra dos campos de e-mail do cadastro e da recuperação de senha.
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Chave aleatória (EVP) é sempre um UUID com hífens. Aceita qualquer versão:
// o banco é quem gera, e recusar por versão só criaria falso negativo.
const EVP_RULE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** CPF com dígito verificador conferido, não só contagem de dígitos.
 *
 *  Vale o custo porque o erro que isso pega é o mais provável e o mais caro:
 *  um dígito trocado passa por qualquer validação de tamanho, e quem descobre
 *  é a pessoa tentando pagar — que não tem como saber se errou ao colar ou se
 *  a chave está errada na origem. */
function isValidCpf(digits: string): boolean {
  if (digits.length !== 11) return false;
  // 000.000.000-00 e afins passam no cálculo dos dígitos, mas não são CPF.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    if ((sum * 10) % 11 % 10 !== Number(digits[len])) return false;
  }
  return true;
}

function formatCpf(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara enquanto a pessoa digita. E-mail e chave aleatória não têm máscara:
 *  qualquer reescrita no meio da digitação atrapalharia mais que ajudaria. */
export function formatPixInput(raw: string, type: PixKeyType): string {
  switch (type) {
    case 'cpf': return formatCpf(onlyDigits(raw));
    case 'phone': return formatNationalPhone(raw, WHATSAPP_COUNTRY);
    case 'email': return raw.trim();
    case 'random': return raw.trim();
  }
}

export function isValidPixKey(raw: string, type: PixKeyType): boolean {
  switch (type) {
    case 'cpf': return isValidCpf(onlyDigits(raw));
    case 'phone': return isValidPhone(raw, WHATSAPP_COUNTRY);
    case 'email': return EMAIL_RULE.test(raw.trim());
    case 'random': return EVP_RULE.test(raw.trim());
  }
}

/** O que vai pro banco: sempre a forma canônica da chave, sem máscara.
 *
 *  Guardar mascarado obrigaria toda leitura futura a limpar antes de comparar
 *  ou copiar, e a máscara é decisão de exibição — pode mudar sem que a chave
 *  mude. Telefone sai em E.164 sem "+", igual à coluna `whatsapp`, pelo mesmo
 *  motivo documentado em toWhatsappNumber.
 *
 *  Devolve null quando a chave não é válida pro tipo; quem chama não salva. */
export function toStoredPixKey(raw: string, type: PixKeyType): string | null {
  if (!isValidPixKey(raw, type)) return null;
  switch (type) {
    case 'cpf': return onlyDigits(raw);
    case 'phone': return toWhatsappNumber(raw, WHATSAPP_COUNTRY);
    case 'email': return raw.trim().toLowerCase();
    case 'random': return raw.trim().toLowerCase();
  }
}

/** Chave salva → o texto que vai pro app do banco, na cópia e na mensagem.
 *
 *  Separado da exibição de propósito: o que se lê e o que se cola não são a
 *  mesma string. Telefone é o caso que obriga — a chave é "+5511987654321", e
 *  o "+" não sobrevive à coluna (guardada sem ele, igual à `whatsapp`), mas o
 *  banco precisa dele. CPF vai sem pontuação pelo mesmo motivo: é a forma que
 *  qualquer app aceita, enquanto a mascarada depende do parser do outro lado. */
export function pixKeyForCopy(stored: string, type: PixKeyType): string {
  return type === 'phone' ? `+${stored}` : stored;
}

/** Chave salva → exibição. CPF e telefone voltam mascarados pra conferência
 *  visual: é assim que a pessoa reconhece o próprio número. */
export function formatPixKey(stored: string, type: PixKeyType): string {
  switch (type) {
    case 'cpf': return formatCpf(stored);
    case 'phone': return formatNationalPhone(fromWhatsappNumber(stored), WHATSAPP_COUNTRY);
    case 'email': return stored;
    case 'random': return stored;
  }
}
