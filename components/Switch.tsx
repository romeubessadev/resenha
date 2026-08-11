import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolateColor } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { radius, type ColorPalette } from '@/theme';

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const THUMB_SIZE = 20;
const THUMB_INSET = 2;
const DURATION = 150;

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

// Primeiro toggle do design system — não existia nenhum componente de
// switch no app antes (todo "ligar/desligar" usava segmentado ou checkbox).
export function Switch({ value, onValueChange, disabled }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: DURATION });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.primary]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2) }],
  }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      hitSlop={8}
      style={[styles.hitArea, disabled && styles.disabled]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  // `alignSelf` existe pra impedir que o Pressable estique na altura do
  // contêiner (o padrão do flex é `stretch`), inflando a área de toque muito
  // além do switch.
  //
  // `center`, e NÃO `flex-start`: alignSelf sobrepõe o alignItems do pai, e o
  // eixo cruzado de uma linha é o vertical — com `flex-start` o switch grudava
  // no TOPO de qualquer linha mais alta que ele, como a de "Tornar recorrente",
  // que tem um ícone de 36px ao lado. Centrar impede o esticão do mesmo jeito.
  hitArea: {
    alignSelf: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    padding: THUMB_INSET,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
});
