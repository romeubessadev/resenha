import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Button, Input } from '@/components';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { isOnboardingDone } from '@/lib/onboarding';
import { fontFamilies, fontSizes, spacing, type ColorPalette } from '@/theme';

export default function EntrarScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tourDone, setTourDone] = useState(false);

  useEffect(() => {
    isOnboardingDone().then(setTourDone);
  }, []);

  // Mesma regra do "Bora rachar" em login.tsx: quem nunca viu o tour passa por
  // ele antes do cadastro — a ordem Onboarding → Paywall → Auth que o
  // CLAUDE.md define. Este link ia DIRETO pro formulário e furava o funil
  // inteiro pra quem chegasse por "já tenho conta" e mudasse de ideia.
  //
  // Sem leitura do storage ainda, manda pro tour: ele é pulável, e repeti-lo
  // incomoda menos do que sonegá-lo.
  function handleCreateAccount() {
    router.push(tourDone ? '/(pre-auth)/signup' : '/(pre-auth)/onboarding');
  }

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError(t('entrar.errorEmptyFields'));
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (!signInError) {
      setLoading(false);
      router.replace('/grupos');
      return;
    }

    // Conta existe mas o e-mail nunca foi confirmado: reenvia o código
    // e leva pra tela de verificação.
    //
    // Discrimina pelo `code`, não pelo texto: o servidor manda
    // `email_not_confirmed` junto de "Email not confirmed", e casar pela
    // mensagem quebra em silêncio se a redação mudar — aí quem tem conta e
    // senha certas cai em "E-mail ou senha incorretos" e não tem saída.
    // É o mesmo erro que deixava o OTP dizer "expirou" pra código errado.
    if (signInError.code === 'email_not_confirmed') {
      await supabase.auth.resend({ type: 'signup', email: cleanEmail });
      setLoading(false);
      router.push({
        pathname: '/(pre-auth)/verificar-codigo',
        params: { email: cleanEmail, type: 'signup' },
      });
      return;
    }

    setLoading(false);
    setError(t('entrar.errorInvalidCredentials'));
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bottomOffset={16}
    >
      <BackButton />

      <View style={styles.logoWrap}>
        <Image source={require('@/assets/logo-resenha.png')} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>{t('entrar.title')}</Text>
        <Text style={styles.subtitle}>{t('entrar.subtitle')}</Text>
      </View>

      <View style={styles.fields}>
        <Input
          label={t('auth.emailLabel')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Input
          variant="password"
          label={t('auth.passwordLabel')}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
        />

        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(pre-auth)/recuperar-senha')}>
          <Text style={styles.forgotLink}>{t('entrar.forgotPassword')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <Button
          label={loading ? t('entrar.submitting') : t('entrar.submit')}
          onPress={handleLogin}
          disabled={!email.trim() || !password || loading}
          raised
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>{t('auth.orContinueWith')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          label={t('auth.googleButton')}
          onPress={() => {}}
          variant="secondary"
          icon={<Image source={require('@/assets/logo-google.png')} style={styles.socialIcon} resizeMode="contain" />}
        />
        <Button
          label={t('auth.appleButton')}
          onPress={() => {}}
          variant="secondary"
          icon={<Image source={require('@/assets/logo-apple.png')} style={styles.socialIcon} resizeMode="contain" />}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('entrar.footerText')}</Text>
        <TouchableOpacity activeOpacity={0.7} onPress={handleCreateAccount}>
          <Text style={styles.footerLink}>{t('entrar.footerLink')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.pagePadding,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 128,
    height: 64,
  },
  hero: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSizes.heroSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  fields: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  forgotLink: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  socialIcon: {
    width: 20,
    height: 20,
  },
  errorText: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.danger,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
});
