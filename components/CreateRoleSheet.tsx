import { useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Alert, Share, Linking,
} from 'react-native';
import { Camera, Check, Copy, RotateCw, Share2, X } from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from './Avatar';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { Input } from './Input';
import { WhatsAppIcon } from './WhatsAppIcon';
import { RoleLimitError, useCreateGroup } from '@/hooks/useGroups';
import { useUpdateGroupAvatar } from '@/hooks/useGroup';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { getGroupAvatarUrl } from '@/lib/groupAvatar';
import { buildPickImageTexts, pickImage } from '@/lib/imagePicker';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Photo = { uri: string; mimeType: string };
type CreatedGroup = { id: string; name: string; avatarPath: string | null; inviteCode: string };
type Step = 'form' | 'done';

const NAME_MAX = 40;

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
  onLimitReached: () => void;
};

export function CreateRoleSheet({ visible, onClose, onCreated, onLimitReached }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [created, setCreated] = useState<CreatedGroup | null>(null);
  const [copied, setCopied] = useState(false);
  const { createGroup, loading } = useCreateGroup();
  const { setGroupAvatarOnCreate, loading: uploadingAvatar } = useUpdateGroupAvatar();
  const afterCloseRef = useRef<(() => void) | null>(null);

  const canCreate = name.trim().length >= 2 && !loading && !uploadingAvatar;

  function reset() {
    setStep('form');
    setName('');
    setPhoto(null);
    setCreated(null);
    setCopied(false);
  }

  function handleClose() {
    const createdGroupId = created?.id ?? null;
    reset();
    if (createdGroupId) afterCloseRef.current = () => onCreated(createdGroupId);
    onClose();
  }

  // Só chama a ação adiada depois que o BottomSheetModal terminou de
  // desmontar de verdade — abrir um segundo Modal nativo (o LimitPaywallSheet)
  // antes disso pode travar a apresentação (mesmo motivo de JoinRoleSheet.tsx).
  function handleClosed() {
    const action = afterCloseRef.current;
    afterCloseRef.current = null;
    action?.();
  }

  async function handlePickPhoto() {
    try {
      const asset = await pickImage(buildPickImageTexts(t, {
        sourceTitle: t('common.groupPhotoTitle'),
        galleryPermissionBody: t('profile.photoPermissionBody'),
      }), { allowsEditing: true, aspect: [1, 1] });
      if (asset) setPhoto({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
    } catch (err) {
      Alert.alert(t('common.galleryErrorTitle'), err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCreate() {
    if (!canCreate) return;
    try {
      const group = await createGroup(name.trim(), null);
      let avatarPath: string | null = null;
      if (photo) {
        try {
          avatarPath = await setGroupAvatarOnCreate(group.id, photo.uri, photo.mimeType);
        } catch (err) {
          Alert.alert(t('createRole.createdButPhotoFailedTitle'), t('createRole.createdButPhotoFailedBody', { error: err instanceof Error ? err.message : String(err) }));
        }
      }
      setCreated({ id: group.id, name: group.name, avatarPath, inviteCode: group.invite_code.toUpperCase() });
      setStep('done');
    } catch (err) {
      if (err instanceof RoleLimitError) {
        afterCloseRef.current = onLimitReached;
        handleClose();
        return;
      }
      // Serializa por getOwnPropertyNames, e não só `err`: erro do Supabase
      // guarda a informação útil em `code`, `details` e `hint`, que não são
      // enumeráveis — foi o que revelou uma duplicata de função no banco.
      console.error('[createRole] createGroup falhou:', JSON.stringify(err, Object.getOwnPropertyNames(err ?? {})));
      Alert.alert(t('createRole.createFailedTitle'), err instanceof Error ? err.message : t('common.tryAgain'));
    }
  }

  async function handleCopyCode() {
    if (!created) return;
    await Clipboard.setStringAsync(created.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleWhatsapp() {
    if (!created) return;
    const text = t('invite.shareMessage', { name: created.name, code: created.inviteCode });
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.whatsappOpenFailed'));
    }
  }

  async function handleShareMore() {
    if (!created) return;
    try {
      await Share.share({
        message: t('invite.shareMessage', { name: created.name, code: created.inviteCode }),
      });
    } catch {}
  }

  const headerTitle = step === 'done'
    ? t('createRole.createdTitle')
    : t('createRole.title');

  const headerEl = (
    <View style={styles.header}>
      <Text style={styles.title}>{headerTitle}</Text>
      <TouchableOpacity onPress={handleClose} hitSlop={8} activeOpacity={0.7}>
        <X size={22} color={colors.textPrimary} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} onClosed={handleClosed} gap={spacing.lg}>
      {step === 'form' ? (
        <>
          {headerEl}
          <View style={styles.photoSection}>
            <View style={photo && styles.photoRing}>
              <View style={styles.photoWrap}>
                <TouchableOpacity
                  style={[styles.photoCircle, !photo && styles.photoCircleEmpty]}
                  onPress={handlePickPhoto}
                  activeOpacity={0.8}
                >
                  {photo
                    ? <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                    : (
                      <>
                        <Camera size={28} color={colors.ink} strokeWidth={1.8} />
                        <Text style={styles.photoLabel}>{t('common.addPhoto')}</Text>
                      </>
                    )}
                </TouchableOpacity>
                {photo && (
                  <TouchableOpacity
                    style={styles.photoRemoveBadge}
                    onPress={() => setPhoto(null)}
                    hitSlop={8}
                    activeOpacity={0.7}
                  >
                    <X size={14} color={colors.textPrimary} strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {photo && (
              <TouchableOpacity style={styles.photoChangeRow} onPress={handlePickPhoto} activeOpacity={0.7}>
                <RotateCw size={14} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.photoActionLabel}>{t('common.changePhoto')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View>
            <Input
              label={t('groupSheet.nameLabel')}
              placeholder={t('createRole.namePlaceholder')}
              value={name}
              onChangeText={v => setName(v.slice(0, NAME_MAX))}
              maxLength={NAME_MAX}
            />
            <Text style={styles.counter}>{name.length}/{NAME_MAX}</Text>
          </View>

          <Button
            label={loading || uploadingAvatar ? t('createRole.creating') : t('createRole.submit')}
            onPress={handleCreate}
            disabled={!canCreate}
            loading={loading || uploadingAvatar}
            labelStyle={styles.createBtnLabel}
          />
        </>
      ) : (
        <>
          {headerEl}
          {created && (
            <View style={styles.successBody}>
              <View style={styles.groupHeader}>
                <Avatar
                  name={created.name}
                  id={created.id}
                  photoUrl={getGroupAvatarUrl(created.avatarPath) ?? undefined}
                  variant="warm"
                  size={64}
                />
                <Text style={styles.groupName}>{created.name}</Text>
                <Text style={styles.groupCaption}>{t('createRole.aloneCaption')}</Text>
              </View>

              <View style={styles.qrBox}>
                <QRCodeSVG value={created.inviteCode} size={192} color={colors.ink} backgroundColor={colors.white} />
              </View>

              <TouchableOpacity style={styles.codePill} onPress={handleCopyCode} activeOpacity={0.7}>
                <View>
                  <Text style={styles.codeLabel}>{t('invite.codeLabel')}</Text>
                  <Text style={styles.codeValue}>{created.inviteCode}</Text>
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

              <Button
                label={t('common.done')}
                onPress={handleClose}
                labelStyle={styles.createBtnLabel}
              />
            </View>
          )}
        </>
      )}
    </BottomSheetModal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  pickerBody: {
    gap: spacing.lg,
  },
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

  // ── Form ──────────────────────────────────────────────────
  photoSection: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoRing: {
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: 'rgba(245,197,24,0.25)',
  },
  photoWrap: {
    width: 128,
    height: 128,
  },
  photoCircle: {
    width: 128,
    height: 128,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 4,
  },
  // Tracejado e fundo mostarda são do estado VAZIO — o convite pra escolher uma
  // foto. Com foto escolhida eles não podem ficar: `borderWidth` encolhe a
  // caixa de conteúdo, então a imagem a 100% preenchia 124 de 128 e a borda
  // sobrava aparecendo em volta dela.
  photoCircleEmpty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primaryDark,
    backgroundColor: 'rgba(245,197,24,0.15)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
  photoRemoveBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  photoChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoActionLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  counter: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  createBtnLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surface,
  },
  currencyTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  currencyLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  currencyValue: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  // ── Success ───────────────────────────────────────────────
  successBody: {
    gap: spacing.md,
  },
  groupHeader: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  groupName: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  groupCaption: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  qrBox: {
    alignSelf: 'center',
    padding: spacing.md,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: colors.primary,
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
    letterSpacing: 2,
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
});
