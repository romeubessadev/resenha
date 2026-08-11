import { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { getAvatarPalette, getAvatarNeutral, getAvatarWarm, getAvatarSoft, fontFamilies, type ColorPalette } from '@/theme';

// Cor determinística por pessoa: hash do id (ou do nome, se não houver id)
// mapeado na paleta fixa. Mesma pessoa = mesma cor em qualquer tela, sem
// tratamento especial pra "você" — padrão usado por Slack, Google Workspace,
// Splitwise etc. Colisão de cor entre pessoas diferentes é esperada e ok.
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// AVATAR.md — regras de iniciais:
// nome vazio → "?"; nome único → 2 primeiras letras; nome composto → 1ª + última.
// Emojis não contam como letra (e nunca são quebrados ao meio: emoji é um par
// substituto em UTF-16, então charAt/slice sozinhos cortavam o glifo e sobrava
// um caractere inválido).
function getInitials(name: string): string {
  const letters = name.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
  if (!letters) return '?';
  const parts = letters.split(/\s+/);
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join('').toUpperCase();
  return ([...parts[0]][0] + [...parts[parts.length - 1]][0]).toUpperCase();
}

const AVATAR_SIZES = {
  '2xs': { size: 24, fontSize: 10 },
  xs: { size: 20, fontSize: 9 },
  sm: { size: 28, fontSize: 10 },
  md: { size: 40, fontSize: 12 },
  lg: { size: 48, fontSize: 14 },
  xl: { size: 96, fontSize: 24 },
} as const;

type SizeToken = keyof typeof AVATAR_SIZES;

type Props = {
  name: string;
  id?: string;
  photoUrl?: string;
  size?: SizeToken | number;
  variant?: 'colorful' | 'neutral' | 'warm' | 'soft';
  ring?: boolean;
};

export function Avatar({ name, id, photoUrl, size = 'md', variant = 'colorful', ring = false }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const avatarPalette = useMemo(() => getAvatarPalette(colors), [colors]);
  const avatarNeutral = useMemo(() => getAvatarNeutral(colors), [colors]);
  const avatarWarm = useMemo(() => getAvatarWarm(colors), [colors]);
  const avatarSoft = useMemo(() => getAvatarSoft(colors), [colors]);
  const dimension = typeof size === 'number' ? size : AVATAR_SIZES[size].size;
  const initialsFontSize = typeof size === 'number' ? Math.round(size * 0.3) : AVATAR_SIZES[size].fontSize;
  const ringStyle = ring ? { borderWidth: 2, borderColor: colors.background } : null;

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[styles.base, ringStyle, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}
      />
    );
  }

  const { bg, text: fg } = variant === 'neutral'
    ? avatarNeutral
    : variant === 'soft'
      ? avatarSoft[hashString(id ?? name) % avatarSoft.length]
      : variant === 'warm'
        ? avatarWarm[hashString(id ?? name) % avatarWarm.length]
        : avatarPalette[hashString(id ?? name) % avatarPalette.length];

  return (
    <View style={[styles.base, ringStyle, { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: bg }]}>
      <Text
        style={{
          fontSize: initialsFontSize,
          color: fg,
          fontFamily: fontFamilies.semibold,
          includeFontPadding: false,
          textAlignVertical: 'center',
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
