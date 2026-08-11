import { useMemo, useState, ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Eye, EyeOff, Search, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Props = Omit<TextInputProps, 'style'> & {
  variant?: 'text' | 'password' | 'search';
  icon?: ReactNode;
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** Controla a visibilidade da senha de fora — usado quando dois campos de
   *  senha (nova/confirmar) precisam compartilhar um único toggle de olho.
   *  Sem essas props, o campo gerencia sua própria visibilidade sozinho. */
  secureVisible?: boolean;
  onToggleSecureVisible?: () => void;
};

export function Input({
  variant = 'text',
  icon,
  label,
  containerStyle,
  value,
  onChangeText,
  multiline,
  onFocus,
  onBlur,
  secureVisible,
  onToggleSecureVisible,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [hiddenState, setHiddenState] = useState(true);
  const hidden = secureVisible !== undefined ? !secureVisible : hiddenState;
  const toggleHidden = onToggleSecureVisible ?? (() => setHiddenState(v => !v));

  const isPassword = variant === 'password';
  const isSearch   = variant === 'search';

  const field = (
    <View
      style={[
        styles.wrap,
        multiline && styles.wrapMultiline,
        focused && styles.wrapFocused,
        containerStyle,
      ]}
    >
      {isSearch
        ? <Search size={18} color={colors.textSecondary} strokeWidth={1.8} />
        : icon}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={isPassword && hidden}
        multiline={multiline}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        {...rest}
      />
      {isPassword && (
        <TouchableOpacity onPress={toggleHidden} hitSlop={8} activeOpacity={0.7}>
          {hidden
            ? <Eye    size={18} color={colors.textSecondary} strokeWidth={1.5} />
            : <EyeOff size={18} color={colors.textSecondary} strokeWidth={1.5} />}
        </TouchableOpacity>
      )}
      {isSearch && !!value && onChangeText != null && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8} activeOpacity={0.7}>
          <X size={18} color={colors.textSecondary} strokeWidth={1.8} />
        </TouchableOpacity>
      )}
    </View>
  );

  // Sem label, o campo é o próprio filho retornado — precisa ser o único
  // elemento pra containerStyle (ex.: flex:1 numa row) chegar nele direto.
  // Com label, o wrapper extra é necessário pra empilhar label+campo.
  if (!label) return field;

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {field}
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  label: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    height: 52,
    gap: spacing.sm,
  },
  wrapMultiline: {
    height: undefined,
    minHeight: 120,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  wrapFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.primaryDark,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.medium,
    letterSpacing: 0,
    color: colors.textPrimary,
    height: '100%',
  },
  inputMultiline: {
    height: undefined,
    textAlignVertical: 'top',
  },
});
