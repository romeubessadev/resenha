import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { X, ArrowDownLeft, ArrowUpRight, Undo2 } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { BottomSheetModal } from './BottomSheetModal';
import { ConfirmPaidSheet } from './ConfirmPaidSheet';
import { ConfirmSheet } from './ConfirmSheet';
import { PixCopyBox } from './PixCopyBox';
import { SettlementStatusPill } from './SettlementStatusPill';
import { WhatsAppIcon } from './WhatsAppIcon';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useMarkAsPaid, useRecordReceipt, useUnmarkAsPaid } from '@/hooks/useSettlements';
import { useTheme } from '@/hooks/useTheme';
import { groupByGroup, type PersonGroup } from '@/lib/walletGrouping';
import { uploadSettlementProof } from '@/lib/settlementProof';
import { formatMoney } from '@/lib/currencies';
import type { TranslationKey } from '@/lib/i18n';
import { fontFamilies, fontSizes, radius, shadows, spacing, type ColorPalette } from '@/theme';

type Tab = 'receber' | 'pagar';

type Props = {
  visible: boolean;
  onClose: () => void;
  people: PersonGroup[];
};

// Bullets mostram o valor real de cada resenha (moeda própria) — o "Total" é
// convertido pra moeda principal do usuário, mesma lente da Carteira.
function buildBullets(person: PersonGroup): string {
  return groupByGroup(person.items).map(g => `• ${g.groupName}: ${formatMoney(Math.abs(g.net))}`).join('\n');
}

// Os acertos que ESSA pessoa tem marcados esperando confirmação. O `flatMap`
// (em vez de filter) é o que tira o `settlementId` de nullable — sem ele, nada
// pra desfazer.
function waitingSettlements(person: PersonGroup) {
  return person.items.flatMap(i =>
    i.direction === 'out' && i.status === 'waiting' && i.settlementId
      ? [{ settlementId: i.settlementId, groupId: i.groupId, groupName: i.groupName, proofPath: i.proofPath }]
      : []);
}

function buildMessage(key: TranslationKey, t: (key: TranslationKey, params?: Record<string, string | number>) => string, person: PersonGroup): string {
  const first = person.personName.split(' ')[0];
  const total = formatMoney(Math.abs(person.net));
  return t(key, { name: first, bullets: buildBullets(person), total });
}

async function openWhatsapp(message: string, phone: string | null, failedMessage: string) {
  const encoded = encodeURIComponent(message);
  const phoneParam = phone ? `phone=${phone}&` : '';
  try {
    await Linking.openURL(`whatsapp://send?${phoneParam}text=${encoded}`);
  } catch {
    try {
      await Linking.openURL(`https://wa.me/${phone ?? ''}?text=${encoded}`);
    } catch {
      Alert.alert(failedMessage);
    }
  }
}

export function BatchSettleSheet({ visible, onClose, people }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const myUserId = session?.user.id ?? '';
  const { markAsPaid } = useMarkAsPaid();
  const { recordReceipt } = useRecordReceipt();
  const { unmarkAsPaid, loading: undoing } = useUnmarkAsPaid();

  const [tab, setTab] = useState<Tab>('pagar');
  const [pendingPersonId, setPendingPersonId] = useState<string | null>(null);
  // Pessoa cujo pagamento está sendo confirmado (com chance de anexar
  // comprovante) — troca o corpo do sheet, igual o SettleUpSheet faz.
  const [confirmingPerson, setConfirmingPerson] = useState<PersonGroup | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  // Pessoa cuja marcação está prestes a ser desfeita.
  const [undoingPerson, setUndoingPerson] = useState<PersonGroup | null>(null);
  // Snapshot do total de cada aba no momento em que o sheet abriu — "Total" fica
  // fixo nesse valor, enquanto "RESTAM" acompanha ao vivo conforme a galera vai
  // sendo resolvida na mesma sessão.
  const [openTotals, setOpenTotals] = useState({ receber: 0, pagar: 0 });

  const receivers = people.filter(p => p.net > 0);
  const payers = people.filter(p => p.net < 0);

  useEffect(() => {
    if (visible) {
      const receberTotal = receivers.reduce((s, p) => s + p.net, 0);
      const pagarTotal = payers.reduce((s, p) => s - p.net, 0);
      setTab(pagarTotal >= receberTotal ? 'pagar' : 'receber');
      setOpenTotals({ receber: receberTotal, pagar: pagarTotal });
    } else {
      setConfirmingPerson(null);
      setUndoingPerson(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const list = tab === 'receber' ? receivers : payers;
  const remaining = list.reduce((s, p) => s + Math.abs(p.net), 0);
  const openTotal = tab === 'receber' ? openTotals.receber : openTotals.pagar;

  function canResolve(person: PersonGroup): boolean {
    return tab === 'pagar'
      ? person.items.some(i => i.direction === 'out' && i.status === 'pending')
      // Não exige mais que a outra pessoa tenha marcado como pago: a RPC
      // record_receipt cria a marcação quando ela não existe.
      : person.items.some(i => i.direction === 'in' && i.status !== 'settled');
  }

  /** Aba "a receber": registra o recebimento de todos as resenhas dessa pessoa. */
  async function handleResolve(person: PersonGroup) {
    setPendingPersonId(person.personId);
    try {
      const items = person.items.filter(i => i.direction === 'in' && i.status !== 'settled');
      for (const item of items) {
        await recordReceipt(item.groupId, item.personId, item.amount);
      }
    } catch {
      Alert.alert(t('batch.resolveFailedTitle'), t('batch.resolveFailedBody'));
    } finally {
      setPendingPersonId(null);
    }
  }

  /** Aba "a pagar": marca as resenhas dessa pessoa, com o comprovante escolhido. */
  async function handleConfirmMarkPaid(proofUri: string | null, mimeType: string | null) {
    if (!confirmingPerson) return;
    const items = confirmingPerson.items.filter(i => i.direction === 'out' && i.status === 'pending');
    setConfirmSaving(true);
    try {
      for (const item of items) {
        // Um upload por acerto, mesmo sendo a mesma foto pros várias resenhas:
        // "Marquei sem querer" apaga o arquivo do comprovante, e um path
        // compartilhado deixaria os outras resenhas apontando pra um arquivo
        // que não existe mais.
        const proofPath = proofUri
          ? await uploadSettlementProof(item.groupId, myUserId, item.personId, proofUri, mimeType ?? 'image/jpeg')
          : undefined;
        await markAsPaid(item.groupId, myUserId, item.personId, item.amount, proofPath);
      }
      setConfirmingPerson(null);
    } catch {
      Alert.alert(t('batch.resolveFailedTitle'), t('batch.resolveFailedBody'));
    } finally {
      setConfirmSaving(false);
    }
  }

  /** Aba "a pagar": desfaz a marcação de todas as resenhas marcadas dessa pessoa. */
  async function handleUndo() {
    if (!undoingPerson) return;
    try {
      for (const s of waitingSettlements(undoingPerson)) {
        await unmarkAsPaid(s.settlementId, s.groupId, s.proofPath);
      }
      setUndoingPerson(null);
    } catch {
      setUndoingPerson(null);
      Alert.alert(t('settle.undoFailedInline'));
    }
  }

  async function handleWhatsapp(person: PersonGroup) {
    const message = tab === 'receber'
      ? buildMessage('batch.receberMessage', t, person)
      : buildMessage('batch.pagarMessage', t, person);
    await openWhatsapp(message, person.personWhatsapp, t('common.whatsappOpenFailed'));
  }

  const undoTargets = undoingPerson ? waitingSettlements(undoingPerson) : [];
  const undoDescription = undoingPerson
    ? t(undoTargets.length === 1 ? 'batch.undoBodySingular' : 'batch.undoBody', {
      count: undoTargets.length,
      names: undoTargets.map(s => s.groupName).join(', '),
      name: undoingPerson.personName.split(' ')[0],
    }) + (undoTargets.some(s => s.proofPath) ? t('batch.undoProofSuffix') : '')
    : '';

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{confirmingPerson ? t('settle.confirmTitle') : t('wallet.batchSettle')}</Text>
        <TouchableOpacity
          onPress={() => (confirmingPerson ? setConfirmingPerson(null) : onClose())}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {confirmingPerson ? (
        <ConfirmPaidSheet
          toName={confirmingPerson.personName}
          amount={Math.abs(confirmingPerson.net)}
          onConfirm={handleConfirmMarkPaid}
          loading={confirmSaving}
        />
      ) : (
      <>
          <Text style={styles.explain}>
            {t('batch.explain')}
          </Text>

          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tab, tab === 'receber' && styles.tabActive]}
              onPress={() => setTab('receber')}
              activeOpacity={0.7}
            >
              <ArrowDownLeft size={14} color={tab === 'receber' ? colors.forest : colors.textSecondary} strokeWidth={2.2} />
              <Text style={[styles.tabLabel, tab === 'receber' && styles.tabLabelActiveReceber]}>
                {t('batch.receiveTab', { count: receivers.length })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'pagar' && styles.tabActive]}
              onPress={() => setTab('pagar')}
              activeOpacity={0.7}
            >
              <ArrowUpRight size={14} color={tab === 'pagar' ? colors.coral : colors.textSecondary} strokeWidth={2.2} />
              <Text style={[styles.tabLabel, tab === 'pagar' && styles.tabLabelActivePagar]}>
                {t('batch.payTab', { count: payers.length })}
              </Text>
            </TouchableOpacity>
          </View>

          {list.length > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                {tab === 'receber' ? t('wallet.toReceive') : t('wallet.toPay')} · {t('batch.remaining', { amount: formatMoney(remaining) })}
              </Text>
              <Text style={styles.totalsValue}>{t('common.total')} {formatMoney(openTotal)}</Text>
            </View>
          )}

          {list.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('wallet.emptyTitle')}</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {list.map(person => {
                const resolvable = canResolve(person);
                const pending = pendingPersonId === person.personId;
                const groups = groupByGroup(person.items);
                const subtitle = groups.length === 1
                  ? t('batch.groupsSubtitleSingular', { count: 1, name: groups[0].groupName })
                  : t('batch.groupsSubtitle', { count: groups.length, names: groups.map(g => g.groupName).join(', ') });
                const relevantDirection = tab === 'pagar' ? 'out' : 'in';
                // Já marquei como pago e tô esperando a outra pessoa confirmar —
                // sem isso, o botão só aparecia desabilitado, sem explicar o motivo.
                // Vale pra ALGUMA resenha da pessoa: é o que o selo conta.
                const waitingConfirmation = tab === 'pagar' && person.items.some(i => i.direction === 'out' && i.status === 'waiting');
                // Saldo sem nenhuma despesa por trás — mesma ideia do SettleUpSheet
                // (provavelmente a despesa que gerou essa cobrança foi apagada).
                const hasNoExpenses = person.items.some(i => i.direction === relevantDirection && i.hasNoExpenses);

                // Tinte só quando NÃO sobrou nada pra marcar: o card agrega N
                // resenhas, e com um marcado e outro em aberto o fundo amarelo
                // diria "tudo em espera" — o selo já conta a parte marcada.
                const allWaiting = waitingConfirmation && !resolvable;

                return (
                  <View key={person.personId} style={[styles.personCard, allWaiting && styles.personCardWaiting]}>
                    <View style={styles.personRow}>
                      <Avatar name={person.personName} id={person.personId} photoUrl={person.personPhotoUrl ?? undefined} size={40} variant="colorful" />
                      <View style={styles.personInfo}>
                        <Text style={styles.personName} numberOfLines={1}>{person.personName}</Text>
                        <Text style={styles.personSubtitle} numberOfLines={1}>{subtitle}</Text>
                        {hasNoExpenses && (
                          <Text style={styles.noExpensesTag} numberOfLines={2}>{t('settle.noExpensesTag')}</Text>
                        )}
                      </View>
                      <Text style={[styles.personValue, { color: tab === 'receber' ? colors.forest : colors.coral }]}>
                        {tab === 'receber' ? '+ ' : '− '}{formatMoney(Math.abs(person.net))}
                      </Text>
                    </View>

                    {/* Linha própria, como no TransferCard: dentro da coluna do
                        nome o selo fica espremido entre o avatar e o valor. */}
                    {waitingConfirmation && (
                      <View style={styles.statusRow}>
                        <SettlementStatusPill
                          status="marked_paid"
                          label={t('transfer.waitingConfirm', { name: person.personName.split(' ')[0] })}
                        />
                      </View>
                    )}

                    {/* Mesma regra do TransferCard, traduzida pro card que
                        agrega N resenhas: aparece pra quem DEVE e enquanto sobrar
                        algo pra marcar (`resolvable`). Some quando tudo já foi
                        marcado, e nunca na aba "A receber" — ali a chave seria
                        a minha, que eu já vejo no meu perfil. */}
                    {tab === 'pagar' && resolvable && person.personPixKey && person.personPixKeyType && (
                      <PixCopyBox pixKey={person.personPixKey} pixKeyType={person.personPixKeyType} />
                    )}

                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.whatsappBtn}
                        onPress={() => handleWhatsapp(person)}
                        activeOpacity={0.85}
                      >
                        <WhatsAppIcon size={14} color={colors.whatsapp} />
                        {/* Diz a AÇÃO, não o canal — o ícone verde ao lado já
                            entrega o WhatsApp. Na aba receber você dá um toque;
                            na aba pagar você avisa. */}
                        <Text style={styles.whatsappBtnLabel} numberOfLines={1}>
                          {t(tab === 'receber' ? 'common.nudge' : 'common.notify')}
                        </Text>
                      </TouchableOpacity>
                      {/* Sem nada pra marcar, este slot era um botão morto a
                          50% dizendo "Marcar como pago". Vira o desfazer, como
                          no TransferCard. No estado misto ele não aparece: o
                          marcar ainda tem função, e desfazer UMA resenha se faz no
                          sheet da resenha, que é onde dá pra ver qual é. */}
                      {allWaiting ? (
                        <TouchableOpacity
                          style={[styles.resolveBtn, styles.undoBtn]}
                          onPress={() => setUndoingPerson(person)}
                          activeOpacity={0.85}
                        >
                          <Undo2 size={14} color={colors.ink} strokeWidth={2} />
                          <Text style={styles.resolveBtnLabel} numberOfLines={1}>{t('transfer.undoMarkedPaid')}</Text>
                        </TouchableOpacity>
                      ) : (
                        /* Rotulado, e não só um ✓: o mesmo botão significa
                           "Paguei" numa aba e "Recebi" na outra, e ícone sozinho
                           não distingue os dois. */
                        <TouchableOpacity
                          style={[styles.resolveBtn, !resolvable && styles.resolveBtnDisabled]}
                          onPress={() => (tab === 'pagar' ? setConfirmingPerson(person) : handleResolve(person))}
                          activeOpacity={0.7}
                          disabled={!resolvable || pending}
                        >
                          <Text style={styles.resolveBtnLabel}>
                            {pending
                              ? t('transfer.marking')
                              : t(tab === 'receber' ? 'transfer.confirmReceipt' : 'transfer.markAsPaid')}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {/* `nested`: este sheet já é um Modal nativo (mesmo caso do SettleUpSheet). */}
      <ConfirmSheet
        nested
        visible={!!undoingPerson}
        onClose={() => { if (!undoing) setUndoingPerson(null); }}
        title={t('batch.undoTitle')}
        description={undoDescription}
        confirmLabel={t('transfer.undoMarkedPaid')}
        confirmLoadingLabel={t('batch.undoing')}
        onConfirm={handleUndo}
        loading={undoing}
      />
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
  tabLabelActiveReceber: {
    fontFamily: fontFamilies.semibold,
    color: colors.forest,
  },
  tabLabelActivePagar: {
    fontFamily: fontFamilies.semibold,
    color: colors.coral,
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
  totalsValue: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  personCard: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.sm,
  },
  // Mesmos valores do `cardMarkedPaid` do TransferCard — o estado "marcado,
  // esperando confirmar" tem que ler igual nas duas telas.
  personCardWaiting: {
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderColor: 'rgba(217,168,0,0.4)',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  personName: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  personSubtitle: {
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
  noExpensesTag: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  personValue: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    fontVariant: ['tabular-nums'],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.whatsapp,
    backgroundColor: colors.background,
  },
  whatsappBtnLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.whatsapp,
  },
  resolveBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  resolveBtnDisabled: {
    opacity: 0.5,
  },
  undoBtn: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  resolveBtnLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
});
