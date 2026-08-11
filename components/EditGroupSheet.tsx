import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { Camera, RotateCw, X } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { Input } from './Input';
import { useUpdateGroup, useUpdateGroupAvatar } from '@/hooks/useGroup';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { buildPickImageTexts, pickImage } from '@/lib/imagePicker';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

const NAME_MAX = 40;

type LocalPhoto = { uri: string; mimeType: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  hasExpenses: boolean;
  avatarPath: string | null;
  avatarUrl: string | null;
};

export function EditGroupSheet({ visible, onClose, groupId, groupName, hasExpenses, avatarPath, avatarUrl }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState(groupName);
  const [saving, setSaving] = useState(false);
  // Foto só é enviada/removida de verdade no "Salvar alterações" — até lá
  // fica só como preview local, igual ao nome.
  const [localPhoto, setLocalPhoto] = useState<LocalPhoto | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const { updateGroup } = useUpdateGroup();
  const { updateGroupAvatar, removeGroupAvatar } = useUpdateGroupAvatar();

  useEffect(() => {
    if (visible) {
      setName(groupName);
      setLocalPhoto(null);
      setPhotoRemoved(false);
    }
  }, [visible, groupName]);

  const nameTrimmed = name.trim();
  const nameChanged = nameTrimmed !== groupName.trim();
  const nameValid   = nameTrimmed.length >= 2;
  const photoDirty  = localPhoto != null || photoRemoved;
  const canSave     = nameValid && !saving && (nameChanged || photoDirty);
  const previewUrl  = localPhoto ? localPhoto.uri : photoRemoved ? null : avatarUrl;

  async function handlePickPhoto() {
    try {
      const asset = await pickImage(buildPickImageTexts(t, {
        sourceTitle: t('common.groupPhotoTitle'),
        galleryPermissionBody: t('profile.photoPermissionBody'),
      }), { allowsEditing: true, aspect: [1, 1] });
      if (asset) {
        setLocalPhoto({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
        setPhotoRemoved(false);
      }
    } catch (err) {
      Alert.alert(t('common.galleryErrorTitle'), err instanceof Error ? err.message : String(err));
    }
  }

  function handleRemovePhoto() {
    if (localPhoto) {
      setLocalPhoto(null);
    } else if (avatarUrl) {
      setPhotoRemoved(true);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (localPhoto) {
        await updateGroupAvatar(groupId, localPhoto.uri, localPhoto.mimeType, avatarPath);
      } else if (photoRemoved && avatarPath) {
        await removeGroupAvatar(groupId, avatarPath);
      }
      if (nameChanged) {
        await updateGroup(groupId, { name: nameTrimmed });
      }
      onClose();
    } catch {
      Alert.alert(t('editGroup.saveFailedTitle'), t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  }

  const headerEl = (
    <View style={styles.header}>
      <Text style={styles.title}>{t('editGroup.title')}</Text>
      <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
        <X size={22} color={colors.textPrimary} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheetModal visible={visible} onClose={onClose} gap={spacing.lg}>
      {headerEl}
      <View style={styles.photoSection}>
        <View style={previewUrl ? styles.photoRing : undefined}>
          <View style={styles.photoWrap}>
            <TouchableOpacity
              style={[styles.photoCircle, !previewUrl && styles.photoCircleEmpty]}
              onPress={handlePickPhoto}
              activeOpacity={0.8}
              disabled={saving}
            >
              {previewUrl
                ? <Image source={{ uri: previewUrl }} style={styles.photoImage} />
                : (
                  <>
                    <Camera size={24} color={colors.ink} strokeWidth={1.8} />
                    <Text style={styles.photoLabel}>{t('common.addPhoto')}</Text>
                  </>
                )}
            </TouchableOpacity>
            {previewUrl && (
              <TouchableOpacity
                style={styles.photoRemoveBadge}
                onPress={handleRemovePhoto}
                hitSlop={8}
                activeOpacity={0.7}
                disabled={saving}
              >
                <X size={14} color={colors.textPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {previewUrl && (
          <TouchableOpacity style={styles.photoChangeRow} onPress={handlePickPhoto} activeOpacity={0.7}>
            <RotateCw size={14} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.photoActionLabel}>{t('common.changePhoto')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View>
        <Input
          label={t('groupSheet.nameLabel')}
          value={name}
          onChangeText={v => setName(v.slice(0, NAME_MAX))}
          maxLength={NAME_MAX}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          containerStyle={styles.nameInput}
        />
        <Text style={styles.counter}>{name.length}/{NAME_MAX}</Text>
      </View>


      <Button
        label={saving ? t('common.saving') : t('editGroup.submit')}
        onPress={handleSave}
        disabled={!canSave}
        labelStyle={styles.saveBtnLabel}
      />
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

  // ── Foto ──────────────────────────────────────────────────
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
    width: 96,
    height: 96,
  },
  photoCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 4,
  },
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

  // ── Nome ──────────────────────────────────────────────────
  nameInput: {
    borderRadius: radius.full,
  },
  counter: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  saveBtnLabel: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },

  // ── Moeda ─────────────────────────────────────────────────
});
