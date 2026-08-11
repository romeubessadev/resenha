import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Linking, useWindowDimensions } from 'react-native';
// ScrollView do gesture-handler, não do react-native: este sheet vive dentro de
// um <Modal> que tem seu próprio GestureHandlerRootView (ver BottomSheetModal),
// e ali o gesture-handler intercepta o toque no nativo enquanto o ScrollView do
// RN espera pelo sistema de responder do JS. Os dois disputam, e o sintoma é o
// primeiro arrasto não fazer nada e só o segundo rolar. Este nasce dentro do
// mesmo sistema de gestos que está interceptando.
import { ScrollView } from 'react-native-gesture-handler';
import { X, CheckCircle2, ArrowLeftRight, Info } from 'lucide-react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BottomSheetModal } from './BottomSheetModal';
import { TransferCard } from './TransferCard';
import { ConfirmPaidSheet } from './ConfirmPaidSheet';
import { ConfirmSheet } from './ConfirmSheet';
import { useGroup } from '@/hooks/useGroup';
import { useExpenses } from '@/hooks/useExpenses';
import { useSettlements, useMarkAsPaid, useConfirmReceived, useRecordReceipt, useUnmarkAsPaid, type SettlementTransfer } from '@/hooks/useSettlements';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { uploadSettlementProof } from '@/lib/settlementProof';
import { formatMoney } from '@/lib/currencies';
import { pixKeyForCopy } from '@/lib/pix';
import { supabase } from '@/lib/supabase';
import { fontFamilies, fontSizes, radius, shadows, spacing, type ColorPalette } from '@/theme';

type Tab = 'pendentes' | 'anteriores';

type Props = {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  /** Veio de um deep-link (ex.: Carteira) — rola a lista até o card desse par. */
  focusUserId?: string;
};

export function SettleUpSheet({ visible, onClose, groupId, focusUserId }: Props) {
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // O sheet acompanha o tamanho do conteúdo (poucos acertos, sheet pequeno) e
  // a lista rola dentro desse teto quando passa dele — em vez de o painel
  // inteiro esticar até a tela toda.
  const { height: windowHeight } = useWindowDimensions();
  const listCap = windowHeight * 0.5;
  const scrollRef = useRef<ScrollView>(null);
  const cardYRef = useRef<Record<string, number>>({});

  const { data: group } = useGroup(groupId);
  const { data: lancamentos } = useExpenses(groupId);
  const { transfers, settled } = useSettlements(groupId);
  // Saldo pendente sem nenhuma despesa por trás — normalmente sinal de que a
  // despesa que gerou essa cobrança foi apagada depois de já ter sido paga.
  // Só avisa, não mexe em nada (ver conversa sobre o caso do romeubessa10).
  const hasNoExpenses = lancamentos.filter(l => l.type === 'expense').length === 0;
  const { markAsPaid } = useMarkAsPaid();
  const { confirmReceived } = useConfirmReceived();
  const { unmarkAsPaid } = useUnmarkAsPaid();
  const { recordReceipt, loading: recordingReceipt } = useRecordReceipt();

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirmingTransfer, setConfirmingTransfer] = useState<SettlementTransfer | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<SettlementTransfer | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pendentes');

  const members = group?.members ?? [];
  const memberById = new Map(members.map(m => [m.id, m]));

  // Acerto confirmado sai da lista (o saldo daquele par zerou), então o que dá
  // pra medir aqui é quanto do que está em aberto já saiu do lugar.
  const total = transfers.length;
  const done = transfers.filter(t => t.status === 'marked_paid').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const settledCards = settled.flatMap(s => {
    const fromMember = memberById.get(s.fromUserId);
    const toMember = memberById.get(s.toUserId);
    // Quem saiu da resenha não está mais em group.members e ficaria sem nome —
    // mesmo comportamento da lista de pendentes.
    if (!fromMember || !toMember) return [];
    return [{ settlement: s, fromMember, toMember }];
  });

  // O total soma TODOS os acertos da resenha, inclusive os entre outras duas
  // pessoas — é o número que explica a lista que está logo abaixo. O recorte
  // pessoal vem separado em recebido/pago: somar os dois num "seu total" só
  // misturaria dinheiro que entrou com dinheiro que saiu. O que sobra (acertos
  // de terceiros) fica implícito na diferença, de propósito — é um dado que
  // ninguém age em cima e que já está visível card a card.
  const settledTotal = settledCards.reduce((sum, c) => sum + c.settlement.amount, 0);
  const settledTotalLabel = formatMoney(settledTotal);
  const myReceived = settledCards.filter(c => c.toMember.isMe).reduce((sum, c) => sum + c.settlement.amount, 0);
  const myPaid = settledCards.filter(c => c.fromMember.isMe).reduce((sum, c) => sum + c.settlement.amount, 0);
  const yourShareLabel = myReceived > 0 && myPaid > 0
    ? t('settle.yourShareBoth', { received: formatMoney(myReceived), paid: formatMoney(myPaid) })
    : myReceived > 0
      ? t('settle.yourShareReceived', { amount: formatMoney(myReceived) })
      : myPaid > 0
        ? t('settle.yourSharePaid', { amount: formatMoney(myPaid) })
        : null;

  useEffect(() => {
    if (!visible) {
      setConfirmingTransfer(null);
      setViewingProofUrl(null);
      setTab('pendentes');
    }
  }, [visible]);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(total > 0 ? done / total : 0, { duration: 250, easing: Easing.out(Easing.ease) });
  }, [done, total, progress]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  useEffect(() => {
    if (!visible || !focusUserId) return;
    const match = transfers.find(t => t.fromUserId === focusUserId || t.toUserId === focusUserId);
    if (!match) return;
    const key = `${match.fromUserId}-${match.toUserId}`;
    const timer = setTimeout(() => {
      const y = cardYRef.current[key];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.sm), animated: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [visible, focusUserId, transfers]);

  async function handleConfirmMarkPaid(proofUri: string | null, mimeType: string | null) {
    if (!confirmingTransfer) return;
    const tx = confirmingTransfer;
    setConfirmSaving(true);
    try {
      let proofPath: string | undefined;
      if (proofUri) {
        proofPath = await uploadSettlementProof(groupId, tx.fromUserId, tx.toUserId, proofUri, mimeType ?? 'image/jpeg');
      }
      await markAsPaid(groupId, tx.fromUserId, tx.toUserId, tx.amount, proofPath);
      setConfirmingTransfer(null);
    } catch {
      Alert.alert(t('settle.confirmFailedTitle'), t('settle.proofUploadFailedBody'));
    } finally {
      setConfirmSaving(false);
    }
  }

  async function handleViewProof(path: string) {
    const { data } = await supabase.storage.from('settlement-proofs').createSignedUrl(path, 300);
    if (data?.signedUrl) setViewingProofUrl(data.signedUrl);
  }

  // Credor registrando o recebimento sem o devedor ter marcado nada. A RPC
  // cria a linha e confirma de uma vez — o mesmo caminho que o Acertar
  // em lote já usava. Confirma antes porque mexe no saldo dos dois lados.
  async function handleRecordReceipt() {
    if (!receiptTarget) return;
    const tx = receiptTarget;
    try {
      await recordReceipt(groupId, tx.fromUserId, tx.amount);
      setReceiptTarget(null);
    } catch {
      setReceiptTarget(null);
      Alert.alert(t('settle.confirmFailedInline'));
    }
  }

  async function handleConfirm(tx: SettlementTransfer) {
    if (!tx.settlementId) return;
    const key = `${tx.fromUserId}-${tx.toUserId}`;
    setPendingKey(key);
    try {
      await confirmReceived(tx.settlementId, groupId, tx.fromUserId, tx.toUserId, tx.amount);
    } catch {
      Alert.alert(t('settle.confirmFailedInline'));
    } finally {
      setPendingKey(null);
    }
  }

  async function handleUnmark(tx: SettlementTransfer) {
    if (!tx.settlementId) return;
    const key = `${tx.fromUserId}-${tx.toUserId}`;
    setPendingKey(key);
    try {
      await unmarkAsPaid(tx.settlementId, groupId, tx.proofPath);
    } catch {
      Alert.alert(t('settle.undoFailedInline'));
    } finally {
      setPendingKey(null);
    }
  }

  async function openWhatsapp(message: string, phone?: string | null) {
    const encoded = encodeURIComponent(message);
    const phoneParam = phone ? `phone=${phone}&` : '';
    try {
      await Linking.openURL(`whatsapp://send?${phoneParam}text=${encoded}`);
    } catch {
      try {
        await Linking.openURL(`https://wa.me/${phone ?? ''}?text=${encoded}`);
      } catch {
        Alert.alert(t('common.whatsappOpenFailed'));
      }
    }
  }

  function handleWhatsapp(tx: SettlementTransfer, role: 'debtor' | 'creditor') {
    const fromMember = memberById.get(tx.fromUserId);
    const toMember = memberById.get(tx.toUserId);
    const fromName = fromMember?.name ?? '';
    const toName = toMember?.name ?? '';
    const amount = formatMoney(tx.amount);
    const groupName = group?.name ?? 'resenha';

    if (role === 'debtor') {
      const toFirstName = toName.split(' ')[0];
      if (tx.status === 'marked_paid') {
        openWhatsapp(t('settle.msgDebtorMarkedPaid', { name: toFirstName, amount }), toMember?.whatsapp);
        return;
      }
      openWhatsapp(t('settle.msgDebtorPending', { name: toFirstName, amount, group: groupName }), toMember?.whatsapp);
    } else {
      const fromFirstName = fromName.split(' ')[0];
      if (tx.status === 'marked_paid') {
        openWhatsapp(t('settle.msgCreditorMarkedPaid', { name: fromFirstName, amount }), fromMember?.whatsapp);
        return;
      }
      // A chave vai só na COBRANÇA, e só a de quem cobra: a mensagem termina
      // prometendo "vou te passar como você pode acertar" — sem a chave, a
      // promessa vira mais uma ida e volta. No caminho do devedor ela não entra
      // (mandar pro credor a chave dele mesmo não serve pra nada), nem quando o
      // pagamento já foi marcado.
      const myPix = toMember?.pixKey && toMember.pixKeyType
        ? t('settle.msgPixSuffix', {
          type: t(`pixSheet.type.${toMember.pixKeyType}`),
          key: pixKeyForCopy(toMember.pixKey, toMember.pixKeyType),
        })
        : '';
      openWhatsapp(
        t('settle.msgCreditorPending', { name: fromFirstName, amount, group: groupName }) + myPix,
        fromMember?.whatsapp,
      );
    }
  }

  const title = confirmingTransfer
    ? t('settle.confirmTitle')
    : viewingProofUrl
      ? t('settle.proofTitle')
      : t('settle.title');

  function handleHeaderClose() {
    if (confirmingTransfer) { setConfirmingTransfer(null); return; }
    if (viewingProofUrl) { setViewingProofUrl(null); return; }
    onClose();
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={handleHeaderClose} hitSlop={8} activeOpacity={0.7}>
            <X size={22} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {confirmingTransfer ? (
          <ConfirmPaidSheet
            toName={memberById.get(confirmingTransfer.toUserId)?.isMe ? t('common.you') : memberById.get(confirmingTransfer.toUserId)?.name ?? ''}
            amount={confirmingTransfer.amount}
            onConfirm={handleConfirmMarkPaid}
            loading={confirmSaving}
          />
        ) : viewingProofUrl ? (
          <Image source={{ uri: viewingProofUrl }} style={styles.proofPreviewImg} resizeMode="contain" />
        ) : (
          <>
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[styles.tab, tab === 'pendentes' && styles.tabActive]}
                onPress={() => setTab('pendentes')}
                activeOpacity={0.7}
              >
                <ArrowLeftRight size={14} color={tab === 'pendentes' ? colors.textPrimary : colors.textSecondary} strokeWidth={2.2} />
                <Text style={[styles.tabLabel, tab === 'pendentes' && styles.tabLabelActivePendentes]}>
                  {t('settle.pendingTab', { n: transfers.length })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'anteriores' && styles.tabActive]}
                onPress={() => setTab('anteriores')}
                activeOpacity={0.7}
              >
                <CheckCircle2 size={14} color={tab === 'anteriores' ? colors.forest : colors.textSecondary} strokeWidth={2.2} />
                <Text style={[styles.tabLabel, tab === 'anteriores' && styles.tabLabelActiveAnteriores]}>
                  {t('settle.settledTab', { n: settledCards.length })}
                </Text>
              </TouchableOpacity>
            </View>

            {tab === 'pendentes' ? (
              <>
                {total > 0 && (
                  <View style={styles.progressBlock}>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>{t('settle.progress', { done, total })}</Text>
                      <Text style={styles.progressPct}>{pct}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <Animated.View style={[styles.progressFill, progressStyle]} />
                    </View>
                  </View>
                )}

                {total > 0 && hasNoExpenses && (
                  <View style={styles.noExpensesNotice}>
                    <Info size={16} color={colors.primaryDark} strokeWidth={2} />
                    <Text style={styles.noExpensesNoticeText}>{t('settle.noExpensesNotice')}</Text>
                  </View>
                )}

                <ScrollView
                  ref={scrollRef}
                  style={{ maxHeight: listCap }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.list}
                >
                  {total === 0 && hasNoExpenses ? (
                    /* Nada a acertar porque nunca se gastou nada. Comemorar
                       'tá tudo quitado' aqui soa errado: não houve dívida pra
                       quitar. Mesmo tom neutro do vazio da aba ao lado. */
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyHint}>{t('settle.nothingToSettleYet')}</Text>
                    </View>
                  ) : total === 0 ? (
                    <View style={styles.emptyState}>
                      <CheckCircle2 size={40} color={colors.forest} strokeWidth={1.8} />
                      <Text style={styles.emptyTitle}>{t('settle.allSettled')}</Text>
                    </View>
                  ) : (
                    transfers.map(tx => {
                      const fromMember = memberById.get(tx.fromUserId);
                      const toMember = memberById.get(tx.toUserId);
                      if (!fromMember || !toMember) return null;

                      const role = fromMember.isMe ? 'debtor' : toMember.isMe ? 'creditor' : 'bystander';
                      const key = `${tx.fromUserId}-${tx.toUserId}`;
                      const amountLabel = formatMoney(tx.amount);

                      return (
                        <View key={key} onLayout={e => { cardYRef.current[key] = e.nativeEvent.layout.y; }}>
                          <TransferCard
                            fromId={fromMember.id}
                            fromName={fromMember.isMe ? t('profile.you') : fromMember.name}
                            fromPhotoUrl={fromMember.photoUrl}
                            toId={toMember.id}
                            toName={toMember.isMe ? t('common.you') : toMember.name}
                            toPhotoUrl={toMember.photoUrl}
                            amountLabel={amountLabel}
                            role={role}
                            status={tx.status}
                            loading={pendingKey === key}
                            proofPath={tx.proofPath}
                            onMarkPaid={() => setConfirmingTransfer(tx)}
                            onConfirm={() => handleConfirm(tx)}
                            onRecordReceipt={() => setReceiptTarget(tx)}
                            onUnmark={() => handleUnmark(tx)}
                            onWhatsapp={() => handleWhatsapp(tx, role === 'creditor' ? 'creditor' : 'debtor')}
                            onViewProof={() => tx.proofPath && handleViewProof(tx.proofPath)}
                            pixKey={toMember.pixKey}
                            pixKeyType={toMember.pixKeyType}
                          />
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                {total > 0 && (
                  <Text style={styles.footerLink}>
                    {t('settle.footerHint')}
                  </Text>
                )}
              </>
            ) : (
              <>
                {settledCards.length > 0 && (
                  <View style={styles.settledTotals}>
                    <View style={styles.totalsRow}>
                      <Text style={styles.totalsLabel}>{t('settle.settledTotalLabel')}</Text>
                      <View style={styles.totalsValueBox}>
                        <Text style={styles.totalsValue}>{settledTotalLabel}</Text>
                      </View>
                    </View>
                    {yourShareLabel && <Text style={styles.yourShare}>{yourShareLabel}</Text>}
                  </View>
                )}

                <ScrollView
                  style={{ maxHeight: listCap }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.list}
                >
                  {settledCards.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyHint}>{t('settle.noSettledYet')}</Text>
                    </View>
                  ) : (
                    settledCards.map(({ settlement, fromMember, toMember }) => {
                      const role = fromMember.isMe ? 'debtor' : toMember.isMe ? 'creditor' : 'bystander';
                      const amountLabel = formatMoney(settlement.amount);

                      return (
                        <TransferCard
                          key={settlement.id}
                          fromId={fromMember.id}
                          fromName={fromMember.isMe ? t('profile.you') : fromMember.name}
                          fromPhotoUrl={fromMember.photoUrl}
                          toId={toMember.id}
                          toName={toMember.isMe ? t('common.you') : toMember.name}
                          toPhotoUrl={toMember.photoUrl}
                          amountLabel={amountLabel}
                          role={role}
                          status="confirmed"
                          proofPath={settlement.proofPath}
                          dateLabel={settlement.confirmedAt
                            ? new Date(settlement.confirmedAt).toLocaleDateString(language, { day: '2-digit', month: 'short' })
                            : undefined}
                          onViewProof={() => settlement.proofPath && handleViewProof(settlement.proofPath)}
                        />
                      );
                    })
                  )}
                </ScrollView>
              </>
            )}
          </>
        )}
      </View>

      {/* `nested`: este sheet já é um Modal nativo, e abrir outro por cima
          trava a apresentação. */}
      <ConfirmSheet
        nested
        visible={!!receiptTarget}
        onClose={() => { if (!recordingReceipt) setReceiptTarget(null); }}
        title={t('settle.recordReceiptTitle')}
        description={receiptTarget
          ? t('settle.recordReceiptBody', {
            name: memberById.get(receiptTarget.fromUserId)?.name.split(' ')[0] ?? '',
            amount: formatMoney(receiptTarget.amount),
          })
          : ''}
        confirmLabel={t('transfer.confirmReceipt')}
        confirmLoadingLabel={t('common.confirming')}
        onConfirm={handleRecordReceipt}
        loading={recordingReceipt}
      />
    </BottomSheetModal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  // O espaçamento entre os blocos vinha da prop `gap` do BottomSheetModal —
  // com o corpo agrupado numa caixa só, o painel passou a ter um filho único
  // e o gap mora aqui.
  body: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Mesmo segmented control do BatchSettleSheet ("Receber | Pagar").
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  tabActive: {
    backgroundColor: colors.background,
    ...shadows.card,
  },
  tabLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  // Neutra, e não na cor da marca: na paleta do app o amarelo do primary é
  // quase o mesmo do warning, então acento vira "atenção" aos olhos. E 'a
  // acertar' não é estado de alerta, é o estado normal de uma resenha em
  // andamento. Com só o verde colorido, ele volta a significar algo — a
  // seleção da aba já é dita pelo fundo e pelo semibold.
  tabLabelActivePendentes: {
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  tabLabelActiveAnteriores: {
    fontFamily: fontFamilies.semibold,
    color: colors.forest,
  },
  // Resumo da aba de acertados — mesma linha de totais do BatchSettleSheet.
  settledTotals: {
    gap: 2,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalsLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  totalsValueBox: {
    alignItems: 'flex-end',
  },
  totalsValue: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  totalsValueSecondary: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  yourShare: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  title: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  progressBlock: {
    gap: spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  progressPct: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  emptyHint: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  noExpensesNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: 'rgba(245,197,24,0.15)',
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  noExpensesNoticeText: {
    flex: 1,
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
    lineHeight: fontSizes.captionSm * 1.4,
  },
  footerLink: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  proofPreviewImg: {
    width: '100%',
    height: 360,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
});
