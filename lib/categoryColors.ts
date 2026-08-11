// ═══════════════════════════════════════════════════════════════════════════
// categoryColors
//
// A cor de cada categoria é fixa (ver lib/categories.ts) — este arquivo só
// tem a lógica de render: a opacidade "translúcida" do design system
// aplicada em cima do hex puro (getCategoryChipColor), pra pintar o círculo
// do ícone e afins.
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_CATEGORY_COLOR = '#6B7280'; // Cinza — mesma cor de "Outros"

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

// Cores "claras" (luminância alta) precisam de mais opacidade pra continuar
// visíveis sobre o fundo do sheet — regra calculada pela luminância em vez de
// fixada por cor.
//
function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6;
}

/**
 * Cor de fundo translúcida do círculo que abriga o ícone da categoria.
 *
 * 20/25% é o handoff original do design, e é fraco de propósito: o traço lucide
 * JÁ está na cor da categoria, então o fundo é só apoio. Forte demais, ele
 * encosta no tom do próprio ícone e o contraste desmancha — mesmo matiz contra
 * mesmo matiz. É a mesma faixa que o HistoryFeed usa nos círculos dele
 * (0,15–0,25), e é isso que faz as duas abas parecerem a mesma tela.
 *
 * Houve uma segunda variante, mais forte (40/50%), enquanto o rosto da despesa
 * era um emoji: glifo colorido não aceita tintura, então a bolinha era o único
 * lugar onde a cor da categoria aparecia. Saiu junto com o emoji. Não volte a
 * um parâmetro com default — quando ele existia, esquecer de passar `'icon'`
 * dobrava silenciosamente a saturação da tela inteira.
 */
export function getCategoryChipColor(hex: string | null | undefined): string {
  const value = hex && hexToRgb(hex) ? hex : DEFAULT_CATEGORY_COLOR;
  const light = isLightColor(value);
  return hexToRgba(value, light ? 0.25 : 0.2);
}
