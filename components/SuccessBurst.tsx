import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { radius, type ColorPalette } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const RING_DURATION = 1200;
const RING_DELAY = 300;
const POP_DURATION = 500;
const CHECK_DURATION = 500;
const CHECK_DELAY = 250;
const CHECK_LENGTH = 60;

type Props = {
  size?: number;
};

export function SuccessBurst({ size = 96 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const coreScale = useSharedValue(0);
  const coreOpacity = useSharedValue(0);
  const checkOffset = useSharedValue(CHECK_LENGTH);

  useEffect(() => {
    ring1.value = withRepeat(withTiming(1, { duration: RING_DURATION, easing: Easing.out(Easing.ease) }), -1);
    ring2.value = withDelay(
      RING_DELAY,
      withRepeat(withTiming(1, { duration: RING_DURATION, easing: Easing.out(Easing.ease) }), -1)
    );
    coreScale.value = withTiming(1, { duration: POP_DURATION, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
    coreOpacity.value = withTiming(1, { duration: POP_DURATION });
    checkOffset.value = withDelay(
      CHECK_DELAY,
      withTiming(0, { duration: CHECK_DURATION, easing: Easing.out(Easing.ease) })
    );
  }, [ring1, ring2, coreScale, coreOpacity, checkOffset]);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ring1.value),
    transform: [{ scale: 0.6 + ring1.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ring2.value),
    transform: [{ scale: 0.6 + ring2.value }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    opacity: coreOpacity.value,
    transform: [{ scale: coreScale.value }],
  }));

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: checkOffset.value,
  }));

  const coreSize = size * 0.72;
  const checkSize = size * 0.42;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.ring, ring1Style, { backgroundColor: 'rgba(245,197,24,0.4)' }]} />
      <Animated.View style={[styles.ring, ring2Style, { backgroundColor: 'rgba(245,197,24,0.25)' }]} />
      <Animated.View
        style={[
          styles.core,
          coreStyle,
          { width: coreSize, height: coreSize, backgroundColor: colors.primary },
        ]}
      >
        <Svg width={checkSize} height={checkSize} viewBox="0 0 24 24" fill="none">
          <AnimatedPath
            d="M5 12.5 L10 17 L19 8"
            stroke={colors.ink}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHECK_LENGTH}
            animatedProps={checkProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.full,
  },
  core: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
