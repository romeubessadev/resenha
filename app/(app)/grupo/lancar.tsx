import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { X, Mic, Repeat, Sparkles } from 'lucide-react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ExpenseFormFields, LimitPaywallSheet, RecurrenceSheet, Switch, type PaywallReason } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useGroup } from '@/hooks/useGroup';
import { useCreateExpense, type SplitType } from '@/hooks/useExpenses';
import { useExpenseForm, formatAmountForInput, describeRecurrenceSummary, nextOccurrenceAfter, toDateOnlyString, type RecurrenceFreq } from '@/hooks/useExpenseForm';
import { useLanguage } from '@/hooks/useLanguage';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useIsPremium } from '@/hooks/usePlan';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, spacing, radius, type ColorPalette } from '@/theme';

const ANIM_DURATION = 250;
const PANEL_CLOSED_OFFSET = 600;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Parse manual (não `new Date(iso)`) — um "YYYY-MM-DD" puro é interpretado como
// UTC meia-noite pelo Date nativo, virando o dia anterior em fusos negativos.
function parseIsoDateLocal(iso: string | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function LancarDespesaScreen() {
  const insets = useSafeAreaInsets();
  const {
    groupId, aiTitle, aiAmount, aiDate, aiPaidById,
    aiParticipantIds: aiParticipantIdsParam,
    aiSplitType, aiShares: aiSharesParam, aiExactAmounts: aiExactAmountsParam,
    aiRecurrenceFreq, aiRecurrenceIntervalDays, aiRecurrenceStart, aiRecurrenceEnd,
  } = useLocalSearchParams<{
    groupId: string;
    aiTitle?: string;
    aiAmount?: string;
    aiDate?: string;
    aiPaidById?: string;
    aiParticipantIds?: string;
    aiSplitType?: string;
    aiShares?: string;
    aiExactAmounts?: string;
    aiRecurrenceFreq?: string;
    aiRecurrenceIntervalDays?: string;
    aiRecurrenceStart?: string;
    aiRecurrenceEnd?: string;
  }>();
  const { session } = useAuth();
  const meId = session?.user.id ?? '';
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const aiAmountNum = aiAmount ? parseFloat(aiAmount) : 0;
  // Parse manual (não `new Date(iso)`) pra não sofrer o shift de fuso: um
  // "YYYY-MM-DD" puro é interpretado como UTC meia-noite pelo Date nativo,
  // o que vira o dia anterior em horários negativos (ex.: Brasil, UTC-3).
  const aiDateObj = useMemo(() => {
    if (!aiDate) return null;
    const [y, m, d] = aiDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }, [aiDate]);
  const aiParticipantIds = useMemo(
    () => (aiParticipantIdsParam ? aiParticipantIdsParam.split(',').filter(Boolean) : []),
    [aiParticipantIdsParam],
  );
  const aiShares = useMemo(() => {
    const out: Record<string, number> = {};
    if (!aiSharesParam) return out;
    for (const pair of aiSharesParam.split(',')) {
      const [id, n] = pair.split(':');
      if (id) out[id] = Number(n) || 1;
    }
    return out;
  }, [aiSharesParam]);
  const aiExactAmounts = useMemo(() => {
    const out: Record<string, number> = {};
    if (!aiExactAmountsParam) return out;
    for (const pair of aiExactAmountsParam.split(',')) {
      const [id, v] = pair.split(':');
      if (id) out[id] = Number(v) || 0;
    }
    return out;
  }, [aiExactAmountsParam]);
  // Mesmo parse manual (não `new Date(iso)`) do aiDateObj acima, pelo mesmo motivo.
  const aiRecurrenceStartObj = useMemo(() => parseIsoDateLocal(aiRecurrenceStart), [aiRecurrenceStart]);
  const aiRecurrenceEndObj = useMemo(() => parseIsoDateLocal(aiRecurrenceEnd), [aiRecurrenceEnd]);

  const { data: group, loading: groupLoading } = useGroup(groupId);
  // Sem estado de "enviando": a despesa é dada como lançada assim que entra na
  // lista, e a subida acontece em segundo plano (ou fica na fila, sem rede).
  const { createExpense } = useCreateExpense();
  const isPremium = useIsPremium();
  const isOnline = useIsOnline();
  // Quem arquivou a resenha (pra si) some das opções de "quem pagou"/"dividir
  // com" — arquivar exige estar quite, então incluir de
  // novo essa pessoa numa despesa nova a colocaria devendo sem ela saber.
  const members = useMemo(() => (group?.members ?? []).filter(m => !m.archivedAt), [group]);

  const form = useExpenseForm({
    members, meId, groupId,
    seedDefaults: true,
    // Despesa nova abre na divisão padrão da resenha — a resposta de "como
    // costumam dividir" do onboarding de quem criou. Continua trocável aqui.
    initialSplitType: group?.defaultSplitType as SplitType | undefined,
  });

  // ── Form state (específico da criação) ──────────────────────────────────────
  const [hasVoiceDraft, setHasVoiceDraft] = useState(!!(aiTitle || aiAmountNum > 0));
  const [recurrenceSheetOpen, setRecurrenceSheetOpen] = useState(false);
  const [limitReason, setLimitReason] = useState<PaywallReason | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Reaplica os campos sempre que chega um rascunho novo da IA (ex: usuário volta
  // pra essa mesma tela de "Nova despesa" depois de ditar por voz outra vez).
  useEffect(() => {
    if (aiAmountNum > 0) form.setValor(formatAmountForInput(aiAmountNum));
    if (aiDateObj) form.setDate(aiDateObj);
    if (aiTitle) form.setDescricao(aiTitle);
    if (aiTitle || aiAmountNum > 0) setHasVoiceDraft(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiAmountNum, aiDateObj, aiTitle]);

  useEffect(() => {
    if (aiParticipantIds.length === 0 || members.length === 0) return;
    const validAiIds = aiParticipantIds.filter(id => members.some(m => m.id === id));
    form.setSelecionados(validAiIds);
    if (aiSplitType === 'shares' && Object.keys(aiShares).length > 0) {
      form.setDividirTipo('por_valores');
      form.setPartes(Object.fromEntries(members.map(m => [m.id, aiShares[m.id] ?? 0])));
      form.setValoresExatos({});
    } else if (aiSplitType === 'exact' && Object.keys(aiExactAmounts).length > 0) {
      form.setDividirTipo('valores_exatos');
      form.setPartes({});
      form.setValoresExatos(Object.fromEntries(
        Object.entries(aiExactAmounts).map(([id, v]) => [id, formatAmountForInput(v)]),
      ));
    } else {
      form.setDividirTipo('igualmente');
      form.setPartes({});
      form.setValoresExatos({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiParticipantIds, aiSplitType, aiShares, aiExactAmounts, members]);

  // Quem pagou, ditado por voz — só aplica se for de fato um membro do grupo.
  useEffect(() => {
    if (aiPaidById && members.some(m => m.id === aiPaidById)) form.setPaidById(aiPaidById);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPaidById, members]);

  // Recorrência ditada por voz. Recorrência é recurso premium (mesma trava de
  // handleRecurringRowPress) — o ditado em si já exige premium na edge
  // function, mas a checagem aqui é defensiva. Usa `aiDateObj` (não
  // `form.date`) como base pro início: outro efeito acima também seta
  // `form.date` a partir do mesmo param, e nesse mesmo ciclo de efeitos o
  // valor novo ainda não teria comitado.
  useEffect(() => {
    if (!aiRecurrenceFreq || !isPremium) return;
    if (!['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(aiRecurrenceFreq)) return;
    const freq = aiRecurrenceFreq as RecurrenceFreq;
    const intervalDays = freq === 'custom' ? parseInt(aiRecurrenceIntervalDays ?? '', 10) : undefined;
    if (freq === 'custom' && (!intervalDays || intervalDays < 1)) return;

    const baseDate = aiDateObj ?? form.date;
    const startMinimum = new Date(baseDate);
    startMinimum.setHours(0, 0, 0, 0);
    const nextRunDate = aiRecurrenceStartObj && aiRecurrenceStartObj >= startMinimum ? aiRecurrenceStartObj : baseDate;

    const endDateMinimum = nextOccurrenceAfter(nextRunDate, freq, intervalDays);
    const endDate = aiRecurrenceEndObj && aiRecurrenceEndObj >= endDateMinimum ? aiRecurrenceEndObj : undefined;

    form.setRecurrence({ freq, intervalDays, nextRunDate, endDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiRecurrenceFreq, aiRecurrenceIntervalDays, aiRecurrenceStartObj, aiRecurrenceEndObj, isPremium]);

  // Fundo escurecido e painel animam juntos (fade + slide), igual ao BottomSheetModal —
  // dá a mesma sensação natural de abertura das outras sheets do app (ex: Compartilhar resenha).
  const overlayOpacity = useSharedValue(0);
  const panelTranslateY = useSharedValue(PANEL_CLOSED_OFFSET);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: ANIM_DURATION, easing: Easing.out(Easing.ease) });
    panelTranslateY.value = withTiming(0, { duration: ANIM_DURATION, easing: Easing.out(Easing.ease) });
  }, [overlayOpacity, panelTranslateY]);

  function handleClose() {
    overlayOpacity.value = withTiming(0, { duration: ANIM_DURATION, easing: Easing.in(Easing.ease) });
    panelTranslateY.value = withTiming(
      PANEL_CLOSED_OFFSET,
      { duration: ANIM_DURATION, easing: Easing.in(Easing.ease) },
      finished => {
        if (finished) runOnJS(router.back)();
      },
    );
  }

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: panelTranslateY.value }] }));

  function handleDitarDespesa() {
    if (!groupId) return;
    // Precisa de resposta da IA pra preencher o formulário ANTES de confirmar —
    // não há o que enfileirar, então sem rede não abre.
    if (!isOnline) {
      Alert.alert(t('offline.title'), t('offline.needsInternet'));
      return;
    }
    if (!isPremium) {
      setLimitReason('voice');
      return;
    }
    router.push({ pathname: '/(app)/grupo/falar' as never, params: { groupId } });
  }

  // Toque na linha sempre abre o sheet (configurar do zero ou editar o
  // rascunho já feito) — desligar (remover) é só o switch, ação separada.
  function handleRecurringRowPress() {
    if (!isPremium) {
      setLimitReason('recurring');
      return;
    }
    setRecurrenceSheetOpen(true);
  }

  function handleRecurringSwitchToggle(next: boolean) {
    if (!next) {
      form.setRecurrence(null);
      return;
    }
    handleRecurringRowPress();
  }

  function handleUpgradeFromLimit() {
    setLimitReason(null);
    setPaywallOpen(true);
  }

  function handleSubscribe() {
    setPaywallOpen(false);
    Alert.alert(t('limitPaywall.cta'), t('paywall.notAvailableYet'));
  }

  // O botão não fica mais em "Lançando..." (não há o que esperar), então a
  // trava contra toque duplo é esta: `handleClose` só anima a saída, e dois
  // toques no mesmo frame passariam os dois pelo formulário aberto.
  const launchedRef = useRef(false);

  async function handleLancar() {
    if (!groupId || !form.canSubmit || launchedRef.current) return;

    const participants = form.buildParticipants();
    if (participants.length === 0) return;

    const title = form.descricao.trim();

    launchedRef.current = true;
    // Sem await: a despesa já entra na lista e no saldo pelo efeito otimista, e
    // sem rede ela fica pausada na fila — esperar aqui travaria a tela até a
    // internet voltar. A receita de recorrência e o upload do comprovante vão
    // dentro da MESMA mutação, na ordem certa (ver createExpenseMutationFn).
    createExpense({
      groupId,
      title,
      // Sem categoria: quem resolve é a fila, depois do insert — tanto na
      // despesa digitada quanto na ditada (ver CreateExpenseInput).
      // Nome e foto resolvidos aqui: a despesa otimista (lista e detalhe)
      // precisa deles pra ser desenhada sem rede, e a tela é quem já tem os
      // membros carregados.
      memberInfo: Object.fromEntries(
        members.map(m => [m.id, { name: m.name, photoUrl: m.photoUrl ?? null }]),
      ),
      amount: form.totalNum,
      splitType: form.splitType,
      paidById: form.paidById,
      participants,
      receiptPath: form.receiptPath ?? undefined,
      date: toDateOnlyString(form.date),
      recurrence: form.recurrence,
    }, message => Alert.alert(t('lancar.submitFailedTitle'), message));

    handleClose();
  }

  return (
    // Rota apresentada como `transparentModal` (ver grupo/_layout.tsx) — gerenciada pelo
    // react-native-screens, então continua na mesma superfície nativa do GestureHandlerRootView
    // único de app/_layout.tsx (diferente de um <Modal> de verdade, que cria uma janela nativa
    // isolada de fato — esses sim precisam do próprio wrapper, ver BottomSheetModal.tsx). Um
    // GestureHandlerRootView aninhado aqui era desaconselhado pela própria lib e explicava o
    // "preciso tocar em algo antes do scroll destravar" — gesture-handler não recomenda nesting.
    <View style={styles.modalRoot}>
      <AnimatedPressable style={[styles.overlay, overlayStyle]} onPress={handleClose}>
      <AnimatedPressable style={[styles.sheetPanel, panelStyle]} onPress={() => {}}>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t('lancar.title')}</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleClose}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.formBody}>
          <KeyboardAwareScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            bottomOffset={16}
          >
            <TouchableOpacity style={styles.ditarPill} onPress={handleDitarDespesa} activeOpacity={0.8}>
              <View style={styles.ditarIconCircle}>
                <Mic size={20} color={colors.ink} strokeWidth={2} />
              </View>
              <View style={styles.ditarTextCol}>
                <Text style={styles.ditarTitle}>{hasVoiceDraft ? t('lancar.dictateAgain') : t('lancar.dictate')}</Text>
                <Text style={styles.ditarSubtitle}>{t('lancar.aiHint')}</Text>
              </View>
              <Sparkles size={20} color={colors.primaryDark} strokeWidth={2} />
            </TouchableOpacity>

            {/* Sem campo de categoria: ela é resolvida pela IA junto do emoji,
                dentro da fila de sincronização, e se corrige no "Editar
                despesa". Um campo vazio aqui seria uma pergunta — e quem
                respondesse na dúvida jogaria tudo em "Outros", justamente o
                lixo que o Insight não pode ter. */}
            <ExpenseFormFields
              members={members}
              membersLoading={groupLoading}
              form={form}
              recurrenceSlot={(
                <Pressable style={styles.recurringRow} onPress={handleRecurringRowPress}>
                  <View style={styles.recurringIconChip}>
                    <Repeat size={18} color={colors.textPrimary} strokeWidth={2} />
                  </View>
                  <View style={styles.recurringTextCol}>
                    <Text style={styles.recurringLabel}>{t('expenseForm.makeRecurring')}</Text>
                    {!!form.recurrence && (
                      <Text style={styles.recurringSubtitle}>
                        {describeRecurrenceSummary(form.recurrence, t)} · {t('expenseForm.tapToEdit')}
                      </Text>
                    )}
                  </View>
                  <Switch value={!!form.recurrence} onValueChange={handleRecurringSwitchToggle} />
                </Pressable>
              )}
            />
          </KeyboardAwareScrollView>

          {/* CTA */}
          <KeyboardStickyView>
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
              <Button
                label={t('lancar.submit')}
                onPress={handleLancar}
                disabled={!form.canSubmit}
                labelStyle={styles.btnPrimaryLabel}
              />
            </View>
          </KeyboardStickyView>
      </View>

      </AnimatedPressable>
      </AnimatedPressable>

      <RecurrenceSheet
        visible={recurrenceSheetOpen}
        onClose={() => setRecurrenceSheetOpen(false)}
        expenseDate={form.date}
        initial={form.recurrence}
        onConfirm={form.setRecurrence}
      />

      <LimitPaywallSheet
        visible={limitReason != null}
        reason={limitReason ?? 'voice'}
        onClose={() => setLimitReason(null)}
        onUpgrade={handleUpgradeFromLimit}
      />

      <LimitPaywallSheet
        visible={paywallOpen}
        reason="general"
        onClose={() => setPaywallOpen(false)}
        onUpgrade={handleSubscribe}
      />
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(21,27,36,0.4)',
  },
  // Altura DEFINIDA, não um teto: com `maxHeight` o painel fica de altura
  // automática e o ScrollView lá dentro guarda métrica desatualizada até algum
  // evento de layout forçar remedição — na prática o scroll só destravava
  // depois de arrastar pra cima e pra baixo. Mesmo motivo de grupo/despesa.tsx.
  sheetPanel: {
    height: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    overflow: 'hidden',
  },
  formBody: {
    flex: 1,
  },
  pickerBody: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.md,
  },
  scroll: {
    flex: 1,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  // ── Ditar despesa ─────────────────────────────────────────────────────────────
  ditarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(245,197,24,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217,168,0,0.3)',
    marginBottom: spacing.lg,
  },
  ditarIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ditarTextCol: {
    flex: 1,
  },
  ditarTitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  ditarSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Tornar recorrente ─────────────────────────────────────────────────────────
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    // 8 + chip de 36 + 8 = os mesmos 52 do Input (ver components/Input.tsx).
    // Não é altura fixa porque esta linha cresce quando ganha o subtítulo com
    // o resumo da recorrência.
    paddingVertical: spacing.sm,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surface,
  },
  recurringIconChip: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  recurringTextCol: {
    flex: 1,
    gap: 2,
  },
  recurringLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  recurringSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Footer / CTA ──────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
  },
  btnPrimaryLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },

});
