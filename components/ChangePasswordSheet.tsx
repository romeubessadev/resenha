import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Check, Lock, X } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { Input } from './Input';
import { PasswordRules, checkPasswordRules } from './PasswordRules';
import { useChangePassword, WrongPasswordError } from '@/hooks/useChangePassword';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ChangePasswordSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { changePassword, loading } = useChangePassword();

  const [formKey, setFormKey] = useState(0);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);

  // Reseta os campos a cada abertura — o sheet nunca desmonta, só o BottomSheetModal
  // interno esconde/mostra. `formKey` força o remount dos inputs pra resetar estado
  // interno (ex: visibilidade da senha).
  useEffect(() => {
    if (visible) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setShowNew(false);
      setWrongPassword(false);
      setFormKey(k => k + 1);
    }
  }, [visible]);

  const rulesValid = checkPasswordRules(next).valid;
  const showMatch = confirm.length > 0;
  const matches = confirm === next;
  const sameAsCurrent = next.length > 0 && next === current;
  const canSubmit = current.length > 0 && rulesValid && showMatch && matches && !sameAsCurrent && !loading;

  async function handleSave() {
    if (!canSubmit) return;
    setWrongPassword(false);
    try {
      await changePassword(current, next);
      onClose();
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        setWrongPassword(true);
      } else {
        Alert.alert(t('changePassword.failedTitle'), t('common.tryAgain'));
      }
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('profile.changePassword')}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>{t('changePassword.subtitle')}</Text>

      <View key={formKey} style={styles.fields}>
        <View>
          <Input
            variant="password"
            label={t('changePassword.currentLabel')}
            placeholder="••••••••"
            icon={<Lock size={16} color={colors.textSecondary} strokeWidth={2} />}
            value={current}
            onChangeText={setCurrent}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
          />
          {wrongPassword && <Text style={styles.errorText}>{t('changePassword.currentWrong')}</Text>}
        </View>

        <View>
          <Input
            variant="password"
            label={t('changePassword.newLabel')}
            placeholder="••••••••"
            icon={<Lock size={16} color={colors.textSecondary} strokeWidth={2} />}
            value={next}
            onChangeText={setNext}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            secureVisible={showNew}
            onToggleSecureVisible={() => setShowNew(v => !v)}
          />
          <PasswordRules password={next} />
          {sameAsCurrent && <Text style={styles.errorText}>{t('changePassword.sameAsCurrent')}</Text>}
        </View>

        <View>
          <Input
            variant="password"
            label={t('changePassword.confirmLabel')}
            placeholder="••••••••"
            icon={<Lock size={16} color={colors.textSecondary} strokeWidth={2} />}
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            secureVisible={showNew}
            onToggleSecureVisible={() => setShowNew(v => !v)}
          />
          {showMatch && (
            <View style={styles.matchRow}>
              <View style={[styles.matchDot, matches ? styles.matchDotValid : styles.matchDotInvalid]}>
                {matches
                  ? <Check size={10} color={colors.white} strokeWidth={3} />
                  : <X size={10} color={colors.white} strokeWidth={3} />}
              </View>
              <Text style={[styles.matchLabel, matches ? styles.matchLabelValid : styles.matchLabelInvalid]}>
                {matches ? t('changePassword.matches') : t('changePassword.noMatch')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Sem "Cancelar": o X do cabeçalho já fecha, e é assim que os outros
          sheets de formulário do app se comportam (WhatsApp, Criar rolê,
          Editar rolê). */}
      <TouchableOpacity
        style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
        onPress={handleSave}
        activeOpacity={0.85}
        disabled={!canSubmit}
      >
        <Text style={styles.saveLabel}>{loading ? t('common.saving') : t('common.save')}</Text>
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
  subtitle: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  fields: {
    gap: spacing.md,
  },

  errorText: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.danger,
    marginTop: spacing.xs,
  },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  matchDot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchDotValid: {
    backgroundColor: colors.textPrimary,
  },
  matchDotInvalid: {
    backgroundColor: colors.danger,
  },
  matchLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
  },
  matchLabelValid: {
    color: colors.textPrimary,
  },
  matchLabelInvalid: {
    color: colors.danger,
  },

  // 52 em largura cheia, mesma medida da ação dos outros sheets do app.
  saveBtn: {
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveLabel: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
});
