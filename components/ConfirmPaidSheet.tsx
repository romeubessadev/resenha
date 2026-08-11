import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { Image as ImageIcon, X } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/currencies';
import { buildPickImageTexts, pickImage } from '@/lib/imagePicker';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

const MAX_PROOF_MB = 5;

type Props = {
  toName: string;
  amount: number;
  onConfirm: (proofUri: string | null, mimeType: string | null) => void;
  loading?: boolean;
};

/** Conteúdo puro (sem sheet/modal em volta) — embutido dentro do
 *  SettleUpSheet via troca de conteúdo no mesmo BottomSheetModal: dois
 *  Modal nativos abertos ao mesmo tempo trava a apresentação no iOS/Android. */
export function ConfirmPaidSheet({ toName, amount, onConfirm, loading }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [proofMimeType, setProofMimeType] = useState<string | null>(null);

  async function handlePick() {
    const asset = await pickImage(buildPickImageTexts(t, {
      sourceTitle: t('confirmPaid.proofLabel'),
      galleryPermissionBody: t('confirmPaid.photoPermissionBody'),
    }));
    if (!asset) return;
    if (asset.fileSize && asset.fileSize > MAX_PROOF_MB * 1024 * 1024) {
      Alert.alert(t('confirmPaid.fileTooBigTitle'), t('confirmPaid.fileTooBigBody', { mb: MAX_PROOF_MB }));
      return;
    }
    setProofUri(asset.uri);
    setProofMimeType(asset.mimeType ?? 'image/jpeg');
  }

  function handleRemove() {
    setProofUri(null);
    setProofMimeType(null);
  }

  return (
    <>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>{t('confirmPaid.summaryLabel')}</Text>
        <Text style={styles.summaryValue}>
          {formatMoney(amount)} <Text style={styles.summaryValueMuted}>{t('confirmPaid.forPerson', { name: toName })}</Text>
        </Text>
      </View>

      <View>
        <Text style={styles.fieldLabel}>
          {t('confirmPaid.proofLabel')} <Text style={styles.fieldLabelOptional}>{t('common.optional')}</Text>
        </Text>
        <Text style={styles.explain}>
          {t('confirmPaid.proofExplain', { name: toName })}
        </Text>
      </View>

      {!proofUri ? (
        <TouchableOpacity style={styles.uploaderPill} onPress={handlePick} activeOpacity={0.7} disabled={loading}>
          <ImageIcon size={20} color={colors.textSecondary} strokeWidth={1.8} />
          <Text style={styles.uploaderLabel}>{t('confirmPaid.attachProof')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.previewCard}>
          <Image source={{ uri: proofUri }} style={styles.previewImg} resizeMode="cover" />
          <TouchableOpacity style={styles.removeBtn} onPress={handleRemove} hitSlop={8} activeOpacity={0.7} disabled={loading}>
            <X size={16} color={colors.ink} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.swapBtn} onPress={handlePick} activeOpacity={0.7} disabled={loading}>
            <ImageIcon size={14} color={colors.ink} strokeWidth={2} />
            <Text style={styles.swapLabel}>{t('common.swap')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sem "Cancelar": o X do cabeçalho do sheet que abriga este corpo já
          volta um passo (ver handleHeaderClose no SettleUpSheet e o mesmo no
          BatchSettleSheet). Um botão pra fazer o que o X faz duplicava a saída
          e roubava metade da linha da ação. */}
      <TouchableOpacity
        style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
        onPress={() => onConfirm(proofUri, proofMimeType)}
        activeOpacity={0.85}
        disabled={loading}
      >
        <Text style={styles.confirmLabel}>{loading ? t('common.confirming') : t('common.confirm')}</Text>
      </TouchableOpacity>
    </>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  summary: {
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    gap: 2,
  },
  summaryLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  summaryValueMuted: {
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  fieldLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  fieldLabelOptional: {
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  explain: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  uploaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  uploaderLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  previewCard: {
    height: 200,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surface,
  },
  previewImg: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapBtn: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  swapLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
  // 52 em largura cheia, igual à ação do ConfirmSheet e do "Sair do rolê" —
  // era 48 e metade da linha, dividindo espaço com um cancelar.
  confirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
});
