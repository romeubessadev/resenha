import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { isOnboardingDone, resetOnboarding } from '@/lib/onboarding';
import { fontFamilies, fontSizes, radius, shadows, spacing, type ColorPalette } from '@/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tourDone, setTourDone] = useState(false);

  useEffect(() => {
    isOnboardingDone().then(setTourDone);
  }, []);

  // "Bora rachar" é o começo do funil: quem nunca viu o tour passa por ele (e
  // pelo paywall) antes do cadastro — a ordem que o CLAUDE.md define. Quem já
  // viu vai direto ao formulário. Se a leitura do storage ainda não voltou,
  // manda pro tour: ele é pulável, e repeti-lo incomoda menos do que sonegá-lo.
  function handleStart() {
    router.push(tourDone ? '/(pre-auth)/signup' : '/(pre-auth)/onboarding');
  }

  return (
    <View style={styles.root}>
      <Image
        source={require('@/assets/amigos.png')}
        style={styles.heroImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.7)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <Image source={require('@/assets/logo-bros.png')} style={styles.wordmark} resizeMode="contain" />

        <View style={styles.bottomBlock}>
          <Text style={styles.headline}>{t('login.headline')}</Text>

          <View style={styles.card}>
            <Text style={styles.cardCopy}>{t('login.cardCopy')}</Text>

            <Button
              label={t('login.cta')}
              onPress={handleStart}
              raised
            />

            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(pre-auth)/entrar')}>
              <Text style={styles.secondaryLink}>{t('login.haveAccount')}</Text>
            </TouchableOpacity>

            {/* Só em desenvolvimento: limpa a flag e as respostas pra refazer o
                tour sem reinstalar o app. Não vai pra produção. */}
            {__DEV__ && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => resetOnboarding().then(() => setTourDone(false))}
              >
                <Text style={styles.devLink}>Refazer tour (dev)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  wordmark: {
    alignSelf: 'center',
    width: 112,
    height: 56,
    ...shadows.logoOnPhoto,
  },
  bottomBlock: {
    paddingHorizontal: spacing.pagePadding,
  },
  headline: {
    textAlign: 'center',
    fontSize: fontSizes.hero,
    lineHeight: fontSizes.hero,
    fontFamily: fontFamilies.bold,
    color: colors.coral,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    ...shadows.balance,
  },
  cardCopy: {
    textAlign: 'center',
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    marginBottom: spacing.md,
  },
  secondaryLink: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  devLink: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
});
