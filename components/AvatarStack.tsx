import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, type ColorPalette } from '@/theme';

const SIZES = { '2xs': 24, xs: 20, sm: 28, md: 40 } as const;

type Member = { id: string; name: string; photoUrl?: string; isMe?: boolean };

type Props = {
  members: Member[];
  max?: number;
  size?: keyof typeof SIZES;
};

export function AvatarStack({ members, max = 3, size = 'xs' }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dimension = SIZES[size];
  const visible = members.slice(0, max);
  const overflow = members.length - visible.length;
  const overlap = -Math.round(dimension * 0.3);

  return (
    <View style={styles.row}>
      {visible.map((member, i) => (
        <View key={member.id} style={i > 0 ? { marginLeft: overlap } : undefined}>
          <Avatar name={member.name} id={member.id} photoUrl={member.photoUrl} size={size} variant="colorful" ring />
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={[
            styles.bubble,
            { width: dimension, height: dimension, borderRadius: dimension / 2, marginLeft: overlap },
          ]}
        >
          <Text style={[styles.bubbleText, { fontSize: Math.round(dimension * 0.4) }]}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  bubbleText: {
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
});
