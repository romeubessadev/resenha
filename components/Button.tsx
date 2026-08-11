import {
  Pressable,
  Text,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { ReactNode, useMemo } from 'react';
import { Spinner } from './Spinner';
import { useTheme } from '@/hooks/useTheme';
import { radius, fontFamilies, fontSizes, spacing, type ColorPalette } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
  /** CTA principal de tela cheia dedicada (auth, onboarding) — dá o relevo
   *  com barrinha inferior. Deixe `false` (padrão) dentro de sheets/conteúdo. */
  raised?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  style,
  labelStyle,
  fullWidth = true,
  raised = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDisabled = disabled || loading;
  const isChunky = (variant === 'primary' || variant === 'dark') && raised;

  return (
    <View style={[styles.wrap, fullWidth && styles.fullWidth, isChunky && styles.wrapChunky, isDisabled && styles.disabled, style]}>
      {isChunky && <View style={[styles.chunkyShadow, variant === 'dark' && styles.chunkyShadowDark]} />}
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          styles[variant],
          pressed && styles[`pressed_${variant}`],
          pressed && styles.pressedScale,
        ]}
      >
        {loading ? (
          <Spinner size={20} color={variant === 'primary' ? colors.ink : colors.primary} />
        ) : (
          <View style={[styles.row, iconRight != null && styles.rowSpread]}>
            {icon && <View style={styles.iconGap}>{icon}</View>}
            <Text style={[styles.label, styles[`label_${variant}`], labelStyle]}>{label}</Text>
            {iconRight}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const CHUNKY_OFFSET = 2;

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  wrap: {
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  wrapChunky: {
    marginBottom: CHUNKY_OFFSET,
  },
  chunkyShadow: {
    position: 'absolute',
    top: CHUNKY_OFFSET,
    left: 0,
    right: 0,
    bottom: -CHUNKY_OFFSET,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDark,
  },
  // Dourado, e não um preto mais escuro: sob a face `ink` (#151B24) a lateral
  // escura era invisível na prática, e o relevo do `raised` simplesmente não
  // aparecia. A cor da marca resolve e é o que os mockups do tour mostram.
  chunkyShadowDark: {
    backgroundColor: colors.primaryDark,
  },
  base: {
    height: 54,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pressedScale: {
    transform: [{ scale: 0.99 }],
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSpread: {
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  iconGap: {
    marginRight: spacing.sm,
  },

  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  dark: {
    backgroundColor: colors.ink,
  },
  disabled: {
    opacity: 0.5,
  },

  // Pressed
  pressed_primary: {
    backgroundColor: colors.primaryDark,
  },
  pressed_secondary: {
    backgroundColor: colors.surface,
  },
  pressed_danger: {
    backgroundColor: colors.dangerLight,
  },
  pressed_ghost: {
    backgroundColor: colors.primaryLight,
  },
  pressed_dark: {
    backgroundColor: '#0A0D12',
  },

  // Labels
  label: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
  },
  label_primary: {
    color: colors.ink,
  },
  label_secondary: {
    color: colors.textPrimary,
  },
  label_danger: {
    color: colors.danger,
  },
  label_ghost: {
    color: colors.primary,
  },
  label_dark: {
    color: colors.white,
  },
});
