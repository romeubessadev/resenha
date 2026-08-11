import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image, Modal,
  TouchableWithoutFeedback, Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Pencil, Trash2, X, ChevronRight, Repeat, Image as ImageIcon, Maximize2, CloudOff,
} from 'lucide-react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, BackButton, Button, CategoryPickerBody, CategoryIcon, ConfirmSheet, ExpenseDetailSkeleton, ExpenseFormFields, LimitPaywallSheet, RecurrenceSheet, Switch, type PaywallReason } from '@/components';
import { BottomSheetModal } from '@/components/BottomSheetModal';
import { useAuth } from '@/hooks/useAuth';
import { useExpense } from '@/hooks/useExpense';
import { randomUUID } from 'expo-crypto';
import {
  useUpdateExpense, useDeleteExpense, useExpenses,
  type ExpenseParticipantInput, type RecurrenceIntent,
} from '@/hooks/useExpenses';
import { useGroupBalances } from '@/hooks/useGroupBalances';
import { useExpenseForm, DIVIDIR_TIPO_FROM_SPLIT, describeRecurrenceSummary, nextOccurrenceAfter, toDateOnlyString, type DividirTipo, type RecurrenceConfig } from '@/hooks/useExpenseForm';
import { buildRecurrenceRow } from '@/hooks/useRecurrence';
import { computeOwnPosition, computeTotalOccurrences, parseDateOnly } from '@/lib/recurrence';
import { useExpenseRecurrenceInfo, type ExpenseRecurrenceInfo } from '@/hooks/useExpenseRecurrenceInfo';
import { useGroup } from '@/hooks/useGroup';
import { useCategories, findCategory } from '@/hooks/useCategories';
import { useIsPremium } from '@/hooks/usePlan';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/currencies';
import { DEFAULT_CATEGORY_COLOR, getCategoryChipColor, hexToRgba } from '@/lib/categoryColors';
import { supabase } from '@/lib/supabase';
import type { Language, TranslationKey } from '@/lib/i18n';
import { fontFamilies, fontSizes, spacing, radius, shadows, type ColorPalette } from '@/theme';

// Rótulo curto pra linha "Divisão" do cupom — legenda do recibo, não do form de editar.
const DIVISAO_LABEL_KEYS: Record<DividirTipo, TranslationKey> = {
  igualmente:     'expenseDetail.splitEqual',
  por_valores:    'expenseDetail.splitByShares',
  valores_exatos: 'expenseDetail.splitExact',
};

function partesLabel(n: number, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string {
  return t(n === 1 ? 'expenseDetail.partsSingular' : 'expenseDetail.partsPlural', { n });
}

function formatDateLong(iso: string, language: Language): string {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(iso: string, language: Language): string {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(language, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function ordinalLabel(n: number): string {
  return `${n}ª`;
}

type RecurrenceStatus =
  | { kind: 'finished'; endDateLabel: string; total: number | null }
  // Pausada guarda a posição, mas NÃO a próxima data: ela existiria no papel e
  // não vai acontecer. Anunciar uma cobrança que a série não vai fazer é o
  // contrário do que o título "Recorrência pausada" acabou de dizer.
  | { kind: 'paused'; occurrenceLabel: string; total: number | null }
  | { kind: 'active'; nextDateLabel: string; occurrenceLabel: string; total: number | null };

function computeRecurrenceStatus(
  info: ExpenseRecurrenceInfo,
  expenseDate: Date,
  language: Language,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): RecurrenceStatus {
  const pattern = { freq: info.freq, intervalDays: info.intervalDays, anchorDay: info.anchorDay };
  const seedDate = parseDateOnly(info.firstOccurrenceDate);
  const total = computeTotalOccurrences(pattern, seedDate, info.endDate);

  if (!info.active && info.endDate) {
    return { kind: 'finished', endDateLabel: formatDateLong(info.endDate, language), total };
  }

  const ownPosition = computeOwnPosition(seedDate, expenseDate, pattern);
  let occurrenceLabel = ordinalLabel(ownPosition);
  if (total !== null) {
    occurrenceLabel = t('expenseDetail.occurrenceOfTotal', { ordinal: occurrenceLabel, total });
  }

  // Depois de `finished`: uma série que já acabou não é "pausada", mesmo que a
  // chave estivesse desligada quando o prazo venceu.
  if (info.paused) {
    return { kind: 'paused', occurrenceLabel, total };
  }

  // Um passo à frente da PRÓPRIA despesa aberta, não o next_run_date da
  // recorrência (que é sempre a mesma data pra qualquer despesa da série) —
  // segue a mesma lógica por-despesa do "Ocorrência" acima.
  const nextDate = nextOccurrenceAfter(expenseDate, info.freq, info.intervalDays ?? undefined, info.anchorDay);

  return {
    kind: 'active',
    nextDateLabel: nextDate.toLocaleDateString(language, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    occurrenceLabel,
    total,
  };
}


export default function DespesaDetailScreen() {
  const insets = useSafeAreaInsets();
  const { despesaId, openEdit } = useLocalSearchParams<{ groupId: string; despesaId: string; openEdit?: string }>();
  const { session } = useAuth();
  const meId = session?.user.id ?? '';
  const { language, t } = useLanguage();
  const { colors, resolvedScheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, resolvedScheme), [colors, resolvedScheme]);

  const { data: expense, loading, error, refetch } = useExpense(despesaId);
  // Sem estado de "salvando": os valores novos aparecem assim que se confirma,
  // e a subida acontece em segundo plano (ou fica na fila, sem rede).
  const { updateExpense } = useUpdateExpense();
  // Sem estado de "apagando": a despesa some da lista assim que se confirma, e
  // a subida acontece em segundo plano (ou fica na fila, sem rede).
  const { deleteExpense } = useDeleteExpense();
  // Criar, cancelar e atualizar a recorrência agora acontecem DENTRO da
  // mutação de editar (ver buildRecurrenceIntent) — este hook só lê.
  const { info: recurrenceInfo, loading: recurrenceInfoLoading } = useExpenseRecurrenceInfo(expense?.recurrenceId);
  const { data: group } = useGroup(expense?.groupId);
  const { data: categories } = useCategories(expense?.groupId);
  const isPremium = useIsPremium();
  const { data: lancamentos } = useExpenses(expense?.groupId);
  const { paymentsOnlyBalances } = useGroupBalances(expense?.groupId);
  const groupMembers = group?.members ?? [];
  // Editar/apagar é de quem pagou, de quem LANÇOU ou de admin da resenha (mesma
  // regra da RLS expenses_update/delete_payer_creator_or_admin) — sem essa
  // checagem o botão aparecia pra todo mundo e só falhava ao confirmar.
  // Quem lançou entrou na conta: lançar em nome de outro é o fluxo
  // normal do app, e antes disso a pessoa criava a despesa e ficava sem como
  // corrigir o próprio erro.
  // Dono conta como admin: é o que o is_group_admin() do banco faz,
  // e a UI nem expõe os dois papéis (participantes.tsx rotula os dois de "admin").
  const myGroupRole = groupMembers.find(m => m.isMe)?.role;
  const isGroupAdmin = myGroupRole === 'owner' || myGroupRole === 'admin';
  const canManageExpense = !!expense?.paidByMe || !!expense?.createdByMe || isGroupAdmin;
  // Apagar a última despesa da resenha pode deixar alguém com saldo pendente
  // (pagamento já confirmado, sem mais nenhuma despesa por perto pra
  // explicar o motivo) — ver hooks/useGroupBalances.ts.
  const isLastExpense = lancamentos.filter(l => l.type === 'expense').length === 1;
  const orphanedMembers = isLastExpense
    ? groupMembers.filter(m => Math.abs(paymentsOnlyBalances[m.id] ?? 0) > 0.005)
    : [];

  const [showComprovante, setShowComprovante] = useState(false);
  // Edição de despesa recorrente aguardando a escolha de alcance. Guarda o que
  // já foi montado pra não recalcular depois da resposta — e porque o form
  // pode mudar enquanto o sheet está aberto.
  const [pendingSave, setPendingSave] = useState<{ participants: ExpenseParticipantInput[]; title: string } | null>(null);
  // A miniatura pode estar viva pelo cache de imagem e a versão grande não —
  // no Android o cache guarda o bitmap no tamanho da view, então ampliar
  // dispara nova busca na rede. Sem isto o modal abria preto, sem explicação.
  const [fullReceiptFailed, setFullReceiptFailed] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Desligar a chave de uma recorrência já ativa não pausa na hora — só marca a
  // intenção, igual qualquer outro campo do form. A pausa de verdade só
  // acontece se a pessoa confirmar em "Salvar alterações".
  //
  // Pausa, e não cancelamento: apagar a receita zeraria o recurrence_id de TODA
  // ocorrência passada (a FK é ON DELETE SET NULL), que perderia o card e o
  // "3ª de 12". Uma ação que parece "parar de repetir" não pode destruir o
  // histórico da série.
  const [pendingPauseRecurrence, setPendingPauseRecurrence] = useState(false);
  // Mesma lógica pra trocar o ritmo (freq/intervalo/término): fica pendente até
  // "Salvar alterações", em vez de gravar no toque do "Concluir" do sheet.
  const [pendingRecurrenceUpdate, setPendingRecurrenceUpdate] = useState<RecurrenceConfig | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const editForm = useExpenseForm({
    members: groupMembers, meId, groupId: expense?.groupId,
  });
  // Categoria é resolvida pela IA no lançamento e se corrige aqui, no
  // formulário de editar — junto do resto, em rascunho até "Salvar alterações".
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const editSelectedCategory = findCategory(categories, editCategoryId);
  // Sheet aninhado (BottomSheetModal `nested`) que empilha POR CIMA do Modal de
  // editar sem abrir um segundo <Modal> nativo — mantém o formulário visível
  // (dimmed) atrás.
  const [pickingCategory, setPickingCategory] = useState(false);
  const [recurrenceSheetOpen, setRecurrenceSheetOpen] = useState(false);
  const [limitReason, setLimitReason] = useState<PaywallReason | null>(null);
  // Já era recorrente antes de abrir o form de editar — nesse caso o toggle
  // abre o sheet pré-preenchido pra EDITAR a config atual (freq/intervalo/
  // término), em vez de criar uma receita nova. Cancelar continua só no
  // detalhe da despesa (fora do modo editar).
  // Exige a receita VIVA, não só o `recurrence_id` da despesa: a série pode ter
  // sido apagada (soft delete) e a ocorrência antiga mantém o vínculo
  // apontando pra ela. Sem esta condição, a chave "Repetir" tentaria atualizar
  // uma receita apagada e a ressuscitaria.
  //
  // Enquanto a consulta não responde, assume viva — é o caso comum, e assumir
  // o contrário faria a chave piscar em "desligada" numa despesa recorrente,
  // com o toque criando uma receita nova em vez de editar a que existe.
  const isAlreadyRecurring = !!expense?.recurrenceId && (recurrenceInfoLoading || !!recurrenceInfo);
  const existingRecurrenceConfig: RecurrenceConfig | null = recurrenceInfo ? {
    freq: recurrenceInfo.freq,
    intervalDays: recurrenceInfo.intervalDays ?? undefined,
    nextRunDate: parseDateOnly(recurrenceInfo.nextRunDate),
    endDate: recurrenceInfo.endDate ? parseDateOnly(recurrenceInfo.endDate) : undefined,
    anchorDay: recurrenceInfo.anchorDay,
  } : null;
  const recurrenceStatus = recurrenceInfo && expense
    ? computeRecurrenceStatus(recurrenceInfo, parseDateOnly(expense.date), language, t)
    : null;
  // Apagar uma ocorrência de série viva tem duas leituras — some só ela, ou
  // some ela e a repetição para. Só pergunta quando a pergunta faz sentido:
  // série pausada ou já finalizada não vai gerar mais nada, então a exclusão
  // volta a ser a de sempre.
  //
  // E só pra quem pode mesmo pausar: a policy expense_recurrences_update_owner_
  // or_admin é do criador da receita ou admin/dono da resenha. Quem só pagou a
  // despesa apaga a ocorrência, mas o update da série seria filtrado pela RLS
  // sem afetar linha nenhuma — a opção prometeria parar a repetição e não
  // pararia, calada.
  const canPauseRecurrence = isGroupAdmin || recurrenceInfo?.createdBy === meId;
  // Última ocorrência da série: não há alcance a perguntar, porque não sobra
  // futuro — a série é encerrada junto (ver deleteExpenseMutationFn). Só avisa.
  const seriesOccurrences = expense?.recurrenceId
    ? lancamentos.filter(l => l.type === 'expense' && l.recurrenceId === expense.recurrenceId).length
    : 0;
  const deleteEndsSeries = !!expense?.recurrenceId && !!recurrenceInfo && seriesOccurrences <= 1;

  const deleteHitsLiveSeries = !!expense?.recurrenceId && !deleteEndsSeries
    && !!recurrenceInfo?.active && !recurrenceInfo.paused;
  const askDeleteScope = deleteHitsLiveSeries && canPauseRecurrence;
  // Quem não pode pausar apaga só a ocorrência e a série segue lançando —
  // a pergunta de alcance, que é onde isso está dito, nunca aparece pra ele.
  const warnSeriesContinues = deleteHitsLiveSeries && !canPauseRecurrence;
  // No form de editar, mostra o ritmo pendente (ainda não salvo) quando
  // houver, em vez do que já está no servidor — reflete o que "Salvar
  // alterações" vai de fato gravar.
  const displayedRecurrenceConfig: RecurrenceConfig | null = isAlreadyRecurring
    ? (pendingRecurrenceUpdate ?? existingRecurrenceConfig)
    : editForm.recurrence;

  useEffect(() => {
    if (!expense?.receiptPath) { setReceiptUrl(null); return; }
    supabase.storage.from('comprovantes').createSignedUrl(expense.receiptPath, 3600).then(({ data }) => {
      setReceiptUrl(data?.signedUrl ?? null);
    });
  }, [expense?.receiptPath]);

  function openEditModal() {
    if (!expense) return;
    editForm.loadFromExpense(expense);
    editForm.setReceiptUri(receiptUrl);
    setEditCategoryId(expense.categoryId);
    setPickingCategory(false);
    setPendingPauseRecurrence(!!recurrenceInfo?.paused);
    setPendingRecurrenceUpdate(null);
    setEditModalOpen(true);
  }

  // Veio direto do swipe "Editar" na lista de despesas — abre o modal de
  // edição assim que o dado carrega, sem precisar de mais um toque aqui.
  const autoEditHandledRef = useRef(false);
  useEffect(() => {
    if (openEdit === '1' && expense && canManageExpense && !autoEditHandledRef.current) {
      autoEditHandledRef.current = true;
      openEditModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEdit, expense, canManageExpense]);

  // Toque na linha: se tem uma pausa pendente, desfaz (liga de novo); senão
  // abre o sheet — configurar do zero, editar o rascunho, ou editar a
  // recorrência já ativa (com startEditable=false lá dentro travando só o
  // campo Início).
  function handleRecurringRowPress() {
    if (isAlreadyRecurring && pendingPauseRecurrence) {
      setPendingPauseRecurrence(false);
      return;
    }
    if (!isAlreadyRecurring && !isPremium) {
      setLimitReason('recurring');
      return;
    }
    setRecurrenceSheetOpen(true);
  }

  // Desligar a chave de uma recorrência já ativa só marca a intenção — a pausa
  // de verdade só acontece se "Salvar alterações" for confirmado.
  function handleRecurringSwitchToggle(next: boolean) {
    if (isAlreadyRecurring) {
      setPendingPauseRecurrence(!next);
      return;
    }
    if (!next) {
      editForm.setRecurrence(null);
      return;
    }
    handleRecurringRowPress();
  }

  function handleRecurrenceConfirm(config: RecurrenceConfig) {
    if (isAlreadyRecurring) {
      setPendingRecurrenceUpdate(config);
      return;
    }
    editForm.setRecurrence(config);
  }

  function handleUpgradeFromLimit() {
    setLimitReason(null);
  }

  // O que fazer com a recorrência ao salvar. As operações vão DENTRO da mesma
  // mutação da despesa (ver useExpenses), e não em chamadas separadas:
  // enfileiradas soltas, seriam retomadas em paralelo na reconexão e a despesa
  // poderia gravar o vínculo antes da receita existir.
  //
  // O RITMO (freq/intervalo/término) e a PAUSA são sempre da série inteira, e
  // por isso não passam pela pergunta de alcance. O CONTEÚDO (valor, título,
  // pagador, divisão, categoria) existe na ocorrência e no molde, e só vai pro
  // molde quando a pessoa escolhe "esta e as próximas".
  function buildRecurrenceIntent(participants: ExpenseParticipantInput[], applyToFuture: boolean): RecurrenceIntent {
    if (!expense) return { action: 'none', id: null };

    if (isAlreadyRecurring && expense.recurrenceId) {
      const config = pendingRecurrenceUpdate ?? existingRecurrenceConfig;
      if (!config) return { action: 'none', id: expense.recurrenceId };
      return {
        action: 'update',
        id: expense.recurrenceId,
        freq: config.freq,
        intervalDays: config.freq === 'custom' ? (config.intervalDays ?? 1) : null,
        endDate: config.endDate ? toDateOnlyString(config.endDate) : null,
        amount: editForm.totalNum,
        applyToFuture,
        paused: pendingPauseRecurrence,
      };
    }

    // Passou a ser recorrente agora. O id nasce aqui pra a despesa já sair
    // sabendo a qual receita vai se ligar, sem ida ao servidor.
    if (editForm.recurrence && !isAlreadyRecurring) {
      const id = randomUUID();
      return {
        action: 'create',
        id,
        row: buildRecurrenceRow(
          {
            groupId: expense.groupId,
            title: editForm.descricao.trim(),
            // A categoria acompanha a receita pra as ocorrências futuras
            // nascerem no mesmo balde — mas não é editável aqui.
            categoryId: expense.categoryId,
            amount: editForm.totalNum,
            splitType: editForm.splitType,
            paidById: editForm.paidById,
            participants,
            receiptPath: editForm.receiptPath,
            recurrence: editForm.recurrence,
          },
          meId,
          id,
        ),
      };
    }

    return { action: 'none', id: expense.recurrenceId };
  }

  // Sem await: lista, saldo e detalhe já mostram os valores novos pelo efeito
  // otimista, e sem rede a edição fica pausada na fila — esperar aqui deixaria
  // o sheet travado até a internet voltar.
  // Mudou algo que a receita da recorrência guarda? Só isso justifica a
  // pergunta de escopo — mexer só na data de UMA ocorrência não tem futuro pra
  // afetar, e perguntar ali seria ruído.
  function contentChangedForSeries(participants: ExpenseParticipantInput[], title: string): boolean {
    if (!expense) return false;
    if (title !== expense.title) return true;
    if (Math.abs(editForm.totalNum - expense.amount) > 0.005) return true;
    if (editForm.paidById !== expense.paidById) return true;
    if (editForm.splitType !== expense.splitType) return true;
    if (editCategoryId !== expense.categoryId) return true;
    return participants.length !== expense.participants.length
      || participants.some(p => !expense.participants.some(o => o.userId === p.userId));
  }

  function handleSaveEdit() {
    if (!expense || !editForm.canSubmit) return;

    const participants = editForm.buildParticipants();
    if (participants.length === 0) return;

    const title = editForm.descricao.trim();

    // Despesa recorrente com conteúdo alterado: quem decide o alcance é a
    // pessoa, não o app. Antes a mudança SEMPRE vazava pras próximas — corrigir
    // a luz de um mês mais cara reajustava todos os meses seguintes calado.
    if (isAlreadyRecurring && !pendingPauseRecurrence && contentChangedForSeries(participants, title)) {
      setPendingSave({ participants, title });
      return;
    }

    commitEdit(participants, title, true);
  }

  // Sem await: lista, saldo e detalhe já mostram os valores novos pelo efeito
  // otimista, e sem rede a edição fica pausada na fila — esperar aqui deixaria
  // o sheet travado até a internet voltar.
  function commitEdit(participants: ExpenseParticipantInput[], title: string, applyToFuture: boolean) {
    if (!expense) return;
    setPendingSave(null);

    updateExpense({
      expenseId: expense.id,
      groupId: expense.groupId,
      categoryId: editCategoryId,
      title,
      // Os dois fatos que a fila precisa pra decidir se redescreve, e o quê.
      // Comparados aqui porque é esta tela que tem os valores originais em mãos
      // — `editCategoryId` nasce de `expense.categoryId` ao abrir o sheet.
      titleChanged: title !== expense.title,
      categoryTouched: editCategoryId !== expense.categoryId,
      amount: editForm.totalNum,
      splitType: editForm.splitType,
      paidById: editForm.paidById,
      date: toDateOnlyString(editForm.date),
      receiptPath: editForm.receiptPath,
      // O que está gravado hoje, pra mutação limpar o bucket se a foto foi
      // trocada ou removida.
      previousReceiptPath: expense.receiptPath,
      participants,
      memberInfo: Object.fromEntries(
        groupMembers.map(m => [m.id, { name: m.name, photoUrl: m.photoUrl ?? null }]),
      ),
      recurrence: buildRecurrenceIntent(participants, applyToFuture),
    }, () => Alert.alert(t('expenseDetail.saveFailedTitle'), t('common.tryAgain')));

    setEditModalOpen(false);
  }

  // Sem await: a despesa já saiu da lista e do saldo pelo efeito otimista, e
  // sem rede a exclusão fica pausada na fila. Esperar aqui deixaria a pessoa
  // presa numa tela cuja despesa já não existe mais pra ela.
  function handleApagar(pauseSeries: boolean) {
    if (!expense) return;

    deleteExpense(expense.id, expense.groupId, expense.recurrenceId ?? null, pauseSeries, () =>
      Alert.alert(t('expenseDetail.deleteFailedTitle'), t('common.tryAgain')));
    setDeleteConfirmOpen(false);
    router.back();
  }

  const heroCat = findCategory(categories, expense?.categoryId);
  const shortId = expense ? expense.id.slice(-4).toUpperCase() : '';
  const totalPartes = (expense?.participants ?? []).reduce((s, p) => s + (p.shares ?? 1), 0);
  const myShare = expense?.participants.find(p => p.isMe)?.shareAmount;
  const receivable = (expense?.participants ?? [])
    .filter(p => p.userId !== expense?.paidById)
    .reduce((s, p) => s + p.shareAmount, 0);
  const totalizer = expense?.paidByMe
    ? { label: t('expenseDetail.totalizerReceivable'), value: receivable, color: colors.forest, prefix: '+ ', italic: false }
    : myShare !== undefined
      ? { label: t('expenseDetail.totalizerOwed'), value: myShare, color: colors.coral, prefix: '− ', italic: false }
      : { label: t('expenseDetail.totalizerNotIncluded'), value: null as number | null, color: colors.textSecondary, prefix: '', italic: true };

  const heroAmountLabel = formatMoney(Math.abs(expense?.amount ?? 0));
  const totalizerLabel = totalizer.value !== null ? formatMoney(Math.abs(totalizer.value)) : null;
  const recurrenceTotalLabel = recurrenceStatus?.total && expense
    ? formatMoney(Math.abs(expense.amount) * recurrenceStatus.total)
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.headerRow}>
        <BackButton style={styles.headerBackBtn} />
        <Text style={styles.headerTitle}>{t('expenseDetail.title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading && !expense ? (
        <ExpenseDetailSkeleton />
      ) : error || !expense ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{t('expenseDetail.loadErrorTitle')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.7}>
            <Text style={styles.retryBtnLabel}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            // Só o respiro do fim da página. Já teve +72 aqui, reservando
            // espaço pra um botão flutuante que esta tela não tem — Editar e
            // Apagar são o último conteúdo DENTRO do scroll. Com o conteúdo
            // curto, aquela folga virava a única coisa rolável: a pessoa
            // arrastava e só via fundo vazio.
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            <View style={styles.cupom}>
              {/* Cabeçalho do cupom */}
              <View style={styles.cupomHeader}>
                <Text style={styles.cupomLabel}>{t('expenseDetail.couponLabel')}</Text>
                {group && <Text style={styles.cupomGroupName}>{group.name}</Text>}
              </View>

              {/* Hero */}
              <View style={styles.heroSection}>
                <View style={[
                  styles.heroCatCircle,
                  { backgroundColor: getCategoryChipColor(heroCat?.color) },
                ]}>
                  <CategoryIcon
                    icon={heroCat?.icon}
                    size={32}
                    color={heroCat?.color ?? colors.textSecondary}
                  />
                </View>
                <Text style={styles.heroTitle}>{expense.title}</Text>
                {/* Único lugar da categoria no app inteiro fora do Insight: ela
                    é resolvida pela IA sem passar por formulário nenhum, então
                    é aqui que a pessoa vê o que ficou e conserta. Grava na
                    hora — é conserto pontual, não edição da despesa, e por isso
                    não passa pelo "Salvar alterações".
                    Sem ícone de identidade: categoria é agregação. O lápis é só
                    a affordance de que dá pra tocar. */}
                {/* Texto puro: editar a categoria é pelo formulário de editar,
                    junto do resto. Um lápis solto aqui seria uma segunda porta
                    pra editar a mesma despesa. */}
                <Text style={styles.heroCategory}>{heroCat?.name ?? t('common.categoryFallback')}</Text>
                <Text style={styles.heroAmount}>{heroAmountLabel}</Text>
              </View>

              <View style={styles.dashedDivider} />

              {/* Info rows */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('expenseDetail.date')}</Text>
                <Text style={[styles.infoValue, styles.infoValueRegular]}>{formatDateLong(expense.date, language)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('expenseDetail.paidBy')}</Text>
                <View style={styles.infoValueRow}>
                  <Avatar name={expense.paidByName} id={expense.paidById} photoUrl={expense.paidByPhotoUrl ?? undefined} size={22} variant="colorful" />
                  <Text style={styles.infoValue}>{expense.paidByMe ? t('common.youCapitalized') : expense.paidByName}</Text>
                </View>
              </View>
              {/* Categoria não repete aqui: ela já está sob o título, no hero,
                  onde também se corrige. Duas linhas dizendo a mesma coisa
                  fazem a pessoa procurar diferença entre elas. */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('expenseDetail.splitType')}</Text>
                <Text style={styles.infoValue}>
                  {t(DIVISAO_LABEL_KEYS[DIVIDIR_TIPO_FROM_SPLIT[expense.splitType]])} · {t('expenseDetail.peopleCountLabel', { count: expense.participants.length })}
                  {expense.splitType === 'shares' ? ` · ${partesLabel(totalPartes, t)}` : ''}
                </Text>
              </View>
              <View style={styles.dashedDivider} />

              {/* Recorrência */}
              {!!recurrenceInfo && !!recurrenceStatus && !!existingRecurrenceConfig && (
                <>
                  <Text style={styles.sectionHeader}>{t('expenseDetail.recurrenceHeader')}</Text>
                  <View style={styles.recurrenceCard}>
                    {/* Sem o disco colorido: "círculo + título forte" é a
                        gramática do HERO, que diz o que a despesa é. Repetida
                        aqui dentro do mesmo cupom, lia como uma segunda
                        identidade competindo com ela. O cabeçalho da seção já
                        nomeia o bloco; aqui basta uma linha de contexto. */}
                    <View style={styles.recurrenceTitleRow}>
                      <Repeat size={16} color={colors.textSecondary} strokeWidth={2.2} />
                      <Text style={styles.recurrenceTitle} numberOfLines={2}>
                        {recurrenceInfo.paused
                          ? t('expenseDetail.recurrencePaused')
                          : describeRecurrenceSummary(existingRecurrenceConfig, t)}
                        {' · '}
                        <Text style={styles.recurrenceSubtitle}>
                          {t('expenseDetail.recurrenceStartedOn', { date: formatDateShort(recurrenceInfo.firstOccurrenceDate, language) })}
                          {' · '}
                          {recurrenceInfo.endDate
                            ? t('expenseDetail.recurrenceUntil', { date: formatDateShort(recurrenceInfo.endDate, language) })
                            : t('expenseDetail.recurrenceNoEnd')}
                        </Text>
                      </Text>
                    </View>

                    <View style={styles.recurrenceStatusCard}>
                      {recurrenceStatus.kind === 'finished' ? (
                        <Text style={styles.recurrenceStatusFinished}>
                          {t('expenseDetail.recurrenceFinished', { date: recurrenceStatus.endDateLabel })}
                        </Text>
                      ) : (
                        <>
                          {/* Sem "Próxima" quando pausada — a série não vai
                              cobrar até alguém retomar, e a posição desta
                              despesa na série continua valendo. */}
                          {recurrenceStatus.kind === 'active' && (
                            <View style={styles.recurrenceStatusRow}>
                              <Text style={styles.recurrenceStatusLabel}>{t('expenseDetail.nextOccurrenceLabel')}</Text>
                              <Text style={styles.recurrenceStatusValue}>{recurrenceStatus.nextDateLabel}</Text>
                            </View>
                          )}
                          <View style={styles.recurrenceStatusRow}>
                            <Text style={styles.recurrenceStatusLabel}>{t('expenseDetail.occurrenceLabel')}</Text>
                            <Text style={styles.recurrenceStatusValue}>{recurrenceStatus.occurrenceLabel}</Text>
                          </View>
                        </>
                      )}
                      {!!recurrenceTotalLabel && (
                        <View style={styles.recurrenceStatusRow}>
                          <Text style={styles.recurrenceStatusLabel}>{t('expenseDetail.recurrenceTotalLabel')}</Text>
                          <Text style={styles.recurrenceStatusValue}>{recurrenceTotalLabel}</Text>
                        </View>
                      )}
                      {recurrenceStatus.kind === 'paused' && (
                        <Text style={styles.recurrenceStatusFinished}>{t('recurrences.pausedHint')}</Text>
                      )}
                    </View>

                  </View>
                  <View style={styles.dashedDivider} />
                </>
              )}

              {/* Dividido com */}
              <Text style={styles.sectionHeader}>{t('expenseDetail.splitWithHeader')}</Text>
              {expense.participants.map(p => {
                const shareLabel = formatMoney(Math.abs(p.shareAmount));
                return (
                <View key={p.userId} style={styles.splitRow}>
                  <Avatar name={p.name} id={p.userId} photoUrl={p.photoUrl ?? undefined} size={40} variant="colorful" />
                  <View style={styles.splitNameCol}>
                    <View style={styles.splitNameRow}>
                      <Text style={styles.splitName} numberOfLines={1}>{p.isMe ? t('common.youCapitalized') : p.name}</Text>
                      {expense.splitType === 'shares' && (
                        <Text style={styles.splitPartesChip} numberOfLines={1}>· {partesLabel(p.shares ?? 1, t)}</Text>
                      )}
                    </View>
                    {p.userId === expense.paidById && <Text style={styles.paidTag}>{t('common.paidTag')}</Text>}
                  </View>
                  <View style={styles.splitShareCol}>
                    <Text style={styles.splitShare}>{shareLabel}</Text>
                  </View>
                </View>
                );
              })}

              <View style={styles.dashedDivider} />

              {/* Comprovante */}
              <Text style={styles.sectionHeader}>{t('expenseDetail.receiptHeader')}</Text>
              {!receiptUrl && expense.receiptPath ? (
                /* Tem comprovante no Storage, mas a URL assinada não veio — é
                   chamada de rede, e sem internet ela falha. Dizer "sem
                   comprovante" aqui seria mentira. */
                <View style={styles.noReceiptPill}>
                  <CloudOff size={16} color={colors.textSecondary} strokeWidth={1.8} />
                  <Text style={styles.noReceiptLabel}>{t('expenseForm.receiptUnavailable')}</Text>
                </View>
              ) : receiptUrl ? (
                <TouchableOpacity
                  onPress={() => { setFullReceiptFailed(false); setShowComprovante(true); }}
                  activeOpacity={0.92}
                  style={styles.comprovanteWrapper}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={t('expenseDetail.viewReceipt')}
                >
                  <Image source={{ uri: receiptUrl }} style={styles.comprovanteInline} resizeMode="cover" />
                  {/* Ícone, e não a palavra "Ver": o badge está DENTRO do mesmo
                      toque da imagem e nunca teve onPress próprio — ele só
                      avisa que a foto amplia, porque foto parada não parece
                      tocável. Escrito, parecia um botão concorrendo com a
                      imagem, e quem tocava na foto ficava sem entender pra que
                      servia o botão. A seta diagonal é a convenção de ampliar e
                      não promete uma segunda ação. */}
                  <View style={styles.comprovanteViewBadge}>
                    <Maximize2 size={14} color={colors.white} strokeWidth={2.4} />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.noReceiptPill}>
                  <ImageIcon size={16} color={colors.textSecondary} strokeWidth={1.8} />
                  <Text style={styles.noReceiptLabel}>{t('expenseDetail.noReceipt')}</Text>
                </View>
              )}

              <View style={styles.dashedDivider} />

              {/* Totalizador */}
              <View style={styles.totalizerRow}>
                <Text style={[styles.totalizerLabel, totalizer.italic && styles.totalizerLabelItalic]}>
                  {totalizer.label}
                </Text>
                <View style={styles.totalizerValueCol}>
                  <Text style={[styles.totalizerValue, { color: totalizer.color }]}>
                    {totalizerLabel !== null ? `${totalizer.prefix}${totalizerLabel}` : '—'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cupomId}>#{shortId}</Text>
            </View>

            {/* Ações — fora do cupom */}
            {canManageExpense && (
              <View style={styles.actionsGrid}>
                <TouchableOpacity style={styles.editActionBtn} onPress={openEditModal} activeOpacity={0.7}>
                  <Pencil size={16} color={colors.textPrimary} strokeWidth={2} />
                  <Text style={styles.editActionLabel}>{t('expenseDetail.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteActionBtn}
                  onPress={() => setDeleteConfirmOpen(true)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                  <Text style={styles.deleteActionLabel}>{t('expenseDetail.delete')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Modal comprovante */}
          <Modal visible={showComprovante} animationType="fade" transparent statusBarTranslucent>
            <TouchableWithoutFeedback onPress={() => setShowComprovante(false)}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                  <View style={styles.modalContent}>
                    {receiptUrl && !fullReceiptFailed && (
                      <Image
                        source={{ uri: receiptUrl }}
                        style={styles.comprovanteFullImage}
                        resizeMode="contain"
                        onError={() => setFullReceiptFailed(true)}
                      />
                    )}
                    {fullReceiptFailed && (
                      <View style={styles.fullReceiptFailed}>
                        <CloudOff size={28} color={colors.white} strokeWidth={1.8} />
                        <Text style={styles.fullReceiptFailedLabel}>{t('expenseForm.receiptUnavailable')}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.modalClose}
                      onPress={() => setShowComprovante(false)}
                      hitSlop={8}
                    >
                      <X size={18} color={colors.white} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {/* Modal editar despesa */}
          <Modal
            visible={editModalOpen}
            animationType="slide"
            transparent
            onRequestClose={() => setEditModalOpen(false)}
          >
            {/* <Modal> do RN roda numa raiz nativa separada, fora do GestureHandlerRootView
                de app/_layout.tsx — sem esse wrapper aqui, o scroll do form de edição fica
                "preso" até algum fallback nativo liberar (mesmo bug já resolvido em
                BottomSheetModal.tsx e em grupo/lancar.tsx). */}
            <GestureHandlerRootView style={styles.editGestureRoot}>
            <Pressable style={styles.sheetOverlay} onPress={() => setEditModalOpen(false)}>
              <Pressable style={styles.sheetCard} onPress={() => {}}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{t('expenseDetail.editTitle')}</Text>
                  <TouchableOpacity
                    style={styles.sheetCloseBtn}
                    onPress={() => setEditModalOpen(false)}
                    hitSlop={8}
                    activeOpacity={0.7}
                  >
                    <X size={22} color={colors.textPrimary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                <View style={styles.editKeyboardView}>
                <KeyboardAwareScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.editScroll}
                  contentContainerStyle={styles.editScrollContent}
                  keyboardShouldPersistTaps="handled"
                  bottomOffset={16}
                >
                  <ExpenseFormFields
                    members={groupMembers}
                    form={editForm}
                    categorySlot={(
                      <>
                        <Text style={styles.categoryLabel}>{t('lancar.categoryLabel')}</Text>
                        {/* Ícone na bolinha da cor — o mesmo par que a despesa
                            mostra na lista, no hero e no seletor, então o campo
                            já é uma prévia do resultado. Chip de 36 pra casar
                            com o de 'Tornar recorrente', que é o campo logo
                            abaixo e tem a mesma altura de 52.
                            Sem categoria usa o cinza que o Insight dá ao balde
                            dos sem categoria — diz a verdade. */}
                        <TouchableOpacity style={styles.categoryRow} onPress={() => setPickingCategory(true)} activeOpacity={0.7}>
                          <View style={[
                            styles.categoryIconChip,
                            { backgroundColor: getCategoryChipColor(editSelectedCategory?.color ?? DEFAULT_CATEGORY_COLOR) },
                          ]}>
                            <CategoryIcon
                              icon={editSelectedCategory?.icon}
                              size={20}
                              color={editSelectedCategory?.color ?? DEFAULT_CATEGORY_COLOR}
                            />
                          </View>
                          <Text style={styles.categoryName} numberOfLines={1}>
                            {editSelectedCategory ? editSelectedCategory.name : t('common.categoryFallback')}
                          </Text>
                          <ChevronRight size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </>
                    )}
                    receiptUnavailable={!receiptUrl && !!expense.receiptPath}
                    recurrenceOptional={!isAlreadyRecurring}
                    recurrenceSlot={(
                      <Pressable style={styles.recurringRow} onPress={handleRecurringRowPress}>
                        <View style={styles.recurringIconChip}>
                          <Repeat size={18} color={colors.textPrimary} strokeWidth={2} />
                        </View>
                        <View style={styles.recurringTextCol}>
                          <Text style={styles.recurringLabel}>{t('expenseForm.makeRecurring')}</Text>
                          {isAlreadyRecurring && pendingPauseRecurrence ? (
                            <Text style={styles.recurringSubtitle}>{t('expenseForm.recurringCancelPending')}</Text>
                          ) : displayedRecurrenceConfig && (
                            <Text style={styles.recurringSubtitle}>
                              {describeRecurrenceSummary(displayedRecurrenceConfig, t)}
                              {' · '}{t('expenseForm.tapToEdit')}
                            </Text>
                          )}
                        </View>
                        <Switch
                          value={isAlreadyRecurring ? !pendingPauseRecurrence : !!editForm.recurrence}
                          onValueChange={handleRecurringSwitchToggle}
                        />
                      </Pressable>
                    )}
                  />
                </KeyboardAwareScrollView>

                <KeyboardStickyView>
                  <View style={[styles.editFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
                    <Button
                      label={t('expenseDetail.saveChanges')}
                      onPress={handleSaveEdit}
                      disabled={!editForm.canSubmit}
                    />
                  </View>
                </KeyboardStickyView>
                </View>
              </Pressable>
            </Pressable>

            {/* Empilha POR CIMA do Modal de editar (nested — sem abrir um
                segundo <Modal> nativo), mantendo o formulário visível atrás. */}
            {/* Alcance da edição numa despesa recorrente. `nested`, e no mesmo
                nível do seletor de categoria: o Modal de editar é nativo e
                cobriria um sheet declarado fora dele — foi o que aconteceu na
                primeira versão, e salvar parecia não fazer nada.

                Sheet, e não Alert: são duas opções com consequência diferente e
                a pessoa precisa ler antes de escolher. */}
            <ConfirmSheet
              nested
              visible={!!pendingSave}
              onClose={() => setPendingSave(null)}
              title={t('expenseDetail.editScopeTitle')}
              options={[
                {
                  label: t('expenseDetail.editScopeOnlyThis'),
                  hint: t('expenseDetail.editScopeOnlyThisHint'),
                  onPress: () => pendingSave && commitEdit(pendingSave.participants, pendingSave.title, false),
                },
                {
                  label: t('expenseDetail.editScopeFuture'),
                  hint: t('expenseDetail.editScopeFutureHint'),
                  onPress: () => pendingSave && commitEdit(pendingSave.participants, pendingSave.title, true),
                },
              ]}
            />

            <BottomSheetModal nested visible={pickingCategory} onClose={() => setPickingCategory(false)}>
              <CategoryPickerBody
                groupId={expense.groupId}
                selectedCategoryId={editCategoryId}
                onSelect={category => { setEditCategoryId(category.id); setPickingCategory(false); }}
                onRequestClose={() => setPickingCategory(false)}
              />
            </BottomSheetModal>

            <RecurrenceSheet
              visible={recurrenceSheetOpen}
              onClose={() => setRecurrenceSheetOpen(false)}
              expenseDate={editForm.date}
              initial={displayedRecurrenceConfig}
              onConfirm={handleRecurrenceConfirm}
              startEditable={!isAlreadyRecurring}
            />
            </GestureHandlerRootView>
          </Modal>

          <LimitPaywallSheet
            visible={limitReason != null}
            reason={limitReason ?? 'recurring'}
            onClose={() => setLimitReason(null)}
            onUpgrade={handleUpgradeFromLimit}
          />

          {/* Sheet confirmar exclusão — mesmo componente e mesmas opções do
              caminho pelo swipe da lista (grupo/[id].tsx). */}
          <ConfirmSheet
            visible={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            title={t('expenseDetail.deleteConfirmTitle')}
            description={t('expenseDetail.deleteConfirmBody', { title: expense.title, amount: heroAmountLabel })}
            confirmLabel={t('expenseDetail.deleteAction')}
            onConfirm={() => handleApagar(false)}
            variant="danger"
            options={askDeleteScope ? [
              {
                label: t('expenseDetail.deleteScopeOnlyThis'),
                hint: t('expenseDetail.deleteScopeOnlyThisHint'),
                danger: true,
                onPress: () => handleApagar(false),
              },
              {
                label: t('expenseDetail.deleteScopeFuture'),
                hint: t('expenseDetail.deleteScopeFutureHint'),
                danger: true,
                onPress: () => handleApagar(true),
              },
            ] : undefined}
          >
            {warnSeriesContinues && (
              <Text style={styles.deleteRecurrenceHint}>{t('expenseDetail.deleteSeriesContinues')}</Text>
            )}
            {deleteEndsSeries && (
              <Text style={styles.deleteRecurrenceHint}>{t('expenseDetail.deleteEndsSeries')}</Text>
            )}
            {orphanedMembers.length > 0 && (
              <View style={styles.deleteWarningBox}>
                <Text style={styles.deleteWarningTitle}>{t('expenseDetail.deleteLastExpenseWarningTitle')}</Text>
                {orphanedMembers.map(m => (
                  <Text key={m.id} style={styles.deleteWarningLine}>
                    {t('expenseDetail.deleteLastExpenseWarningLine', {
                      name: m.name,
                      amount: formatMoney(Math.abs(paymentsOnlyBalances[m.id] ?? 0)),
                    })}
                  </Text>
                ))}
              </View>
            )}
          </ConfirmSheet>

        </>
      )}

    </View>
  );
}

const createStyles = (colors: ColorPalette, resolvedScheme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flex: 1,
    // bg-brand-mustard/10 no protótipo web (light) — mostarda de marca a 10%
    // de opacidade por cima do fundo. Sem equivalente definido pro dark: o
    // wash mostarda em cima de fundo escuro lia estranho, então dark usa o
    // mesmo par background/surface (fundo escuro + cupom "elevado") que o
    // resto do app já usa pra dar contraste sem depender de cor de marca.
    backgroundColor: resolvedScheme === 'dark' ? colors.background : 'rgba(245,197,24,0.1)',
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
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
    fontFamily: fontFamilies.semibold,
    color: colors.primary,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.sm,
  },
  headerBackBtn: {
    alignSelf: 'center',
    marginBottom: 0,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },

  // ── Content ─────────────────────────────────────────────────────────────────
  content: {
    paddingTop: spacing.lg,
  },

  // ── Cupom ───────────────────────────────────────────────────────────────────
  cupom: {
    marginHorizontal: spacing.pagePadding,
    borderRadius: radius['2xl'],
    // Light: branco puro sobre o wash mostarda. Dark: sem wash de cor, então
    // usa `surface` (mais claro que o container) pra continuar parecendo
    // "elevado" — mesmo par que BottomSheetModal usa em todo o app.
    backgroundColor: resolvedScheme === 'dark' ? colors.surface : colors.background,
    overflow: 'hidden',
    ...shadows.balance,
  },
  cupomHeader: {
    alignItems: 'center',
    gap: 2,
    paddingTop: spacing.lg,
  },
  cupomLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  cupomGroupName: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Hero ────────────────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroCatCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: fontSizes.h1,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  // ── Categoria (só no formulário de editar) ──────────────────────────────────
  categoryLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    // 52 é a altura do Input (ver components/Input.tsx) — a categoria é um
    // campo do mesmo formulário e estava mais baixa só porque a altura vinha do
    // conteúdo, não de um número.
    height: 52,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surface,
  },
  // Mesmos 10px da bolinha do Insight e do seletor.
  categoryIconChip: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },

  heroCategory: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  heroAmount: {
    fontSize: fontSizes.heroSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  heroAmountSecondary: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  heroRateLine: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  heroRateLineStrong: {
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  heroCurrencyChip: {
    marginTop: spacing.sm,
  },

  // ── Dividers ─────────────────────────────────────────────────────────────────
  dashedDivider: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },

  // ── Info rows ────────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.md,
  },
  infoLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    textAlign: 'right',
    flexShrink: 1,
  },
  infoValueRegular: {
    fontFamily: fontFamilies.regular,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Inverte junto com o cupom (ver `cupom` acima): no claro o cupom é branco,
  // então a caixa precisa ser `surface` pra aparecer; no escuro o cupom é
  // `surface` e a caixa desce pra `background`. Antes era `background` nos
  // dois, o que a deixava BRANCA SOBRE BRANCA no tema claro — invisível.
  recurrenceStatusCard: {
    padding: spacing.sm + 4,
    borderRadius: radius.xl,
    backgroundColor: resolvedScheme === 'dark' ? colors.background : colors.surface,
    gap: spacing.xs,
  },
  recurrenceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  recurrenceStatusLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recurrenceStatusValue: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  recurrenceStatusFinished: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Seções (Dividido com / Comprovante) ──────────────────────────────────────
  sectionHeader: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.md,
  },
  splitNameCol: {
    flex: 1,
    gap: 2,
  },
  splitNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  splitName: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  splitPartesChip: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  paidTag: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  splitShareCol: {
    alignItems: 'flex-end',
  },
  splitShare: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  splitShareSecondary: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },

  // ── Totalizador ──────────────────────────────────────────────────────────────
  totalizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  totalizerLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  totalizerLabelItalic: {
    fontStyle: 'italic',
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  totalizerValueCol: {
    alignItems: 'flex-end',
  },
  totalizerValue: {
    fontSize: fontSizes.h1,
    fontFamily: fontFamilies.semibold,
  },
  totalizerValueSecondary: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  cupomId: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingTop: 2,
    paddingBottom: spacing.lg,
  },

  // ── Ações (fora do cupom) ─────────────────────────────────────────────────────
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.pagePadding,
    marginTop: spacing.lg,
  },
  editActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editActionLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  deleteActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  deleteActionLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.danger,
  },
  recurrenceCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  recurrenceTitleRow: {
    flexDirection: 'row',
    // Topo, e não centro: com duas linhas de texto ao lado de um ícone de
    // 16px, centralizar deixaria o glifo boiando no meio do parágrafo.
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
  },
  recurrenceTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
    // Alinha a primeira linha com o ícone, que é menor que a caixa do texto.
    lineHeight: 18,
  },
  recurrenceSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  // ── Comprovante ──────────────────────────────────────────────────────────────
  comprovanteWrapper: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    // O divisor tracejado é uma View de altura zero, sem margem própria — o
    // respiro abaixo do comprovante tem que sair daqui. Sem isto a foto encosta
    // na linha; o estado vazio (noReceiptPill) já tinha a mesma margem.
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  comprovanteInline: {
    width: '100%',
    height: 200,
  },
  comprovanteViewBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: 'rgba(21,27,36,0.6)',
  },
  noReceiptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  noReceiptLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  fullReceiptFailed: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  fullReceiptFailedLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.white,
    textAlign: 'center',
  },

  // ── Modal comprovante ────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  comprovanteFullImage: {
    width: '100%',
    height: '80%',
  },
  modalClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Sheet: editar despesa ────────────────────────────────────────────────────
  editGestureRoot: {
    flex: 1,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(21,27,36,0.4)',
  },
  // Altura DEFINIDA, não um teto — mesmo motivo de grupo/lancar.tsx: com
  // altura automática o ScrollView de dentro guarda métrica velha e o scroll
  // só destrava depois de um arrasto pra cima e outro pra baixo.
  sheetCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingTop: spacing.lg,
    // maxHeight, e não height: a folha acompanha o conteúdo e só para de
    // crescer em 92% da tela. Com altura FIXA ela ocupava 92% sempre, e
    // formulário curto deixava um vão morto entre o último campo e o botão.
    // Mesmo padrão do BottomSheetModal do projeto.
    maxHeight: '92%',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    marginBottom: spacing.sm,
  },
  sheetCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    flex: 1,
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  // flexShrink, e não flex: 1. Com o card sem altura fixa (ver sheetCard),
  // `flex: 1` significa flexBasis 0 — sem espaço livre pra crescer, o conteúdo
  // colapsaria pra altura zero. Assim ele nasce do tamanho do conteúdo e só
  // encolhe quando o card bate no teto, que é quando o scroll passa a valer.
  editKeyboardView: {
    flexShrink: 1,
  },

  // ── Tornar recorrente ─────────────────────────────────────────────────────────
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    // 8 + chip de 36 + 8 = os mesmos 52 dos outros campos. Não é altura fixa
    // porque esta linha cresce quando ganha o subtítulo com o resumo da
    // recorrência — aí duas linhas precisam de mais espaço, e devem ter.
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

  // Mesmo motivo do editKeyboardView acima.
  editScroll: {
    flexShrink: 1,
  },
  editPickerBody: {
    paddingHorizontal: spacing.pagePadding,
  },
  editScrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
  },
  editFooter: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
  },

  // ── Sheet: confirmar exclusão ─────────────────────────────────────────────────
  // O sheet é o ConfirmSheet; aqui ficam só os avisos que entram como children.
  //
  // Informação, não alarme — mesma linha e mesmo estilo do sheet equivalente
  // em grupo/[id].tsx, pra os dois caminhos de apagar dizerem o mesmo.
  deleteRecurrenceHint: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  deleteWarningBox: {
    backgroundColor: hexToRgba(colors.coral, 0.1),
    borderRadius: radius.lg,
    padding: spacing.sm + 4,
    gap: 2,
    marginBottom: spacing.md,
  },
  deleteWarningTitle: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.coral,
    marginBottom: 2,
  },
  deleteWarningLine: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.coral,
  },
});
