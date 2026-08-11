import { useMemo } from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  /** Sobrepõe o posicionamento padrão (alignSelf/marginBottom) — útil dentro de um header row. */
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed, style]}
    >
      <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.2} />
    </Pressable>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  wrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
});
