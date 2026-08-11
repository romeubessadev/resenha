import { useMemo, useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  List, Users, ChevronDown, ArrowLeftRight,
  ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock,
} from 'lucide-react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, BatchSettleSheet, LimitPaywallSheet, PullToRefresh, SkeletonBone as Bone, SwipeTabs, WalletListSkeleton } from '@/components';
import { useWallet } from '@/hooks/useWallet';
import { useIsPremium } from '@/hooks/usePlan';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/currencies';
import { WEEKDAYS, type Language, type TranslationKey } from '@/lib/i18n';
import { groupByPerson, groupByGroup } from '@/lib/walletGrouping';
import { fontFamilies, fontSizes, spacing, radius, type ColorPalette } from '@/theme';

function whenLabel(iso: string, language: Language, t: (key: TranslationKey) => string): string {
  // Extrai ano/mês/dia direto da string, sem passar por new Date(iso) —
  // esse parse trata o timestamp como instante UTC, e uma despesa gravada
  // à meia-noite UTC (ex.: materializada pelo cron) já vira o dia anterior
  // em qualquer fuso negativo (Brasil, EUA), classificando errado como "Ontem".
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return t('wallet.today');
  if (diffDays === 1) return t('wallet.yesterday');
  if (diffDays > 1 && diffDays < 7) return WEEKDAYS[language][date.getDay()];
  return date.toLocaleDateString(language, { day: '2-digit', month: 'short' });
}

type Filter = 'pendentes' | 'a-receber' | 'a-pagar' | 'acertados';
type ViewMode = 'lista' | 'pessoa';

const FILTERS: { key: Filter; labelKey: TranslationKey }[] = [
  { key: 'pendentes', labelKey: 'wallet.filterAll' },
  { key: 'a-receber', labelKey: 'wallet.filterReceivable' },
  { key: 'a-pagar', labelKey: 'wallet.filterPayable' },
  { key: 'acertados', labelKey: 'wallet.filterSettled' },
];

export default function CarteiraScreen() {
  const insets = useSafeAreaInsets();
  const { data: txs, loading, error, refetch } = useWallet();
  // Primeira carga: sem nada em cache. Atualizar puxando não entra aqui — lá o
  // conteúdo real fica na tela e quem sinaliza é o indicador do PullToRefresh.
  const firstLoad = loading && txs.length === 0;
  const isPremium = useIsPremium();
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [filter, setFilter] = useState<Filter>('pendentes');
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [batchSheetOpen, setBatchSheetOpen] = useState(false);
  const [limitSheetOpen, setLimitSheetOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Ref do scroll pro PullToRefresh declarar os dois gestos como simultâneos —
  // sem isso o scroll nativo engole o arrasto e o puxão nunca ativa.
  const listRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  // Toda resenha é em reais, então somar é somar — não há mais conversão entre a
  // moeda da resenha e a do usuário nesta tela de agregação.
  const toMine = (t: { amount: number }) => t.amount;

  const nonSettled = txs.filter(t => t.status !== 'settled');
  const totalIn = nonSettled.filter(t => t.direction === 'in').reduce((s, t) => s + toMine(t), 0);
  const totalOut = nonSettled.filter(t => t.direction === 'out').reduce((s, t) => s + toMine(t), 0);
  const net = totalIn - totalOut;
  const netLabel = net > 0 ? t('wallet.netReceivable') : net < 0 ? t('wallet.netOwed') : t('wallet.netEven');
  const netColor = net > 0 ? colors.forest : net < 0 ? colors.coral : colors.textPrimary;
  const netPrefix = net > 0 ? '+ ' : net < 0 ? '− ' : '';

  const filtered = filter === 'pendentes' ? nonSettled
    : filter === 'a-receber' ? nonSettled.filter(t => t.direction === 'in')
    : filter === 'a-pagar' ? nonSettled.filter(t => t.direction === 'out')
    : txs.filter(t => t.status === 'settled');

  const grouped = groupByPerson(filtered, toMine);

  const batchPeople = groupByPerson(nonSettled, toMine).filter(p => p.net !== 0);
  const batchTotal = totalIn + totalOut;

  function goToGroup(groupId: string, personId: string, hasPending: boolean) {
    router.push({
      pathname: '/(app)/grupo/[id]' as never,
      params: {
        id: groupId,
        tab: 'saldos',
        ...(hasPending ? { action: 'settle', focusUserId: personId } : {}),
      },
    });
  }

  function handleBatchPress() {
    if (isPremium) setBatchSheetOpen(true);
    else setLimitSheetOpen(true);
  }

  function handleUpgradeFromLimit() {
    setLimitSheetOpen(false);
    setPaywallOpen(true);
  }

  function handleSubscribe() {
    setPaywallOpen(false);
    Alert.alert(t('limitPaywall.cta'), t('paywall.notAvailableYet'));
  }

  const sheetsOpen = batchSheetOpen || limitSheetOpen || paywallOpen;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SwipeTabs
        onSwipeLeft={() => { if (!sheetsOpen) router.replace('/ajustes'); }}
        onSwipeRight={() => { if (!sheetsOpen) router.replace('/grupos'); }}
      >
      <PullToRefresh scrollY={scrollY} scrollRef={listRef} onRefresh={async () => { await refetch(); }}>
        <Animated.ScrollView
          ref={listRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          // Com os dois gestos ativos ao mesmo tempo, o bounce do iOS moveria o
          // conteúdo por conta própria e somaria ao deslocamento do puxão.
          bounces={false}
          // A régua de filtros (índice 1) gruda no topo ao rolar. Ela decide o
          // que a lista mostra — sumindo, trocar de filtro exigiria voltar ao
          // topo antes. O resto do cabeçalho é informação de chegada e rola
          // junto, devolvendo a tela inteira pra lista.
          stickyHeaderIndices={[1]}
          contentContainerStyle={{ paddingBottom: spacing.xxl + 52 }}
        >
          <View style={styles.header}>
            {/* Par agrupado com gap próprio: o `gap` do header vale entre os
                BLOCOS (título, saldo, cards) e afastaria demais o subtítulo. */}
            <View style={styles.titleBlock}>
              <Text style={styles.pageTitle}>{t('wallet.title')}</Text>
              <Text style={styles.pageSubtitle}>{t('wallet.subtitle')}</Text>
            </View>

            {/* Título e subtítulo acima são rótulos da tela e aparecem sempre.
                Daqui pra baixo tudo é CALCULADO: sem dado, `net` dá zero e a
                tela afirmaria "Está tudo em dia · R$ 0,00" pra quem talvez
                esteja devendo — mentira que dura até a consulta responder. */}
            {firstLoad ? (
              <>
                <View style={styles.balanceBlock}>
                  <Bone style={styles.balanceLabelBone} />
                  <Bone style={styles.balanceValueBone} />
                </View>

                <View style={styles.statRow}>
                  {[0, 1].map(i => (
                    <View key={i} style={styles.statCard}>
                      <Bone style={styles.statLabelBone} />
                      <Bone style={styles.statValueBone} />
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.balanceBlock}>
                  <Text style={styles.balanceLabel}>{netLabel}</Text>
                  <Text style={[styles.balanceValue, { color: netColor }]}>
                    {netPrefix}{formatMoney(Math.abs(net))}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{t('wallet.toReceive')}</Text>
                    <Text style={[styles.statValue, { color: colors.forest }]}>{formatMoney(totalIn)}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{t('wallet.toPay')}</Text>
                    <Text style={[styles.statValue, { color: colors.coral }]}>{formatMoney(totalOut)}</Text>
                  </View>
                </View>
              </>
            )}

            {batchPeople.length > 0 && (
              <TouchableOpacity
                style={styles.batchBtn}
                onPress={handleBatchPress}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <View style={styles.batchIconCircle}>
                  <ArrowLeftRight size={18} color={colors.ink} strokeWidth={2.2} />
                </View>
                <View style={styles.batchInfo}>
                  <Text style={styles.batchTitle}>{t('wallet.batchSettle')}</Text>
                  <Text style={styles.batchSubtitle} numberOfLines={1}>
                    {batchPeople.length} {batchPeople.length === 1 ? t('wallet.batchPerson') : t('wallet.batchPeople')} · {t('wallet.batchSubtitle')}
                  </Text>
                </View>
                <Text style={styles.batchValue}>{formatMoney(batchTotal)}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Fundo opaco e não transparente: grudado no topo, ele passa por
              cima da lista rolando atrás. */}
          <View style={styles.filterBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map(f => {
                const active = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setFilter(f.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}>{t(f.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

        <View style={styles.content}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>{viewMode === 'lista' ? t('wallet.movementsHeader') : t('wallet.byPersonHeader')}</Text>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'lista' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('lista')}
                activeOpacity={0.7}
              >
                <List size={16} color={viewMode === 'lista' ? colors.textPrimary : colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'pessoa' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('pessoa')}
                activeOpacity={0.7}
              >
                <Users size={16} color={viewMode === 'pessoa' ? colors.textPrimary : colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          {firstLoad ? (
            <WalletListSkeleton />
          ) : error ? (
            /* ANTES do estado vazio, e não depois: sem esta faixa, uma carga que
               falhou caía no "Nada por aqui" — a Carteira afirmando que ninguém
               te deve nada quando na verdade ela não conseguiu perguntar. É a
               pior mentira que o app pode contar, porque é sobre dinheiro.
               `error` só vem preenchido quando não há dado nenhum (ver
               lib/queryError.ts), então atualizar com a lista na tela não passa
               por aqui. */
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('wallet.loadErrorTitle')}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.7}>
                <Text style={styles.retryBtnLabel}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('wallet.emptyTitle')}</Text>
              <Text style={styles.emptySubtitle}>{t('wallet.emptySubtitle')}</Text>
            </View>
          ) : viewMode === 'lista' ? (
            <View>
              {filtered.map(tx => (
                <Pressable
                  key={tx.id}
                  style={({ pressed }) => [styles.txRow, pressed && styles.rowPressed]}
                  onPress={() => goToGroup(tx.groupId, tx.personId, tx.status !== 'settled')}
                >
                  <View style={[
                    styles.txIconCircle,
                    tx.status === 'settled'
                      ? styles.txIconCircleSettled
                      : tx.direction === 'in' ? styles.txIconCircleIn : styles.txIconCircleOut,
                  ]}>
                    {tx.status === 'settled'
                      ? <CheckCircle2 size={18} color={colors.textSecondary} strokeWidth={2} />
                      : tx.direction === 'in'
                        ? <ArrowDownLeft size={18} color={colors.forest} strokeWidth={2.2} />
                        : <ArrowUpRight size={18} color={colors.coral} strokeWidth={2.2} />}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txName} numberOfLines={1}>{tx.personName}</Text>
                    <Text style={styles.txSubtitle} numberOfLines={1}>{tx.groupName} · {whenLabel(tx.createdAt, language, t)}</Text>
                    {tx.status === 'waiting' && (
                      <View style={styles.waitingPill}>
                        <Clock size={10} color={colors.ink} strokeWidth={2.5} />
                        <Text style={styles.waitingPillLabel}>{t('wallet.waitingConfirmation')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[
                    styles.txValue,
                    tx.status === 'settled'
                      ? styles.txValueSettled
                      : { color: tx.direction === 'in' ? colors.forest : colors.coral },
                  ]}>
                    {tx.direction === 'in' ? '+ ' : '− '}{formatMoney(toMine(tx))}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View>
              {grouped.map(person => {
                const personGroups = groupByGroup(person.items);
                const isExpanded = expandedPersonId === person.personId;
                const single = personGroups.length === 1;
                return (
                  <View key={person.personId} style={styles.personCard}>
                    <Pressable
                      style={({ pressed }) => [styles.personRow, pressed && styles.rowPressed]}
                      onPress={() => single
                        ? goToGroup(personGroups[0].groupId, person.personId, personGroups[0].items.some(i => i.status !== 'settled'))
                        : setExpandedPersonId(isExpanded ? null : person.personId)}
                    >
                      <Avatar name={person.personName} id={person.personId} photoUrl={person.personPhotoUrl ?? undefined} size={40} variant="colorful" />
                      <View style={styles.txInfo}>
                        <Text style={styles.txName} numberOfLines={1}>{person.personName}</Text>
                        <Text style={styles.txSubtitle} numberOfLines={1}>
                          {single
                            ? personGroups[0].groupName
                            : t('wallet.multiGroupSummary', { groups: personGroups.length, items: person.items.length })}
                        </Text>
                      </View>
                      <Text style={[
                        styles.txValue,
                        { color: person.net > 0 ? colors.forest : person.net < 0 ? colors.coral : colors.textSecondary },
                      ]}>
                        {person.net > 0 ? '+ ' : person.net < 0 ? '− ' : ''}{formatMoney(Math.abs(person.net))}
                      </Text>
                      {!single && (
                        <ChevronDown
                          size={18}
                          color={colors.textSecondary}
                          strokeWidth={2}
                          style={isExpanded ? styles.chevronExpanded : undefined}
                        />
                      )}
                    </Pressable>

                    {!single && isExpanded && personGroups.map(g => (
                      <TouchableOpacity
                        key={g.groupId}
                        style={styles.subRow}
                        onPress={() => goToGroup(g.groupId, person.personId, g.items.some(i => i.status !== 'settled'))}
                        activeOpacity={0.7}
                      >
                        <View style={styles.subDot} />
                        <View style={styles.txInfo}>
                          <Text style={styles.subGroupName}>{g.groupName}</Text>
                          <Text style={styles.subMeta}>
                            {g.items.length} {g.items.length === 1 ? t('wallet.movementSingular') : t('wallet.movementPlural')} ·{' '}
                            {g.items.some(i => i.status !== 'settled') ? t('wallet.pending') : t('wallet.settled')}
                          </Text>
                        </View>
                        <Text style={[
                          styles.txValue,
                          { color: g.net > 0 ? colors.forest : g.net < 0 ? colors.coral : colors.textSecondary },
                        ]}>
                          {g.net > 0 ? '+ ' : g.net < 0 ? '− ' : ''}{formatMoney(Math.abs(g.net))}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </View>
        </Animated.ScrollView>
      </PullToRefresh>
      </SwipeTabs>

      <BatchSettleSheet
        visible={batchSheetOpen}
        onClose={() => setBatchSheetOpen(false)}
        people={batchPeople}
      />

      <LimitPaywallSheet
        visible={limitSheetOpen}
        reason="batchSettle"
        onClose={() => setLimitSheetOpen(false)}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // `xl` no topo, igual ao Ajustes (a outra aba com título grande): lá o
  // respiro vem do contentContainerStyle, aqui do próprio header, mas o
  // resultado tem que ser o mesmo — as duas telas ficam lado a lado na tabbar.
  header: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  // Barra grudada no topo pelo stickyHeaderIndices. Fundo opaco e o mesmo
  // respiro lateral do resto da página.
  filterBar: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  // 2px entre título e subtítulo, igual ao Ajustes.
  titleBlock: {
    gap: 2,
  },
  pageTitle: {
    fontSize: fontSizes.h1Lg,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  balanceBlock: {
    marginTop: spacing.sm,
    gap: 2,
  },
  balanceLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  // Ossos com a altura do texto que substituem, pra o número real entrar sem
  // empurrar nada.
  balanceLabelBone: {
    width: 150,
    height: 16,
    borderRadius: radius.full,
    marginBottom: 6,
  },
  balanceValueBone: {
    width: 190,
    height: 34,
    borderRadius: radius.full,
  },
  statLabelBone: {
    width: '70%',
    height: 10,
    borderRadius: radius.full,
  },
  statValueBone: {
    width: '55%',
    height: 18,
    borderRadius: radius.full,
    marginTop: 4,
  },
  balanceValue: {
    fontSize: fontSizes.heroLg,
    fontFamily: fontFamilies.semibold,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: 4,
  },
  statLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: fontSizes.h1Sm,
    fontFamily: fontFamilies.semibold,
    fontVariant: ['tabular-nums'],
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.md,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
  },
  batchIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21,27,36,0.1)',
  },
  batchTitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
  batchSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: 'rgba(21,27,36,0.7)',
  },
  batchValue: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  batchInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  filterRow: {
    gap: spacing.xs,
  },
  filterChip: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  filterChipLabelActive: {
    color: colors.ink,
    fontFamily: fontFamilies.semibold,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeader: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
  },
  viewToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: {
    backgroundColor: colors.background,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  retryBtn: {
    marginTop: spacing.md,
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
  // O respiro entre as linhas mora no padding delas, não num gap da lista:
  // assim a faixa inteira é tocável e o realce de pressionar cobre ela toda —
  // mesmo modelo da lista de despesas da resenha e da lista de resenhas. A margem
  // negativa faz o realce sangrar 12px pra cada lado sem desalinhar o
  // conteúdo com o resto da tela.
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: -(spacing.sm + 4),
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderRadius: radius['2xl'],
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconCircleIn: {
    backgroundColor: 'rgba(0,94,49,0.1)',
  },
  txIconCircleOut: {
    backgroundColor: 'rgba(255,118,67,0.1)',
  },
  txIconCircleSettled: {
    backgroundColor: colors.surface,
  },
  txInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  txName: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  txSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  txValue: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    fontVariant: ['tabular-nums'],
  },
  txValueSettled: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  waitingPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  waitingPillLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.medium,
    color: colors.ink,
  },
  // 4, não 8: a linha da pessoa agora tem 8 de padding próprio, então o vão
  // até as sub-linhas dela já vem somado — 8 aqui afastaria a sub-lista da
  // pessoa a que ela pertence.
  personCard: {
    gap: spacing.xs,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: -(spacing.sm + 4),
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderRadius: radius['2xl'],
  },
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
  },
  subDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  subGroupName: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  subMeta: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
});
