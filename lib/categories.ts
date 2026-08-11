// ═══════════════════════════════════════════════════════════════════════════
// categories
//
// Lista fixa e global de categorias — igual em toda resenha, sem criação manual
// nem por IA. `key` é o valor salvo em expenses.category_id/
// expense_recurrences.category_id (texto, não mais uuid de uma tabela por
// resenha). Nome vem de i18n (nameKey); cor é um token do tema (não um hex
// fixo) — resolvida em useCategories via useTheme(), pra respeitar dark
// mode e usar a paleta de marca de verdade.
//
// Ícone + cor: juntos são a identidade visual da categoria, e — sem emoji por
// despesa — o rosto de cada lançamento na lista, no detalhe, no seletor e no
// Insight. Duas despesas do mesmo balde mostram o mesmo desenho de propósito:
// vinte emojis diferentes numa lista viram ruído, e quem individualiza a
// despesa é o título. Os ícones vêm da mesma lista que o banco usa.
// ═══════════════════════════════════════════════════════════════════════════

import {
  UtensilsCrossed, CupSoda, Car, BedDouble, PartyPopper, ShoppingBag, House, MoreHorizontal,
  type LucideIcon,
} from 'lucide-react-native';
import type { TranslationKey } from './i18n';
import type { ColorPalette } from '@/theme';

export const FIXED_CATEGORY_KEYS = [
  'alimentacao', 'bebidas', 'transporte', 'hospedagem', 'lazer', 'compras', 'contas', 'outros',
] as const;

export type FixedCategoryKey = typeof FIXED_CATEGORY_KEYS[number];

export const OUTROS_CATEGORY_KEY: FixedCategoryKey = 'outros';

type FixedCategoryDef = {
  key: FixedCategoryKey;
  icon: LucideIcon;
  colorToken: keyof ColorPalette;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
};

// Oito matizes separados — laranja, amarelo, azul, violeta, rosa, verde-claro,
// verde-escuro e cinza —, escolhidos pra continuar distinguíveis entre si no
// gráfico de insights, que usa esta mesma paleta.
//
// Duas escolhas de ícone que parecem estranhas e não são:
//
//   · `bebidas` é CupSoda, não Beer: a categoria é toda bebida, COM OU SEM
//     álcool (ver o prompt em _shared/categories.ts — a regra existe
//     porque sem ela suco e café caíam em Alimentação). Um chopp desmentiria a
//     própria definição pra quem lança "Café da manhã".
//   · `outros` é MoreHorizontal, não Receipt: Receipt é o fallback de despesa
//     SEM categoria (ver components/CategoryIcon). Como `outros` também é
//     cinza, o mesmo glifo deixaria "classifiquei como Outros" idêntico a
//     "a fila ainda não categorizou" — dois estados bem diferentes. É o mesmo
//     ícone que o banco já usava pra esta categoria.
//
// `outros` precisa continuar por último — getFixedCategory usa o último item
// como fallback pra chave desconhecida.
export const FIXED_CATEGORIES: FixedCategoryDef[] = [
  { key: 'alimentacao', icon: UtensilsCrossed, colorToken: 'coral', nameKey: 'category.alimentacao', descriptionKey: 'category.alimentacaoDesc' },
  { key: 'bebidas', icon: CupSoda, colorToken: 'warning', nameKey: 'category.bebidas', descriptionKey: 'category.bebidasDesc' },
  { key: 'transporte', icon: Car, colorToken: 'blue', nameKey: 'category.transporte', descriptionKey: 'category.transporteDesc' },
  { key: 'hospedagem', icon: BedDouble, colorToken: 'purple', nameKey: 'category.hospedagem', descriptionKey: 'category.hospedagemDesc' },
  { key: 'lazer', icon: PartyPopper, colorToken: 'pinkDeep', nameKey: 'category.lazer', descriptionKey: 'category.lazerDesc' },
  { key: 'compras', icon: ShoppingBag, colorToken: 'success', nameKey: 'category.compras', descriptionKey: 'category.comprasDesc' },
  { key: 'contas', icon: House, colorToken: 'forest', nameKey: 'category.contas', descriptionKey: 'category.contasDesc' },
  { key: 'outros', icon: MoreHorizontal, colorToken: 'textSecondary', nameKey: 'category.outros', descriptionKey: 'category.outrosDesc' },
];

export function isFixedCategoryKey(value: string | null | undefined): value is FixedCategoryKey {
  return !!value && (FIXED_CATEGORY_KEYS as readonly string[]).includes(value);
}

export function getFixedCategory(key: string | null | undefined): FixedCategoryDef {
  return FIXED_CATEGORIES.find(c => c.key === key) ?? FIXED_CATEGORIES[FIXED_CATEGORIES.length - 1];
}
