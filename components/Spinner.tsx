import { useEffect, useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { hexToRgba } from '@/lib/categoryColors';

const SPIN_DURATION = 900;
/** 12 traços é a contagem do indicador do iOS — abaixo disso o giro fica
 *  "picotado" e o leque deixa de ler como um círculo. */
const SPOKES = 12;
const STEP = 360 / SPOKES;
/** Largura proporcional ao diâmetro, com mínimo de 2 — abaixo disso o traço
 *  some em tela de alta densidade. */
const MIN_SPOKE_WIDTH = 2;
/** Opacidade da ponta da cauda. O traço da frente é sempre 1. */
const TAIL_OPACITY = 0.15;
/** Quanto do cinza padrão fica de pé. Vale SÓ pro padrão: quem passa `color`
 *  recebe a cor cheia, senão o spinner dentro de botão desbotaria junto. */
const DEFAULT_TINT_ALPHA = 0.55;

type Geometry = {
  width: number;
  height: number;
  orbit: number;
  offsetLeft: number;
  offsetTop: number;
};

type SpokeProps = Geometry & {
  index: number;
  tint: string;
  progress?: SharedValue<number>;
};

function Spoke({ index, tint, progress, width, height, orbit, offsetLeft, offsetTop }: SpokeProps) {
  // Cresce com o índice porque o giro é horário: o traço mais aceso tem que ser
  // o da FRENTE, e a cauda fica no sentido contrário ao movimento. Invertido, o
  // rastro aparece adiante da cabeça e o giro lê ao avesso.
  const litOpacity = TAIL_OPACITY + (index / (SPOKES - 1)) * (1 - TAIL_OPACITY);

  const animStyle = useAnimatedStyle(() => {
    // Girando: cada traço fica parado na sua posição da rampa, e quem cria o
    // movimento é a rotação do conjunto.
    if (!progress) return { opacity: litOpacity };
    // Acendendo: o leque está imóvel e os traços aparecem em ordem horária
    // conforme o arrasto avança. Aqui aceso é aceso, sem rampa — ela existe pra
    // dar direção ao giro, e parado não há direção pra indicar.
    return { opacity: index < progress.value * SPOKES ? 1 : 0 };
  });

  return (
    <Animated.View
      style={[
        {
          // `left`/`top` explícitos em vez de centralizar por flex: filho
          // absoluto sem âncora depende do alinhamento do pai, e aqui a posição
          // precisa ser exatamente o centro pra rotação sair concêntrica.
          position: 'absolute',
          left: offsetLeft,
          top: offsetTop,
          width,
          height,
          borderRadius: width / 2,
          backgroundColor: tint,
        },
        // Roda o traço em torno do próprio centro e SÓ ENTÃO o afasta: como o
        // translate acontece no eixo já rotacionado, ele sai radial. Invertendo
        // a ordem, os 12 empilham no mesmo lugar.
        { transform: [{ rotate: `${index * STEP}deg` }, { translateY: -orbit }] },
        animStyle,
      ]}
    />
  );
}

type Props = {
  /** Diâmetro em px. 20 equivale ao "small" do ActivityIndicator. */
  size?: number;
  /** Cor dos traços. Padrão: `textSecondary` lavado, o cinza de conteúdo
   *  secundário a 55% — e não a cor da marca, porque o amarelo é o mesmo
   *  `#F5C518` do botão primário e do realce, então em amarelo o indicador
   *  competia com eles. Os usos que caem dentro de um botão passam a cor do
   *  rótulo, e essa vai cheia. */
  color?: string;
  /** Progresso de 0 a 1. Passando isto, o leque para de girar e passa a acender
   *  traço a traço — é o estado de arrasto do PullToRefresh. Tirando a prop,
   *  ele volta a girar. */
  progress?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Indicador de carregamento do app: leque de traços radiais girando, o mesmo
 * desenho do indicador do iOS (e do Instagram). Substitui o `ActivityIndicator`
 * nativo, que desenha diferente em cada plataforma — leque no iOS, arco no
 * Android —, então a mesma tela tinha duas caras dependendo do aparelho.
 *
 * O giro é em passos discretos, um traço por vez, e não contínuo: é o passo que
 * dá o "tique" do indicador do sistema. Girando liso, o leque vira um borrão
 * cinza e some a diferença entre a cabeça e a cauda.
 */
export function Spinner({ size = 20, color, progress, style }: Props) {
  const { colors } = useTheme();
  const tint = color ?? hexToRgba(colors.textSecondary, DEFAULT_TINT_ALPHA);
  const step = useSharedValue(0);
  const spinning = !progress;

  useEffect(() => {
    if (!spinning) return;
    step.value = 0;
    step.value = withRepeat(withTiming(SPOKES, { duration: SPIN_DURATION, easing: Easing.linear }), -1);
    return () => cancelAnimation(step);
  }, [spinning, step]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinning ? Math.floor(step.value) * STEP : 0}deg` }],
  }));

  const geometry = useMemo<Geometry>(() => {
    const width = Math.max(MIN_SPOKE_WIDTH, Math.round(size * 0.1));
    const height = Math.round(size * 0.28);
    return {
      width,
      height,
      // Distância do centro até o centro do traço: encosta a ponta de fora na
      // borda da caixa, que é o que mantém o leque com o diâmetro pedido.
      orbit: (size - height) / 2,
      offsetLeft: (size - width) / 2,
      offsetTop: (size - height) / 2,
    };
  }, [size]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={[{ width: size, height: size }, spinStyle, style]}
    >
      {Array.from({ length: SPOKES }, (_, i) => (
        <Spoke key={i} index={i} tint={tint} progress={progress} {...geometry} />
      ))}
    </Animated.View>
  );
}
