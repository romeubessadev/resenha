import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { UserMinus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, BackButton, ConfirmSheet, WhatsAppIcon, SaldoSkeleton, Spinner } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useGroup, useRemoveMember } from '@/hooks/useGroup';
import { useGroupBalances } from '@/hooks/useGroupBalances';
import { useRecordReceipt } from '@/hooks/useSettlements';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/currencies';
import { fontWeights, fontSizes, spacing, radius, type ColorPalette } from '@/theme';

export default function SaldoDetailScreen() {
  const insets = useSafeAreaInsets();
  const { groupId, memberId } = useLocalSearchParams<{
    groupId: string;
    memberId: string;
  }>();
  const { session } = useAuth();
  const myUserId = session?.user.id;
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: group, loading: groupLoading, error: groupError, refetch: refetchGroup } = useGroup(groupId);
  const { balances, transfers, loading: balancesLoading } = useGroupBalances(groupId);
  const { recordReceipt, loading: recording } = useRecordReceipt();
  const { removeMember, loading: removing } = useRemoveMember();

  const [receiveTarget, setReceiveTarget] = useState<{ fromId: string; fromName: string; amount: number } | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  const loading = groupLoading || balancesLoading;
  const member  = group?.members.find(m => m.id === memberId);

  if (loading) {
    return <SaldoSkeleton />;
  }

  if (groupError || !group || !member) {
    return (
      <View style={[styles.container, styles.centerFill, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{t('saldoDetail.loadErrorTitle')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetchGroup()} activeOpacity={0.7}>
          <Text style={styles.retryBtnLabel}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isMe    = member.isMe;
  const balance = balances[memberId ?? ''] ?? 0;

  // Pessoas que devem a este membro
  const toReceive = transfers
    .filter(t => t.toUserId === memberId)
    .map(t => ({ other: group.members.find(m => m.id === t.fromUserId), amount: t.amount }))
    .filter((r): r is { other: NonNullable<typeof r.other>; amount: number } => r.other != null);

  // Pessoas a quem este membro deve
  const toPay = transfers
    .filter(t => t.fromUserId === memberId)
    .map(t => ({ other: group.members.find(m => m.id === t.toUserId), amount: t.amount }))
    .filter((r): r is { other: NonNullable<typeof r.other>; amount: number } => r.other != null);

  const hasRelated = toReceive.length > 0 || toPay.length > 0;

  // Hero
  const displayName  = isMe ? t('saldoDetail.meSuffix', { name: member.name }) : member.name;
  const balanceLabel = t('saldoDetail.balanceLabel');
  const balanceText  = formatMoney(Math.abs(balance));
  const balanceColor = balance > 0 ? colors.success : balance < 0 ? colors.danger : colors.textSecondary;

  function listNames(people: { other: { name: string; isMe: boolean } }[]): string {
    const label = (p: { other: { name: string; isMe: boolean } }) =>
      p.other.isMe ? t('common.you') : p.other.name.split(' ')[0];
    if (people.length === 1) return label(people[0]);
    if (people.length === 2) return t('saldoDetail.twoNames', { a: label(people[0]), b: label(people[1]) });
    return t('saldoDetail.moreNames', { a: label(people[0]), b: label(people[1]) });
  }

  const firstName = member.name.split(' ')[0];

  let subtitle: string;
  if (isMe) {
    if (toReceive.length > 0 && toPay.length > 0) {
      subtitle = t('saldoDetail.meBothLabel');
    } else if (toReceive.length > 0) {
      subtitle = t('saldoDetail.meReceiveLabel', { names: listNames(toReceive) });
    } else if (toPay.length > 0) {
      subtitle = t('saldoDetail.meOweLabel', { names: listNames(toPay) });
    } else {
      subtitle = t('saldoDetail.noneLabel');
    }
  } else {
    if (toReceive.length > 0 && toPay.length > 0) {
      subtitle = t('saldoDetail.otherBothLabel', { name: firstName });
    } else if (toReceive.length > 0) {
      subtitle = t('saldoDetail.otherReceiveLabel', { name: firstName, names: listNames(toReceive) });
    } else if (toPay.length > 0) {
      subtitle = t('saldoDetail.otherOweLabel', { name: firstName, names: listNames(toPay) });
    } else {
      subtitle = t('saldoDetail.noneLabel');
    }
  }

  async function handleCobrar(otherName: string, amount: number, whatsapp?: string | null) {
    const first = otherName.split(' ')[0];
    const msg   = t('saldoDetail.chargeMessage', { name: first, amount: formatMoney(Math.abs(amount)) });
    const phone = whatsapp ? `phone=${whatsapp}&` : '';
    try { await Linking.openURL(`whatsapp://send?${phone}text=${encodeURIComponent(msg)}`); } catch {}
  }

  async function handlePagar(otherName: string, amount: number, whatsapp?: string | null) {
    const first = otherName.split(' ')[0];
    const msg   = t('saldoDetail.payMessage', { name: first, amount: formatMoney(Math.abs(amount)) });
    const phone = whatsapp ? `phone=${whatsapp}&` : '';
    try { await Linking.openURL(`whatsapp://send?${phone}text=${encodeURIComponent(msg)}`); } catch {}
  }

  // Guarda quem pagou e quanto: a confirmação é um sheet, então os dados
  // precisam sobreviver ao toque que abre.
  function handleRecebi(fromId: string, fromName: string, amount: number) {
    if (!myUserId || !group) return;
    setReceiveTarget({ fromId, fromName, amount });
  }

  async function handleConfirmRecebi() {
    if (!receiveTarget || !myUserId || !group) return;
    const { fromId, amount } = receiveTarget;
    try {
      // Pela RPC, e não com um insert direto em `payments`: o histórico e o
      // push de confirmação penduram no UPDATE de settlements, então só quem
      // passa por ela aparece pro devedor. Quem recebe é
      // sempre o `auth.uid()`, por isso não vai `myUserId` aqui.
      await recordReceipt(group.id, fromId, amount);
      setReceiveTarget(null);
    } catch {
      setReceiveTarget(null);
      Alert.alert(t('saldoDetail.recordFailedTitle'), t('common.tryAgain'));
    }
  }

  async function handleConfirmRemove() {
    if (!group || !member) return;
    try {
      await removeMember(group.id, member.id);
      setRemoveConfirmOpen(false);
      router.back();
    } catch {
      setRemoveConfirmOpen(false);
      Alert.alert(t('saldoDetail.removeFailedTitle'), t('common.tryAgain'));
    }
  }

  return (
    <View style={styles.container}>

      {/* Botão voltar flutuante */}
      <BackButton style={[styles.backBtn, { top: insets.top + spacing.sm, marginBottom: 0 }]} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg }]}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Avatar name={member.name} id={member.id} size={80} variant="colorful" />
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroLabel}>{balanceLabel}</Text>
          <Text style={[styles.heroBalance, { color: balanceColor }]}>{balanceText}</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        </View>

        {/* Pessoas relacionadas */}
        {hasRelated && (
          <>
            <Text style={styles.sectionHeader}>{t('saldoDetail.relatedPeopleHeader')}</Text>

            {/* Quem deve a este membro */}
            {toReceive.map((rel, idx) => (
              <View key={`r-${idx}`} style={styles.personCard}>
                <View style={styles.personRow}>
                  <Avatar name={rel.other.name} id={rel.other.id} size={44} variant="colorful" />
                  <View style={styles.personInfo}>
                    <Text style={styles.personName} numberOfLines={1}>{rel.other.name}</Text>
                    <Text style={styles.personRelation}>
                      {isMe ? t('saldoDetail.owesYou') : t('saldoDetail.owesOther', { name: member.name })}
                    </Text>
                  </View>
                  <Text style={styles.personAmount}>
                    {formatMoney(Math.abs(rel.amount))}
                  </Text>
                </View>

                {isMe && (
                  <>
                    <View style={styles.cardDivider} />
                    <TouchableOpacity
                      style={styles.btnPrimary}
                      onPress={() => handleCobrar(rel.other.name, rel.amount, rel.other.whatsapp)}
                      activeOpacity={0.8}
                    >
                      <WhatsAppIcon color={colors.ink} />
                      <Text style={styles.btnPrimaryLabel}>{t('common.nudge')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnOutlined}
                      onPress={() => handleRecebi(rel.other.id, rel.other.name, rel.amount)}
                      activeOpacity={0.8}
                      disabled={recording}
                    >
                      <Text style={styles.btnOutlinedLabel}>
                        {recording ? t('saldoDetail.marking') : t('saldoDetail.markReceived')}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))}

            {/* Quem este membro deve */}
            {toPay.map((rel, idx) => (
              <View key={`p-${idx}`} style={styles.personCard}>
                <View style={styles.personRow}>
                  <Avatar name={rel.other.name} id={rel.other.id} size={44} variant="colorful" />
                  <View style={styles.personInfo}>
                    <Text style={styles.personName} numberOfLines={1}>{rel.other.name}</Text>
                    <Text style={styles.personRelation}>
                      {isMe ? t('saldoDetail.meOwesTo', { name: rel.other.name }) : t('saldoDetail.otherOwesTo', { payer: member.name, payee: rel.other.name })}
                    </Text>
                  </View>
                  <Text style={styles.personAmount}>
                    {formatMoney(Math.abs(rel.amount))}
                  </Text>
                </View>

                {isMe && (
                  <>
                    <View style={styles.cardDivider} />
                    <TouchableOpacity
                      style={styles.btnPrimary}
                      onPress={() => handlePagar(rel.other.name, rel.amount, rel.other.whatsapp)}
                      activeOpacity={0.8}
                    >
                      <WhatsAppIcon color={colors.ink} />
                      <Text style={styles.btnPrimaryLabel}>{t('common.notify')}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))}
          </>
        )}

        {/* Remover participante */}
        {!isMe && (
          <TouchableOpacity style={styles.removeRow} onPress={() => setRemoveConfirmOpen(true)} activeOpacity={0.7} disabled={removing}>
            {removing
              ? <Spinner size={20} color={colors.danger} />
              : <UserMinus size={20} color={colors.danger} strokeWidth={2} />}
            <Text style={styles.removeRowLabel}>{removing ? t('saldoDetail.removing') : t('saldoDetail.removeFromGroup')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={!!receiveTarget}
        onClose={() => { if (!recording) setReceiveTarget(null); }}
        title={t('saldoDetail.confirmReceiveTitle')}
        description={receiveTarget
          ? t('saldoDetail.confirmReceiveBody', {
            amount: formatMoney(Math.abs(receiveTarget.amount)),
            name: receiveTarget.fromName.split(' ')[0],
          })
          : ''}
        confirmLabel={t('common.confirm')}
        confirmLoadingLabel={t('common.confirming')}
        onConfirm={handleConfirmRecebi}
        loading={recording}
      />

      <ConfirmSheet
        visible={removeConfirmOpen}
        onClose={() => { if (!removing) setRemoveConfirmOpen(false); }}
        title={t('saldoDetail.removeConfirmTitle')}
        description={t('saldoDetail.removeConfirmBody', { name: firstName })}
        confirmLabel={t('saldoDetail.removeAction')}
        confirmLoadingLabel={t('saldoDetail.removing')}
        onConfirm={handleConfirmRemove}
        variant="danger"
        loading={removing}
      />
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerFill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryBtnLabel: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },

  // ── Back button ──────────────────────────────────────────────────────────────
  backBtn: {
    position: 'absolute',
    left: spacing.pagePadding,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Content ──────────────────────────────────────────────────────────────────
  content: {},

  // ── Hero ─────────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  heroName: {
    marginTop: spacing.sm,
    fontSize: fontSizes.h1,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  heroLabel: {
    marginTop: spacing.sm,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  heroBalance: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ── Section ──────────────────────────────────────────────────────────────────
  sectionHeader: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
  },

  // ── Person card ──────────────────────────────────────────────────────────────
  personCard: {
    marginHorizontal: spacing.pagePadding,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  personInfo: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  personRelation: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
  },
  personAmount: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },

  // ── Buttons ──────────────────────────────────────────────────────────────────
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    marginTop: spacing.sm,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  btnPrimaryLabel: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: colors.ink,
  },
  btnOutlined: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  btnOutlinedLabel: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },

  // ── Remover participante ─────────────────────────────────────────────────────
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.pagePadding,
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeRowLabel: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: colors.danger,
  },
});
