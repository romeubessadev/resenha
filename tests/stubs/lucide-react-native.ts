// `lib/categories.ts` mapeia cada categoria ao seu ícone, então importar
// categoria (pra `isFixedCategoryKey`) arrasta o pacote inteiro de ícones — e
// com ele react-native-svg e o react-native de verdade, que é Flow e o node não
// parseia.
//
// Qual componente de ícone é qual não muda nada na lógica sob teste (texto de
// histórico, cor de categoria, predicados). São referências opacas aqui.
//
// Ícone novo em lib/categories.ts precisa de uma linha aqui. O erro é explícito
// ("does not provide an export named ..."), não silencioso.

export type LucideIcon = unknown;

const icon = (name: string) => ({ displayName: name }) as const;

export const UtensilsCrossed = icon('UtensilsCrossed');
export const CupSoda = icon('CupSoda');
export const Car = icon('Car');
export const BedDouble = icon('BedDouble');
export const PartyPopper = icon('PartyPopper');
export const ShoppingBag = icon('ShoppingBag');
export const House = icon('House');
export const MoreHorizontal = icon('MoreHorizontal');
