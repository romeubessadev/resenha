import { useEffect, useMemo, useState } from 'react';
import { Modal, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, type ColorPalette } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

const DURATION = 200;

type Props = {
  visible: boolean;
  onClose: () => void;
  photoUrl: string;
};

// Visualização fullscreen da foto — tap em qualquer lugar (ou no X) fecha.
// Sem pinch-zoom: aqui é só foto de perfil (da resenha ou da pessoa), não precisa
// de detalhe.
export function PhotoViewerModal({ visible, onClose, photoUrl }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mounted, setMounted] = useState(visible);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.ease) });
    } else {
      opacity.value = withTiming(0, { duration: DURATION, easing: Easing.in(Easing.ease) }, finished => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, opacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + spacing.sm }]}
          onPress={onClose}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <X size={22} color={colors.white} strokeWidth={2} />
        </TouchableOpacity>
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="contain" />
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  closeBtn: {
    position: 'absolute',
    right: spacing.pagePadding,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  photo: {
    width: '100%',
    height: '80%',
  },
});
