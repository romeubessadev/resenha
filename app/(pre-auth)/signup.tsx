import { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CountryCode } from 'libphonenumber-js/max';
import { BackButton, Button, Input, PasswordRules, checkPasswordRules } from '@/components';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { examplePhone, formatNationalPhone, isValidPhone, toWhatsappNumber } from '@/lib/whatsapp';
import { fontFamilies, fontSizes, spacing, type ColorPalette } from '@/theme';

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Número é sempre brasileiro — máscara, validação e E.164 saem daqui. O DDI
// não aparece na UI. Mesma decisão do WhatsAppSheet.
const COUNTRY: CountryCode = 'BR';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const passwordValid = checkPasswordRules(password).valid;
  const canSubmit = name.trim().length >= 2 && EMAIL_RULE.test(email.trim())
    && isValidPhone(whatsapp, COUNTRY) && passwordValid;

  async function handleSignup() {
    const cleanEmail = email.trim().toLowerCase();
    if (!canSubmit) return;

    const whatsappNumber = toWhatsappNumber(whatsapp, COUNTRY);
    if (!whatsappNumber) return;

    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { name: name.trim(), whatsapp: whatsappNumber, language } },
    });

    setLoading(false);

    if (signUpError) {
      // A causa REAL só existe aqui — o texto que vai pra tela é sempre
      // genérico de propósito (mensagem de servidor não é pra usuário ler).
      // Sem este log, um cadastro que falha é indistinguível de outro: foi
      // exatamente o que aconteceu quando o envio de e-mail caiu e não havia
      // como saber se era senha, rede, e-mail repetido ou o hook.
      if (__DEV__) console.error('[signup] falhou:', signUpError.code, signUpError.status, signUpError.message);

      // Pelo `code`, não pelo texto: a mensagem é redação do GoTrue e muda
      // entre versões sem aviso — quando mudar, o ramo para de casar e o erro
      // certo vira "Tenta de novo". Mesma armadilha que já custou quatro
      // correções neste app (queryError, send-push, OTP e login).
      if (signUpError.code === 'user_already_exists') {
        setError(t('signup.errorAlreadyRegistered'));
      } else if (signUpError.code === 'over_email_send_rate_limit') {
        setError(t('signup.errorRateLimit'));
      } else if (signUpError.message.includes('hook')) {
        // O cadastro em si passou; quem falhou foi o envio do e-mail. Vale uma
        // mensagem própria: "tenta de novo" não resolve, e a pessoa fica
        // repetindo um gesto que não tem como dar certo.
        setError(t('signup.errorEmailSend'));
      } else {
        setError(t('signup.errorGeneric'));
      }
      return;
    }

    // E-mail já cadastrado e confirmado: o Supabase não retorna erro,
    // mas devolve um usuário sem identidades
    if (data.user?.identities?.length === 0) {
      setError(t('signup.errorAlreadyRegistered'));
      return;
    }

    router.push({
      pathname: '/(pre-auth)/verificar-codigo',
      params: { email: cleanEmail, type: 'signup' },
    });
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
          <Text style={styles.title}>{t('signup.title')}</Text>
          <Text style={styles.subtitle}>{t('signup.subtitle')}</Text>
        </View>

        <View style={styles.fields}>
          <Input
            label={t('signup.nameLabel')}
            placeholder={t('signup.namePlaceholder')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Input
            label={t('auth.emailLabel')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View>
            <Input
              label="WhatsApp"
              placeholder={examplePhone(COUNTRY)}
              value={whatsapp}
              onChangeText={v => setWhatsapp(formatNationalPhone(v, COUNTRY))}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
            <Text style={styles.helperText}>{t('signup.whatsappHelper')}</Text>
          </View>

          <View>
            <Input
              variant="password"
              label={t('auth.passwordLabel')}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />

            <PasswordRules password={password} />
          </View>
        </View>

        <View style={styles.actions}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Button
            label={loading ? t('signup.submitting') : t('signup.submit')}
            onPress={handleSignup}
            disabled={!canSubmit || loading}
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

        <Text style={styles.disclaimer}>{t('signup.disclaimer')}</Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('signup.footerText')}</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(pre-auth)/entrar')}>
            <Text style={styles.footerLink}>{t('signup.footerLink')}</Text>
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
    width: '100%',
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
  helperText: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl,
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
  disclaimer: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
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
