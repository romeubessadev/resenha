import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  archived: boolean;
  onParticipants: () => void;
  onInsights: () => void;
  onRename: () => void;
  onToggleArchive: () => void;
  onLeave: () => void;
};

export function GroupOptionsSheet({ visible, onClose, onClosed, archived, onParticipants, onInsights, onRename, onToggleArchive, onLeave }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} onClosed={onClosed}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('groupOptions.title')}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.item}
        onPress={() => { onClose(); onParticipants(); }}
        activeOpacity={0.7}
      >
        <Text style={styles.itemLabel}>{t('groupOptions.members')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.item, styles.itemRow]}
        onPress={() => { onClose(); onInsights(); }}
        activeOpacity={0.7}
      >
        <Text style={styles.itemLabel}>{t('groupOptions.insights')}</Text>
        <Text style={styles.itemDescription}>{t('groupOptions.insightsHint')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => { onClose(); onRename(); }}
        activeOpacity={0.7}
      >
        <Text style={styles.itemLabel}>{t('editGroup.title')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.item, styles.itemRow]}
        onPress={() => { onClose(); onToggleArchive(); }}
        activeOpacity={0.7}
      >
        <Text style={styles.itemLabel}>{archived ? t('groupOptions.unarchive') : t('groupOptions.archive')}</Text>
        {!archived && <Text style={styles.itemDescription}>{t('groupOptions.archiveHint')}</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => { onClose(); onLeave(); }}
        activeOpacity={0.7}
      >
        <Text style={styles.itemLabelDanger}>{t('leaveGroup.action')}</Text>
      </TouchableOpacity>
    </BottomSheetModal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  item: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.lg,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  itemDescription: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  itemLabelDanger: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.coral,
  },
});
