import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';
import type { TranslationKey } from '@/lib/i18n';

export type PaywallReason = 'roles' | 'voice' | 'batchSettle' | 'export' | 'recurring' | 'general';

type Props = {
  visible: boolean;
  reason: PaywallReason;
  onClose: () => void;
  onUpgrade: () => void;
};

const COPY_KEYS: Record<PaywallReason, { eyebrow: TranslationKey; title: TranslationKey; subtitle: TranslationKey }> = {
  roles: { eyebrow: 'limitPaywall.rolesEyebrow', title: 'limitPaywall.rolesTitle', subtitle: 'limitPaywall.rolesSubtitle' },
  voice: { eyebrow: 'limitPaywall.genericEyebrow', title: 'limitPaywall.voiceTitle', subtitle: 'limitPaywall.voiceSubtitle' },
  batchSettle: { eyebrow: 'limitPaywall.genericEyebrow', title: 'limitPaywall.batchSettleTitle', subtitle: 'limitPaywall.batchSettleSubtitle' },
  export: { eyebrow: 'limitPaywall.genericEyebrow', title: 'limitPaywall.exportTitle', subtitle: 'limitPaywall.exportSubtitle' },
  recurring: { eyebrow: 'limitPaywall.genericEyebrow', title: 'limitPaywall.recurringTitle', subtitle: 'limitPaywall.recurringSubtitle' },
  general: { eyebrow: 'limitPaywall.genericEyebrow', title: 'limitPaywall.generalTitle', subtitle: 'limitPaywall.generalSubtitle' },
};

// Fixos, sempre nesta ordem, independente do motivo do gatilho — o objetivo é
// mostrar o pacote Premium inteiro, não só o item que travou.
//
// Emoji, e não lucide: é a MESMA lista da tela de paywall pós-onboarding
// (app/(pre-auth)/paywall.tsx), e as duas precisam bater — duas telas com cara
// diferente vendendo a mesma oferta é inconsistência que todo usuário vê. A
// exceção ao "só lucide na UI" vale para os dois paywalls e para o tour.
const BENEFITS: { emoji: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { emoji: '🎉', titleKey: 'limitPaywall.benefit1', descKey: 'limitPaywall.benefit1Desc' },
  { emoji: '🏷️', titleKey: 'limitPaywall.benefit2', descKey: 'limitPaywall.benefit2Desc' },
  { emoji: '🎤', titleKey: 'limitPaywall.benefit3', descKey: 'limitPaywall.benefit3Desc' },
  { emoji: '⚡', titleKey: 'limitPaywall.benefit4', descKey: 'limitPaywall.benefit4Desc' },
  { emoji: '📄', titleKey: 'limitPaywall.benefit5', descKey: 'limitPaywall.benefit5Desc' },
  { emoji: '🕘', titleKey: 'limitPaywall.benefit6', descKey: 'limitPaywall.benefit6Desc' },
  { emoji: '🔁', titleKey: 'limitPaywall.benefit8', descKey: 'limitPaywall.benefit8Desc' },
  { emoji: '🚀', titleKey: 'limitPaywall.benefit7', descKey: 'limitPaywall.benefit7Desc' },
];

export function LimitPaywallSheet({ visible, reason, onClose, onUpgrade }: Props) {
  const { t } = useLanguage();
  const { colors, resolvedScheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const copy = COPY_KEYS[reason];
  // "dark" (preto) é o contraste máximo no light, contra o fundo creme — no
  // dark mode ink quase some no background, então vira mostarda (o contraste
  // máximo lá é o inverso).
  const ctaVariant = resolvedScheme === 'dark' ? 'primary' : 'dark';

  return (
    <BottomSheetModal visible={visible} onClose={onClose} gap={0}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeChip} onPress={onClose} hitSlop={8} activeOpacity={0.7}>
          <X size={18} color={colors.textPrimary} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollFlex} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{t(copy.eyebrow)}</Text>
          <Text style={styles.title}>
            {t(copy.title)}{'\n'}
            <Text style={styles.titleAccent}>{t('limitPaywall.titleSuffix')}</Text>
          </Text>
          <Text style={styles.subtitle}>{t(copy.subtitle)}</Text>
        </View>

        <View style={styles.benefitsList}>
          {BENEFITS.map(benefit => (
            <View key={benefit.titleKey} style={styles.benefitRow}>
              <View style={styles.benefitIconChip}>
                <Text style={styles.benefitEmoji}>{benefit.emoji}</Text>
              </View>
              <View style={styles.benefitTextCol}>
                <Text style={styles.benefitTitle}>{t(benefit.titleKey)}</Text>
                <Text style={styles.benefitDesc}>{t(benefit.descKey)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t('limitPaywall.cta')} onPress={onUpgrade} variant={ctaVariant} raised />
        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.dismissLink}>{t('limitPaywall.dismiss')}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeChip: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  scrollFlex: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  hero: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.bold,
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: fontSizes.h1Lg,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    lineHeight: fontSizes.h1Lg * 1.05,
  },
  titleAccent: {
    color: colors.primaryDark,
  },
  subtitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: fontSizes.body * 1.4,
    maxWidth: 280,
  },
  benefitsList: {
    gap: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
  },
  benefitIconChip: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitEmoji: {
    fontSize: fontSizes.h1Sm,
  },
  benefitTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingTop: 2,
  },
  benefitTitle: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  benefitDesc: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: fontSizes.caption * 1.35,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  dismissLink: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
