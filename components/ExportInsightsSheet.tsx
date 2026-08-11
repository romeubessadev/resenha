import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Spinner } from './Spinner';
import { FileSpreadsheet, FileText, X, type LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheetModal } from './BottomSheetModal';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import type { LancamentoItem } from '@/hooks/useExpenses';
import {
  buildFileBase,
  buildInsightsCsv,
  buildInsightsPdfHtml,
  exportInsightsCsv,
  exportInsightsPdf,
  type ExportCategoryRow,
} from '@/lib/insightsExport';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  periodLabel: string;
  scopeLabel: string;
  expenses: LancamentoItem[];
  categoryData: ExportCategoryRow[];
  categoryNameById: Map<string, string>;
  total: number;
};

type ExportingKind = 'csv' | 'pdf' | null;

export function ExportInsightsSheet({
  visible, onClose, groupName, periodLabel, scopeLabel, expenses, categoryData,
  categoryNameById, total,
}: Props) {
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [exportingKind, setExportingKind] = useState<ExportingKind>(null);

  const hasExpenses = expenses.length > 0;
  const disabled = exportingKind !== null || !hasExpenses;

  async function handleExport(kind: 'csv' | 'pdf') {
    setExportingKind(kind);
    try {
      const fileBase = buildFileBase(groupName, periodLabel);
      if (kind === 'csv') {
        const csv = buildInsightsCsv({
          expenses,
          categoryNameById,
          fallbackCategoryLabel: t('common.categoryFallback'),
          language,
          t,
        });
        await exportInsightsCsv(csv, fileBase);
      } else {
        const html = buildInsightsPdfHtml({
          groupName,
          periodLabel,
          scopeLabel,
          total,
          categories: categoryData,
          expenses,
          categoryNameById,
          fallbackCategoryLabel: t('common.categoryFallback'),
          language,
          t,
        });
        await exportInsightsPdf(html, fileBase);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (err) {
      console.error('[insights-export]', err);
      Alert.alert(t('insight.exportErrorTitle'), t('insight.exportErrorBody'));
    } finally {
      setExportingKind(null);
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('insight.exportTitle')}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        {hasExpenses
          ? t('insight.exportSubtitleCount', { count: expenses.length, period: periodLabel })
          : t('insight.exportEmptyMessage')}
      </Text>

      <View style={styles.optionList}>
        <ExportOption
          styles={styles}
          icon={FileSpreadsheet}
          tint={colors.forest}
          tintBg={styles.iconCircleForest}
          title={t('insight.exportCsvTitle')}
          description={t('insight.exportCsvDesc')}
          loading={exportingKind === 'csv'}
          disabled={disabled}
          onPress={() => handleExport('csv')}
        />
        <ExportOption
          styles={styles}
          icon={FileText}
          tint={colors.coral}
          tintBg={styles.iconCircleCoral}
          title={t('insight.exportPdfTitle')}
          description={t('insight.exportPdfDesc')}
          loading={exportingKind === 'pdf'}
          disabled={disabled}
          onPress={() => handleExport('pdf')}
        />
      </View>
    </BottomSheetModal>
  );
}

// ── ExportOption ────────────────────────────────────────────────────────────

type ExportOptionProps = {
  styles: ReturnType<typeof createStyles>;
  icon: LucideIcon;
  tint: string;
  tintBg: object;
  title: string;
  description: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
};

function ExportOption({ styles, icon: Icon, tint, tintBg, title, description, loading, disabled, onPress }: ExportOptionProps) {
  return (
    <TouchableOpacity
      style={[styles.option, disabled && styles.optionDisabled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[styles.iconCircle, tintBg]}>
        {loading ? <Spinner size={20} color={tint} /> : <Icon size={20} color={tint} strokeWidth={2.2} />}
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  subtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  optionList: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surface,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleForest: {
    backgroundColor: 'rgba(0,94,49,0.15)',
  },
  iconCircleCoral: {
    backgroundColor: 'rgba(255,118,67,0.15)',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  optionDescription: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
});
