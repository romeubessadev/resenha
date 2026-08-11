import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Clock } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  /** 'marked_paid': alguém marcou e falta o outro lado confirmar.
   *  'confirmed': acerto fechado. */
  status: 'marked_paid' | 'confirmed';
  label: string;
};

/** Selo de estado do acerto. Vive fora do TransferCard porque o card do
 *  Acertar em lote mostra o MESMO estado ("Esperando {name} confirmar") e
 *  vinha dizendo isso como texto solto, sem selo e noutra cor. */
export function SettlementStatusPill({ status, label }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const confirmed = status === 'confirmed';

  return (
    <View style={[styles.pill, confirmed ? styles.pillConfirmed : styles.pillMarkedPaid]}>
      {confirmed
        ? <Check size={12} color={colors.white} strokeWidth={3} />
        : <Clock size={12} color={colors.ink} strokeWidth={2.5} />}
      <Text style={[styles.pillLabel, confirmed && styles.pillLabelConfirmed]}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pillMarkedPaid: {
    backgroundColor: colors.primary,
  },
  pillConfirmed: {
    backgroundColor: colors.forest,
  },
  pillLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
  pillLabelConfirmed: {
    color: colors.white,
  },
});
