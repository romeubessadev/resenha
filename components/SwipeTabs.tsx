import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const SWIPE_THRESHOLD = 60;

type Props = {
  /** Chamado ao arrastar da direita pra esquerda (ir pra próxima aba). */
  onSwipeLeft?: () => void;
  /** Chamado ao arrastar da esquerda pra direita (ir pra aba anterior). */
  onSwipeRight?: () => void;
  children: React.ReactNode;
};

// Troca de aba (Rolês ↔ Carteira ↔ Perfil) por swipe horizontal. Só assume o
// toque em arrastos predominantemente horizontais — senão desiste e libera o
// toque pro scroll vertical/pull-to-refresh da tela (mesma lógica inversa do
// PullToRefresh, pra não competir entre si).
export function SwipeTabs({ onSwipeLeft, onSwipeRight, children }: Props) {
  const pan = Gesture.Pan()
    .enabled(!!(onSwipeLeft || onSwipeRight))
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .runOnJS(true)
    .onEnd(e => {
      if (e.translationX <= -SWIPE_THRESHOLD) onSwipeLeft?.();
      else if (e.translationX >= SWIPE_THRESHOLD) onSwipeRight?.();
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.flex}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
