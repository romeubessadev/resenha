import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { ChevronDown, ChevronUp, Download, TrendingUp, TrendingDown, Minus, Check } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BackButton, CategoryExpensesSheet, CategoryIcon, ExportInsightsSheet, InsightSkeleton, LimitPaywallSheet } from '@/components';
import { useGroup } from '@/hooks/useGroup';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories, findCategory } from '@/hooks/useCategories';
import { useIsPremium } from '@/hooks/usePlan';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/currencies';
import { DEFAULT_CATEGORY_COLOR, getCategoryChipColor } from '@/lib/categoryColors';
import type { Language } from '@/lib/i18n';
import { fontFamilies, fontSizes, spacing, radius, shadows, type ColorPalette } from '@/theme';

const NOW = new Date();

// ── Constants ─────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function monthLabel(month: number, year: number, language: Language): string {
  return capitalize(new Date(year, month, 1).toLocaleDateString(language, { month: 'long' }));
}

function monthShortLabel(month: number, year: number, language: Language): string {
  return capitalize(new Date(year, month, 1).toLocaleDateString(language, { month: 'short' }));
}

type PeriodType = 'mes' | 'ano' | 'tudo';
type Scope = 'eu' | 'grupo';


function monthsInCurrentYear(currentMonth: number, currentYear: number, createdAt: string | null): { month: number; year: number }[] {
  const created = createdAt ? new Date(createdAt) : null;
  const startMonth = created && created.getFullYear() === currentYear ? created.getMonth() : 0;

  const list: { month: number; year: number }[] = [];
  for (let m = currentMonth; m >= startMonth; m--) {
    list.push({ month: m, year: currentYear });
  }
  return list;
}

// Ano/mês direto da string, sem passar por new Date(date) — esse parse trata
// 'YYYY-MM-DD' como meia-noite UTC, e em fuso negativo (Brasil, EUA) a despesa
// do dia 1º já cairia no mês anterior. Mesmo cuidado do yearOptions abaixo.
function inPeriod(date: string, m: number, y: number, kind: 'mes' | 'ano'): boolean {
  const year = Number(date.slice(0, 4));
  if (kind === 'ano') return year === y;
  return year === y && Number(date.slice(5, 7)) - 1 === m;
}

function amountFor(l: { myShare?: number; amount: number }, scope: Scope): number {
  return scope === 'eu' ? (l.myShare ?? 0) : l.amount;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function InsightScreen() {
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const { data: group, loading: groupLoading, error: groupError, refetch: refetchGroup } = useGroup(groupId);
  const { data: lancamentos, loading: expensesLoading, error: expensesError, refetch: refetchExpenses } = useExpenses(groupId);
  const { data: categories } = useCategories(groupId);
  const isPremium = useIsPremium();
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const groupName = group?.name ?? t('insight.groupFallback');

  const [scope, setScope] = useState<Scope>('eu');
  const [periodType, setPeriodType] = useState<PeriodType>('mes');
  const [month, setMonth] = useState(NOW.getMonth());
  const [year, setYear] = useState(NOW.getFullYear());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [limitSheetOpen, setLimitSheetOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(null);

  const periodLabel = periodType === 'ano' ? String(year) : monthLabel(month, year, language);
  const scopeLabel = scope === 'eu' ? t('insight.scopeMe') : t('insight.scopeGroup');

  const expenses = useMemo(() => lancamentos.filter(l => l.type === 'expense'), [lancamentos]);

  const filtered = useMemo(() => {
    if (periodType === 'tudo') return expenses;
    return expenses.filter(l => inPeriod(l.date, month, year, periodType));
  }, [expenses, periodType, month, year]);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;

  const filteredPrev = useMemo(() => {
    if (periodType === 'tudo') return [];
    if (periodType === 'mes') return expenses.filter(l => inPeriod(l.date, prevMonth, prevMonthYear, 'mes'));
    return expenses.filter(l => inPeriod(l.date, 0, year - 1, 'ano'));
  }, [expenses, periodType, year, prevMonth, prevMonthYear]);

  const total = useMemo(() => filtered.reduce((s, l) => s + amountFor(l, scope), 0), [filtered, scope]);
  const prevTotal = useMemo(() => filteredPrev.reduce((s, l) => s + amountFor(l, scope), 0), [filteredPrev, scope]);

  const hasPrevData = periodType !== 'tudo' && filteredPrev.length > 0;
  const delta = hasPrevData && prevTotal > 0 ? (total - prevTotal) / prevTotal : hasPrevData ? 0 : null;

  const prevPeriodWord = periodType === 'ano' ? t('insight.periodWordYear') : t('insight.periodWordMonth');

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of filtered) {
      const key = l.categoryId ?? 'sem-categoria';
      map[key] = (map[key] ?? 0) + amountFor(l, scope);
    }
    return Object.entries(map)
      .filter(([, amount]) => amount > 0)
      .map(([key, amount]) => {
        const cat = findCategory(categories, key);
        return {
          key,
          label: cat?.name ?? t('common.categoryFallback'),
          color: cat?.color ?? DEFAULT_CATEGORY_COLOR,
          icon: cat?.icon,
          amount,
          pct: total > 0 ? Math.round((amount / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filtered, total, categories, scope, t]);

  const categoryNameById = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);

  // O sheet guarda só a chave da categoria, não o objeto: assim ele acompanha
  // troca de período/escopo enquanto está aberto, em vez de congelar o valor
  // que existia no momento do toque.
  const openCategory = useMemo(
    () => categoryData.find(c => c.key === openCategoryKey) ?? null,
    [categoryData, openCategoryKey],
  );

  // No escopo 'eu' a lista mostra a SUA parte de cada despesa, então despesa em
  // que você não entrou no rateio sai fora: ela contribui 0 pro total do card e
  // só apareceria como uma linha de valor zero.
  const openCategoryExpenses = useMemo(() => {
    if (openCategoryKey === null) return [];
    const ofCategory = filtered.filter(l => (l.categoryId ?? 'sem-categoria') === openCategoryKey);
    return scope === 'eu' ? ofCategory.filter(l => (l.myShare ?? 0) > 0) : ofCategory;
  }, [filtered, openCategoryKey, scope]);

  const monthOptions = useMemo(
    () => monthsInCurrentYear(NOW.getMonth(), NOW.getFullYear(), group?.createdAt ?? null),
    [group?.createdAt],
  );

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    // Ano direto da string (antes do "T"), sem passar por new Date(l.date) —
    // esse parse trata o timestamp como instante UTC, e uma despesa
    // materializada na virada do ano (meia-noite UTC) já cairia no ano
    // anterior em fuso negativo (Brasil, EUA).
    for (const l of expenses) years.add(Number(l.date.slice(0, 4)));
    years.add(NOW.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses]);

  const loading = groupLoading || expensesLoading;
  const errorMsg = groupError || expensesError;


  function retry() {
    refetchGroup();
    refetchExpenses();
  }

  function selectMonth(m: number, y: number) {
    setMonth(m);
    setYear(y);
    setPickerOpen(false);
  }

  function selectYear(y: number) {
    setYear(y);
    setPickerOpen(false);
  }

  function openExport() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPremium) setExportOpen(true);
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <BackButton style={styles.backBtn} />
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{t('insight.eyebrow')}</Text>
          <Text style={styles.title} numberOfLines={1}>{groupName}</Text>
        </View>
        <Pressable
          onPress={openExport}
          accessibilityLabel={t('insight.exportButtonLabel')}
          hitSlop={8}
          style={({ pressed }) => [styles.exportBtn, pressed && styles.exportBtnPressed]}
        >
          <Download size={20} color={colors.textPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>

      {loading ? (
        <InsightSkeleton />
      ) : errorMsg || !group ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{t('insight.loadErrorTitle')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.7}>
            <Text style={styles.retryBtnLabel}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.fixed}>
            {/* Escopo */}
            <View style={styles.segmented}>
              <SegButton styles={styles} label={t('insight.scopeMe')} active={scope === 'eu'} onPress={() => setScope('eu')} />
              <SegButton styles={styles} label={t('insight.scopeGroup')} active={scope === 'grupo'} onPress={() => setScope('grupo')} />
            </View>

            {/* Período */}
            <View style={styles.segmented}>
              <SegButton styles={styles} label={t('insight.periodMonth')} active={periodType === 'mes'} onPress={() => { setPeriodType('mes'); setPickerOpen(false); }} />
              <SegButton styles={styles} label={t('insight.periodYear')} active={periodType === 'ano'} onPress={() => { setPeriodType('ano'); setPickerOpen(false); }} />
              <SegButton styles={styles} label={t('insight.periodAll')} active={periodType === 'tudo'} onPress={() => { setPeriodType('tudo'); setPickerOpen(false); }} />
            </View>

            {periodType !== 'tudo' && (
              <View style={styles.pickerWrap}>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setPickerOpen(o => !o)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerLabel}>{periodLabel}</Text>
                  {pickerOpen
                    ? <ChevronUp size={20} color={colors.textPrimary} strokeWidth={2} />
                    : <ChevronDown size={20} color={colors.textPrimary} strokeWidth={2} />
                  }
                </TouchableOpacity>

                {pickerOpen && (
                  <>
                    <Pressable style={styles.pickerBackdrop} onPress={() => setPickerOpen(false)} />
                    <View style={styles.pickerDropdown}>
                      <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerList}>
                        {periodType === 'mes'
                          ? monthOptions.map(({ month: m, year: y }) => {
                              const isSelected = m === month && y === year;
                              return (
                                <TouchableOpacity
                                  key={`${y}-${m}`}
                                  style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                                  onPress={() => selectMonth(m, y)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.pickerItemLabel}>{monthLabel(m, y, language)}</Text>
                                  {isSelected && <Check size={18} color={colors.forest} strokeWidth={2.5} />}
                                </TouchableOpacity>
                              );
                            })
                          : yearOptions.map(y => {
                              const isSelected = y === year;
                              return (
                                <TouchableOpacity
                                  key={y}
                                  style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                                  onPress={() => selectYear(y)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.pickerItemLabel}>{y}</Text>
                                  {isSelected && <Check size={18} color={colors.forest} strokeWidth={2.5} />}
                                </TouchableOpacity>
                              );
                            })
                        }
                      </ScrollView>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Card resumo */}
            <View style={styles.card}>
              <View style={styles.cardLabelRow}>
                <Text style={styles.cardLabel}>
                  {scope === 'eu' ? t('insight.spentByMe') : t('insight.spentByGroup')}
                  {periodType !== 'tudo' && ` · ${periodType === 'ano' ? year : `${monthShortLabel(month, year, language)}/${String(year).slice(2)}`}`}
                  {periodType === 'tudo' && ` · ${t('insight.sinceBeginning')}`}
                </Text>
              </View>
              <Text style={styles.cardAmount}>
                {formatMoney(total)}
              </Text>

              {periodType !== 'tudo' && (
                delta === null ? (
                  <View style={styles.cardCompareRow}>
                    <Text style={styles.cardCompareMuted}>
                      {t('insight.noPrevData', { period: prevPeriodWord })}
                    </Text>
                  </View>
                ) : delta === 0 ? (
                  <View style={styles.cardCompareRow}>
                    <Minus size={16} color={colors.textSecondary} strokeWidth={2.5} />
                    <Text style={styles.cardCompareMuted}>{t('insight.deltaEqual', { period: prevPeriodWord })}</Text>
                  </View>
                ) : delta > 0 ? (
                  <View style={styles.cardCompareRow}>
                    <TrendingUp size={16} color={colors.coral} strokeWidth={2.5} />
                    <Text style={styles.cardCompareCoral}>
                      {t('insight.deltaMore', { pct: Math.round(delta * 100), period: prevPeriodWord })}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.cardCompareRow}>
                    <TrendingDown size={16} color={colors.forest} strokeWidth={2.5} />
                    <Text style={styles.cardCompareForest}>
                      {t('insight.deltaLess', { pct: Math.round(Math.abs(delta) * 100), period: prevPeriodWord })}
                    </Text>
                  </View>
                )
              )}
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg }]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('insight.byCategory')}</Text>
            </View>

            {categoryData.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>{t('insight.emptyTitle')}</Text>
                <Text style={styles.emptyStateDescription}>{t('insight.emptySubtitle')}</Text>
              </View>
            ) : (
              <View>
                {categoryData.map(item => {
                  const valueLabel = formatMoney(item.amount);
                  return (
                  <View key={item.key}>
                  <Pressable
                    style={({ pressed }) => [styles.categoryRow, pressed && styles.categoryRowPressed]}
                    onPress={() => setOpenCategoryKey(item.key)}
                  >
                    <View style={styles.categoryContent}>
                      <View style={styles.categoryHeaderRow}>
                        {/* Mesmo par ícone+cor que a despesa mostra na lista do
                            resenha: quem olha o gráfico reconhece de onde a fatia
                            veio sem precisar ler o rótulo. */}
                        <View style={[styles.categoryIconCircle, { backgroundColor: getCategoryChipColor(item.color) }]}>
                          <CategoryIcon icon={item.icon} size={20} color={item.color} />
                        </View>
                        <View style={styles.categoryTextCol}>
                          <Text style={styles.categoryName} numberOfLines={1}>{item.label}</Text>
                          <Text style={styles.categoryPct}>{t('insight.percentOfTotal', { pct: item.pct })}</Text>
                        </View>
                        <View style={styles.categoryValueCol}>
                          <Text style={styles.categoryValue}>{valueLabel}</Text>
                        </View>
                      </View>
                      <View style={styles.categoryTrack}>
                        <View
                          style={[
                            styles.categoryFill,
                            { width: `${Math.max(item.pct, 4)}%`, backgroundColor: item.color },
                          ]}
                        />
                      </View>
                    </View>
                  </Pressable>
                  </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </>
      )}

      <CategoryExpensesSheet
        visible={openCategoryKey !== null}
        onClose={() => setOpenCategoryKey(null)}
        category={openCategory}
        expenses={openCategoryExpenses}
        scope={scope}
      />

      <ExportInsightsSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        groupName={groupName}
        periodLabel={periodLabel}
        scopeLabel={scopeLabel}
        expenses={filtered}
        categoryData={categoryData}
        categoryNameById={categoryNameById}
        total={total}
      />

      <LimitPaywallSheet
        visible={limitSheetOpen}
        reason="export"
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

// ── SegButton ─────────────────────────────────────────────────────────────────

function SegButton({ label, active, onPress, styles }: { label: string; active: boolean; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  return (
    <TouchableOpacity
      style={[styles.segBtn, active && styles.segBtnActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.segLabel, active && styles.segLabelActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pagePadding,
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
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

  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backBtn: {
    alignSelf: 'center',
    marginBottom: 0,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  title: {
    fontSize: fontSizes.h1Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnPressed: {
    backgroundColor: colors.surface,
  },

  // ── Fixed filters area ──────────────────────────────────────────────────────
  fixed: {
    paddingHorizontal: spacing.pagePadding,
    gap: spacing.md,
  },

  // ── Segmented control ───────────────────────────────────────────────────────
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  segBtnActive: {
    backgroundColor: colors.background,
    ...shadows.card,
  },
  segLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  segLabelActive: {
    color: colors.textPrimary,
  },

  // ── Period picker ────────────────────────────────────────────────────────────
  pickerWrap: {
    position: 'relative',
    zIndex: 10,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
  },
  pickerLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  pickerBackdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
  },
  pickerDropdown: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    maxHeight: 280,
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    ...shadows.balance,
    overflow: 'hidden',
  },
  pickerList: {
    paddingVertical: spacing.xs,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pickerItemSelected: {
    backgroundColor: colors.background,
  },
  pickerItemLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },

  // ── Stats card ───────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['3xl'],
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  cardAmount: {
    fontSize: fontSizes.heroSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  cardAmountSecondary: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  // Quem afasta a linha de comparação do valor é SEMPRE esta linha, nunca o
  // texto: com o marginTop no texto, o estado "igual ao mês anterior" (que põe
  // o texto dentro desta row, ao lado do ícone) empurrava só o texto e ele
  // descia 4px em relação ao ícone. Os três estados usam esta row.
  cardCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  cardCompareMuted: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  cardCompareCoral: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.coral,
  },
  cardCompareForest: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.forest,
  },

  // ── Scroll / category list ───────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // 4 + os 12 de padding do topo da primeira categoria = os 16 de sempre até
    // o primeiro item. O respiro da lista mora no padding da linha, pra que
    // ele seja tocável junto com ela.
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  // Mesma linha da lista de resenhas (GroupCard): padding 12, raio 2xl, realce
  // `surface` ao pressionar e nada de traço — quem separa uma categoria da
  // outra são os 12+12 de padding, e é padding (não gap da lista) pra que a
  // faixa inteira seja tocável e o realce cubra ela toda.
  //
  // 12 aqui vale mais que na lista de despesas: esta linha tem 8px de vão
  // interno entre o cabeçalho e a barra, então com 16 de respiro externo a
  // razão cairia pra 2:1 e a barra de uma categoria ficaria quase tão perto
  // do nome da seguinte quanto do próprio.
  //
  // A margem negativa faz o realce sangrar 12px pra cada lado sem desalinhar
  // o conteúdo com o resto da tela.
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -(spacing.sm + 4),
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius['2xl'],
  },
  categoryRowPressed: {
    backgroundColor: colors.surface,
  },
  categoryContent: {
    flex: 1,
    gap: spacing.sm,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // 12, igual ao vão entre ícone e título na lista de despesas da resenha.
    gap: spacing.sm + 4,
  },
  categoryIconCircle: {
    // 40/20/16 é a medida de lista do app (despesa na resenha, HistoryFeed,
    // seletor de categoria) — ver a regra em components/CategoryIcon.tsx.
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mesma anatomia da lista de despesas: ícone | título + subtítulo | valor.
  // O "% do total" é o subtítulo — estava numa terceira linha, que era o que
  // deixava a linha do Insight 50% mais alta que as outras listas do app.
  categoryTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  categoryName: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  categoryValueCol: {
    alignItems: 'flex-end',
  },
  categoryValue: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  categoryValueSecondary: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  categoryTrack: {
    height: 8,
    borderRadius: radius.full,
    // `gray200` e não `surface`: o trilho fica sobre `background`, e ali
    // `surface` é 3% de diferença — some, e a barra vira um pedaço de cor
    // solto, sem referência de quanto é o total.
    backgroundColor: colors.gray200,
    overflow: 'hidden',
  },
  categoryFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  categoryPct: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  emptyStateDescription: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
});
