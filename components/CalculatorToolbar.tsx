import { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Minus, X, Divide, Equal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, shadows, type ColorPalette } from '@/theme';

export type CalcOp = '+' | '-' | '*' | '/';

type Props = {
  /** Operador pendente — fica destacado até o `=` (ou outro operador) resolver. */
  activeOp: CalcOp | null;
  onOperator: (op: CalcOp) => void;
  onEquals: () => void;
};

// Operador é glifo, não ícone de navegação: precisa do peso de um caractere
// tipográfico pra competir com o valor em 48px logo acima. 2.5 é o degrau
// "pesado" que o resto do app já usa (Check, stepper).
const ICON_SIZE = 22;
const ICON_STROKE = 2.5;

const OPS: { op: CalcOp; Icon: typeof Plus }[] = [
  { op: '+', Icon: Plus },
  { op: '-', Icon: Minus },
  { op: '*', Icon: X },
  { op: '/', Icon: Divide },
];

/** Barra de operações do campo de valor. Puramente apresentacional: a conta em
 *  si (buffer e operador pendente) mora em ExpenseFormFields, junto do valor
 *  que ela edita.
 *
 *  Sem `onPress` que tire o foco do campo: as duas telas que montam o
 *  formulário rolam num KeyboardAwareScrollView com
 *  `keyboardShouldPersistTaps="handled"`, então tocar aqui não fecha o teclado
 *  nem devolve o blur — que reformataria o valor no meio da conta. */
export function CalculatorToolbar({ activeOp, onOperator, onEquals }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Tecla de calculadora é toque repetido e sem som: o retorno tátil é o que
  // confirma que pegou. Mesma intensidade do resto do app (ver insight.tsx).
  function tap(run: () => void) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    run();
  }

  return (
    <View style={styles.bar}>
      {OPS.map(({ op, Icon }, i) => {
        const active = activeOp === op;
        return (
          <TouchableOpacity
            key={op}
            style={[styles.cell, i > 0 && styles.cellDivided, active && styles.cellActive]}
            onPress={() => tap(() => onOperator(op))}
            activeOpacity={0.7}
          >
            <Icon size={ICON_SIZE} color={active ? colors.ink : colors.textPrimary} strokeWidth={ICON_STROKE} />
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        style={[styles.cell, styles.cellDivided]}
        onPress={() => tap(onEquals)}
        activeOpacity={0.7}
      >
        <Equal size={ICON_SIZE} color={colors.textPrimary} strokeWidth={ICON_STROKE} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    marginTop: spacing.md,
    // Pílula explícita: com radius.xl a 44 de altura o RN já grampeava em 22 e
    // desenhava isto de qualquer jeito — melhor dizer do que depender do corte.
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    // Sem isto o fundo da célula ativa vaza por cima do raio da barra.
    overflow: 'hidden',
    ...shadows.card,
  },
  cell: {
    flex: 1,
    // 44, e não os 52 de campo (Input, pílula de comprovante): esta barra é
    // auxiliar e transitória, não pode pesar igual ao campo de descrição. 44
    // ainda é o alvo de toque mínimo recomendado, então não custa precisão.
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Divisória como borda da célula seguinte, e não como <View> própria: um
  // separador de 1px entre irmãos flex:1 tira largura de um dos lados e as
  // cinco células deixam de ser iguais.
  cellDivided: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  cellActive: {
    backgroundColor: colors.primary,
  },
});
