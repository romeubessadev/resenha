import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBone as Bone } from './SkeletonBone';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, type ColorPalette } from '@/theme';

// Contorno do CORPO do Insight — o header da tela (título e exportar) já é real
// e fica de fora, porque não depende do fetch. Daqui pra baixo tudo depende:
// os controles refletem o período carregado e a lista, as categorias.
export function InsightSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <View style={styles.fixed}>
        <Bone style={styles.segmented} />
        <Bone style={styles.segmented} />
        <Bone style={styles.picker} />

        {/* Card resumo */}
        <View style={styles.card}>
          <Bone style={styles.cardLabelBar} />
          <Bone style={styles.cardAmountBar} />
          <Bone style={styles.cardCompareBar} />
        </View>
      </View>

      <View style={styles.scrollContent}>
        <View style={styles.sectionHeaderRow}>
          <Bone style={styles.sectionTitleBar} />
        </View>

        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={styles.categoryRow}>
            <View style={styles.categoryContent}>
              <View style={styles.categoryHeaderRow}>
                <Bone style={styles.categoryIconCircle} />
                <View style={styles.categoryTextCol}>
                  <Bone style={styles.categoryNameBar} />
                  <Bone style={styles.categoryPctBar} />
                </View>
                <Bone style={styles.categoryValueBar} />
              </View>
              <Bone style={styles.categoryTrack} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  root: {
    flex: 1,
  },

  // ── Controles fixos ───────────────────────────────────────────────────────────
  fixed: {
    paddingHorizontal: spacing.pagePadding,
    gap: spacing.md,
  },
  // 42 = os 4 de padding do trilho + a altura do botão do segmented.
  segmented: {
    height: 42,
    borderRadius: radius.full,
  },
  picker: {
    height: 52,
    borderRadius: radius.full,
  },

  // ── Card resumo ───────────────────────────────────────────────────────────────
  // Mantém o fundo `surface` do card real: aqui o card é moldura, não conteúdo,
  // e ele já existe antes do dado chegar.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['3xl'],
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardLabelBar: {
    width: 140,
    height: 12,
    borderRadius: radius.full,
  },
  cardAmountBar: {
    width: 160,
    height: 30,
    borderRadius: radius.full,
  },
  cardCompareBar: {
    marginTop: spacing.xs,
    width: 180,
    height: 12,
    borderRadius: radius.full,
  },

  // ── Lista de categorias ───────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.lg,
  },
  sectionHeaderRow: {
    marginBottom: spacing.xs,
  },
  sectionTitleBar: {
    width: 120,
    height: 15,
    borderRadius: radius.full,
  },
  // Espelha o categoryRow, menos o recuo negativo: ele existe só pra o realce
  // de toque sangrar até a margem, e osso não recebe toque.
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
  },
  categoryContent: {
    flex: 1,
    gap: spacing.sm,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  categoryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  categoryTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  categoryNameBar: {
    width: '50%',
    height: 15,
    borderRadius: radius.full,
  },
  categoryPctBar: {
    width: '30%',
    height: 12,
    borderRadius: radius.full,
  },
  categoryValueBar: {
    width: 64,
    height: 15,
    borderRadius: radius.full,
  },
  categoryTrack: {
    height: 8,
    borderRadius: radius.full,
  },
});
