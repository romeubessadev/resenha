import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Paperclip, Undo2 } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { PixCopyBox } from './PixCopyBox';
import { SettlementStatusPill } from './SettlementStatusPill';
import { WhatsAppIcon } from './WhatsAppIcon';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { type PixKeyType } from '@/lib/pix';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Role = 'debtor' | 'creditor' | 'bystander';
type Status = 'pending' | 'marked_paid' | 'confirmed';

type Props = {
  fromId: string;
  fromName: string;
  fromPhotoUrl?: string | null;
  toId: string;
  toName: string;
  toPhotoUrl?: string | null;
  /** Valor já formatado na moeda da resenha. */
  amountLabel: string;
  /** "≈ <valor na moeda do usuário>" — só quando a moeda da resenha difere da do usuário. */
  role: Role;
  status: Status;
  loading?: boolean;
  /** Path do comprovante anexado ao marcar como pago (se anexou). */
  proofPath?: string | null;
  /** Data já formatada, exibida ao lado do selo — usada na lista de acertos
   *  já confirmados, onde "quando" importa tanto quanto "quanto". */
  dateLabel?: string;
  onMarkPaid?: () => void;
  /** Credor confirmando um acerto que o devedor já marcou como pago. */
  onConfirm?: () => void;
  /** Credor registrando que recebeu SEM o devedor ter marcado nada. */
  onRecordReceipt?: () => void;
  onUnmark?: () => void;
  onWhatsapp?: () => void;
  onViewProof?: () => void;
  /** Chave Pix de QUEM RECEBE. Só o devedor a vê, e só com o acerto em aberto. */
  pixKey?: string | null;
  pixKeyType?: PixKeyType | null;
};

export function TransferCard({
  fromId, fromName, fromPhotoUrl, toId, toName, toPhotoUrl, amountLabel, role, status, loading,
  proofPath, dateLabel, onMarkPaid, onConfirm, onRecordReceipt, onUnmark, onWhatsapp, onViewProof,
  pixKey, pixKeyType,
}: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Só pra quem deve, e só enquanto há o que pagar: depois de marcado como pago
  // a chave vira ruído, e pro credor ela é a própria — ele já a vê no perfil.
  const showPix = role === 'debtor' && status === 'pending' && !!pixKey && !!pixKeyType;

  const pillLabel = status === 'confirmed'
    ? t('transfer.confirmed')
    : status === 'marked_paid'
      ? (role === 'creditor' ? t('transfer.markedPaidBy', { name: fromName }) : t('transfer.waitingConfirm', { name: toName }))
      : null;

  const cardStyle = [
    styles.card,
    status === 'marked_paid' && styles.cardMarkedPaid,
    status === 'confirmed' && styles.cardConfirmed,
  ];

  return (
    <View style={cardStyle}>
      <View style={styles.header}>
        <Avatar name={fromName} id={fromId} photoUrl={fromPhotoUrl ?? undefined} size={32} variant="colorful" />
        <View style={styles.headerText}>
          <Text style={styles.headerLine} numberOfLines={1}>
            <Text style={styles.headerBold}>{fromName}</Text>
            <Text style={styles.headerMuted}> {t(status === 'confirmed' ? 'transfer.paidTo' : 'transfer.paysTo')} </Text>
            <Text style={styles.headerBold}>{toName}</Text>
          </Text>
          <Text style={styles.amount}>{amountLabel}</Text>
        </View>
        <Avatar name={toName} id={toId} photoUrl={toPhotoUrl ?? undefined} size={32} variant="colorful" />
      </View>

      {(pillLabel || dateLabel || (proofPath && role !== 'bystander')) && (
        <View style={styles.statusRow}>
          {pillLabel && (
            <SettlementStatusPill status={status === 'confirmed' ? 'confirmed' : 'marked_paid'} label={pillLabel} />
          )}
          {proofPath && role !== 'bystander' && (
            <TouchableOpacity style={styles.proofChip} onPress={onViewProof} activeOpacity={0.7}>
              <Paperclip size={12} color={colors.textPrimary} strokeWidth={2} />
              <Text style={styles.proofChipLabel}>{t('transfer.viewProof')}</Text>
            </TouchableOpacity>
          )}
          {dateLabel && <Text style={styles.dateLabel}>{dateLabel}</Text>}
        </View>
      )}

      {showPix && pixKey && pixKeyType && (
        <PixCopyBox pixKey={pixKey} pixKeyType={pixKeyType} />
      )}

      {role !== 'bystander' && status !== 'confirmed' && (
        <>
          <View style={styles.actionsRow}>
            {/* Diz a AÇÃO, não o canal — o ícone verde ao lado já entrega o
                WhatsApp. Quem tem a receber dá um toque, quem deve avisa. */}
            <TouchableOpacity style={[styles.outlineBtn, styles.whatsappBtn]} onPress={onWhatsapp} activeOpacity={0.7}>
              <WhatsAppIcon size={14} color={colors.whatsapp} />
              <Text style={[styles.outlineBtnLabel, styles.whatsappBtnLabel]} numberOfLines={1}>
                {t(role === 'creditor' ? 'common.nudge' : 'common.notify')}
              </Text>
            </TouchableOpacity>

            {role === 'debtor' && status === 'pending' && (
              <TouchableOpacity style={styles.solidBtn} onPress={onMarkPaid} activeOpacity={0.85} disabled={loading}>
                <Text style={styles.solidBtnLabel}>{loading ? t('transfer.marking') : t('transfer.markAsPaid')}</Text>
              </TouchableOpacity>
            )}

            {role === 'debtor' && status === 'marked_paid' && (
              <TouchableOpacity style={[styles.solidBtn, styles.undoBtn]} onPress={onUnmark} activeOpacity={0.85} disabled={loading}>
                <Undo2 size={14} color={colors.ink} strokeWidth={2} />
                <Text style={styles.solidBtnLabel}>{t('transfer.undoMarkedPaid')}</Text>
              </TouchableOpacity>
            )}

            {/* O credor age nos DOIS estados. Antes, com o acerto pendente,
                ele via um botão morto ("Aguardando pagamento") e dependia de o
                devedor abrir o app — mesmo tendo recebido o Pix e sido avisado
                por fora. A RPC `record_receipt` já resolvia isso, e o
                Acertar em lote já usava; só este card ficou pra trás.
                Registrar recebimento só REDUZ o que devem a quem chama, então
                não há brecha de abuso. */}
            {role === 'creditor' && (
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={status === 'marked_paid' ? onConfirm : onRecordReceipt}
                activeOpacity={0.85}
                disabled={loading}
              >
                <Text style={styles.confirmBtnLabel}>{loading ? t('common.confirming') : t('transfer.confirmReceipt')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  card: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardMarkedPaid: {
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderColor: 'rgba(217,168,0,0.4)',
  },
  cardConfirmed: {
    backgroundColor: 'rgba(0,94,49,0.05)',
    borderColor: 'rgba(0,94,49,0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerLine: {
    fontSize: 13,
  },
  headerBold: {
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  headerMuted: {
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: fontSizes.h1Sm,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  amountSecondary: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  proofChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  proofChipLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  dateLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  outlineBtnLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  whatsappBtn: {
    borderColor: colors.whatsapp,
    backgroundColor: colors.background,
  },
  whatsappBtnLabel: {
    color: colors.whatsapp,
  },
  solidBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  solidBtnLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
  undoBtn: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  confirmBtnLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
});
