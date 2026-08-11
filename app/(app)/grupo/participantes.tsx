import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { UserPlus, LogOut, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, BackButton, InviteQrSheet, LeaveGroupSheet, MemberActionsSheet, ParticipantsSkeleton } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useGroup, type GroupMember } from '@/hooks/useGroup';
import { useGroupBalances } from '@/hooks/useGroupBalances';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/currencies';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

// Ordenação do handoff: dono → admins extras → você → demais (alfabética).
// "Você" só pula a fila dentro do grupo de participantes comuns — se você
// já é dono ou admin, sua posição vem só do seu papel.
function roleRank(role: GroupMember['role']): number {
  if (role === 'owner') return 0;
  if (role === 'admin') return 1;
  return 2;
}

function sortMembers(members: GroupMember[], language: string): GroupMember[] {
  return [...members].sort((a, b) => {
    const rankDiff = roleRank(a.role) - roleRank(b.role);
    if (rankDiff !== 0) return rankDiff;
    if (a.role === 'member') {
      if (a.isMe && !b.isMe) return -1;
      if (b.isMe && !a.isMe) return 1;
    }
    return a.name.localeCompare(b.name, language);
  });
}

// Modelo do WhatsApp: admin age sobre qualquer um, menos sobre quem criou o
// rolê. O papel 'owner' continua existindo no banco, mas some da interface —
// pra quem usa, existe só "admin"; o dono é um admin que ninguém rebaixa.
//
// A proteção do criador é o que evita guerra de rebaixamento e o que garante
// que sempre reste alguém no comando.
function canActOn(myRole: GroupMember['role'], targetRole: GroupMember['role']): boolean {
  if (myRole !== 'owner' && myRole !== 'admin') return false;
  return targetRole !== 'owner';
}

export default function ParticipantesScreen() {
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { session } = useAuth();
  const myUserId = session?.user.id;
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: group, loading: groupLoading, error: groupError, refetch: refetchGroup } = useGroup(groupId);
  const { balances } = useGroupBalances(groupId);

  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [actionsTarget, setActionsTarget] = useState<GroupMember | null>(null);

  if (groupLoading && !group) {
    return <ParticipantsSkeleton />;
  }

  if (groupError || !group) {
    return (
      <View style={[styles.container, styles.centerFill, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{t('participants.loadErrorTitle')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetchGroup()} activeOpacity={0.7}>
          <Text style={styles.retryBtnLabel}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const members = group.members;
  const sorted = sortMembers(members, language);
  const myRole = members.find(m => m.isMe)?.role ?? 'member';
  const isOwner = myRole === 'owner';
  const isAdminOrOwner = myRole === 'owner' || myRole === 'admin';
  const myBalance = myUserId ? (balances[myUserId] ?? 0) : 0;
  const actionsTargetBalance = actionsTarget ? (balances[actionsTarget.id] ?? 0) : 0;
  const otherMembers = members
    .filter(m => !m.isMe)
    .map(m => ({ id: m.id, name: m.name, joinedAt: m.joinedAt, role: m.role, balance: balances[m.id] ?? 0 }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <BackButton style={styles.headerBackBtn} />
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>{t('participants.title')}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{group.name}</Text>
          </View>
        </View>
        {isAdminOrOwner && (
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={() => setInviteSheetOpen(true)}
            activeOpacity={0.7}
          >
            <UserPlus size={20} color={colors.ink} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.countLabel}>
        {t(members.length === 1 ? 'participants.countSingular' : 'participants.countPlural', { count: members.length })}
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xl }]}
      >
        {sorted.map(m => {
          const balance = balances[m.id] ?? 0;
          const status = balance === 0 ? 'quite' : balance > 0 ? 'receber' : 'devendo';
          const valueColor = status === 'receber' ? colors.forest : status === 'devendo' ? colors.coral : colors.textSecondary;
          const valuePrefix = status === 'receber' ? '+ ' : status === 'devendo' ? '− ' : '';
          const balanceLabel = formatMoney(Math.abs(balance));
          const statusLabel = status === 'quite'
            ? t('participants.statusEven')
            : status === 'receber'
              ? t('participants.statusReceivable', { amount: balanceLabel })
              : t('participants.statusOwing', { amount: balanceLabel });
          const hasActions = !m.isMe && canActOn(myRole, m.role);

          return (
            <TouchableOpacity
              key={m.id}
              style={styles.memberRow}
              onPress={hasActions ? () => setActionsTarget(m) : undefined}
              disabled={!hasActions}
              activeOpacity={hasActions ? 0.7 : 1}
            >
              <Avatar name={m.name} id={m.id} photoUrl={m.photoUrl ?? undefined} size={44} variant="colorful" />
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName} numberOfLines={1}>{m.isMe ? t('common.youCapitalized') : m.name}</Text>
                  {/* Dono e admin usam o MESMO rótulo: pra quem usa o app existe
                      só "admin". O papel de dono continua no banco protegendo
                      quem criou de ser rebaixado, mas não é exposto. */}
                  {(m.role === 'owner' || m.role === 'admin') && (
                    <View style={styles.adminChip}>
                      <ShieldCheck size={13} color={colors.successLight} fill={colors.forest} strokeWidth={2.5} />
                      <Text style={styles.adminTag}>{t('participants.adminTag')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.memberStatus} numberOfLines={1}>{statusLabel}</Text>
              </View>
              <View style={styles.memberValueCol}>
                <Text style={[styles.memberValue, { color: valueColor }]}>{valuePrefix}{balanceLabel}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={() => setLeaveSheetOpen(true)}
          activeOpacity={0.7}
        >
          <LogOut size={18} color={colors.coral} strokeWidth={2} />
          <Text style={styles.leaveBtnLabel}>{t('participants.leaveGroup')}</Text>
        </TouchableOpacity>
        <Text style={styles.leaveLegend}>
          {isOwner
            ? t('participants.leaveLegendOwner')
            : t('participants.leaveLegendMember')}
        </Text>
      </ScrollView>

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
        myBalance={myBalance}
        otherMembers={otherMembers}
      />

      <MemberActionsSheet
        visible={actionsTarget !== null}
        onClose={() => setActionsTarget(null)}
        groupId={group.id}
        member={actionsTarget}
        targetBalance={actionsTargetBalance}
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

  // ── Header ────────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  headerBackBtn: {
    alignSelf: 'center',
    marginBottom: 0,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  inviteBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },

  // ── Count ─────────────────────────────────────────────────────────────────────
  countLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: spacing.pagePadding,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius['2xl'],
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberName: {
    flexShrink: 1,
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  // Selo de verificado: fundo verde lavado com ícone e texto no verde cheio —
  // o mesmo par "lavagem + cor cheia" que o Histórico do rolê usa. O escudo é
  // CHEIO (fill) com o traço na cor do fundo, então o "check" aparece vazado —
  // só de contorno o ícone some a 13px. Escapa do padrão uppercase dos
  // micro-rótulos da tela (PAGOU, countLabel) porque aqui não é rótulo de
  // coluna, é selo ao lado do nome.
  adminChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs - 1,
    borderRadius: radius.full,
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  adminTag: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.forest,
    textTransform: 'lowercase',
  },
  memberStatus: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  memberValueCol: {
    alignItems: 'flex-end',
  },
  memberValue: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
  },
  memberValueSecondary: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },

  // ── Sair do rolê ──────────────────────────────────────────────────────────────
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 52,
    marginTop: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,118,67,0.3)',
  },
  leaveBtnLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.coral,
  },
  leaveLegend: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
