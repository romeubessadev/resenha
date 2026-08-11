import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Spinner } from './Spinner';

const THRESHOLD = 70;
const MAX_PULL = THRESHOLD * 1.6;
const RESISTANCE = 1.8;

type Props = {
  /** Posição de scroll do conteúdo ativo — o gesto só puxa quando ela está em 0. */
  scrollY: SharedValue<number>;
  /** Ref do ScrollView que ocupa a tela, quando ele é o filho direto.
   *
   *  Sem isto, o scroll NATIVO reivindica todo arrasto vertical e este `Pan`
   *  nunca ativa — a tela simplesmente não se move. Só funcionava onde havia
   *  uma região não-rolável pra começar o arrasto (o hero do detalhe da resenha).
   *  Declarando os dois como simultâneos, cada um faz a sua parte: o scroll
   *  rola quando tem pra onde ir, e este traduz o conteúdo quando `scrollY`
   *  já está em 0. */
  scrollRef?: React.RefObject<React.ComponentType<object> | null>;
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
  children: React.ReactNode;
};

// Réplica do PullToRefresh do handoff: cobre a tela inteira (não só a lista),
// com resistência elástica e indicador próprio em vez do spinner nativo do OS.
export function PullToRefresh({ scrollY, scrollRef, onRefresh, disabled = false, children }: Props) {
  const pull = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);

  async function handleTrigger() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      pull.value = withTiming(0, { duration: 200 });
    }
  }

  // Quanto do arrasto já foi feito, de 0 a 1 — é o que acende os traços do
  // leque um a um enquanto você puxa.
  const pullProgress = useDerivedValue(() => Math.min(pull.value / THRESHOLD, 1));

  const pan = Gesture.Pan()
    .enabled(!disabled)
    // Ver o comentário do prop: sem isto o scroll nativo ganha o arrasto e o
    // gesto nunca chega a ativar.
    //
    // O cast troca `null` por `undefined` no `current`: o `useAnimatedRef` do
    // Reanimated declara um e o gesture-handler espera o outro. Ele só lê a
    // ref, então a diferença é de tipo, não de comportamento.
    .simultaneousWithExternalGesture(...(scrollRef
      ? [scrollRef as React.RefObject<React.ComponentType<object> | undefined>]
      : []))
    // Só assume o toque em arrastos predominantemente verticais — sem isso o
    // gesto capturava qualquer toque (inclusive da borda esquerda), travando
    // o swipe nativo de voltar e outros scrolls horizontais da tela.
    .activeOffsetY([-10, 10])
    .failOffsetX([-20, 20])
    .onUpdate(e => {
      if (refreshing) return;
      if (scrollY.value <= 0 && e.translationY > 0) {
        pull.value = Math.min(e.translationY / RESISTANCE, MAX_PULL);
      }
    })
    .onEnd(() => {
      if (refreshing) return;
      if (pull.value >= THRESHOLD) {
        pull.value = withTiming(THRESHOLD);
        runOnJS(handleTrigger)();
      } else {
        pull.value = withTiming(0, { duration: 200 });
      }
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }));

  const indicatorWrapStyle = useAnimatedStyle(() => ({
    opacity: pull.value > 4 ? 1 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.wrap}>
        <Animated.View style={[styles.indicatorWrap, indicatorWrapStyle]} pointerEvents="none">
          {/* Sem `progress` o leque gira; com ele, acende conforme o arrasto.
              Trocar a prop na hora de disparar é o que faz "acender" virar
              "girar" no momento em que você solta. */}
          <Spinner size={28} progress={refreshing ? undefined : pullProgress} />
        </Animated.View>
        <Animated.View style={[styles.content, contentStyle]}>
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

// Sem `createStyles`: com o crachá e o anel fora, nenhum estilo daqui depende
// de cor — o leque traz a dele.
const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  indicatorWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
});
