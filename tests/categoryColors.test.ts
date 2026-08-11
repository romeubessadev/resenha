// A cor do círculo que abriga o ícone da categoria.
//
// Parece decoração, mas tem duas regras que já foram erradas: o fundo é fraco
// DE PROPÓSITO (o traço lucide já está na cor da categoria, então fundo forte
// encosta no tom do ícone e o contraste desmancha), e cor clara precisa de
// mais opacidade pra continuar visível — calculado por luminância, não fixado
// por cor.
import { describe, it, expect } from 'vitest';
import { hexToRgba, getCategoryChipColor, DEFAULT_CATEGORY_COLOR } from '@/lib/categoryColors';

describe('hexToRgba', () => {
  it('converte hex de 6 dígitos', () => {
    expect(hexToRgba('#FF7A45', 0.5)).toBe('rgba(255,122,69,0.5)');
  });

  it('aceita sem o # e com maiúsculas ou minúsculas', () => {
    expect(hexToRgba('ff7a45', 0.2)).toBe('rgba(255,122,69,0.2)');
    expect(hexToRgba('#FF7A45', 0.2)).toBe(hexToRgba('#ff7a45', 0.2));
  });

  it('preto e branco nos extremos', () => {
    expect(hexToRgba('#000000', 1)).toBe('rgba(0,0,0,1)');
    expect(hexToRgba('#FFFFFF', 1)).toBe('rgba(255,255,255,1)');
  });

  it('hex inválido volta como veio, em vez de virar "rgba(NaN…)"', () => {
    // Um NaN aqui pintaria o círculo de transparente sem ninguém notar.
    for (const ruim of ['#GGG', '#12345', 'azul', '']) {
      expect(hexToRgba(ruim, 0.2)).toBe(ruim);
    }
  });

  it('espaço em volta não atrapalha', () => {
    expect(hexToRgba('  #FF7A45  ', 0.2)).toBe('rgba(255,122,69,0.2)');
  });
});

describe('getCategoryChipColor', () => {
  it('cor escura usa a opacidade menor', () => {
    // #1E3A8A é azul escuro — luminância bem abaixo do corte.
    expect(getCategoryChipColor('#1E3A8A')).toBe('rgba(30,58,138,0.2)');
  });

  it('cor CLARA ganha mais opacidade pra não sumir no fundo', () => {
    // #FDE68A é amarelo claro: com 0,2 ele encostaria no branco do sheet.
    expect(getCategoryChipColor('#FDE68A')).toBe('rgba(253,230,138,0.25)');
  });

  it('o corte é por luminância, não por matiz', () => {
    // Dois amarelos: o claro passa do corte, o escuro não. Se a regra fosse
    // "amarelo é claro", os dois cairiam no mesmo lado.
    expect(getCategoryChipColor('#FEF3C7')).toContain('0.25');
    expect(getCategoryChipColor('#92400E')).toContain('0.2)');
  });

  it('sem cor, cai no cinza de "Outros"', () => {
    const esperado = hexToRgba(DEFAULT_CATEGORY_COLOR, 0.2);
    expect(getCategoryChipColor(null)).toBe(esperado);
    expect(getCategoryChipColor(undefined)).toBe(esperado);
  });

  it('cor INVÁLIDA também cai no cinza — não vaza o texto quebrado pra tela', () => {
    expect(getCategoryChipColor('não-é-cor')).toBe(hexToRgba(DEFAULT_CATEGORY_COLOR, 0.2));
  });

  it('a opacidade fica na faixa fraca combinada com o design (0,15–0,25)', () => {
    // Foi assim que as abas de Insight e Histórico passaram a parecer a mesma
    // tela. Uma variante de 40/50% existiu na época do emoji e saiu junto.
    for (const cor of ['#1E3A8A', '#FDE68A', '#FF7A45', '#6B7280']) {
      const alpha = Number(getCategoryChipColor(cor).match(/,([\d.]+)\)$/)![1]);
      expect(alpha, cor).toBeGreaterThanOrEqual(0.15);
      expect(alpha, cor).toBeLessThanOrEqual(0.25);
    }
  });
});
