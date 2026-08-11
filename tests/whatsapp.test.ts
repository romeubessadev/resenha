import { describe, it, expect } from 'vitest';
import {
  WHATSAPP_COUNTRY,
  onlyDigits,
  formatNationalPhone,
  isValidPhone,
  toWhatsappNumber,
  fromWhatsappNumber,
  examplePhone,
  formatWhatsappDisplay,
} from '@/lib/whatsapp';

const MOBILE = '11987654321';
const STORED = '5511987654321';

describe('onlyDigits', () => {
  it('tira máscara, espaço e parêntese', () => {
    expect(onlyDigits('(11) 98765-4321')).toBe(MOBILE);
    expect(onlyDigits('+55 11 98765 4321')).toBe(STORED);
    expect(onlyDigits('abc')).toBe('');
  });
});

describe('formatNationalPhone', () => {
  it('mascara no padrão brasileiro', () => {
    expect(formatNationalPhone(MOBILE, 'BR')).toBe('(11) 98765-4321');
  });

  it('SEMPRE termina em dígito — é o que faz o backspace funcionar', () => {
    // Sem o corte do separador pendurado, 2 dígitos viram "(11)"; apagar o ")"
    // devolve os mesmos 2 dígitos, que remascaram pra "(11)" — campo travado.
    for (let n = 1; n <= MOBILE.length; n++) {
      const out = formatNationalPhone(MOBILE.slice(0, n), 'BR');
      expect(out, `${n} dígito(s) virou "${out}"`).toMatch(/\d$/);
    }
  });

  it('apagar um caractere sempre reduz a contagem de dígitos', () => {
    let prev = Infinity;
    for (let n = MOBILE.length; n >= 1; n--) {
      const digits = onlyDigits(formatNationalPhone(MOBILE.slice(0, n), 'BR')).length;
      expect(digits).toBeLessThan(prev);
      prev = digits;
    }
  });

  it('campo vazio não explode', () => {
    expect(formatNationalPhone('', 'BR')).toBe('');
  });
});

describe('isValidPhone', () => {
  it('aceita celular e fixo brasileiros', () => {
    expect(isValidPhone(MOBILE, 'BR')).toBe(true);
    expect(isValidPhone('1133334444', 'BR')).toBe(true);
  });

  it('recusa número com cara de telefone mas prefixo inexistente', () => {
    // O entrypoint /max existe justamente pra isto: no import padrão,
    // '999999999' passaria como válido no Brasil.
    expect(isValidPhone('999999999', 'BR')).toBe(false);
  });

  it('recusa curto, longo e vazio', () => {
    expect(isValidPhone('11', 'BR')).toBe(false);
    expect(isValidPhone('119876543210000', 'BR')).toBe(false);
    expect(isValidPhone('', 'BR')).toBe(false);
  });
});

describe('toWhatsappNumber / fromWhatsappNumber', () => {
  it('guarda em E.164 sem o "+"', () => {
    expect(toWhatsappNumber(MOBILE, 'BR')).toBe(STORED);
    expect(toWhatsappNumber('(11) 98765-4321', 'BR')).toBe(STORED);
  });

  it('devolve null pra número inválido — quem chama não salva', () => {
    expect(toWhatsappNumber('999999999', 'BR')).toBeNull();
    expect(toWhatsappNumber('', 'BR')).toBeNull();
  });

  it('vai e volta sem perder dígito', () => {
    expect(fromWhatsappNumber(toWhatsappNumber(MOBILE, 'BR'))).toBe(MOBILE);
  });

  it('não concatena DDI cru: tira o prefixo de tronco onde ele existe', () => {
    // No Reino Unido, 07911 123456 é +44 7911 123456 — sem o zero.
    const uk = toWhatsappNumber('07911123456', 'GB');
    expect(uk).toBe('447911123456');
    expect(uk).not.toContain('4407911');
  });

  it('fromWhatsappNumber tolera null e vazio', () => {
    expect(fromWhatsappNumber(null)).toBe('');
    expect(fromWhatsappNumber('')).toBe('');
  });
});

describe('examplePhone e formatWhatsappDisplay', () => {
  it('o placeholder mostra o formato do próprio país', () => {
    expect(examplePhone('BR')).toMatch(/\d/);
    expect(examplePhone('BR')).not.toBe(examplePhone('ES'));
  });

  it('exibe número salvo em formato internacional', () => {
    expect(formatWhatsappDisplay(STORED)).toMatch(/^\+55/);
    expect(formatWhatsappDisplay(null)).toBe('');
  });
});

describe('o país do app', () => {
  it('é o Brasil — uma moeda, um plano de numeração', () => {
    expect(WHATSAPP_COUNTRY).toBe('BR');
  });
});
