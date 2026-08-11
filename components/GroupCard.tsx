import { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Avatar } from './Avatar';
import { AvatarStack } from './AvatarStack';
import { useLanguage } from '@/hooks/useLanguage';
import { formatMoney } from '@/lib/currencies';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { fontFamilies, fontSizes, radius, type ColorPalette } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

type Member = { id: string; name: string; photoUrl?: string; isMe?: boolean };

type Props = {
  groupId: string;
  name: string;
  photoUrl?: string | null;
  members?: Member[];
  netBalance: number;
  /** Moeda em que `netBalance` já vem formatado (moeda principal do usuário — useGroups já converteu). */
  archived: boolean;
  lastActivityAt: string;
  index?: number;
  onPress: () => void;
};

export function GroupCard({ groupId, name, photoUrl, members, netBalance, archived, lastActivityAt, index = 0, onPress }: Props) {
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      50 + index * 40,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) }),
    );
  }, [progress, index]);

  const riseStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: 12 * (1 - progress.value) }],
  }));

  return (
    <Animated.View style={riseStyle}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={archived && styles.avatarArchived}>
          <Avatar name={name} id={groupId} photoUrl={photoUrl ?? undefined} variant="warm" size={56} />
        </View>

        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <View style={styles.metaRow}>
            {members !== undefined && members.length > 0 && (
              <AvatarStack members={members} size="2xs" />
            )}
            <Text style={styles.metaText}> · {formatRelativeTime(lastActivityAt, language)}</Text>
          </View>
        </View>

        {archived ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('groups.archivedBadge')}</Text>
          </View>
        ) : netBalance === 0 ? (
          <Text style={styles.quiteText}>{t('groupDetail.balanceEven')}</Text>
        ) : (
          <Text style={[styles.valueText, { color: netBalance > 0 ? colors.forest : colors.coral }]}>
            {netBalance > 0 ? '+ ' : '− '}{formatMoney(Math.abs(netBalance))}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius['2xl'],
    gap: 12,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  avatarArchived: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  quiteText: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  valueText: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    fontVariant: ['tabular-nums'],
  },
});
