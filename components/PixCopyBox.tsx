import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { formatPixKey, pixKeyForCopy, type PixKeyType } from '@/lib/pix';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  /** Chave Pix de QUEM RECEBE, na forma canônica que veio do banco. */
  pixKey: string;
  pixKeyType: PixKeyType;
};

/** Chave Pix de quem vai receber, com botão de copiar — o que se LÊ é a chave
 *  mascarada, o que se COLA é a canônica (ver lib/pix.ts).
 *
 *  Vive fora do TransferCard porque o Acertar em lote monta o próprio card de
 *  pessoa e precisa da mesma caixa: duas cópias do "copiei/copiado" divergiriam
 *  na primeira mexida. Quem chama decide QUANDO mostrar. */
export function PixCopyBox({ pixKey, pixKeyType }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(pixKeyForCopy(pixKey, pixKeyType));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={styles.pixBox}>
      <View style={styles.pixTextCol}>
        <Text style={styles.pixLabel}>
          {copied
            ? t('transfer.pixCopied')
            : t('transfer.payWithPix', { type: t(`pixSheet.type.${pixKeyType}`) })}
        </Text>
        <Text style={styles.pixKey} numberOfLines={1}>{formatPixKey(pixKey, pixKeyType)}</Text>
      </View>
      <TouchableOpacity style={styles.pixCopyBtn} onPress={handleCopy} activeOpacity={0.7} hitSlop={6}>
        {copied
          ? <Check size={16} color={colors.forest} strokeWidth={2.5} />
          : <Copy size={16} color={colors.textPrimary} strokeWidth={2} />}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  // Caixa cinza entre o valor e os botões, como no mockup: o dado que o app
  // guarda pra você aparece separado do que o app faz por você.
  pixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  pixTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pixLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pixKey: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  pixCopyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
});
