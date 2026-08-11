import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from './BackButton';
import { SkeletonBone as Bone } from './SkeletonBone';
import { ExpenseListSkeleton } from './ExpenseListSkeleton';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, type ColorPalette } from '@/theme';

// Contorno da tela de detalhe do rolê, mostrado enquanto o grupo ainda não
// tem dado em cache (primeira entrada). Header fica real/funcional — só o
// conteúdo abaixo (hero, saldo, tabs, lista) é placeholder.
export function GroupDetailSkeleton() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <BackButton style={styles.headerBackBtn} />
        <View style={styles.headerRight}>
          <Bone style={styles.headerIconBone} />
          <Bone style={styles.headerIconBone} />
        </View>
      </View>

      <View style={styles.hero}>
        <Bone style={styles.avatar} />
        <Bone style={styles.nameBar} />
        <Bone style={styles.subtitleBar} />
        <View style={styles.avatarStackRow}>
          {[0, 1, 2, 3].map(i => (
            <Bone key={i} style={[styles.miniAvatar, i > 0 && styles.miniAvatarOverlap]} />
          ))}
        </View>
      </View>

      <View style={styles.balanceCard}>
        <Bone style={styles.labelBar} />
        <Bone style={styles.valueBar} />
        <View style={styles.actionsRow}>
          <Bone style={styles.actionBtn} />
          <Bone style={styles.actionBtn} />
        </View>
      </View>

      <View style={styles.tabBarRow}>
        <Bone style={styles.tabPill} />
        <Bone style={styles.tabPillWide} />
        <Bone style={styles.tabPill} />
      </View>

      <View style={styles.list}>
        <ExpenseListSkeleton />
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.sm,
  },
  headerBackBtn: {
    alignSelf: 'center',
    marginBottom: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBone: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },

  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  nameBar: {
    width: 160,
    height: 24,
    borderRadius: radius.full,
  },
  subtitleBar: {
    width: 190,
    height: 14,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  avatarStackRow: {
    flexDirection: 'row',
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.background,
  },
  miniAvatarOverlap: {
    marginLeft: -8,
  },

  balanceCard: {
    marginHorizontal: spacing.pagePadding,
    marginBottom: spacing.md,
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  labelBar: {
    width: 120,
    height: 14,
    borderRadius: radius.full,
  },
  valueBar: {
    width: 150,
    height: 28,
    borderRadius: radius.full,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.full,
  },

  tabBarRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
  },
  tabPill: {
    width: 72,
    height: 34,
    borderRadius: radius.full,
  },
  tabPillWide: {
    width: 96,
    height: 34,
    borderRadius: radius.full,
  },

  list: {
    paddingHorizontal: spacing.pagePadding,
  },
});
