import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Button } from '@/components';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { fontFamilies, fontSizes, spacing, radius, type ColorPalette } from '@/theme';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60; // segundos

type OtpType = 'signup' | 'recovery';

export default function VerificarCodigoScreen() {
  const { email, type } = useLocalSearchParams<{ email: string; type: OtpType }>();
  const otpType: OtpType = type === 'recovery' ? 'recovery' : 'signup';

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef<(TextInput | null)[]>(Array(CODE_LENGTH).fill(null));
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Cooldown do reenvio (o código acabou de ser enviado pela tela anterior)
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  function handleChange(text: string, index: number) {
    // Só dígito: o preenchimento automático e a colagem trazem lixo junto
    // (espaço, hífen, o texto em volta do código no e-mail).
    const digitos = text.replace(/\D/g, '');

    // Mais de um dígito de uma vez = colagem ou preenchimento automático do
    // sistema, que entrega o código INTEIRO num campo só. Antes daqui saía
    // `text.slice(-1)`, então o código chegava e sobrava só o último dígito —
    // o atalho do celular parecia não funcionar.
    if (digitos.length > 1) {
      const next = [...code];
      for (let i = 0; i < digitos.length && index + i < CODE_LENGTH; i++) {
        next[index + i] = digitos[i];
      }
      setCode(next);
      const ultimo = Math.min(index + digitos.length, CODE_LENGTH) - 1;
      inputRefs.current[ultimo]?.focus();
      return;
    }

    const char = digitos.slice(-1);
    const next = [...code];
    next[index] = char;
    setCode(next);
    if (char && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace') {
      if (code[index]) {
        const next = [...code];
        next[index] = '';
        setCode(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  }

  const isFilled = code.every(c => c !== '');

  async function handleVerificar() {
    if (!email || !isFilled) return;
    setLoading(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.join(''),
      type: otpType,
    });

    setLoading(false);

    if (verifyError) {
      // UMA mensagem pros dois casos porque o servidor não os separa: código
      // errado devolve `otp_expired` e "Token has expired or is invalid",
      // igualzinho a um código vencido. É proposital no GoTrue — dizer "esse
      // código está errado" confirmaria que existe um código válido pendente
      // pra aquele e-mail.
      //
      // Antes daqui saía `message.includes('expired')`, que casava sempre: o
      // ramo de "inválido" era inalcançável e quem errava um dígito era
      // mandado pedir outro código, que é o conselho errado.
      if (__DEV__) console.error('[otp] falhou:', verifyError.code, verifyError.status, verifyError.message);
      setError(t('verificarCodigo.errorInvalidOrExpired'));
      return;
    }

    if (otpType === 'signup') {
      router.replace('/(pre-auth)/bem-vindo');
    } else {
      router.replace('/(pre-auth)/nova-senha');
    }
  }

  async function handleReenviar() {
    if (!email || resendIn > 0) return;
    setError(null);

    const { error: resendError } = otpType === 'signup'
      ? await supabase.auth.resend({ type: 'signup', email })
      : await supabase.auth.resetPasswordForEmail(email);

    if (resendError) {
      setError(t('verificarCodigo.errorResendFailed'));
      return;
    }

    setCode(Array(CODE_LENGTH).fill(''));
    setResendIn(RESEND_COOLDOWN);
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
          <Text style={styles.title}>{t('verificarCodigo.title')}</Text>
          <Text style={styles.subtitle}>{t('verificarCodigo.subtitle')}</Text>
          <Text style={styles.subtitleEmail}>{email}</Text>
        </View>

        <View style={styles.codeRow}>
          {Array(CODE_LENGTH).fill(null).map((_, i) => (
            <TextInput
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              style={[styles.codeBox, focusedIndex === i && styles.codeBoxFocused]}
              value={code[i]}
              onChangeText={text => handleChange(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              onFocus={() => setFocusedIndex(i)}
              onBlur={() => setFocusedIndex(prev => (prev === i ? null : prev))}
              keyboardType="number-pad"
              // Declara que este campo espera um código de uso único. Sem
              // isto o sistema não OFERECE o código: no iOS ele não aparece na
              // barra do teclado, no Android o autofill não sugere.
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              // CODE_LENGTH, não 1: o preenchimento automático entrega os seis
              // dígitos num campo só, e com limite 1 o sistema os corta antes
              // de `handleChange` ver. Quem reparte entre as caixas é o handler.
              maxLength={CODE_LENGTH}
              selectTextOnFocus
              textAlign="center"
            />
          ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          label={loading ? t('verificarCodigo.submitting') : t('verificarCodigo.submit')}
          onPress={handleVerificar}
          disabled={!isFilled || loading}
          raised
        />

        <View style={styles.resendWrap}>
          <TouchableOpacity onPress={handleReenviar} activeOpacity={0.7} disabled={resendIn > 0}>
            <Text style={[styles.resendLink, resendIn > 0 && styles.resendLinkDisabled]}>
              {resendIn > 0 ? t('verificarCodigo.resendIn', { seconds: resendIn }) : t('verificarCodigo.resend')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.changeEmailLink}>{t('verificarCodigo.changeEmail')}</Text>
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
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  subtitleEmail: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: fontSizes.h1Lg,
    fontFamily: fontFamilies.semibold,
    letterSpacing: 0,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  codeBoxFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.primaryDark,
  },
  errorText: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  resendWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  resendLink: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: 'rgba(17,17,17,0.8)',
  },
  resendLinkDisabled: {
    color: colors.textSecondary,
  },
  changeEmailLink: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
});
