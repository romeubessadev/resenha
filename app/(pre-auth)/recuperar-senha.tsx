import { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Button, Input } from '@/components';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { fontFamilies, fontSizes, spacing, type ColorPalette } from '@/theme';

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RecuperarSenhaScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const canSubmit = EMAIL_RULE.test(email.trim());

  async function handleEnviar() {
    const cleanEmail = email.trim().toLowerCase();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail);

    setLoading(false);

    if (resetError) {
      setError(t('recuperarSenha.errorGeneric'));
      return;
    }

    router.push({
      pathname: '/(pre-auth)/verificar-codigo',
      params: { email: cleanEmail, type: 'recovery' },
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

        <View style={styles.hero}>
          <Text style={styles.title}>{t('recuperarSenha.title')}</Text>
          <Text style={styles.subtitle}>
            {t('recuperarSenha.subtitle')}
          </Text>
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
        </View>

        <View style={styles.actions}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Button
            label={loading ? t('recuperarSenha.submitting') : t('recuperarSenha.submit')}
            onPress={handleEnviar}
            disabled={!canSubmit || loading}
            raised
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('recuperarSenha.footerText')}</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()}>
            <Text style={styles.footerLink}>{t('recuperarSenha.footerLink')}</Text>
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
