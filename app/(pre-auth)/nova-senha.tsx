import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Check, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Button, Input, PasswordRules, checkPasswordRules } from '@/components';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

export default function NovaSenhaScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const passwordValid = checkPasswordRules(password).valid;
  const showMatch = confirm.length > 0;
  const matches = confirm === password;
  const canSubmit = passwordValid && showMatch && matches;

  async function handleSalvar() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    // A sessão já existe aqui (criada pelo verifyOtp de recuperação)
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(
        updateError.message.includes('different from the old')
          ? t('novaSenha.errorDifferent')
          : t('novaSenha.errorGeneric')
      );
      return;
    }

    router.replace('/(pre-auth)/senha-alterada');
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
          <Text style={styles.title}>{t('novaSenha.title')}</Text>
          <Text style={styles.subtitle}>{t('novaSenha.subtitle')}</Text>
        </View>

        <View style={styles.fields}>
          <View>
            <Input
              variant="password"
              label={t('novaSenha.newPasswordLabel')}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <PasswordRules password={password} />
          </View>

          <View>
            <Input
              variant="password"
              label={t('novaSenha.confirmPasswordLabel')}
              placeholder="••••••••"
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="none"
            />
            {showMatch && (
              <View style={styles.matchRow}>
                <View style={[styles.matchDot, matches ? styles.matchDotValid : styles.matchDotInvalid]}>
                  {matches
                    ? <Check size={10} color={colors.white} strokeWidth={3} />
                    : <X size={10} color={colors.white} strokeWidth={3} />}
                </View>
                <Text style={[styles.matchLabel, matches ? styles.matchLabelValid : styles.matchLabelInvalid]}>
                  {matches ? t('novaSenha.matchValid') : t('novaSenha.matchInvalid')}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Button
            label={loading ? t('novaSenha.submitting') : t('novaSenha.submit')}
            onPress={handleSalvar}
            disabled={!canSubmit || loading}
            raised
          />
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
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  matchDot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchDotValid: {
    backgroundColor: colors.textPrimary,
  },
  matchDotInvalid: {
    backgroundColor: colors.danger,
  },
  matchLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
  },
  matchLabelValid: {
    color: colors.textPrimary,
  },
  matchLabelInvalid: {
    color: colors.danger,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.danger,
    textAlign: 'center',
  },
});
