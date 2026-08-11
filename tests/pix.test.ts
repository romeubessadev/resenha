import { describe, it, expect } from 'vitest';
import { formatPixInput, isValidPixKey, toStoredPixKey, pixKeyForCopy, formatPixKey, PIX_KEY_TYPES } from '@/lib/pix';
import { onlyDigits } from '@/lib/whatsapp';

// CPF com dígitos verificadores corretos, usado como base dos casos válidos.
const CPF = '52998224725';
const EVP = '123e4567-e89b-12d3-a456-426614174000';
const PHONE = '11987654321';

describe('CPF', () => {
  it('aceita CPF com dígito verificador correto, mascarado ou não', () => {
    expect(isValidPixKey(CPF, 'cpf')).toBe(true);
    expect(isValidPixKey('529.982.247-25', 'cpf')).toBe(true);
  });

  it('recusa um dígito trocado — o erro que a validação de tamanho deixaria passar', () => {
    expect(isValidPixKey('52998224726', 'cpf')).toBe(false);
  });

  it('recusa dígito repetido, que passa no cálculo mas não é CPF', () => {
    for (const d of ['00000000000', '11111111111', '99999999999']) {
      expect(isValidPixKey(d, 'cpf')).toBe(false);
    }
  });

  it('recusa contagem de dígitos errada', () => {
    expect(isValidPixKey('5299822472', 'cpf')).toBe(false);
    expect(isValidPixKey('529982247255', 'cpf')).toBe(false);
    expect(isValidPixKey('', 'cpf')).toBe(false);
  });

  it('mascara progressivamente enquanto digita', () => {
    expect(formatPixInput('529', 'cpf')).toBe('529');
    expect(formatPixInput('529982', 'cpf')).toBe('529.982');
    expect(formatPixInput('529982247', 'cpf')).toBe('529.982.247');
    expect(formatPixInput(CPF, 'cpf')).toBe('529.982.247-25');
  });

  it('não deixa a máscara passar de 11 dígitos', () => {
    expect(formatPixInput('529982247259999', 'cpf')).toBe('529.982.247-25');
  });

  it('guarda sem máscara e exibe com máscara', () => {
    expect(toStoredPixKey('529.982.247-25', 'cpf')).toBe(CPF);
    expect(formatPixKey(CPF, 'cpf')).toBe('529.982.247-25');
  });

  it('copia sem pontuação — é a forma que qualquer app de banco aceita', () => {
    expect(pixKeyForCopy(CPF, 'cpf')).toBe(CPF);
  });
});

describe('e-mail', () => {
  it('aceita e-mail comum', () => {
    expect(isValidPixKey('bros@exemplo.com.br', 'email')).toBe(true);
  });

  it('recusa sem @, sem domínio, sem TLD ou com espaço', () => {
    for (const bad of ['bros', 'bros@', '@exemplo.com', 'bros@exemplo', 'a b@exemplo.com']) {
      expect(isValidPixKey(bad, 'email')).toBe(false);
    }
  });

  it('normaliza pra minúsculo e sem espaço nas pontas ao guardar', () => {
    expect(toStoredPixKey('  BROS@Exemplo.COM  ', 'email')).toBe('bros@exemplo.com');
  });
});

describe('chave aleatória (EVP)', () => {
  it('aceita UUID com hífens, em qualquer caixa', () => {
    expect(isValidPixKey(EVP, 'random')).toBe(true);
    expect(isValidPixKey(EVP.toUpperCase(), 'random')).toBe(true);
  });

  it('recusa UUID sem hífen ou truncado', () => {
    expect(isValidPixKey(EVP.replace(/-/g, ''), 'random')).toBe(false);
    expect(isValidPixKey('123e4567-e89b-12d3-a456', 'random')).toBe(false);
  });

  it('guarda em minúsculo', () => {
    expect(toStoredPixKey(EVP.toUpperCase(), 'random')).toBe(EVP);
  });
});

describe('telefone', () => {
  it('aceita celular brasileiro válido', () => {
    expect(isValidPixKey(PHONE, 'phone')).toBe(true);
  });

  it('recusa número que só tem a cara de telefone', () => {
    expect(isValidPixKey('999999999', 'phone')).toBe(false);
    expect(isValidPixKey('11', 'phone')).toBe(false);
  });

  it('guarda em E.164 sem o "+", igual à coluna whatsapp', () => {
    expect(toStoredPixKey(PHONE, 'phone')).toBe('5511987654321');
  });

  it('devolve o "+" só na cópia, que é o que o app do banco precisa', () => {
    const stored = toStoredPixKey(PHONE, 'phone')!;
    expect(pixKeyForCopy(stored, 'phone')).toBe('+5511987654321');
    expect(stored.startsWith('+')).toBe(false);
  });

  it('exibe mascarado, preservando os dígitos nacionais', () => {
    const stored = toStoredPixKey(PHONE, 'phone')!;
    expect(onlyDigits(formatPixKey(stored, 'phone'))).toBe(PHONE);
  });
});

describe('contrato de toStoredPixKey', () => {
  it('devolve null pra chave inválida em todos os tipos — quem chama não salva', () => {
    for (const type of PIX_KEY_TYPES) {
      expect(toStoredPixKey('claramente-invalido !!', type)).toBeNull();
    }
  });

  it('guarda CPF e telefone como dígitos puros, sem nada de máscara', () => {
    // Só estes dois: o ponto do e-mail e o hífen do UUID são parte da chave.
    expect(toStoredPixKey('529.982.247-25', 'cpf')).toMatch(/^\d{11}$/);
    expect(toStoredPixKey('(11) 98765-4321', 'phone')).toMatch(/^\d+$/);
  });

  it('nunca devolve espaço nas pontas, em nenhum tipo', () => {
    const cases = [
      ['  529.982.247-25 ', 'cpf'],
      ['  BROS@Exemplo.COM ', 'email'],
      [` ${PHONE} `, 'phone'],
      [` ${EVP} `, 'random'],
    ] as const;
    for (const [raw, type] of cases) {
      const stored = toStoredPixKey(raw, type);
      expect(stored).not.toBeNull();
      expect(stored).toBe(stored!.trim());
    }
  });

  it('é idempotente: guardar o que já está guardado devolve o mesmo', () => {
    const cases = [[CPF, 'cpf'], ['bros@exemplo.com', 'email'], [EVP, 'random']] as const;
    for (const [raw, type] of cases) {
      const once = toStoredPixKey(raw, type)!;
      expect(toStoredPixKey(once, type)).toBe(once);
    }
  });
});
