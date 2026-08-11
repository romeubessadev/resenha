import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBone as Bone } from './SkeletonBone';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, type ColorPalette } from '@/theme';

// Placeholder da aba Resumo do rolê: o grid 2×2 de números + a linha de
// contagem embaixo.
//
// Separado do GroupDetailSkeleton de propósito: aquele cobre a tela inteira
// quando o rolê ainda não existe em cache; este é pro caso em que o rolê JÁ
// carregou (header, hero e saldo estão na tela) e só faltam os saldos e as
// despesas. São dois momentos diferentes, com quantidades diferentes de tela
// pra preencher.
export function SummaryStatsSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      <View style={styles.grid}>
        {[0, 1].map(row => (
          <View key={row} style={styles.gridRow}>
            {[0, 1].map(col => (
              <View key={col} style={styles.card}>
                <Bone style={styles.label} />
                <Bone style={styles.value} />
              </View>
            ))}
          </View>
        ))}
      </View>
      <Bone style={styles.footer} />
    </View>
  );
}

// Mesmas medidas do statGrid/statCard de grupo/[id].tsx, pra os números reais
// entrarem exatamente onde os ossos estavam.
const createStyles = (colors: ColorPalette) => StyleSheet.create({
  grid: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
    gap: 6,
  },
  label: {
    width: '55%',
    height: 10,
    borderRadius: radius.full,
  },
  value: {
    width: '75%',
    height: 20,
    borderRadius: radius.full,
  },
  footer: {
    width: 140,
    height: 12,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
});
