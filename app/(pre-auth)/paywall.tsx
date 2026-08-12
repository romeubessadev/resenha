import { useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { X, LockOpen, Bell, Star } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import type { TranslationKey } from '@/lib/i18n';
import { fontFamilies, fontSizes, radius, shadows, spacing, type ColorPalette } from '@/theme';

// Emoji, e não lucide, no tour e no paywall — decisão explícita pra bater com
// os mockups. No app pós-login a regra continua sendo lucide.
//
// Os textos reaproveitam as chaves `limitPaywall.*` que o sheet de limite já
// usa: é a mesma oferta, e duplicar a copy garantiria que as duas telas
// divergissem na primeira revisão.
const BENEFITS = [
  // Ordem por PERCEPÇÃO de valor, não por afinidade temática: IA e insights são
  // o que diferencia, então abrem a lista. Ilimitadas cai pro 4º porque só pesa
  // pra quem já bateu no limite. Exportar e novidades fecham.
  { emoji: '🎤', title: 'limitPaywall.benefit3', desc: 'limitPaywall.benefit3Desc' },
  { emoji: '⚡', title: 'limitPaywall.benefit4', desc: 'limitPaywall.benefit4Desc' },
  { emoji: '🎉', title: 'limitPaywall.benefit1', desc: 'limitPaywall.benefit1Desc' },
  { emoji: '🔁', title: 'limitPaywall.benefit8', desc: 'limitPaywall.benefit8Desc' },
  { emoji: '🕘', title: 'limitPaywall.benefit6', desc: 'limitPaywall.benefit6Desc' },
  { emoji: '📊', title: 'limitPaywall.benefit5', desc: 'limitPaywall.benefit5Desc' },
  { emoji: '🚀', title: 'limitPaywall.benefit7', desc: 'limitPaywall.benefit7Desc' },
] as const satisfies readonly { emoji: string; title: TranslationKey; desc: TranslationKey }[];

type PlanKey = 'monthly' | 'annual' | 'lifetime';

// Preços fixos NO CLIENTE, de propósito e provisoriamente: o RevenueCat ainda
// não está integrado (não há `react-native-purchases` no projeto), então não
// existe offering de onde puxar. Quando entrar, estes três valores saem daqui
// e passam a vir da loja — que é a única fonte correta, já que preço muda por
// país e por promoção.
const PLANS = [
  { key: 'monthly', title: 'paywall.planMonthly', note: 'paywall.planMonthlyNote', price: 'R$ 14,90' },
  { key: 'annual', title: 'paywall.planAnnual', note: 'paywall.planAnnualNote', price: 'R$ 89,90/ano', aside: 'R$ 7,49/mês' },
  { key: 'lifetime', title: 'paywall.planLifetime', note: 'paywall.planLifetimeNote', price: 'R$ 249,90' },
] as const satisfies readonly {
  key: PlanKey; title: TranslationKey; note: TranslationKey; price: string; aside?: string;
}[];

/** Só o anual tem teste grátis, então a linha do tempo some nos outros dois —
 *  prometer "7 dias grátis" num plano vitalício seria mentira. */
const TRIAL_STEPS = [
  { Icon: LockOpen, label: 'paywall.trialDay0', desc: 'paywall.trialDay0Desc' },
  { Icon: Bell, label: 'paywall.trialDay5', desc: 'paywall.trialDay5Desc' },
  { Icon: Star, label: 'paywall.trialDay7', desc: 'paywall.trialDay7Desc' },
] as const satisfies readonly { Icon: typeof LockOpen; label: TranslationKey; desc: TranslationKey }[];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [plan, setPlan] = useState<PlanKey>('annual');

  const selected = PLANS.find(p => p.key === plan)!;
  const [titleStart, titleAccent = '', titleEnd = ''] = t('paywall.title').split(/[[\]]/);

  function notAvailable() {
    Alert.alert(t('limitPaywall.cta'), t('paywall.notAvailableYet'));
  }

  const footerNote = plan === 'annual'
    ? t('paywall.footerAnnual', { price: selected.price })
    : plan === 'monthly'
      ? t('paywall.footerMonthly', { price: selected.price })
      : t('paywall.footerLifetime');

  const ctaLabel = plan === 'annual'
    ? t('paywall.ctaTrial')
    : plan === 'monthly'
      ? t('limitPaywall.cta')
      : t('paywall.ctaLifetime');

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Image source={require('@/assets/logo-resenha.png')} style={styles.wordmark} resizeMode="contain" />
        {/* Fechar segue pro cadastro, não volta pra capa: o paywall é o último
            passo antes do "Auth" do fluxo, e o X significa "sigo sem assinar". */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.replace('/(pre-auth)/signup')}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <X size={20} color={colors.textPrimary} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {titleStart}
          <Text style={styles.titleAccent}>{titleAccent}</Text>
          {titleEnd}
        </Text>
        <Text style={styles.subtitle}>{t('paywall.subtitle')}</Text>

        <View style={styles.benefitList}>
          {BENEFITS.map(benefit => (
            <View key={benefit.title} style={styles.benefitRow}>
              <View style={styles.benefitChip}>
                <Text style={styles.benefitEmoji}>{benefit.emoji}</Text>
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>{t(benefit.title)}</Text>
                <Text style={styles.benefitDesc}>{t(benefit.desc)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.planList}>
          {PLANS.map(option => {
            const active = option.key === plan;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.planCard, active && styles.planCardActive]}
                onPress={() => setPlan(option.key)}
                activeOpacity={0.85}
              >
                {option.key === 'annual' && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeLabel}>{t('paywall.mostChosen')}</Text>
                  </View>
                )}
                <View style={styles.planTextCol}>
                  <Text style={styles.planTitle}>{t(option.title)}</Text>
                  <Text style={styles.planNote}>{t(option.note)}</Text>
                </View>
                <View style={styles.planPriceCol}>
                  <Text style={styles.planPrice}>{option.price}</Text>
                  {'aside' in option && <Text style={styles.planAside}>{option.aside}</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {plan === 'annual' && (
          <View style={styles.trialBlock}>
            <Text style={styles.trialHeading}>{t('paywall.trialHeading')}</Text>
            {TRIAL_STEPS.map((trial, i) => (
              <View key={trial.label} style={styles.trialRow}>
                <View style={styles.trialRail}>
                  <View style={styles.trialChip}>
                    <trial.Icon size={18} color={colors.textPrimary} strokeWidth={2.2} />
                  </View>
                  {i < TRIAL_STEPS.length - 1 && <View style={styles.trialConnector} />}
                </View>
                <View style={styles.trialText}>
                  <Text style={styles.trialLabel}>{t(trial.label)}</Text>
                  <Text style={styles.trialDesc}>{t(trial.desc)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={notAvailable} activeOpacity={0.7} style={styles.restoreBtn}>
          <Text style={styles.restore}>{t('paywall.restore')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Text style={styles.footerNote}>{footerNote}</Text>
        <Button label={ctaLabel} onPress={notAvailable} variant="dark" raised />
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pagePadding,
  },
  // Igual ao onboarding e ao header de (tabs)/grupos — os três são marca de
  // cabeçalho, ao lado de um botão de 40px.
  wordmark: {
    width: 88,
    height: 44,
  },
  closeBtn: {
    position: 'absolute',
    right: spacing.pagePadding,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.heroLg,
    lineHeight: fontSizes.heroLg + 6,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  titleAccent: {
    color: colors.primary,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: fontSizes.h2,
    lineHeight: 22,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Benefícios ──────────────────────────────────────────────────────────────
  benefitList: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  benefitChip: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  benefitEmoji: {
    fontSize: fontSizes.h1Sm,
  },
  benefitText: {
    flex: 1,
    minWidth: 0,
  },
  benefitTitle: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  benefitDesc: {
    marginTop: 1,
    fontSize: fontSizes.bodySm,
    lineHeight: 18,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Planos ──────────────────────────────────────────────────────────────────
  planList: {
    marginTop: spacing.xl,
    gap: spacing.sm + 2,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  planCardActive: {
    borderColor: colors.textPrimary,
    ...shadows.card,
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  planBadgeLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  planTextCol: {
    flex: 1,
    minWidth: 0,
  },
  planTitle: {
    fontSize: fontSizes.h1Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  planNote: {
    marginTop: 1,
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  planPriceCol: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: fontSizes.h1Sm,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  planAside: {
    marginTop: 1,
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  // ── Como funciona o teste ───────────────────────────────────────────────────
  trialBlock: {
    marginTop: spacing.xl,
  },
  trialHeading: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  trialRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  trialRail: {
    alignItems: 'center',
  },
  trialChip: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  trialConnector: {
    flex: 1,
    width: 2,
    minHeight: spacing.sm,
    backgroundColor: colors.border,
  },
  trialText: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  trialLabel: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  trialDesc: {
    marginTop: 1,
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  restoreBtn: {
    marginTop: spacing.lg,
    alignSelf: 'center',
  },
  // Discreto de propósito: a Apple exige mecanismo de restauração em app que
  // vende não-consumível (o vitalício) — quem troca de aparelho precisa
  // recuperar o que pagou. Não dá pra remover, mas não precisa competir com o
  // CTA.
  restore: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  footer: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.cream,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
});
