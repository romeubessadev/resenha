import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { ChevronRight, MoreHorizontal, Pencil, Plus, Repeat, Trash2, X, QrCode, Receipt, Search } from 'lucide-react-native';
import Animated, { Easing, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, AvatarStack, BackButton, Button, ConfirmSheet, EditGroupSheet, CategoryIcon, ExpenseListSkeleton, GroupDetailSkeleton, GroupOptionsSheet, HistoryFeed, InviteQrSheet, LeaveGroupSheet, LimitPaywallSheet, PhotoViewerModal, PullToRefresh, RecurringExpensesSheet, SettleUpSheet, SummaryStatsSkeleton, SwipeTabs } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { ArchiveNotSettledError, useGroup, useSetGroupArchived } from '@/hooks/useGroup';
import { useGroupBalances } from '@/hooks/useGroupBalances';
import { useExpenses, useDeleteExpense, type LancamentoItem } from '@/hooks/useExpenses';
import { useExpenseRecurrenceInfo } from '@/hooks/useExpenseRecurrenceInfo';
import { useGroupRecurrences } from '@/hooks/useGroupRecurrences';
import { useCategories, findCategory } from '@/hooks/useCategories';
import { useGroupHistory } from '@/hooks/useGroupHistory';
import { RoleLimitError } from '@/hooks/useGroups';
import { useIsPremium } from '@/hooks/usePlan';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import type { Language } from '@/lib/i18n';
import { getGroupAvatarUrl } from '@/lib/groupAvatar';
import { getCategoryChipColor, hexToRgba } from '@/lib/categoryColors';
import { formatMoney } from '@/lib/currencies';
import { formatDayLabel, formatRelativeTime } from '@/lib/formatRelativeTime';
import { parseDateOnly } from '@/lib/recurrence';
import { fontFamilies, fontSizes, spacing, radius, shadows, type ColorPalette } from '@/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'resumo' | 'despesas' | 'saldos' | 'historico';
const TAB_ORDER: Tab[] = ['resumo', 'despesas', 'saldos', 'historico'];

// Avatares já pré-carregados nessa sessão do app — evita re-esperar o
// Image.prefetch (e flashar o skeleton inteiro) toda vez que se revisita
// um rolê cuja foto já foi carregada antes.
const prefetchedAvatarUrls = new Set<string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayLabel(iso: string, language: Language): string {
  // Extrai ano/mês/dia direto da string, sem passar por new Date(iso) —
  // esse parse trata o timestamp como instante UTC, e uma despesa gravada
  // à meia-noite UTC (ex.: materializada pelo cron) já vira o dia anterior
  // em qualquer fuso negativo (Brasil, EUA), classificando errado como "Ontem".
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  return formatDayLabel(new Date(year, month - 1, day), language);
}

function groupByDay(items: LancamentoItem[], language: Language): { label: string; items: LancamentoItem[] }[] {
  const groups: { label: string; items: LancamentoItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.date, language);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

// Linha da lista virtualizada de despesas — achata os grupos por dia num único
// array (header + itens) pra caber num FlatList, que precisa de uma lista
// plana pra virtualizar (só monta as linhas visíveis em tela, mesmo com
// centenas de despesas no rolê).
// Busca sem acento: "jose" acha "José", "voce" acha "você". Mesma técnica do
// slugify em lib/insightsExport.ts — a regex é montada por fromCharCode em vez
// de literal.
const DIACRITICS_REGEX = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function foldCase(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS_REGEX, '').toLowerCase();
}

type DespesaListRow =
  | { kind: 'header'; label: string }
  | { kind: 'expense'; item: LancamentoItem };

function buildDespesaListRows(items: LancamentoItem[], language: Language): DespesaListRow[] {
  return groupByDay(items, language).flatMap(group => [
    { kind: 'header' as const, label: group.label },
    ...group.items.map(item => ({ kind: 'expense' as const, item })),
  ]);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function GroupDetailScreen() {
  const insets    = useSafeAreaInsets();
  const { id, tab: tabParam, action, focusUserId } = useLocalSearchParams<{
    id: string; tab?: string; action?: string; focusUserId?: string;
  }>();
  const { session } = useAuth();
  const myUserId = session?.user.id;
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: group, error: groupError, refetch: refetchGroup } = useGroup(id);
  const { balances, transfers, paymentsOnlyBalances, isInitialLoading: balancesInitialLoading, refetch: refetchBalances } = useGroupBalances(id);
  const { data: lancamentos, isInitialLoading: expensesInitialLoading, error: expensesError, refetch: refetchExpenses } = useExpenses(id);
  const { data: categories } = useCategories(id);
  // Mesma queryKey do HistoryFeed — o React Query compartilha o cache entre as
  // duas chamadas, então ler `data` aqui não custa rede nenhuma.
  const { data: history, refetch: refetchHistory } = useGroupHistory(id);
  const { setGroupArchived, loading: archiving } = useSetGroupArchived();
  const { recurrences } = useGroupRecurrences(id);
  const isPremium = useIsPremium();
  // Sem estado de "apagando": a despesa some da lista assim que se confirma, e
  // a subida acontece em segundo plano (ou fica na fila, sem rede).
  const { deleteExpense } = useDeleteExpense();

  const avatarUrl = getGroupAvatarUrl(group?.avatarPath);

  const [activeTab,     setActiveTab]     = useState<Tab>(tabParam === 'saldos' ? 'saldos' : 'resumo');
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [settleUpOpen, setSettleUpOpen] = useState(false);
  const [limitSheetOpen, setLimitSheetOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [recurringSheetOpen, setRecurringSheetOpen] = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [avatarLoaded,  setAvatarLoaded]  = useState(() => !avatarUrl || prefetchedAvatarUrls.has(avatarUrl));
  const [deleteTarget, setDeleteTarget] = useState<LancamentoItem | null>(null);
  // Só 1 linha aberta por vez no swipe — abrir uma nova fecha a anterior
  // (Swipeable não faz isso sozinho, cada instância é independente).
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const openSwipeableIdRef = useRef<string | null>(null);
  function handleSwipeableWillOpen(expenseId: string) {
    const prevId = openSwipeableIdRef.current;
    if (prevId && prevId !== expenseId) swipeableRefs.current.get(prevId)?.close();
    openSwipeableIdRef.current = expenseId;
  }

  // Sem await: a despesa já saiu da lista e do saldo pelo efeito otimista, e
  // sem rede a exclusão fica pausada na fila — esperar aqui travaria o sheet
  // até a internet voltar.
  function handleConfirmDeleteExpense(pauseSeries: boolean) {
    if (!deleteTarget) return;
    deleteExpense(deleteTarget.id, id ?? '', deleteTarget.recurrenceId ?? null, pauseSeries, () =>
      Alert.alert(t('expenseDetail.deleteFailedTitle'), t('common.tryAgain')));
    setDeleteTarget(null);
  }

  // Ação a disparar só depois que o menu de opções terminar de fechar de
  // verdade — abrir um segundo Modal nativo antes disso pode travar a
  // apresentação (dois Modals disputando a transição ao mesmo tempo).
  const afterMenuCloseRef = useRef<(() => void) | null>(null);
  function handleMenuClosed() {
    const action = afterMenuCloseRef.current;
    afterMenuCloseRef.current = null;
    action?.();
  }

  // Deep-link da Carteira: chega com action=settle pra abrir "Acertar contas"
  // direto (só uma vez — não reabre se a pessoa fechar o sheet). Depende de
  // `action` (não só monta com []) porque no primeiro render após o push os
  // search params às vezes ainda não chegaram, e sem isso a condição falha
  // pra sempre e o sheet nunca abre. O delay espera a animação de entrada da
  // própria tela terminar — abrir o <Modal> nativo do sheet no meio dela
  // disputa a transição e a apresentação pode ser descartada (mesmo motivo
  // do afterMenuCloseRef acima).
  const settleDeepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (settleDeepLinkHandledRef.current || action !== 'settle') return;
    settleDeepLinkHandledRef.current = true;
    const timer = setTimeout(() => setSettleUpOpen(true), 400);
    return () => clearTimeout(timer);
  }, [action]);

  // Posição de scroll da aba ativa — o PullToRefresh só puxa quando está em 0.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  // Troca de aba (Resumo ↔ Despesas ↔ Saldos ↔ Histórico) por swipe horizontal —
  // mesmo componente/padrão da tabbar de baixo (Rolês ↔ Carteira ↔ Perfil). Não
  // troca com algum sheet aberto por cima, pra não confundir com o gesto do sheet.
  const sheetsOpen = menuOpen || editSheetOpen || inviteSheetOpen || leaveSheetOpen
    || settleUpOpen || limitSheetOpen || paywallOpen || !!deleteTarget || photoViewerOpen;
  function goToAdjacentTab(direction: 1 | -1) {
    if (sheetsOpen) return;
    const nextIndex = TAB_ORDER.indexOf(activeTab) + direction;
    if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) return;
    scrollY.value = 0;
    setActiveTab(TAB_ORDER[nextIndex]);
  }

  // Colapso do hero/card de saldo pra faixa compacta durante a busca.
  // heroHeightSV começa null (altura natural, sem animação) até o primeiro
  // onLayout medir o bloco cheio — daí em diante anima entre 0 e essa altura.
  const heroCollapse = useSharedValue(1);
  const heroHeightSV = useSharedValue<number | null>(null);

  const members   = group?.members ?? [];
  const groupName = group?.name ?? t('groupDetail.fallbackName');
  const myRole = members.find(m => m.isMe)?.role ?? 'member';
  const isOwner = myRole === 'owner';
  const isAdminOrOwner = myRole === 'owner' || myRole === 'admin';

  // Apagar a última despesa do rolê pode deixar alguém com saldo pendente
  // (pagamento já confirmado, sem mais nenhuma despesa por perto pra
  // explicar o motivo) — ver hooks/useGroupBalances.ts. Avisa antes de
  // confirmar, sem mexer em nada automaticamente.
  const isLastExpense = !!deleteTarget && lancamentos.filter(l => l.type === 'expense').length === 1;
  const orphanedMembers = isLastExpense
    ? members.filter(m => Math.abs(paymentsOnlyBalances[m.id] ?? 0) > 0.005)
    : [];

  // Apagar uma ocorrência de série viva tem duas leituras — some só ela, ou
  // some ela e a repetição para. Série pausada ou finalizada não gera mais
  // nada, então a exclusão volta a ser a de sempre (mesma regra do detalhe).
  //
  // Enquanto a consulta não responde, assume viva: é o caso comum, e a opção
  // "só esta" faz exatamente o que o sheet sem escolha faria — errar pra esse
  // lado nunca apaga nem para nada a mais.
  //
  // E só pra quem pode mesmo pausar: a policy expense_recurrences_update_
  // owner_or_admin é do criador da receita ou admin/dono do rolê. Quem só pagou
  // a despesa apaga a ocorrência, mas o update da série seria filtrado pela RLS
  // sem afetar linha nenhuma — a opção prometeria parar a repetição e não
  // pararia, calada.
  const { info: deleteRecurrence, loading: deleteRecurrenceLoading } =
    useExpenseRecurrenceInfo(deleteTarget?.recurrenceId);
  const canPauseRecurrence = isAdminOrOwner
    || (!!deleteRecurrence && deleteRecurrence.createdBy === myUserId);
  // Última ocorrência da série: não há alcance a perguntar, porque não sobra
  // futuro — a série é encerrada junto (ver deleteExpenseMutationFn). Só avisa.
  const seriesOccurrences = deleteTarget?.recurrenceId
    ? lancamentos.filter(l => l.type === 'expense' && l.recurrenceId === deleteTarget.recurrenceId).length
    : 0;
  const deleteEndsSeries = !!deleteTarget?.recurrenceId && seriesOccurrences <= 1
    && (deleteRecurrenceLoading || !!deleteRecurrence);

  const deleteHitsLiveSeries = !!deleteTarget?.recurrenceId && !deleteEndsSeries
    && (deleteRecurrenceLoading || (!!deleteRecurrence?.active && !deleteRecurrence.paused));
  const askDeleteScope = deleteHitsLiveSeries && canPauseRecurrence;
  // Quem não pode pausar apaga só a ocorrência e a série segue lançando. Sem
  // esta linha ele apagaria achando que parou a repetição — a pergunta de
  // alcance, que é onde isso está escrito, nunca aparece pra ele.
  const warnSeriesContinues = deleteHitsLiveSeries && !canPauseRecurrence;

  // A lista já vem ordenada por próxima cobrança, então a 1ª ativa é a que
  // cobra primeiro — é a data que o card do Resumo anuncia.
  const activeRecurrences = recurrences.filter(r => r.status === 'active');
  // Arquivar exige saldo zerado, mas o materializador não olha
  // `archived_at`: a série continua lançando e o saldo volta a mexer — num rolê
  // que saiu da lista de ativos e não entra mais no "Saldo geral". A regra
  // protege o momento do arquivamento e não o dia seguinte, então aqui o app
  // avisa. Pagador ou participante dá no mesmo: os dois mexem no saldo.
  const myActiveRecurrences = activeRecurrences.filter(r =>
    !!myUserId && (r.paidBy === myUserId || r.participantIds.includes(myUserId)));
  const nextRecurrenceLabel = activeRecurrences.length > 0
    ? parseDateOnly(activeRecurrences[0].nextRunDate).toLocaleDateString(language, { day: 'numeric', month: 'long' })
    : '';

  // Navegar com o sheet ainda aberto empurra a tela nova por baixo de um
  // <Modal> nativo que só some depois — a despesa abriria "atrás" do escuro.
  // Igual ao menu de opções, a ida espera o fechamento terminar de verdade.
  const afterRecurringCloseRef = useRef<string | null>(null);
  function handleRecurringClosed() {
    const despesaId = afterRecurringCloseRef.current;
    afterRecurringCloseRef.current = null;
    if (!despesaId) return;
    router.push({
      pathname: '/(app)/grupo/despesa' as never,
      params: { groupId: id ?? '', despesaId, groupName },
    });
  }

  // Pré-carrega a foto do grupo fora da árvore (o skeleton substitui a tela
  // inteira, então o <Avatar>/<Image> real nunca chega a montar pra disparar
  // onLoad sozinho — precisa ser o Image.prefetch mesmo).
  useEffect(() => {
    if (!avatarUrl || prefetchedAvatarUrls.has(avatarUrl)) {
      setAvatarLoaded(true);
      return;
    }
    setAvatarLoaded(false);
    let cancelled = false;
    Image.prefetch(avatarUrl)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          prefetchedAvatarUrls.add(avatarUrl);
          setAvatarLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [avatarUrl]);

  const membersLabel   = `${members.length} ${members.length === 1 ? t('groupDetail.memberSingular') : t('groupDetail.memberPlural')}`;
  // `history[0]` é o evento mais recente (a query já vem `order('at', desc)`) e
  // é o que faz apagar despesa contar como atividade: despesa é hard delete, e
  // sem o log a conta olhava só as linhas vivas e ANDAVA PRA TRÁS ao apagar a
  // mais recente. Idem editar despesa, membro entrar/sair, renomear o rolê.
  //
  // Os lançamentos continuam na conta porque rolê antigo não tem
  // evento nenhum. `createdAt`, não `date`: atividade é quando algo aconteceu,
  // e a data da despesa pode ser retroativa ou futura. Mesma conta de useGroups,
  // pra lista e detalhe baterem.
  const lastActivityIso = [group?.createdAt, history[0]?.at, ...lancamentos.map(l => l.createdAt)]
    .filter((d): d is string => !!d)
    .reduce<string | null>((latest, d) => (!latest || d > latest ? d : latest), null);
  const heroSubtitle    = lastActivityIso
    ? t('groupDetail.lastActivity', { members: membersLabel, time: formatRelativeTime(lastActivityIso, language) })
    : membersLabel;

  async function archiveGroup(groupId: string) {
    try {
      await setGroupArchived(groupId, true);
    } catch (err) {
      if (err instanceof ArchiveNotSettledError) {
        Alert.alert(t('groupDetail.archiveNotSettledTitle'), t('groupDetail.archiveNotSettledBody'));
        return;
      }
      Alert.alert(t('groupDetail.archiveFailedTitle'), t('common.tryAgain'));
    }
  }

  function handleSubscribe() {
    setPaywallOpen(false);
    Alert.alert(t('limitPaywall.cta'), t('paywall.notAvailableYet'));
  }

  // Desarquivar não pergunta nada: é reversível e não mexe em dado de ninguém.
  // Arquivar some com o rolê da lista, então confirma.
  function handleToggleArchive() {
    if (!group) return;
    if (group.archivedAt) {
      setGroupArchived(group.id, false).catch(err => {
        if (err instanceof RoleLimitError) {
          setLimitSheetOpen(true);
          return;
        }
        Alert.alert(t('groupDetail.archiveFailedTitle'), t('common.tryAgain'));
      });
      return;
    }
    setArchiveConfirmOpen(true);
  }

  async function handleConfirmArchive() {
    if (!group) return;
    await archiveGroup(group.id);
    setArchiveConfirmOpen(false);
  }

  const netBalance = myUserId ? (balances[myUserId] ?? 0) : 0;
  const otherMembers = members
    .filter(m => !m.isMe)
    .map(m => ({ id: m.id, name: m.name, joinedAt: m.joinedAt, role: m.role, balance: balances[m.id] ?? 0 }));

  // Puxar em qualquer aba atualiza tudo — Resumo, Despesas, Saldos e Histórico
  // usam hooks independentes (não reagem ao refetch um do outro sozinhos).
  async function handleRefresh() {
    await Promise.all([refetchExpenses(), refetchBalances(), refetchGroup(), refetchHistory()]);
  }

  // ── Resumo ───────────────────────────────────────────────────────────────
  const vouPaguei = lancamentos
    .filter(l => l.type === 'expense' && l.paidByMe)
    .reduce((s, l) => s + l.amount, 0);

  const totalDespesas = lancamentos
    .filter(l => l.type === 'expense')
    .reduce((s, l) => s + l.amount, 0);

  const aReceber = transfers
    .filter(t => t.toUserId === myUserId)
    .reduce((s, t) => s + t.amount, 0);

  const vouDevo = transfers
    .filter(t => t.fromUserId === myUserId)
    .reduce((s, t) => s + t.amount, 0);

  const netBalanceLabel  = netBalance > 0 ? t('groupDetail.netReceivable')
                         : netBalance < 0 ? t('groupDetail.netOwed')
                         : t('groupDetail.netEven');
  const netBalanceColor  = netBalance > 0 ? colors.forest
                         : netBalance < 0 ? colors.coral
                         : colors.textPrimary;
  const netBalancePrefix = netBalance > 0 ? '+ ' : netBalance < 0 ? '− ' : '';
  const netBalanceShortLabel = netBalance > 0 ? t('groupDetail.netReceivableShort') : netBalance < 0 ? t('groupDetail.netOwedShort') : t('groupDetail.netEvenShort');
  const compactBalanceColor = netBalance > 0 ? colors.forest : netBalance < 0 ? colors.coral : colors.textSecondary;

  // ── Despesas ─────────────────────────────────────────────────────────────
  const allExpenses = useMemo(() => lancamentos.filter(l => l.type === 'expense'), [lancamentos]);

  // Busca só existe na aba Despesas — enquanto aberta, hero/card de saldo
  // colapsam numa faixa compacta (em vez de sumir) pra sobrar espaço de tela
  // pra lista acima do teclado sem perder o contexto do saldo.
  const searchActive = searchOpen && activeTab === 'despesas';

  useEffect(() => {
    heroCollapse.value = withTiming(searchActive ? 0 : 1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [searchActive, heroCollapse]);

  const heroWrapStyle = useAnimatedStyle(() => {
    if (heroHeightSV.value === null) return { opacity: heroCollapse.value };
    return { height: heroCollapse.value * heroHeightSV.value, opacity: heroCollapse.value };
  });

  const compactBarStyle = useAnimatedStyle(() => ({
    height: (1 - heroCollapse.value) * 44,
    opacity: 1 - heroCollapse.value,
  }));

  const searchTerm = foldCase(searchQuery.trim());
  // Só os dígitos do que foi digitado: assim "1186,33", "1.186,33" e "118633"
  // viram a mesma busca, e o separador que a linha mostra deixa de atrapalhar.
  const searchDigits = searchQuery.replace(/\D/g, '');

  const filteredExpenses = useMemo(() => {
    if (!searchOpen || !searchTerm) return allExpenses;
    const meLabel = foldCase(t('common.you'));
    return allExpenses.filter(l => {
      if (foldCase(l.title).includes(searchTerm)) return true;
      const payer = l.paidByMe ? meLabel : foldCase(l.paidByName);
      if (payer.includes(searchTerm)) return true;
      // Valor casa por PREFIXO dos centavos, não por trecho solto: "50" acha
      // R$ 50,00 e R$ 500,00, mas não R$ 1.502,00 só porque tem "50" no meio.
      if (searchDigits && String(Math.round(Math.abs(l.amount) * 100)).startsWith(searchDigits)) return true;
      return false;
    });
  }, [allExpenses, searchOpen, searchTerm, searchDigits, t]);

  function toggleSearch() {
    if (searchOpen) {
      setSearchOpen(false);
      setSearchQuery('');
    } else {
      setSearchOpen(true);
      setActiveTab('despesas');
    }
  }

  // ── Participantes ────────────────────────────────────────────────────────
  const membersWithBalance = members.map(m => ({ ...m, netBalance: balances[m.id] ?? 0 }));

  // ── Render ───────────────────────────────────────────────────────────────
  // Segura o skeleton até a foto do grupo (se houver) também terminar de carregar,
  // pra não deixar a bolha do avatar em branco por um instante.
  // Sem erro de verdade ainda e sem grupo: pode ser fetch em andamento OU a
  // query ainda "desabilitada" esperando id/sessão resolverem (isFetching
  // fica false nesse meio-tempo) — nos dois casos é skeleton, nunca erro.
  const heroImageReady = !avatarUrl || avatarLoaded;
  if (!groupError && (!group || !heroImageReady)) {
    return <GroupDetailSkeleton />;
  }

  if (groupError) {
    return (
      <View style={[styles.container, styles.centerFill, styles.errorScreen, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{t('groupDetail.loadErrorTitle')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetchGroup()} activeOpacity={0.7}>
          <Text style={styles.retryBtnLabel}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!group) return null;

  const netBalanceValue = formatMoney(Math.abs(netBalance));

  // Valor de um tile do Resumo.
  function statValue(amount: number) {
    return (
      <Text style={styles.statValue}>{formatMoney(Math.abs(amount))}</Text>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
    <SwipeTabs onSwipeLeft={() => goToAdjacentTab(1)} onSwipeRight={() => goToAdjacentTab(-1)}>
      {/* Header — fica fora do PullToRefresh pra não participar do gesto de puxar
          (senão um toque no botão de voltar mexia no conteúdo e "piscava"). */}
      <View style={styles.headerRow}>
        <BackButton style={styles.headerBackBtn} />

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, searchOpen && styles.iconBtnActive]}
            hitSlop={8}
            activeOpacity={0.7}
            onPress={toggleSearch}
          >
            <Search size={20} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          {isAdminOrOwner && (
            <TouchableOpacity
              style={styles.qrBtn}
              hitSlop={8}
              activeOpacity={0.7}
              onPress={() => setInviteSheetOpen(true)}
            >
              <QrCode size={20} color={colors.ink} strokeWidth={2} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} hitSlop={8} activeOpacity={0.7} onPress={() => setMenuOpen(true)}>
            <MoreHorizontal size={22} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <PullToRefresh
        scrollY={scrollY}
        onRefresh={handleRefresh}
        disabled={editSheetOpen || inviteSheetOpen || menuOpen || searchActive}
      >

      <Animated.View style={[styles.heroCollapseWrap, heroWrapStyle]}>
        <View onLayout={e => {
          if (heroHeightSV.value === null) heroHeightSV.value = e.nativeEvent.layout.height;
        }}
        >
        {/* Hero */}
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.heroAvatarRing}
            activeOpacity={avatarUrl ? 0.85 : 1}
            disabled={!avatarUrl}
            onPress={() => setPhotoViewerOpen(true)}
          >
            <Avatar name={groupName} id={group?.id} photoUrl={avatarUrl ?? undefined} variant="warm" size="xl" />
          </TouchableOpacity>

          <View style={styles.groupNameRow}>
            <TouchableOpacity
              onPress={() => setEditSheetOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.groupName}>{groupName}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>

          <AvatarStack
            members={members.map(m => ({ id: m.id, name: m.name, photoUrl: m.photoUrl ?? undefined, isMe: m.isMe }))}
            size="md"
            max={5}
          />
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardTitleRow}>
            <Text style={styles.balanceCardTitle}>{netBalanceLabel}</Text>
          </View>
          <Text style={[styles.balanceCardAmount, { color: netBalanceColor }]}>
            {netBalancePrefix}{netBalanceValue}
          </Text>
          <View style={styles.balanceCardActions}>
            <View style={styles.balanceBtnPrimaryWrap}>
              <Button
                label={t('groupDetail.settleUp')}
                onPress={() => setSettleUpOpen(true)}
                // Sem dívida em aberto o sheet ainda tem conteúdo: os acertos
                // já quitados moram lá dentro. Só fica preso na primeira carga,
                // senão dá pra abrir e ver "tudo quitado" antes dos saldos
                // chegarem — o card de saldo renderiza antes deles.
                disabled={balancesInitialLoading}
                labelStyle={styles.balanceBtnPrimaryLabel}
              />
            </View>
            <TouchableOpacity
              style={styles.balanceBtnSecondary}
              activeOpacity={0.7}
              onPress={() => setActiveTab('saldos')}
            >
              <Text style={styles.balanceBtnSecondaryLabel}>{t('groupDetail.viewBalances')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </Animated.View>

      {/* Faixa compacta — hero/saldo colapsados durante a busca */}
      <Animated.View style={[styles.compactBar, compactBarStyle]} pointerEvents={searchActive ? 'auto' : 'none'}>
        <View style={styles.compactBarInner}>
          <View style={styles.compactAvatarRing}>
            <Avatar name={groupName} id={group?.id} photoUrl={avatarUrl ?? undefined} variant="warm" size="sm" />
          </View>
          <View style={styles.compactTextBlock}>
            <Text style={styles.compactName} numberOfLines={1}>{groupName}</Text>
            <Text style={styles.compactStatus} numberOfLines={1}>{netBalanceShortLabel}</Text>
          </View>
          <Text style={[styles.compactValue, { color: compactBalanceColor }]}>
            {netBalancePrefix}{netBalanceValue}
          </Text>
        </View>
      </Animated.View>

      {/* Tab bar */}
      <View style={[styles.tabBarWrap, searchActive && styles.tabBarWrapCompact]}>
        <View style={styles.tabBar}>
          {(
            [
              { key: 'resumo',    label: t('groupDetail.tabResumo')    },
              { key: 'despesas',  label: t('groupDetail.tabDespesas')  },
              { key: 'saldos',    label: t('groupDetail.tabSaldos')    },
              { key: 'historico', label: t('groupDetail.tabHistorico') },
            ] as { key: Tab; label: string }[]
          ).map(tab => {
            const active = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => { scrollY.value = 0; setActiveTab(tab.key); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.key === 'despesas' && allExpenses.length > 0 && (
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>
                      {allExpenses.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Search bar */}
      {searchActive && (
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBarPill}>
            <Search size={16} color={colors.textSecondary} strokeWidth={2.2} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('groupDetail.searchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              autoFocus
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8} activeOpacity={0.7}>
                <View style={styles.searchClearBtn}>
                  <X size={14} color={colors.textSecondary} strokeWidth={2.2} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* RESUMO                                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'resumo' && (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tabContent}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {(balancesInitialLoading || expensesInitialLoading) ? (
          <SummaryStatsSkeleton />
          ) : expensesError ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>{t('groupDetail.summaryErrorTitle')}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetchExpenses()} activeOpacity={0.7}>
              <Text style={styles.retryBtnLabel}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
          ) : (
          <>
          {/* Stat grid */}
          <View style={styles.statGrid}>
            <View style={styles.statGridRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('groupDetail.statPaid')}</Text>
                {statValue(vouPaguei)}
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('groupDetail.statTotal')}</Text>
                {statValue(totalDespesas)}
              </View>
            </View>
            <View style={styles.statGridRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('groupDetail.statReceivable')}</Text>
                {statValue(aReceber)}
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('groupDetail.statPayable')}</Text>
                {statValue(vouDevo)}
              </View>
            </View>
          </View>

          <Text style={styles.statFooter}>
            {t(allExpenses.length === 1 ? 'groupDetail.expenseCountSingular' : 'groupDetail.expenseCountPlural', { count: allExpenses.length })}
          </Text>

          {/* O card avisa que existe algo lançando sozinho; o sheet diz o quê e
              se aquilo mexe no bolso de quem olha. Nasceu sem toque de propósito
              ("recorrência se gerencia dentro da despesa") e ganhou um agora
              porque a pergunta que faltava responder — em QUAL delas eu entro —
              não cabia em duas linhas e não tinha outra superfície: nenhuma
              lista feita de despesas alcança uma série cujas ocorrências foram
              todas apagadas. Continua não gerenciando nada: o destino de cada
              linha é a despesa, que é onde se pausa e se edita.
              Some quando não há nenhuma, pra não virar enfeite morto no Resumo. */}
          {activeRecurrences.length > 0 && (
            <Pressable
              style={({ pressed }) => [styles.recurringCard, pressed && styles.recurringCardPressed]}
              onPress={() => setRecurringSheetOpen(true)}
            >
              <View style={styles.recurringIconCircle}>
                <Repeat size={18} color={colors.textPrimary} strokeWidth={2} />
              </View>
              <View style={styles.recurringTextCol}>
                <Text style={styles.recurringTitle}>
                  {t(activeRecurrences.length === 1 ? 'groupDetail.recurringSingular' : 'groupDetail.recurringPlural', { count: activeRecurrences.length })}
                </Text>
                {/* Participação antes da data: saber que uma das três é sua
                    muda mais o que você faz a seguir do que saber quando cai. */}
                <Text style={styles.recurringHint} numberOfLines={1}>
                  {myActiveRecurrences.length === 0
                    ? t(activeRecurrences.length === 1 ? 'groupDetail.recurringYouOutOne' : 'groupDetail.recurringYouOut')
                    : t(activeRecurrences.length === 1 ? 'groupDetail.recurringYouInOne' : 'groupDetail.recurringYouIn',
                      { count: myActiveRecurrences.length, total: activeRecurrences.length })}
                </Text>
                <Text style={styles.recurringHint} numberOfLines={1}>
                  {t('groupDetail.recurringNext', { date: nextRecurrenceLabel })}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          )}
          </>
          )}
        </Animated.ScrollView>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DESPESAS                                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'despesas' && (
        expensesInitialLoading ? (
          <View style={styles.despesaListSkeletonWrap}>
            <ExpenseListSkeleton count={4} />
          </View>
        ) : expensesError ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>{t('groupDetail.expensesErrorTitle')}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetchExpenses()} activeOpacity={0.7}>
              <Text style={styles.retryBtnLabel}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : allExpenses.length === 0 ? (
          <View style={styles.despesaEmptyState}>
            <View style={styles.despesaEmptyIconCircle}>
              <Receipt size={24} color={colors.textSecondary} strokeWidth={1.8} />
            </View>
            <Text style={styles.despesaEmptyTitle}>{t('groupDetail.expensesEmptyTitle')}</Text>
            <Text style={styles.despesaEmptySubtitle}>
              {t('groupDetail.expensesEmptyDefaultSubtitle')}
            </Text>
          </View>
        ) : filteredExpenses.length === 0 ? (
          <View style={styles.searchEmptyState}>
            <Text style={styles.despesaEmptyTitle}>{t('groupDetail.searchEmptyTitle')}</Text>
            <Text style={styles.despesaEmptySubtitle}>
              {t('groupDetail.searchEmptySubtitle')}
            </Text>
          </View>
        ) : (
          <Animated.FlatList<DespesaListRow>
            style={styles.despesasKeyboardView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.tabContent}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            data={buildDespesaListRows(filteredExpenses, language)}
            keyExtractor={(row, index) => row.kind === 'header' ? `h-${index}` : row.item.id}
            renderItem={({ item: row }) => {
              if (row.kind === 'header') {
                return <Text style={styles.dayGroupLabel}>{row.label}</Text>;
              }
              const l = row.item;
              const cat = findCategory(categories, l.categoryId);
              const subtitle = l.paidByMe
                ? t('groupDetail.paidByMeSubtitle', { count: l.splitCount ?? 0 })
                : l.myShare !== undefined
                  ? t('groupDetail.paidByOtherSubtitle', { name: l.paidByName, amount: formatMoney(Math.abs(l.myShare)) })
                  : t('groupDetail.paidByOtherNotInSubtitle', { name: l.paidByName });
              // Editar/apagar pelo swipe é de quem pagou, de quem LANÇOU ou de
              // admin do rolê — mesma regra da RLS (expenses_update/delete_
              // payer_creator_or_admin) e da tela de detalhe (grupo/despesa.tsx).
              // `isAdminOrOwner` e não só 'admin': dono é admin pro
              // is_group_admin() do banco, e a UI nem expõe os dois papéis.
              const canManage = l.paidByMe || l.createdByMe || isAdminOrOwner;
              const rowEl = (
                <Pressable
                  style={({ pressed }) => [styles.despesaRow, pressed && styles.despesaRowPressed]}
                  onPress={() => {
                    router.push({
                      pathname: '/(app)/grupo/despesa' as never,
                      params: { groupId: id ?? '', despesaId: l.id, groupName },
                    });
                  }}
                >
                  {/* A bolinha muda de intensidade conforme o que abriga: com
                      emoji ela é quem carrega a cor da categoria; com o ícone,
                      quem carrega é o traço, e o fundo recua pra não brigar. */}
                  <View style={[
                    styles.despesaCatCircle,
                    { backgroundColor: getCategoryChipColor(cat?.color) },
                  ]}>
                    <CategoryIcon
                      icon={cat?.icon}
                      size={20}
                      color={cat?.color ?? colors.textSecondary}
                    />
                  </View>
                  <View style={styles.despesaBody}>
                    <View style={styles.despesaTitleRow}>
                      <Text style={styles.despesaTitle} numberOfLines={1}>{l.title}</Text>
                      {!!l.recurrenceId && <Repeat size={12} color={colors.textSecondary} strokeWidth={2.4} />}
                    </View>
                    <Text style={styles.despesaPaidBy}>{subtitle}</Text>
                  </View>
                  <Text style={styles.despesaAmount}>{formatMoney(Math.abs(l.amount))}</Text>
                </Pressable>
              );

              return (
                <View>
                  {canManage ? (
                    <Swipeable
                      ref={ref => { swipeableRefs.current.set(l.id, ref); }}
                      overshootLeft={false}
                      overshootRight={false}
                      leftThreshold={40}
                      rightThreshold={40}
                      onSwipeableWillOpen={() => handleSwipeableWillOpen(l.id)}
                      onSwipeableClose={() => { if (openSwipeableIdRef.current === l.id) openSwipeableIdRef.current = null; }}
                      renderLeftActions={() => (
                        <TouchableOpacity
                          style={styles.despesaEditAction}
                          onPress={() => {
                            swipeableRefs.current.get(l.id)?.close();
                            router.push({
                              pathname: '/(app)/grupo/despesa' as never,
                              params: { groupId: id ?? '', despesaId: l.id, groupName, openEdit: '1' },
                            });
                          }}
                          activeOpacity={0.8}
                        >
                          <Pencil size={18} color={colors.primaryDark} strokeWidth={2} />
                          <Text style={styles.despesaEditActionLabel}>{t('expenseDetail.edit')}</Text>
                        </TouchableOpacity>
                      )}
                      renderRightActions={() => (
                        <TouchableOpacity
                          style={styles.despesaDeleteAction}
                          onPress={() => { swipeableRefs.current.get(l.id)?.close(); setDeleteTarget(l); }}
                          activeOpacity={0.8}
                        >
                          <Trash2 size={18} color={colors.white} strokeWidth={2} />
                          <Text style={styles.despesaDeleteActionLabel}>{t('expenseDetail.delete')}</Text>
                        </TouchableOpacity>
                      )}
                    >
                      {rowEl}
                    </Swipeable>
                  ) : rowEl}
                </View>
              );
            }}
          />
        )
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SALDOS                                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'saldos' && (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tabContent}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {membersWithBalance.map(m => {
            const displayName  = m.isMe ? t('common.youCapitalized') : m.name;
            const balance      = m.netBalance;
            const balanceColor = balance > 0 ? colors.forest
                               : balance < 0 ? colors.coral
                               : colors.textSecondary;
            const balancePrefix = balance > 0 ? '+ ' : balance < 0 ? '− ' : '';
            const balanceText  = balance === 0 ? t('groupDetail.balanceEven') : `${balancePrefix}${formatMoney(Math.abs(balance))}`;

            return (
              <View key={m.id} style={styles.participanteRow}>
                <Avatar name={m.name} id={m.id} photoUrl={m.photoUrl ?? undefined} size="md" variant="colorful" />
                <Text style={styles.participanteName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={balance === 0 ? styles.participanteBalanceQuite : [styles.participanteBalance, { color: balanceColor }]}>
                  {balanceText}
                </Text>
              </View>
            );
          })}

          <Text style={styles.saldosLegend}>
            {t('groupDetail.balanceLegend')}
          </Text>
        </Animated.ScrollView>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* HISTÓRICO                                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'historico' && myUserId && (
        <HistoryFeed
          groupId={id}
          myUserId={myUserId}
          isPremium={isPremium}
          onUpgradePress={() => setPaywallOpen(true)}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/(app)/grupo/lancar' as never, params: { groupId: id } })}
      >
        <Plus size={24} color={colors.ink} strokeWidth={2.6} />
      </TouchableOpacity>
      </PullToRefresh>
    </SwipeTabs>

      <RecurringExpensesSheet
        visible={recurringSheetOpen}
        onClose={() => setRecurringSheetOpen(false)}
        onClosed={handleRecurringClosed}
        recurrences={activeRecurrences}
        members={group.members}
        onSelectExpense={despesaId => {
          afterRecurringCloseRef.current = despesaId;
          setRecurringSheetOpen(false);
        }}
      />

      <GroupOptionsSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onClosed={handleMenuClosed}
        archived={!!group.archivedAt}
        onParticipants={() => router.push({ pathname: '/(app)/grupo/participantes' as never, params: { groupId: id } })}
        onInsights={() => router.push({ pathname: '/(app)/grupo/insight' as never, params: { groupId: id } })}
        onRename={() => { afterMenuCloseRef.current = () => setEditSheetOpen(true); }}
        // Encadeado como o "Editar rolê" ao lado: arquivar abre uma
        // confirmação, que é outro Modal — precisa esperar o menu fechar.
        onToggleArchive={() => { afterMenuCloseRef.current = handleToggleArchive; }}
        onLeave={() => { afterMenuCloseRef.current = () => setLeaveSheetOpen(true); }}
      />

      {/* Saldo pendente bloqueia arquivar no servidor. Em vez de deixar
          a pessoa apertar e falhar, o sheet já abre explicando — mesmo
          tratamento do "Sair do rolê". O Alert do catch continua existindo
          porque o servidor bloqueia por um segundo motivo que o client não
          conhece: acerto marcado como pago esperando confirmação. */}
      <ConfirmSheet
        visible={archiveConfirmOpen}
        onClose={() => { if (!archiving) setArchiveConfirmOpen(false); }}
        title={t('groupDetail.archiveConfirmTitle')}
        description={t('groupDetail.archiveConfirmBody')}
        confirmLabel={t('groupDetail.archiveConfirmAction')}
        confirmLoadingLabel={t('groupDetail.archiving')}
        onConfirm={handleConfirmArchive}
        loading={archiving}
        blocked={netBalance !== 0 ? {
          title: t('groupDetail.archiveNotSettledTitle'),
          message: netBalance > 0
            ? t('groupDetail.archiveBlockedReceivable', { amount: formatMoney(Math.abs(netBalance)) })
            : t('groupDetail.archiveBlockedOwe', { amount: formatMoney(Math.abs(netBalance)) }),
        } : null}
      >
        {myActiveRecurrences.length > 0 && (
          <View style={styles.warnBox}>
            <Text style={styles.warnBoxTitle}>{t('groupDetail.archiveRecurrenceWarnTitle')}</Text>
            <Text style={styles.warnBoxLine}>
              {t(myActiveRecurrences.length === 1
                ? 'groupDetail.archiveRecurrenceWarnSingular'
                : 'groupDetail.archiveRecurrenceWarnPlural', { count: myActiveRecurrences.length })}
            </Text>
          </View>
        )}
      </ConfirmSheet>

      <EditGroupSheet
        visible={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        groupId={group.id}
        groupName={group.name}
        hasExpenses={group.hasExpenses}
        avatarPath={group.avatarPath}
        avatarUrl={avatarUrl}
      />

      <InviteQrSheet
        visible={inviteSheetOpen}
        onClose={() => setInviteSheetOpen(false)}
        groupId={group.id}
        groupName={group.name}
        groupCode={group.inviteCode.toUpperCase()}
      />

      <LeaveGroupSheet
        visible={leaveSheetOpen}
        onClose={() => setLeaveSheetOpen(false)}
        groupId={group.id}
        isOwner={isOwner}
        myBalance={netBalance}
        otherMembers={otherMembers}
      />

      <SettleUpSheet
        visible={settleUpOpen}
        onClose={() => setSettleUpOpen(false)}
        groupId={group.id}
        focusUserId={focusUserId}
      />

      {avatarUrl && (
        <PhotoViewerModal
          visible={photoViewerOpen}
          onClose={() => setPhotoViewerOpen(false)}
          photoUrl={avatarUrl}
        />
      )}

      <LimitPaywallSheet
        visible={limitSheetOpen}
        reason="roles"
        onClose={() => setLimitSheetOpen(false)}
        onUpgrade={() => { setLimitSheetOpen(false); setPaywallOpen(true); }}
      />

      <LimitPaywallSheet
        visible={paywallOpen}
        reason="general"
        onClose={() => setPaywallOpen(false)}
        onUpgrade={handleSubscribe}
      />

      {/* Sheet confirmar exclusão — veio do swipe "Excluir" na lista de despesas.
          Duas opções em vez do botão único quando a despesa é de uma série
          viva; os avisos entram como children. */}
      <ConfirmSheet
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('expenseDetail.deleteConfirmTitle')}
        description={deleteTarget
          ? t('expenseDetail.deleteConfirmBody', {
            title: deleteTarget.title,
            amount: formatMoney(Math.abs(deleteTarget.amount)),
          })
          : ''}
        confirmLabel={t('expenseDetail.deleteAction')}
        onConfirm={() => handleConfirmDeleteExpense(false)}
        variant="danger"
        options={askDeleteScope ? [
          {
            label: t('expenseDetail.deleteScopeOnlyThis'),
            hint: t('expenseDetail.deleteScopeOnlyThisHint'),
            danger: true,
            onPress: () => handleConfirmDeleteExpense(false),
          },
          {
            label: t('expenseDetail.deleteScopeFuture'),
            hint: t('expenseDetail.deleteScopeFutureHint'),
            danger: true,
            onPress: () => handleConfirmDeleteExpense(true),
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
          <View style={styles.warnBox}>
            <Text style={styles.warnBoxTitle}>{t('expenseDetail.deleteLastExpenseWarningTitle')}</Text>
            {orphanedMembers.map(m => (
              <Text key={m.id} style={styles.warnBoxLine}>
                {t('expenseDetail.deleteLastExpenseWarningLine', {
                  name: m.name,
                  amount: formatMoney(Math.abs(paymentsOnlyBalances[m.id] ?? 0)),
                })}
              </Text>
            ))}
          </View>
        )}
      </ConfirmSheet>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerFill: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  // Erro de tela cheia: centraliza na vertical também (os erros de aba usam só
  // o centerFill, alinhado ao topo, porque vivem abaixo do header).
  errorScreen: {
    justifyContent: 'center',
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
  iconBtnActive: {
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qrBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  fab: {
    position: 'absolute',
    right: spacing.pagePadding,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  // ── Hero ────────────────────────────────────────────────────────────────────
  heroCollapseWrap: {
    overflow: 'hidden',
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  heroAvatarRing: {
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: 'rgba(245,197,24,0.25)',
    marginBottom: spacing.xs,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  groupName: {
    fontSize: fontSizes.h1Lg,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  // ── Tab bar ─────────────────────────────────────────────────────────────────
  tabBarWrap: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
  },
  tabBarWrapCompact: {
    paddingTop: spacing.sm + 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  tabActive: {
    backgroundColor: colors.background,
    ...shadows.card,
  },
  tabLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.textPrimary,
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: colors.background,
  },
  tabCountActive: {
    backgroundColor: colors.primary,
  },
  tabCountText: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.bold,
    color: colors.textSecondary,
  },
  tabCountTextActive: {
    color: colors.ink,
  },

  // ── Tab content ─────────────────────────────────────────────────────────────
  tabContent: {
    paddingBottom: spacing.xl,
  },
  despesasKeyboardView: {
    flex: 1,
  },
  despesaListSkeletonWrap: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
  },

  // ── Balance card ────────────────────────────────────────────────────────────
  balanceCard: {
    marginHorizontal: spacing.pagePadding,
    marginBottom: spacing.md,
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: 4,
  },
  balanceCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  balanceCardTitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  balanceCardAmount: {
    fontSize: fontSizes.heroSm,
    fontFamily: fontFamilies.semibold,
    letterSpacing: -0.5,
  },
  balanceCardSecondary: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  balanceCardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  balanceBtnPrimaryWrap: {
    flex: 1,
  },
  balanceBtnPrimaryLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
  balanceBtnSecondary: {
    flex: 1,
    height: 54,
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  balanceBtnSecondaryLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },

  // ── Faixa compacta (hero/saldo colapsados na busca) ──────────────────────────
  compactBar: {
    overflow: 'hidden',
  },
  compactBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.sm,
  },
  compactAvatarRing: {
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'rgba(245,197,24,0.3)',
  },
  compactTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  compactName: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    lineHeight: 17,
  },
  compactStatus: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    lineHeight: 13,
  },
  compactValue: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.bold,
  },

  // ── Resumo: stat grid ───────────────────────────────────────────────────────
  statGrid: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  statGridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
    gap: 4,
  },
  statLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  statValueSecondary: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  statFooter: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },

  // ── Card de recorrências do Resumo ────────────────────────────────────────────
  recurringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    marginTop: spacing.lg,
    marginHorizontal: spacing.pagePadding,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  recurringCardPressed: {
    opacity: 0.7,
  },
  recurringIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringTextCol: {
    flex: 1,
    minWidth: 0,
  },
  recurringTitle: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  recurringHint: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Busca de despesas ─────────────────────────────────────────────────────────
  searchBarWrap: {
    paddingHorizontal: spacing.pagePadding,
    marginBottom: spacing.sm,
  },
  searchBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  searchClearBtn: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  searchEmptyState: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.pagePadding,
    gap: spacing.xs,
  },

  // ── Despesas ────────────────────────────────────────────────────────────────
  despesaEmptyState: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.pagePadding,
    gap: spacing.sm,
  },
  despesaEmptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  despesaEmptyTitle: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  despesaEmptySubtitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
  dayGroupLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  despesaCatCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  despesaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.pagePadding,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius['2xl'],
    gap: 12,
    // Precisa ser opaco (não só no :pressed) — o Swipeable empilha a linha
    // por cima das ações de editar/excluir; sem fundo sólido elas aparecem
    // por baixo o tempo todo. Mesma cor do fundo da própria tela — não muda
    // nada visualmente em repouso, só garante a opacidade.
    backgroundColor: colors.background,
  },
  despesaRowPressed: {
    backgroundColor: colors.surface,
  },
  despesaEditAction: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginLeft: spacing.pagePadding,
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(245,197,24,0.2)',
  },
  despesaEditActionLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.primaryDark,
  },
  despesaDeleteAction: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginRight: spacing.pagePadding,
    borderRadius: radius['2xl'],
    backgroundColor: colors.danger,
  },
  despesaDeleteActionLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.white,
  },

  // ── Sheet: confirmar exclusão (swipe da lista) ───────────────────────────────
  // O sheet é o ConfirmSheet; aqui ficam só os avisos que entram como children.
  //
  // Informação, não alarme: fica em texto secundário, e não na caixa coral do
  // aviso de saldo órfão — a repetição continuar não é um risco, é um fato que
  // a pessoa precisa saber antes de confirmar.
  deleteRecurrenceHint: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  // Caixa de aviso dos sheets desta tela — serve o saldo que fica órfão ao
  // apagar a última despesa e a recorrência que segue lançando após arquivar.
  // Nome neutro porque não é mais só do apagar.
  warnBox: {
    backgroundColor: hexToRgba(colors.coral, 0.1),
    borderRadius: radius.lg,
    padding: spacing.sm + 4,
    gap: 2,
    marginBottom: spacing.md,
  },
  warnBoxTitle: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.coral,
    marginBottom: 2,
  },
  warnBoxLine: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.coral,
  },
  despesaBody: {
    flex: 1,
    gap: 3,
  },
  despesaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  despesaTitle: {
    flexShrink: 1,
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  despesaPaidBy: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  despesaAmount: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },

  // ── Participantes ───────────────────────────────────────────────────────────
  participanteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.pagePadding,
    marginBottom: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm + 4,
    gap: 12,
  },
  participanteName: {
    flex: 1,
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  participanteBalance: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
  },
  participanteBalanceQuite: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  saldosLegend: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.pagePadding,
    marginTop: spacing.md,
  },
});
