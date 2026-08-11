import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Share, Linking } from 'react-native';
import { X, Copy, Check, Share2, CircleCheck } from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { WhatsAppIcon } from './WhatsAppIcon';
import { useRegenerateInviteCode } from '@/hooks/useGroup';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  groupCode: string;
};

export function InviteQrSheet({ visible, onClose, groupId, groupName, groupCode }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState(groupCode);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [regenSuccess, setRegenSuccess] = useState(false);
  const { regenerate, loading: regenerating } = useRegenerateInviteCode();

  // O código pode mudar por fora (refetch do grupo) — mantém sincronizado,
  // mas handleRegenerate já atualiza na hora, sem esperar o refetch.
  useEffect(() => { setCode(groupCode); }, [groupCode]);

  async function handleCopy() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleWhatsapp() {
    const text = t('invite.shareMessage', { name: groupName, code });
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.whatsappOpenFailed'));
    }
  }

  async function handleShareMore() {
    try {
      await Share.share({
        message: t('invite.shareMessage', { name: groupName, code }),
      });
    } catch {}
  }

  async function handleRegenerate() {
    try {
      const newCode = await regenerate(groupId);
      setCode(newCode.toUpperCase());
      setRegenConfirmOpen(false);
      setRegenSuccess(true);
      setTimeout(() => setRegenSuccess(false), 3000);
    } catch {
      Alert.alert(t('inviteQr.regenFailedTitle'), t('common.tryAgain'));
    }
  }

  function handleClose() {
    setRegenConfirmOpen(false);
    onClose();
  }

  return (
    <BottomSheetModal visible={visible} onClose={handleClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('inviteQr.title')}</Text>
        <TouchableOpacity onPress={handleClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.qrBox}>
        <QRCodeSVG value={code} size={192} color={colors.ink} backgroundColor={colors.white} />
      </View>

      <TouchableOpacity style={styles.codePill} onPress={handleCopy} activeOpacity={0.7}>
        <View>
          <Text style={styles.codeLabel}>{t('invite.codeLabel')}</Text>
          <Text style={styles.codeValue}>{code}</Text>
        </View>
        <View style={styles.codeCopyCircle}>
          {copied
            ? <Check size={16} color={colors.primaryDark} strokeWidth={2.5} />
            : <Copy size={16} color={colors.textPrimary} strokeWidth={1.8} />}
        </View>
      </TouchableOpacity>

      <View style={styles.shareRow}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleWhatsapp} activeOpacity={0.7}>
          <View style={styles.shareIconCircle}>
            <WhatsAppIcon size={20} color={colors.textPrimary} />
          </View>
          <Text style={styles.shareLabel}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareMore} activeOpacity={0.7}>
          <View style={styles.shareIconCircle}>
            <Share2 size={20} color={colors.textPrimary} strokeWidth={1.8} />
          </View>
          <Text style={styles.shareLabel}>{t('common.more')}</Text>
        </TouchableOpacity>
      </View>

      {regenSuccess ? (
        <View style={styles.regenSuccessRow}>
          <CircleCheck size={16} color={colors.success} strokeWidth={2} />
          <Text style={styles.regenSuccessText}>{t('inviteQr.regenSuccess')}</Text>
        </View>
      ) : regenConfirmOpen ? (
        <View style={styles.regenCard}>
          <Text style={styles.regenCardText}>
            {t('inviteQr.regenConfirmBody')}
          </Text>
          <View style={styles.regenCardActions}>
            <TouchableOpacity
              style={styles.regenCancelBtn}
              onPress={() => setRegenConfirmOpen(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.regenCancelLabel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.regenConfirmBtn}
              onPress={handleRegenerate}
              activeOpacity={0.85}
              disabled={regenerating}
            >
              <Text style={styles.regenConfirmLabel}>{regenerating ? t('inviteQr.regenerating') : t('inviteQr.regenerateConfirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setRegenConfirmOpen(true)} activeOpacity={0.7}>
          <Text style={styles.regenLink}>{t('inviteQr.regenerateLink')}</Text>
        </TouchableOpacity>
      )}

      <Button label={t('common.done')} onPress={handleClose} labelStyle={styles.doneBtnLabel} />
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
  qrBox: {
    alignSelf: 'center',
    padding: spacing.md,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: 'rgba(217,168,0,0.4)',
    backgroundColor: colors.white,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  codeLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  codeCopyCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  shareRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  shareIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  shareLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  regenLink: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  regenCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  regenCardText: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
  },
  regenCardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  regenCancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  regenCancelLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  regenConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.coral,
    alignItems: 'center',
  },
  regenConfirmLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.white,
  },
  regenSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  regenSuccessText: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.success,
    textAlign: 'center',
  },
  doneBtnLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
});
