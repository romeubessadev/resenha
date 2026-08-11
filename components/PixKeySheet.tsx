import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, type KeyboardTypeOptions } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { Input } from './Input';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useUpdateMyProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { PIX_KEY_TYPES, formatPixInput, formatPixKey, isValidPixKey, toStoredPixKey, type PixKeyType } from '@/lib/pix';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

// Cada tipo pede o teclado que o resto do app já usa pro MESMO dado: e-mail
// como em entrar/signup/recuperar-senha, telefone como no WhatsAppSheet. O
// `phone-pad` do telefone não é intercambiável com `number-pad` — só ele traz
// os símbolos, e é o que o campo de WhatsApp usa pro mesmo número.
const KEYBOARD_BY_TYPE: Record<PixKeyType, KeyboardTypeOptions> = {
  cpf: 'number-pad',
  email: 'email-address',
  phone: 'phone-pad',
  random: 'default',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  initialKey: string | null;
  initialType: PixKeyType | null;
};

export function PixKeySheet({ visible, onClose, initialKey, initialType }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { t } = useLanguage();
  const { updateMyProfile, loading } = useUpdateMyProfile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [type, setType] = useState<PixKeyType>('cpf');
  const [key, setKey] = useState('');

  useEffect(() => {
    if (!visible) return;
    // Reabre no que está salvo — inclusive o tipo, que é o que decide máscara e
    // validação. Sem chave ainda, cai no CPF, que é o primeiro chip.
    const savedType = initialType ?? 'cpf';
    setType(savedType);
    // Formata já na abertura: a máscara só existe no onChangeText, e sem isto o
    // campo abriria com os dígitos crus do banco (mesmo motivo do WhatsAppSheet).
    setKey(initialKey ? formatPixKey(initialKey, savedType) : '');
  }, [visible, initialKey, initialType]);

  // Trocar de tipo limpa o campo em vez de tentar remascarar: os quatro
  // formatos não se convertem entre si, e um CPF remascarado como telefone
  // viraria um número plausível o bastante pra ser salvo por engano.
  function handlePickType(next: PixKeyType) {
    if (next === type) return;
    setType(next);
    setKey(initialType === next && initialKey ? formatPixKey(initialKey, next) : '');
  }

  const canSave = isValidPixKey(key, type) && !loading;

  async function handleSave() {
    if (!userId || !canSave) return;
    const stored = toStoredPixKey(key, type);
    if (!stored) return;
    try {
      await updateMyProfile(userId, { pix: { key: stored, type } });
      onClose();
    } catch {
      Alert.alert(t('pixSheet.saveFailedTitle'), t('common.tryAgain'));
    }
  }

  async function handleRemove() {
    if (!userId || loading) return;
    try {
      await updateMyProfile(userId, { pix: null });
      onClose();
    } catch {
      Alert.alert(t('pixSheet.removeFailedTitle'), t('common.tryAgain'));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.header}>
        {/* Mesma string da linha do perfil que abre este sheet — é o padrão do
            WhatsAppSheet e do ChangePasswordSheet, e é o que faz o título do
            sheet confirmar em que você tocou em vez de renomear o assunto. */}
        <Text style={styles.title}>{t('profile.pixKey')}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <Text style={styles.explain}>{t('pixSheet.explain')}</Text>

      <View>
        <Text style={styles.fieldLabel}>{t('pixSheet.typeLabel')}</Text>
        <View style={styles.chipsRow}>
          {PIX_KEY_TYPES.map(option => {
            const active = option === type;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => handlePickType(option)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {t(`pixSheet.type.${option}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Input
        label={t('pixSheet.keyLabel')}
        placeholder={t(`pixSheet.placeholder.${type}`)}
        value={key}
        onChangeText={v => setKey(formatPixInput(v, type))}
        keyboardType={KEYBOARD_BY_TYPE[type]}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        onPress={handleSave}
        activeOpacity={0.85}
        disabled={!canSave}
      >
        <Text style={styles.saveBtnLabel}>{loading ? t('common.saving') : t('pixSheet.save')}</Text>
      </TouchableOpacity>

      {initialKey && (
        <TouchableOpacity onPress={handleRemove} activeOpacity={0.7} disabled={loading} style={styles.removeBtn}>
          <Text style={styles.removeLabel}>{t('pixSheet.removeKey')}</Text>
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
  // Mesmas medidas do label do Input, pro bloco de tipo alinhar com o de chave.
  fieldLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  // flexShrink pra "Chave aleatória" caber quebrando em duas linhas em vez de
  // empurrar os outros três pra fora da tela.
  chip: {
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  chipLabelActive: {
    color: colors.ink,
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
