import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from './BackButton';
import { SkeletonBone as Bone } from './SkeletonBone';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, type ColorPalette } from '@/theme';

// Contorno da tela de saldo por pessoa, mostrado enquanto grupo e saldos ainda
// não têm dado em cache. Só o voltar fica real — tudo abaixo depende do fetch,
// inclusive o nome de quem a tela é sobre.
export function SaldoSkeleton() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <BackButton style={[styles.backBtn, { top: insets.top + spacing.sm, marginBottom: 0 }]} />

      <View style={{ paddingTop: insets.top + spacing.sm }}>
        {/* Hero */}
        <View style={styles.hero}>
          <Bone style={styles.avatar} />
          <Bone style={styles.nameBar} />
          <Bone style={styles.labelBar} />
          <Bone style={styles.balanceBar} />
          <Bone style={styles.subtitleBar} />
        </View>

        {/* Pessoas relacionadas */}
        <View style={styles.sectionHeaderRow}>
          <Bone style={styles.sectionHeaderBar} />
        </View>

        {[0, 1].map(i => (
          <View key={i} style={styles.personCard}>
            <View style={styles.personRow}>
              <Bone style={styles.personAvatar} />
              <View style={styles.personInfo}>
                <Bone style={styles.personNameBar} />
                <Bone style={styles.personRelationBar} />
              </View>
              <Bone style={styles.personAmountBar} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backBtn: {
    position: 'absolute',
    left: spacing.pagePadding,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Hero ──────────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
  },
  nameBar: {
    marginTop: spacing.sm,
    width: 170,
    height: 22,
    borderRadius: radius.full,
  },
  labelBar: {
    marginTop: spacing.sm,
    width: 110,
    height: 14,
    borderRadius: radius.full,
  },
  balanceBar: {
    width: 150,
    height: 30,
    borderRadius: radius.full,
  },
  subtitleBar: {
    width: 200,
    height: 12,
    borderRadius: radius.full,
  },

  // ── Section ───────────────────────────────────────────────────────────────────
  sectionHeaderRow: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
  },
  sectionHeaderBar: {
    width: 130,
    height: 15,
    borderRadius: radius.full,
  },

  // ── Person card ───────────────────────────────────────────────────────────────
  // Espelha o personCard: mesma borda e mesmo raio, pra o card real entrar no
  // mesmo lugar.
  personCard: {
    marginHorizontal: spacing.pagePadding,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
  },
  personInfo: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  personNameBar: {
    width: '45%',
    height: 14,
    borderRadius: radius.full,
  },
  personRelationBar: {
    width: '65%',
    height: 12,
    borderRadius: radius.full,
  },
  personAmountBar: {
    width: 64,
    height: 14,
    borderRadius: radius.full,
  },
});
