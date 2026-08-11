import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBone as Bone } from './SkeletonBone';
import { ExpenseListSkeleton } from './ExpenseListSkeleton';
import { useTheme } from '@/hooks/useTheme';
import { radius, shadows, spacing, type ColorPalette } from '@/theme';

// Contorno do "cupom" de detalhe da despesa, mostrado enquanto a despesa
// ainda não tem dado em cache. O header real (voltar + título) já fica fora
// desse componente, renderizado direto pela tela.
export function ExpenseDetailSkeleton() {
  const { colors, resolvedScheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, resolvedScheme), [colors, resolvedScheme]);

  return (
    <View style={styles.content}>
      <View style={styles.cupom}>
        <View style={styles.cupomHeader}>
          <Bone style={styles.cupomLabelBone} />
          <Bone style={styles.cupomNameBone} />
        </View>

        <View style={styles.heroSection}>
          <Bone style={styles.heroCircle} />
          <Bone style={styles.heroTitleBone} />
          <Bone style={styles.heroCategoryBone} />
          <Bone style={styles.heroAmountBone} />
        </View>

        <View style={styles.divider} />

        {/* Três, não quatro: data, quem pagou e divisão. Categoria saiu das
            linhas de info — ela vive só no hero, logo abaixo do título, onde
            também se corrige. */}
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.infoRow}>
            <Bone style={styles.infoLabelBone} />
            <Bone style={styles.infoValueBone} />
          </View>
        ))}

        <View style={styles.divider} />

        <Bone style={styles.sectionHeaderBone} />
        <View style={styles.splitList}>
          <ExpenseListSkeleton count={2} />
        </View>

        <View style={styles.divider} />

        <Bone style={styles.sectionHeaderBone} />
        <Bone style={styles.receiptPillBone} />

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Bone style={styles.infoLabelBone} />
          <Bone style={styles.infoValueBone} />
        </View>
        <View style={styles.infoRow}>
          <Bone style={styles.infoLabelBone} />
          <Bone style={styles.infoValueBone} />
        </View>

        <View style={styles.solidDivider} />

        <View style={styles.totalizerRow}>
          <Bone style={styles.totalizerLabelBone} />
          <Bone style={styles.totalizerValueBone} />
        </View>
        <Bone style={styles.cupomIdBone} />
      </View>

      <View style={styles.actionsGrid}>
        <Bone style={styles.actionBtnBone} />
        <Bone style={styles.actionBtnBone} />
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette, resolvedScheme: 'light' | 'dark') => StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
  },
  cupom: {
    marginHorizontal: spacing.pagePadding,
    borderRadius: radius['2xl'],
    // Mesmo par do cupom real (despesa.tsx): branco puro no light, `surface`
    // no dark. Antes era `surface` nos dois, e no light a silhueta do
    // placeholder não batia com a da tela que ele anuncia.
    backgroundColor: resolvedScheme === 'dark' ? colors.surface : colors.background,
    overflow: 'hidden',
    ...shadows.balance,
  },
  cupomHeader: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.lg,
  },
  cupomLabelBone: {
    width: 80,
    height: 10,
    borderRadius: radius.full,
  },
  cupomNameBone: {
    width: 110,
    height: 12,
    borderRadius: radius.full,
  },
  heroSection: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  heroTitleBone: {
    width: 150,
    height: 20,
    borderRadius: radius.full,
  },
  heroCategoryBone: {
    width: 90,
    height: 12,
    borderRadius: radius.full,
  },
  heroAmountBone: {
    width: 130,
    height: 28,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  solidDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  infoLabelBone: {
    width: 70,
    height: 13,
    borderRadius: radius.full,
  },
  infoValueBone: {
    width: 110,
    height: 13,
    borderRadius: radius.full,
  },
  sectionHeaderBone: {
    width: 90,
    height: 10,
    borderRadius: radius.full,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  splitList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm + 4,
  },
  receiptPillBone: {
    height: 52,
    borderRadius: radius.full,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  totalizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  totalizerLabelBone: {
    width: 130,
    height: 14,
    borderRadius: radius.full,
  },
  totalizerValueBone: {
    width: 90,
    height: 20,
    borderRadius: radius.full,
  },
  cupomIdBone: {
    width: 40,
    height: 10,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.pagePadding,
    marginTop: spacing.lg,
  },
  actionBtnBone: {
    flex: 1,
    height: 48,
    borderRadius: radius.full,
  },
});
