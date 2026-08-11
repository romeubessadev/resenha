import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, type ColorPalette } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

const DURATION = 250;
const CLOSED_OFFSET = 600;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Chamado depois que o Modal nativo termina de desmontar (fim real da animação de saída).
   *  Use pra encadear uma ação que abre outro Modal — evita apresentar dois Modals nativos
   *  ao mesmo tempo, que pode travar a apresentação no iOS/Android. */
  onClosed?: () => void;
  children: React.ReactNode;
  gap?: number;
  /** Empilha este sheet DENTRO de um <Modal> nativo que já está aberto (ex.:
   *  o sheet de editar despesa em grupo/despesa.tsx), em vez de abrir o
   *  próprio <Modal>/<GestureHandlerRootView>/<KeyboardAvoidingView> — dois
   *  <Modal> nativos abertos ao mesmo tempo travam a apresentação no
   *  iOS/Android. Quem chama já precisa estar dentro de um
   *  GestureHandlerRootView/KeyboardAvoidingView equivalente. Mantém o
   *  conteúdo de baixo visível (dimmed) atrás do overlay, igual ao sheet
   *  de categoria em cima do "Nova despesa". */
  nested?: boolean;
};

// Modal nativo com animationType="slide" anima overlay + folha como um bloco só,
// fazendo o fundo escuro "descer" junto ao fechar em vez de sumir. Aqui as duas
// animações são independentes: overlay dá fade, folha dá slide.
export function BottomSheetModal({ visible, onClose, onClosed, children, gap = spacing.md, nested = false }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mounted, setMounted] = useState(visible);
  const overlayOpacity = useSharedValue(0);
  const panelTranslateY = useSharedValue(CLOSED_OFFSET);

  function finishClose() {
    setMounted(false);
    onClosed?.();
  }

  // Sheet que ainda não abriu nenhuma vez não tem o que fechar. Sem isto, o
  // efeito roda na MONTAGEM com visible=false, a animação de saída "termina" e
  // o `onClosed` dispara sem que nada tenha sido aberto — quem encadeia a
  // próxima etapa nesse callback (ver RecurrencesSheet) executa ela sozinho,
  // logo que a tela monta.
  const hasOpenedRef = useRef(visible);

  useEffect(() => {
    if (visible) {
      hasOpenedRef.current = true;
      setMounted(true);
      overlayOpacity.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.ease) });
      panelTranslateY.value = withTiming(0, { duration: DURATION, easing: Easing.out(Easing.ease) });
    } else {
      if (!hasOpenedRef.current) return;
      overlayOpacity.value = withTiming(0, { duration: DURATION, easing: Easing.in(Easing.ease) });
      panelTranslateY.value = withTiming(
        CLOSED_OFFSET,
        { duration: DURATION, easing: Easing.in(Easing.ease) },
        finished => {
          if (finished) runOnJS(finishClose)();
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, overlayOpacity, panelTranslateY]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: panelTranslateY.value }] }));

  if (!mounted) return null;

  const sheet = (
    <AnimatedPressable
      style={[styles.overlay, { paddingTop: insets.top + spacing.xl }, overlayStyle]}
      onPress={onClose}
    >
      <AnimatedPressable
        style={[
          styles.panel,
          { gap, paddingBottom: Math.max(insets.bottom, spacing.md) },
          panelStyle,
        ]}
        onPress={() => {}}
      >
        {children}
      </AnimatedPressable>
    </AnimatedPressable>
  );

  if (nested) {
    // Cobre o conteúdo já aberto (sheet/Modal pai) sem abrir um segundo
    // <Modal> nativo — ver comentário no prop `nested` acima. Sem
    // GestureHandlerRootView (o pai já fornece um), mas com seu próprio
    // KeyboardAvoidingView — são irmãos na árvore, não aninhados, então
    // não competem entre si mesmo os dois existindo ao mesmo tempo.
    return (
      <View style={StyleSheet.absoluteFill}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {sheet}
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      {/* O <Modal> do RN renderiza numa janela nativa separada — não herda o
          GestureHandlerRootView de app/_layout.tsx. Sem esse wrapper aqui,
          gestos (scroll, etc.) dentro do sheet ficam com o reconhecedor de
          gesto "preso" à espera de um contexto que não existe, até algum
          fallback nativo liberar depois de um tempo (o bug do scroll que só
          "destravava" sozinho). */}
      <GestureHandlerRootView style={styles.keyboardView}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {sheet}
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(21,27,36,0.4)',
  },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    padding: spacing.lg,
    // Nunca deixa o painel crescer além do espaço que o overlay realmente tem
    // (que já encolhe de verdade quando o teclado abre, via KeyboardAvoidingView)
    // — sem isso, conteúdo alto (ex.: busca + lista) empurra o painel pra cima
    // da tela, ficando atrás da status bar e levando o botão de fechar junto.
    maxHeight: '100%',
    overflow: 'hidden',
  },
});
