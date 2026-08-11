// ═══════════════════════════════════════════════════════════════════════════
// _shared/categories.ts
//
// Mesma lista fixa de lib/categories.ts (client) — categoria é global, não
// mais por rolê. Duplicado aqui porque edge functions (Deno) não importam do
// app RN; mantenha as duas listas em sincronia. `label` é só pro prompt da
// IA (não precisa de i18n completo — o client já traduz o nome de exibição
// a partir da própria `key`). Sem cor aqui — a cor é um token do tema
// (light/dark), resolvido só no client (useCategories); o client nunca lê
// `color` da resposta da IA, só a `key` — e ícone não existe mais, a
// identidade visual da categoria é só a cor.
// ═══════════════════════════════════════════════════════════════════════════

export const FIXED_CATEGORY_KEYS = [
  'alimentacao', 'bebidas', 'transporte', 'hospedagem', 'lazer', 'compras', 'contas', 'outros',
] as const;

export type FixedCategoryKey = typeof FIXED_CATEGORY_KEYS[number];

export const OUTROS_CATEGORY_KEY: FixedCategoryKey = 'outros';

// `examples` existe pro prompt, não pra tela: só o rótulo ("Bebidas") não
// resolve casos de fronteira — a IA mandava "suco de laranja" e "café" pra
// Alimentação porque nada dizia que bebida sem álcool também conta.
type FixedCategoryDef = {
  key: FixedCategoryKey;
  label: string;
  examples: string;
};

export const FIXED_CATEGORIES: FixedCategoryDef[] = [
  {
    key: 'alimentacao',
    label: 'Alimentação',
    examples: 'mercado, restaurante, delivery, lanche, padaria',
  },
  // TODA bebida, com ou sem álcool — o rótulo diz "Bebidas" e precisa bater
  // com o conteúdo. Restringir a álcool empurrava refrigerante pra Alimentação,
  // onde o emoji é comida. Custo aceito: o "eu não bebi" fica menos cirúrgico,
  // já que suco entra no mesmo balde da cerveja.
  {
    key: 'bebidas',
    label: 'Bebidas',
    examples: 'bar, cerveja, vinho, drink, suco, café, refrigerante, água, chá',
  },
  {
    key: 'transporte',
    label: 'Transporte',
    examples: 'uber, táxi, gasolina, passagem, estacionamento, pedágio',
  },
  {
    key: 'hospedagem',
    label: 'Hospedagem',
    examples: 'hotel, airbnb, pousada, hostel, diária',
  },
  {
    key: 'lazer',
    label: 'Lazer',
    examples: 'show, cinema, festa, passeio, ingresso, streaming',
  },
  {
    key: 'compras',
    label: 'Compras',
    examples: 'roupa, presente, farmácia, eletrônico, item de loja',
  },
  {
    key: 'contas',
    label: 'Contas',
    examples: 'aluguel, luz, água, internet, condomínio, gás',
  },
  {
    key: 'outros',
    label: 'Outros',
    examples: 'o que não se encaixa em nenhuma das anteriores',
  },
];

export function isFixedCategoryKey(value: string | null | undefined): value is FixedCategoryKey {
  return !!value && (FIXED_CATEGORY_KEYS as readonly string[]).includes(value);
}

export function getFixedCategory(key: string | null | undefined): FixedCategoryDef {
  return FIXED_CATEGORIES.find(c => c.key === key) ?? FIXED_CATEGORIES[FIXED_CATEGORIES.length - 1];
}
