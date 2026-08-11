import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

export function checkPasswordRules(password: string) {
  const length = password.length >= 8;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const digit = /\d/.test(password);
  return { length, upper, lower, digit, valid: length && upper && lower && digit };
}

function RuleItem({ valid, label }: { valid: boolean; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.item}>
      <View style={[styles.dot, valid && styles.dotValid]}>
        {valid && <Check size={10} color={colors.white} strokeWidth={3} />}
      </View>
      <Text style={[styles.label, valid && styles.labelValid]}>{label}</Text>
    </View>
  );
}

export function PasswordRules({ password }: { password: string }) {
  const { length, upper, lower, digit } = checkPasswordRules(password);
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <RuleItem valid={length} label={t('passwordRules.length')} />
        <RuleItem valid={upper} label={t('passwordRules.upper')} />
      </View>
      <View style={styles.row}>
        <RuleItem valid={lower} label={t('passwordRules.lower')} />
        <RuleItem valid={digit} label={t('passwordRules.digit')} />
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  grid: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  item: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotValid: {
    backgroundColor: colors.textPrimary,
  },
  label: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  labelValid: {
    color: colors.textPrimary,
  },
});
