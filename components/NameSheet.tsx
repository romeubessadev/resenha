import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { Input } from './Input';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useUpdateMyProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, type ColorPalette } from '@/theme';

/** Mesmo teto do campo antigo, que era editado direto no hero. Corta na
 *  digitação em vez de recusar ao salvar: o limite existe pra o nome caber na
 *  lista de participantes e no card da resenha, não pra ser uma regra a decorar. */
const NAME_MAX = 40;

type Props = {
  visible: boolean;
  onClose: () => void;
  initialName: string;
};

export function NameSheet({ visible, onClose, initialName }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { t } = useLanguage();
  const { updateMyProfile, loading } = useUpdateMyProfile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(initialName);
  }, [visible, initialName]);

  const trimmed = name.trim();
  // Nome vazio não salva, e agora o botão DIZ isso em vez de a edição fechar
  // fingindo que salvou — era o que a edição inline fazia.
  const canSave = trimmed.length > 0 && trimmed !== initialName && !loading;

  async function handleSave() {
    if (!userId || !canSave) return;
    try {
      await updateMyProfile(userId, { name: trimmed });
      onClose();
    } catch {
      Alert.alert(t('nameSheet.saveFailedTitle'), t('common.tryAgain'));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('profile.name')}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <Text style={styles.explain}>{t('nameSheet.explain')}</Text>

      <Input
        label={t('nameSheet.nameLabel')}
        placeholder={t('nameSheet.placeholder')}
        value={name}
        onChangeText={v => setName(v.slice(0, NAME_MAX))}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />

      <TouchableOpacity
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        onPress={handleSave}
        activeOpacity={0.85}
        disabled={!canSave}
      >
        <Text style={styles.saveBtnLabel}>{loading ? t('common.saving') : t('common.save')}</Text>
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
  explain: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  saveBtn: {
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
});
