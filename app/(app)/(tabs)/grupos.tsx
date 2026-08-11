import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, Alert, Image,
} from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { Plus, QrCode, Search, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreateRoleSheet, GroupCard, GroupListSkeleton, JoinRoleSheet, LimitPaywallSheet, PullToRefresh, QrScannerModal, SkeletonBone as Bone, SwipeTabs } from '@/components';
import { GroupNotFoundError, RoleLimitError, useGroups, useJoinGroup } from '@/hooks/useGroups';
import { useLanguage } from '@/hooks/useLanguage';
import { useMyProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { getGroupAvatarUrl } from '@/lib/groupAvatar';
import { formatMoney } from '@/lib/currencies';
import { fontFamilies, fontSizes, spacing, radius, shadows, type ColorPalette } from '@/theme';

export default function GruposScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<'ativos' | 'arquivados'>('ativos');
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [limitSheetOpen, setLimitSheetOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const { data: groups, loading, error, refetch } = useGroups();
  const initialLoading = loading && groups.length === 0;
  const { data: myProfile, refetch: refetchProfile } = useMyProfile();
  const { joinGroup } = useJoinGroup();

  // Posição de scroll da lista — o PullToRefresh só puxa quando está em 0.
  // Ref do scroll pro PullToRefresh declarar os dois gestos como simultâneos —
  // sem isso o scroll nativo engole o arrasto e o puxão nunca ativa.
  const listRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  const ativos = groups.filter(g => !g.archived);
  const arquivados = groups.filter(g => g.archived);
  const displayed = activeTab === 'arquivados' ? arquivados : ativos;

  // Busca só aparece quando a aba atual (Ativos/Arquivados, cada uma com
  // sua própria contagem) tem rolê suficiente pra justificar filtrar.
  const showSearch = displayed.length >= 6;
  const searchQueryNormalized = showSearch ? searchQuery.trim().toLowerCase() : '';
  const filteredDisplayed = searchQueryNormalized
    ? displayed.filter(g =>
        g.name.toLowerCase().includes(searchQueryNormalized) ||
        g.memberNames.some(n => n.toLowerCase().includes(searchQueryNormalized)),
      )
    : displayed;

  const totalBalance = ativos.reduce((sum, g) => sum + g.netBalance, 0);
  const balanceLabel = totalBalance > 0 ? t('wallet.netReceivable') : totalBalance < 0 ? t('wallet.netOwed') : t('groups.balanceGeneral');
  const balanceColor = totalBalance > 0 ? colors.forest : totalBalance < 0 ? colors.coral : colors.textPrimary;

  function goToGroup(groupId: string) {
    router.push({ pathname: '/(app)/grupo/[id]' as never, params: { id: groupId } });
  }

  async function handleScanned(data: string) {
    setScannerOpen(false);
    try {
      const group = await joinGroup(data);
      goToGroup(group.id);
    } catch (err) {
      if (err instanceof RoleLimitError) {
        setLimitSheetOpen(true);
      } else if (err instanceof GroupNotFoundError) {
        Alert.alert(t('groups.notFoundTitle'), t('groups.notFoundBody'));
      } else {
        Alert.alert(t('groups.joinFailedTitle'), err instanceof Error ? err.message : t('common.tryAgain'));
      }
    }
  }

  function handleUpgrade() {
    setLimitSheetOpen(false);
    setPaywallOpen(true);
  }

  function handleSubscribe() {
    setPaywallOpen(false);
    Alert.alert(t('limitPaywall.cta'), t('paywall.notAvailableYet'));
  }

  async function handleRefresh() {
    await Promise.all([refetch(), refetchProfile()]);
  }

  const sheetsOpen = joinSheetOpen || createSheetOpen || scannerOpen || limitSheetOpen || paywallOpen;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SwipeTabs onSwipeLeft={() => { if (!sheetsOpen) router.replace('/carteira'); }}>
      {/* Faixa de botões fixa, FORA do PullToRefresh — mesma anatomia do
          detalhe do rolê, e pelo mesmo motivo declarado lá: dentro do gesto,
          um toque no botão mexe no conteúdo e "pisca". */}
      <View style={styles.topBar}>
        <Image source={require('@/assets/logo-resenha.png')} style={styles.logo} resizeMode="contain" />

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.qrBtn} onPress={() => setJoinSheetOpen(true)} activeOpacity={0.7}>
            <QrCode size={20} color={colors.ink} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <PullToRefresh
        scrollY={scrollY}
        scrollRef={listRef}
        onRefresh={handleRefresh}
        disabled={joinSheetOpen || createSheetOpen || scannerOpen}
      >
      {/* ── Scroll content ──────────────────────────────────
          `Animated.ScrollView` e não `KeyboardAwareScrollView`: o campo de
          busca é o único input da tela e ele mora na barra grudenta, sempre
          visível no topo — não há o que o teclado possa esconder. E assim as
          três telas com PullToRefresh usam o mesmo scroll. */}
      <Animated.ScrollView
        ref={listRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // Ver carteira.tsx: com os dois gestos simultâneos, o bounce do iOS
        // somaria ao deslocamento do puxão.
        bounces={false}
        // As pills e a busca (índice 1) grudam no topo ao rolar: são os
        // controles do que a lista mostra. O saldo geral é informação de
        // chegada e rola junto, devolvendo a tela inteira pra lista.
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: spacing.xxl + 52 }}
      >
      {/* O saldo é somado a partir dos rolês: sem dado ele daria R$ 0,00 com a
          legenda "somando todos os seus rolês ativos" — uma afirmação que a
          tela ainda não pode fazer. Vira osso até a consulta responder. */}
      <View style={styles.header}>
        <View style={styles.balanceBlock}>
          {initialLoading ? (
            <>
              <Bone style={styles.balanceLabelBone} />
              <Bone style={styles.balanceValueBone} />
              <Bone style={styles.balanceCaptionBone} />
            </>
          ) : (
            <>
              <Text style={styles.balanceLabel}>{balanceLabel}</Text>
              <Text style={[styles.balanceValue, { color: balanceColor }]}>
                {totalBalance > 0 ? '+ ' : totalBalance < 0 ? '− ' : ''}{formatMoney(Math.abs(totalBalance))}
              </Text>
              <Text style={styles.balanceCaption}>{t('groups.balanceCaption')}</Text>
            </>
          )}
        </View>
      </View>

      {/* Fundo opaco: grudada no topo, esta barra passa por cima da lista
          rolando atrás. */}
      <View style={styles.controlsBar}>
        <View style={styles.pills}>
          {(['ativos', 'arquivados'] as const).map(tab => {
            const active = activeTab === tab;
            const count = tab === 'ativos' ? ativos.length : arquivados.length;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {tab === 'ativos' ? t('groups.active') : t('groups.archived')}
                </Text>
                {count > 0 && (
                  <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                    <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {showSearch && (
          <View style={[styles.searchBarPill, searchFocused && styles.searchBarPillFocused]}>
            <Search size={16} color={colors.textSecondary} strokeWidth={2.2} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={t('groups.searchPlaceholder')}
              placeholderTextColor="rgba(107,114,128,0.7)"
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
        )}
      </View>

      <View style={styles.listContent}>
        {initialLoading ? <GroupListSkeleton /> : error ? (
          <View style={styles.emptyStateSimple}>
            <Text style={styles.emptyTitle}>{t('groups.loadErrorTitle')}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.7}>
              <Text style={styles.retryBtnLabel}>{t('groups.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <QrCode size={24} color={colors.textSecondary} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'ativos' ? t('groups.emptyActiveTitle') : t('groups.emptyArchivedTitle')}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'ativos'
                ? t('groups.emptyActiveSubtitle')
                : t('groups.emptyArchivedSubtitle')}
            </Text>
          </View>
        ) : filteredDisplayed.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('groups.emptySearchTitle')}</Text>
            <Text style={styles.emptySubtitle}>{t('groups.emptySearchSubtitle')}</Text>
          </View>
        ) : (
          filteredDisplayed.map((group, index) => (
            <GroupCard
              key={group.id}
              groupId={group.id}
              name={group.name}
              photoUrl={getGroupAvatarUrl(group.avatarPath)}
              members={group.memberIds.map((id, i) => ({
                id,
                name: group.memberNames[i],
                photoUrl: group.memberPhotoUrls[i] ?? undefined,
                isMe: id === myProfile?.id,
              }))}
              netBalance={group.netBalance}
              archived={group.archived}
              lastActivityAt={group.lastActivityAt}
              index={index}
              onPress={() => goToGroup(group.id)}
            />
          ))
        )}

        {!initialLoading && !error && !searchQueryNormalized && activeTab === 'ativos' && displayed.length < 3 && (
          <TouchableOpacity
            style={[styles.ctaCard, displayed.length === 0 && styles.ctaCardAfterEmpty]}
            onPress={() => setCreateSheetOpen(true)}
            activeOpacity={0.7}
          >
            <View style={styles.ctaIconCircle}>
              <Plus size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <View style={styles.ctaText}>
              <Text style={styles.ctaTitle}>{t('groups.createCta')}</Text>
              <Text style={styles.ctaSubtitle}>{t('groups.createCtaSubtitle')}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
      </Animated.ScrollView>
      </PullToRefresh>

      {activeTab === 'ativos' && ativos.length >= 3 && (
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            { bottom: insets.bottom + spacing.lg },
            pressed && styles.fabPressed,
          ]}
          onPress={() => setCreateSheetOpen(true)}
        >
          <Plus size={24} color={colors.ink} strokeWidth={2.6} />
        </Pressable>
      )}
      </SwipeTabs>

      <JoinRoleSheet
        visible={joinSheetOpen}
        onClose={() => setJoinSheetOpen(false)}
        onOpenScanner={() => setScannerOpen(true)}
        onJoined={goToGroup}
        onLimitReached={() => setLimitSheetOpen(true)}
      />

      <QrScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanned}
      />

      <CreateRoleSheet
        visible={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        onCreated={groupId => { refetch(); goToGroup(groupId); }}
        onLimitReached={() => setLimitSheetOpen(true)}
      />

      <LimitPaywallSheet
        visible={limitSheetOpen}
        reason="roles"
        onClose={() => setLimitSheetOpen(false)}
        onUpgrade={handleUpgrade}
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
  listContent: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.pagePadding,
  },

  // ── Cabeçalho (rola junto) ────────────────────────────────
  header: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  // Barra grudada no topo pelo stickyHeaderIndices: pills e busca. Fundo opaco
  // pra a lista rolar por baixo sem transparecer.
  controlsBar: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  // Faixa de botões que fica fixa, fora do PullToRefresh — mesma anatomia da
  // faixa de ícones do detalhe do rolê.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
  },
  logo: {
    width: 88,
    height: 44,
  },
  headerRight: {
    flexDirection: 'row',
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
  // ── Balance ───────────────────────────────────────────────
  balanceBlock: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  balanceLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  balanceValue: {
    fontSize: fontSizes.heroLg,
    fontFamily: fontFamilies.semibold,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  balanceCaption: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Ossos com a altura do texto que substituem, pra o valor real entrar sem
  // empurrar o resto da tela.
  balanceLabelBone: {
    width: 130,
    height: 16,
    borderRadius: radius.full,
    marginBottom: 6,
  },
  balanceValueBone: {
    width: 200,
    height: 34,
    borderRadius: radius.full,
  },
  balanceCaptionBone: {
    width: 170,
    height: 11,
    borderRadius: radius.full,
    marginTop: 8,
  },

  // ── Pills ─────────────────────────────────────────────────
  pills: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  pillActive: {
    backgroundColor: colors.background,
    ...shadows.card,
  },
  pillText: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.textPrimary,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: colors.background,
  },
  countBadgeActive: {
    backgroundColor: colors.primary,
  },
  countText: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  countTextActive: {
    color: colors.ink,
  },

  // ── Busca ─────────────────────────────────────────────────
  searchBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchBarPillFocused: {
    borderColor: colors.primary,
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

  // ── Empty states ──────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  emptyStateSimple: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
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

  // ── CTA "Criar novo rolê" ─────────────────────────────────
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  ctaCardAfterEmpty: {
    marginTop: spacing.lg,
  },
  ctaIconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,197,24,0.25)',
  },
  ctaText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ctaTitle: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  ctaSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── FAB ───────────────────────────────────────────────────
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
  fabPressed: {
    transform: [{ scale: 0.95 }],
  },
});
