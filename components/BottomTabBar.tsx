import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UsersRound, Wallet, User } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import type { TranslationKey } from '@/lib/i18n';
import { fontFamilies, spacing, type ColorPalette } from '@/theme';

const TAB_META = {
  // `UsersRound` e não `Users`: o lucide 1.23 não tem ícone de TRÊS pessoas —
  // os dois desenham uma figura inteira mais uma atrás. A versão redonda tem
  // menos traço, então segura melhor a 24px do tabbar, e combina com a Fredoka.
  // O par ao lado (`User`, em Ajustes) fica sendo a mesma família: um contra
  // vários, que é exatamente a diferença entre as duas abas.
  grupos: { icon: UsersRound, labelKey: 'tabs.groups' as TranslationKey },
  carteira: { icon: Wallet, labelKey: 'tabs.wallet' as TranslationKey },
  ajustes: { icon: User, labelKey: 'tabs.profile' as TranslationKey },
} as const;

export function BottomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name as keyof typeof TAB_META];
        if (!meta) return null;

        const active = state.index === index;
        const Icon = meta.icon;

        function onPress() {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigation.navigate(route.name);
        }

        return (
          <TouchableOpacity key={route.key} style={styles.item} activeOpacity={0.7} onPress={onPress}>
            <Icon
              size={24}
              color={active ? colors.textPrimary : colors.textSecondary}
              strokeWidth={active ? 2.4 : 1.8}
            />
            <Text style={[styles.label, active && styles.labelActive]}>{t(meta.labelKey)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  item: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontSize: 10,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.textPrimary,
  },
});
