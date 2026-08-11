import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { HistoryFeedSkeleton } from './HistoryFeedSkeleton';
import {
  ArrowLeftRight, Lock, Pencil, PartyPopper, Receipt, Repeat, Settings2, ShieldCheck, Sparkles, Trash2, UserMinus, UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import { useGroupHistory, type HistoryEvent } from '@/hooks/useGroupHistory';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { groupEventsByDay, historyEventAmount, historyEventText, isVisibleHistoryEvent } from '@/lib/historyText';
import type { Language, TranslationKey } from '@/lib/i18n';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  groupId: string;
  myUserId: string;
  isPremium: boolean;
  onUpgradePress: () => void;
};

const FREE_HISTORY_LIMIT = 5;

type TypeStyle = { icon: LucideIcon; bg: string; fg: string };

// Cada tipo de evento tem um par cor-de-fundo/cor-do-traço da MESMA família: o
// fundo é a cor lavada, o traço é a cor cheia. Os de fundo mostarda usavam
// `ink` e eram os únicos fora dessa regra — além de quebrarem no dark mode, em
// que a mostarda lavada vira um oliva escuro e um quase-preto em cima some.
// `primaryDark` é a mesma mostarda em versão cheia, que o app já usa em cima
// de lavagem mostarda (ver o brilho do "Ditar despesa").
function typeStyle(event: HistoryEvent, colors: ColorPalette): TypeStyle {
  switch (event.type) {
    case 'expense_created':
      return { icon: Receipt, bg: 'rgba(245,197,24,0.2)', fg: colors.primaryDark };
    case 'expense_edited':
      return { icon: Pencil, bg: 'rgba(0,94,49,0.15)', fg: colors.forest };
    case 'expense_deleted':
      return { icon: Trash2, bg: 'rgba(239,68,68,0.15)', fg: colors.danger };
    case 'settlement':
      return { icon: ArrowLeftRight, bg: 'rgba(0,94,49,0.15)', fg: colors.forest };
    case 'member_joined':
      return { icon: UserPlus, bg: 'rgba(255,163,186,0.25)', fg: colors.pinkDeep };
    case 'member_left':
      return { icon: UserMinus, bg: colors.surface, fg: colors.textSecondary };
    case 'admin_changed':
      // Mesmo escudo do chip de "Admin" em participantes.tsx — não existe
      // ícone próprio de dono porque não existe papel de dono na interface.
      return { icon: ShieldCheck, bg: 'rgba(0,94,49,0.15)', fg: colors.forest };
    case 'group_edited':
      return { icon: Settings2, bg: colors.surface, fg: colors.textSecondary };
    case 'group_created':
      return { icon: PartyPopper, bg: 'rgba(0,94,49,0.15)', fg: colors.forest };
    // Os três de recorrência usam o MESMO Repeat da linha 'Tornar recorrente'
    // no formulário e do card no detalhe — quem vê o feed reconhece do que se
    // trata sem ler. O que muda é a cor: pausar é estado suspenso (neutro),
    // retomar e mexer no ritmo seguem ativos.
    case 'recurrence_paused':
      return { icon: Repeat, bg: colors.surface, fg: colors.textSecondary };
    case 'recurrence_resumed':
    case 'recurrence_edited':
      return { icon: Repeat, bg: 'rgba(245,197,24,0.2)', fg: colors.primaryDark };
  }
}

export function HistoryFeed({ groupId, myUserId, isPremium, onUpgradePress }: Props) {
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: allEvents, isInitialLoading, error, refetch } = useGroupHistory(groupId);

  // Filtra ANTES do corte do free: se sobrasse pra depois, uma troca de coroa
  // invisível gastaria uma das FREE_HISTORY_LIMIT linhas e o plano free
  // mostraria menos eventos do que deveria.
  const events = useMemo(() => allEvents.filter(isVisibleHistoryEvent), [allEvents]);
  const truncated = !isPremium && events.length > FREE_HISTORY_LIMIT;
  const visibleEvents = truncated ? events.slice(0, FREE_HISTORY_LIMIT) : events;
  const dayGroups = useMemo(() => groupEventsByDay(visibleEvents, language), [visibleEvents, language]);

  if (isInitialLoading) {
    return <HistoryFeedSkeleton />;
  }

  if (error) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.7}>
          <Text style={styles.retryBtnLabel}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.centerFill}>
        <View style={styles.emptyIconCircle}>
          <Sparkles size={24} color={colors.textSecondary} strokeWidth={2} />
        </View>
        <Text style={styles.emptyTitle}>{t('history.emptyTitle')}</Text>
        <Text style={styles.emptySubtitle}>{t('history.emptySubtitle')}</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      {dayGroups.map(group => (
        <View key={group.events[0].id} style={styles.dayGroup}>
          <Text style={styles.dayHeader}>{group.label}</Text>
          {group.events.map((event, index) => (
            <HistoryRow
              key={event.id}
              event={event}
              isLast={index === group.events.length - 1}
              myUserId={myUserId}
              language={language}
              t={t}
              colors={colors}
              styles={styles}
            />
          ))}
        </View>
      ))}

      {truncated && (
        <TouchableOpacity style={styles.upgradeRow} onPress={onUpgradePress} activeOpacity={0.7}>
          <View style={styles.upgradeIconCircle}>
            <Lock size={16} color={colors.ink} strokeWidth={2.2} />
          </View>
          <Text style={styles.upgradeLabel}>{t('history.upgradeCta')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── HistoryRow ────────────────────────────────────────────────────────────────

type HistoryRowProps = {
  event: HistoryEvent;
  isLast: boolean;
  myUserId: string;
  language: Language;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  colors: ColorPalette;
  styles: ReturnType<typeof createStyles>;
};

function HistoryRow({ event, isLast, myUserId, language, t, colors, styles }: HistoryRowProps) {
  const { title, detail } = historyEventText(event, myUserId, t);
  const amount = historyEventAmount(event);
  const { icon: Icon, bg, fg } = typeStyle(event, colors);
  const time = new Date(event.at).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.row}>
      <View style={styles.iconCol}>
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Icon size={16} color={fg} strokeWidth={2.2} />
        </View>
        {!isLast && <View style={styles.connector} />}
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
          {amount && (
            <Text
              style={[
                styles.rowAmount,
                amount.variant === 'deleted' && styles.rowAmountDeleted,
                amount.variant === 'settlement' && styles.rowAmountSettlement,
              ]}
            >
              {amount.text}
            </Text>
          )}
        </View>
        {detail && <Text style={styles.rowDetail} numberOfLines={2}>{detail}</Text>}
        <Text style={styles.rowTime}>{time}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.xl * 2,
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
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  scrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  dayGroup: {
    marginBottom: spacing.md,
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surface,
  },
  upgradeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeLabel: {
    flex: 1,
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  dayHeader: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },

  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconCol: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    width: 1,
    minHeight: spacing.md,
    backgroundColor: colors.border,
  },
  rowContent: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: 2,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: {
    flex: 1,
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  rowAmount: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  rowAmountDeleted: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  rowAmountSettlement: {
    color: colors.forest,
  },
  rowDetail: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  rowTime: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
});
