import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from './BackButton';
import { SkeletonBone as Bone } from './SkeletonBone';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

// Contorno da tela de participantes, mostrado enquanto o grupo ainda não tem
// dado em cache (primeira entrada). Segue o GroupDetailSkeleton: o que já se
// sabe sem carregar nada fica real (voltar, título da tela) e só o que depende
// do fetch vira osso — nome da resenha, contagem e as linhas de participante.
export function ParticipantsSkeleton() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <BackButton style={styles.headerBackBtn} />
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>{t('participants.title')}</Text>
            <Bone style={styles.subtitleBar} />
          </View>
        </View>
        {/* Osso incondicional: o botão de convidar só existe pra admin, e o
            papel vem no mesmo fetch. Mesmo compromisso dos ícones do header
            no GroupDetailSkeleton. */}
        <Bone style={styles.inviteBtn} />
      </View>

      <View style={styles.countRow}>
        <Bone style={styles.countBar} />
      </View>

      <View style={styles.listContent}>
        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={styles.memberRow}>
            <Bone style={styles.avatar} />
            <View style={styles.memberInfo}>
              <Bone style={styles.nameBar} />
              <Bone style={styles.statusBar} />
            </View>
            <Bone style={styles.valueBar} />
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

  // ── Header ────────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  headerBackBtn: {
    alignSelf: 'center',
    marginBottom: 0,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  subtitleBar: {
    width: 120,
    height: 11,
    borderRadius: radius.full,
    marginTop: 4,
  },
  inviteBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },

  // ── Count ─────────────────────────────────────────────────────────────────────
  countRow: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
  },
  countBar: {
    width: 110,
    height: 11,
    borderRadius: radius.full,
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: spacing.pagePadding,
  },
  // Espelha o memberRow: mesmos paddings e mesmo gap, pra a lista real entrar
  // sem deslocar nada.
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm + 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  nameBar: {
    width: '45%',
    height: 15,
    borderRadius: radius.full,
  },
  statusBar: {
    width: '65%',
    height: 12,
    borderRadius: radius.full,
  },
  valueBar: {
    width: 64,
    height: 15,
    borderRadius: radius.full,
  },
});
