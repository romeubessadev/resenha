import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontSizes, fontWeights, radius, spacing, type ColorPalette } from '@/theme';

const AVATARS = [
  { id: '1', bg: '#FEE2E2' },
  { id: '2', bg: '#DCFCE7' },
  { id: '3', bg: '#DBEAFE' },
  { id: '4', bg: '#D1FAE5' },
  { id: '5', bg: '#FEF3C7' },
  { id: '6', bg: '#EDE9FE' },
  { id: '7', bg: '#FCE7F3' },
  { id: '8', bg: '#FFF7ED' },
  { id: '9', bg: '#F0F9FF' },
];

export default function AvatarScreen() {
  const [selected, setSelected] = useState('1');
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function handleContinuar() {
    const userId = session?.user.id;
    if (userId) {
      setLoading(true);
      await supabase.from('profiles').update({ avatar_key: selected }).eq('id', userId);
      setLoading(false);
    }
    router.replace('/grupos');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <Text style={styles.logo}>Resenha</Text>

      <View style={styles.header}>
        <Text style={styles.title}>{t('avatar.title')}</Text>
        <Text style={styles.subtitle}>{t('avatar.subtitle')}</Text>
      </View>

      <View style={styles.grid}>
        {[0, 1, 2].map(row => (
          <View key={row} style={styles.gridRow}>
            {AVATARS.slice(row * 3, row * 3 + 3).map(item => {
              const isSelected = item.id === selected;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.avatarWrap, isSelected && styles.avatarSelected]}
                  onPress={() => setSelected(item.id)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: item.bg }]} />
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Check size={11} color={colors.white} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Button
          label={loading ? t('avatar.continuing') : t('common.continue')}
          onPress={handleContinuar}
          disabled={loading}
          raised
        />
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.pagePadding,
  },
  logo: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSizes.h1,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.regular,
    color: colors.textSecondary,
  },
  grid: {
    gap: spacing.lg,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarSelected: {
    borderColor: colors.primary,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
  },
  checkBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  spacer: {
    flex: 1,
  },
  footer: {
    gap: spacing.sm,
  },
});
