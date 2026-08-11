import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { type ColorPalette } from '@/theme';

type Props = { style: object };

export function SkeletonBone({ style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);

  const animStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return <Animated.View style={[styles.bone, style, animStyle]} />;
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  // `gray200`, não `surface`: surface é a cor de fundo de card do app, então
  // osso em surface some sempre que o skeleton desenha dentro de um card (o
  // cupom da despesa, o card de saldo da resenha). gray200 é um passo além disso
  // e aparece tanto sobre o fundo da página quanto sobre card, nos dois temas.
  bone: {
    backgroundColor: colors.gray200,
  },
});
