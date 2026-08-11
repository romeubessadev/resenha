const light = {
  // Brand
  primary:       '#F5C518',
  primaryDark:   '#D9A800',
  primaryLight:  '#FDF3D0',
  secondary:     '#00ED89',
  coral:         '#FF7643',
  coralDeep:     '#E5481E',
  forest:        '#005E31',
  ink:           '#151B24',
  pink:          '#FFA3BA',
  pinkDeep:      '#F55A7D',
  cream:         '#FAF5EA',
  whatsapp:      '#25D366',

  // Semantic — status
  success:      '#22C55E',
  successLight: '#DFF8ED',
  warning:      '#FBBE28',
  danger:       '#EF4444',
  dangerLight:  '#FDEDEB',

  // Accent
  blue:        '#2563EB',
  purple:      '#5B3DF5',

  // Neutrals
  white:      '#FFFFFF',
  background: '#FFFFFF',
  surface:    '#F7F7FB',

  // Text
  textPrimary:   '#111111',
  textSecondary: '#6B7280',

  // Border
  border: '#E5E7EB',

  // Grays (design sheet)
  gray200: '#EDF2F7',
} as const;

const dark = {
  // Brand — mostarda mantém, já funciona bem sobre fundo escuro
  primary:       '#F5C518',
  primaryDark:   '#D9A800',
  primaryLight:  '#3A3320',
  secondary:     '#00ED89',
  coral:         '#FF9166',
  coralDeep:     '#FF7643',
  forest:        '#3FA968',
  ink:           '#151B24',
  pink:          '#FFB3C6',
  pinkDeep:      '#FF7D9C',
  cream:         '#1B212B',
  whatsapp:      '#25D366',

  // Semantic — status
  success:      '#4ADE80',
  successLight: '#12321F',
  warning:      '#FBBE28',
  danger:       '#F87171',
  dangerLight:  '#3A1414',

  // Accent
  blue:        '#5B8DEF',
  purple:      '#8B7BF7',

  // Neutrals
  white:      '#FFFFFF',
  background: '#12161D',
  surface:    '#1B212B',

  // Text
  textPrimary:   '#F4EFE3',
  textSecondary: '#9CA3AF',

  // Border
  border: 'rgba(255,255,255,0.08)',

  // Grays (design sheet)
  gray200: '#232833',
} as const;

export const lightColors = light;
export const darkColors = dark;

export const colors = light;

export type ColorPalette = Record<keyof typeof light, string>;

// Avatar palette — cor sólida por hash do nome, pares exatos do AVATAR.md.
export const getAvatarPalette = (colors: ColorPalette) => [
  { bg: colors.primary, text: colors.ink },
  { bg: colors.coral,   text: colors.white },
  { bg: colors.pink,    text: colors.ink },
  { bg: colors.forest,  text: colors.white },
  { bg: colors.ink,     text: colors.primary },
] as const;

// Fundo/texto uniformes do variant="neutral" (AVATAR.md).
export const getAvatarNeutral = (colors: ColorPalette) => ({ bg: colors.ink, text: colors.cream }) as const;

// Paleta "família mostarda" — reservada ao hero do grupo (destaque quente da tela).
export const getAvatarWarm = (colors: ColorPalette) => [
  { bg: colors.primaryDark, text: colors.ink },
  { bg: colors.coral,       text: colors.white },
  { bg: colors.coralDeep,   text: colors.white },
  { bg: colors.pink,        text: colors.ink },
  { bg: colors.pinkDeep,    text: colors.white },
] as const;

// Paleta suave — tons neutros que não competem com o hero do grupo (warm).
export const getAvatarSoft = (colors: ColorPalette) => [
  { bg: colors.surface,  text: colors.textPrimary },
  { bg: colors.cream,    text: colors.ink },
  { bg: colors.gray200,  text: colors.textPrimary },
] as const;
