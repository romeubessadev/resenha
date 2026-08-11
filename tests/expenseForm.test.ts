// Os utilitários do formulário de despesa. São puros, mas mexem nas duas
// coisas que mais doem quando saem erradas: DINHEIRO e DATA.
//
// A data tem uma armadilha própria — o `.toISOString()` nativo converte pro
// instante UTC, e num fuso negativo (Brasil) a despesa lançada à noite vira o
// dia seguinte no banco. Por isso `toDateOnlyString` lê do relógio local.
import { describe, it, expect } from 'vitest';
import {
  parseBRL,
  formatAmountForInput,
  sanitizeAmountInput,
  toDateOnlyString,
  nextOccurrenceAfter,
  SPLIT_TYPE_MAP,
  DIVIDIR_TIPO_FROM_SPLIT,
} from '@/hooks/useExpenseForm';

describe('parseBRL — texto do campo vira número', () => {
  it('entende milhar com ponto e decimal com vírgula', () => {
    expect(parseBRL('1.234,56')).toBe(1234.56);
    expect(parseBRL('0,05')).toBe(0.05);
  });

  it('campo vazio ou lixo vira zero, não NaN', () => {
    // NaN vazaria pro insert e viraria despesa sem valor.
    expect(parseBRL('')).toBe(0);
    expect(parseBRL('abc')).toBe(0);
  });
});

describe('sanitizeAmountInput — modo dinheiro', () => {
  it('cada tecla empurra um dígito pela direita, pelos CENTAVOS', () => {
    // É o que deixa a máscara visível durante a digitação: o cursor fica sempre
    // no fim, nada é inserido no meio e nenhuma tecla se perde.
    expect(sanitizeAmountInput('5')).toBe('0,05');
    expect(sanitizeAmountInput('50')).toBe('0,50');
    expect(sanitizeAmountInput('500')).toBe('5,00');
    expect(sanitizeAmountInput('5000')).toBe('50,00');
  });

  it('separador é DESENHADO, nunca teclado', () => {
    expect(sanitizeAmountInput('1.234,56')).toBe('1.234,56');
    expect(sanitizeAmountInput('R$ 12,00')).toBe('12,00');
  });

  it('zero vira campo VAZIO, pro placeholder reaparecer', () => {
    // Uma só representação de "nada" — "0,00" pareceria preenchido.
    expect(sanitizeAmountInput('')).toBe('');
    expect(sanitizeAmountInput('0')).toBe('');
    expect(sanitizeAmountInput('000')).toBe('');
    expect(sanitizeAmountInput('abc')).toBe('');
  });

  it('passa do milhar sem perder o agrupamento', () => {
    expect(sanitizeAmountInput('123456')).toBe('1.234,56');
  });
});

describe('sanitizeAmountInput — modo fator (o × e ÷)', () => {
  it('fator NÃO tem centavos implícitos: "2" é dois, não dois centavos', () => {
    // "R$ 20,00 × 20" são vinte VEZES, não vinte reais.
    expect(sanitizeAmountInput('2', 'fator')).toBe('2');
    expect(sanitizeAmountInput('20', 'fator')).toBe('20');
  });

  it('aceita fator quebrado, digitado à mão', () => {
    expect(sanitizeAmountInput('1,5', 'fator')).toBe('1,5');
  });

  it('ponto vale como vírgula — teclado que só oferece ponto', () => {
    // Não há milhar neste modo, então o ponto fica livre pra isso.
    expect(sanitizeAmountInput('1.5', 'fator')).toBe('1,5');
  });

  it('vírgula repetida não cria número inválido', () => {
    expect(sanitizeAmountInput('1,,5', 'fator')).toBe('1,5');
    expect(sanitizeAmountInput('1,2,3', 'fator')).toBe('1,23');
  });

  it('corta em duas casas decimais', () => {
    expect(sanitizeAmountInput('1,23456', 'fator')).toBe('1,23');
  });
});

describe('formatAmountForInput', () => {
  it('sempre duas casas', () => {
    expect(formatAmountForInput(5)).toBe('5,00');
    expect(formatAmountForInput(1234.5)).toBe('1.234,50');
  });

  it('ida e volta com parseBRL preserva o valor', () => {
    for (const n of [0.05, 5, 50.25, 1234.56]) {
      expect(parseBRL(formatAmountForInput(n))).toBe(n);
    }
  });
});

describe('toDateOnlyString — a data NÃO pode andar', () => {
  it('lê do relógio local, não do UTC', () => {
    // 10/03 às 22h no Brasil é 11/03 em UTC. Com `.toISOString()` a despesa
    // seria gravada no dia seguinte.
    expect(toDateOnlyString(new Date(2026, 2, 10, 22, 0, 0))).toBe('2026-03-10');
  });

  it('zera à esquerda mês e dia', () => {
    expect(toDateOnlyString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('meia-noite e 23h59 do MESMO dia dão a mesma string', () => {
    expect(toDateOnlyString(new Date(2026, 5, 1, 0, 0, 0)))
      .toBe(toDateOnlyString(new Date(2026, 5, 1, 23, 59, 59)));
  });
});

describe('nextOccurrenceAfter — quando a série cobra de novo', () => {
  const dia = (d: Date) => toDateOnlyString(d);

  it('diária, semanal e anual andam o passo esperado', () => {
    const base = new Date(2026, 2, 10);
    expect(dia(nextOccurrenceAfter(base, 'daily'))).toBe('2026-03-11');
    expect(dia(nextOccurrenceAfter(base, 'weekly'))).toBe('2026-03-17');
    expect(dia(nextOccurrenceAfter(base, 'yearly', undefined, 10))).toBe('2027-03-10');
  });

  it('custom anda o intervalo pedido', () => {
    expect(dia(nextOccurrenceAfter(new Date(2026, 2, 10), 'custom', 45))).toBe('2026-04-24');
  });

  it('mensal ancorado no dia 31 não vaza pro mês seguinte em fevereiro', () => {
    // Sem o clamp, 31/01 + 1 mês viraria 03/03 e a série pularia fevereiro.
    expect(dia(nextOccurrenceAfter(new Date(2026, 0, 31), 'monthly', undefined, 31))).toBe('2026-02-28');
  });

  it('a âncora SOBREVIVE ao mês curto — volta pro dia 31 depois', () => {
    // O mês curto encolhe a cobrança, não a série: quem assinou dia 31 continua
    // sendo cobrado no 31 nos meses que têm.
    const fev = nextOccurrenceAfter(new Date(2026, 0, 31), 'monthly', undefined, 31);
    expect(dia(nextOccurrenceAfter(fev, 'monthly', undefined, 31))).toBe('2026-03-31');
  });
});

describe('o vocabulário da divisão', () => {
  it('cada opção da tela tem um valor de banco, e a volta é a mesma', () => {
    for (const [tela, banco] of Object.entries(SPLIT_TYPE_MAP)) {
      expect(DIVIDIR_TIPO_FROM_SPLIT[banco]).toBe(tela);
    }
  });

  it('os valores gravados são os que `expenses.split_type` aceita', () => {
    expect(Object.values(SPLIT_TYPE_MAP).sort()).toEqual(['equal', 'exact', 'shares']);
  });
});
