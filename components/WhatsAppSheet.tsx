import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { Input } from './Input';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useUpdateMyProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { countryFromPhone } from '@/lib/countries';
import {
  WHATSAPP_COUNTRY as COUNTRY,
  examplePhone, formatNationalPhone, fromWhatsappNumber, isValidPhone, toWhatsappNumber,
} from '@/lib/whatsapp';
import { fontFamilies, fontSizes, radius, type ColorPalette } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialWhatsapp: string | null;
};

export function WhatsAppSheet({ visible, onClose, initialWhatsapp }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { t } = useLanguage();
  const { updateMyProfile, loading } = useUpdateMyProfile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [whatsapp, setWhatsapp] = useState('');

  useEffect(() => {
    if (!visible) return;
    // Número salvo de outro país (de quando dava pra escolher o DDI) abre com o
    // campo vazio: remascarar dígitos estrangeiros no formato brasileiro
    // mostraria um número diferente do salvo, e plausível o bastante pra ser
    // salvo por engano.
    const stored = countryFromPhone(initialWhatsapp) === COUNTRY ? initialWhatsapp : null;
    // Formata já na abertura: `fromWhatsappNumber` devolve os dígitos nacionais
    // crus, e a máscara só existe no onChangeText — sem isto o campo abre
    // "11987654321" e só vira "(11) 98765-4321" depois do primeiro toque.
    setWhatsapp(formatNationalPhone(fromWhatsappNumber(stored), COUNTRY));
  }, [visible, initialWhatsapp]);

  const canSave = isValidPhone(whatsapp, COUNTRY) && !loading;

  async function handleSave() {
    if (!userId || !canSave) return;
    const number = toWhatsappNumber(whatsapp, COUNTRY);
    if (!number) return;
    try {
      await updateMyProfile(userId, { whatsapp: number });
      onClose();
    } catch {
      Alert.alert(t('whatsappSheet.saveFailedTitle'), t('common.tryAgain'));
    }
  }

  async function handleRemove() {
    if (!userId || loading) return;
    try {
      await updateMyProfile(userId, { whatsapp: null });
      onClose();
    } catch {
      Alert.alert(t('whatsappSheet.removeFailedTitle'), t('common.tryAgain'));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('profile.whatsapp')}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <Text style={styles.explain}>{t('whatsappSheet.explain')}</Text>

      <Input
        label={t('whatsappSheet.numberLabel')}
        placeholder={examplePhone(COUNTRY)}
        value={whatsapp}
        onChangeText={v => setWhatsapp(formatNationalPhone(v, COUNTRY))}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      <TouchableOpacity
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        onPress={handleSave}
        activeOpacity={0.85}
        disabled={!canSave}
      >
        <Text style={styles.saveBtnLabel}>{loading ? t('common.saving') : t('common.save')}</Text>
      </TouchableOpacity>

      {initialWhatsapp && (
        <TouchableOpacity onPress={handleRemove} activeOpacity={0.7} disabled={loading} style={styles.removeBtn}>
          <Text style={styles.removeLabel}>{t('whatsappSheet.removeNumber')}</Text>
        </TouchableOpacity>
      )}
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
  removeBtn: {
    alignItems: 'center',
  },
  removeLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
