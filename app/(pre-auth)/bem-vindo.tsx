import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, SuccessBurst } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, spacing, type ColorPalette } from '@/theme';

export default function BemVindoScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fullName = session?.user.user_metadata?.name as string | undefined;
  const primeiroNome = fullName?.trim().split(' ')[0] || t('bemVindo.fallbackName');

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={styles.hero}>
        <SuccessBurst size={120} />

        <View style={styles.textBlock}>
          <Text style={styles.title}>{t('bemVindo.title', { name: primeiroNome })}</Text>
          <Text style={styles.subtitle}>
            {t('bemVindo.subtitle')}
          </Text>
        </View>
      </View>

      <Button label={t('bemVindo.cta')} onPress={() => router.replace('/grupos')} raised />
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.pagePadding,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  textBlock: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSizes.heroSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
