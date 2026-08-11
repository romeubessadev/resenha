import { describe, it, expect } from 'vitest';
import { formatMoney, CURRENCY_SYMBOL } from '@/lib/currencies';

// O separador entre símbolo e número é espaço NÃO-quebrável no pt-BR, e a versão
// do ICU decide qual. Normaliza pra o teste não quebrar por detalhe de runtime.
const norm = (s: string) => s.replace(/\s/g, ' ');

describe('formatMoney', () => {
  it('formata em real, com vírgula decimal e ponto de milhar', () => {
    expect(norm(formatMoney(1234.56))).toBe('R$ 1.234,56');
  });

  it('sempre mostra duas casas', () => {
    expect(norm(formatMoney(10))).toBe('R$ 10,00');
    expect(norm(formatMoney(0))).toBe('R$ 0,00');
    expect(norm(formatMoney(0.5))).toBe('R$ 0,50');
  });

  it('formata negativo (saldo devedor)', () => {
    expect(norm(formatMoney(-42.5))).toBe('-R$ 42,50');
  });

  it('arredonda pra duas casas em vez de truncar ou vazar dígito', () => {
    expect(norm(formatMoney(3.333))).toBe('R$ 3,33');
    expect(norm(formatMoney(3.336))).toBe('R$ 3,34');
  });

  it('agrupa milhar em valor grande', () => {
    expect(norm(formatMoney(1234567.89))).toBe('R$ 1.234.567,89');
  });

  it('expõe o símbolo usado pelo fallback', () => {
    expect(CURRENCY_SYMBOL).toBe('R$');
  });
});
