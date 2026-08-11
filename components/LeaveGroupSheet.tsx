import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { X, AlertCircle, ArrowRightLeft } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { useLeaveGroup, type GroupMember } from '@/hooks/useGroup';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/currencies';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type OtherMember = { id: string; name: string; joinedAt: string; balance: number; role: GroupMember['role'] };

type LeaveState = 'blocked' | 'owner-others-open' | 'owner-alone' | 'owner-all-quite' | 'member-ok';

function resolveState(isOwner: boolean, myBalance: number, otherMembers: OtherMember[]): LeaveState {
  if (myBalance !== 0) return 'blocked';
  if (isOwner && otherMembers.length === 0) return 'owner-alone';
  if (isOwner && otherMembers.some(m => m.balance !== 0)) return 'owner-others-open';
  if (isOwner) return 'owner-all-quite';
  return 'member-ok';
}

// Espelha promote_oldest_after_admin_leaves: admin mais antigo
// primeiro; membro mais antigo só se não sobrar nenhum admin.
function getNextAdmin(otherMembers: OtherMember[]): OtherMember | undefined {
  return [...otherMembers].sort((a, b) => {
    const rank = (m: OtherMember) => (m.role === 'admin' ? 0 : 1);
    return rank(a) - rank(b) || a.joinedAt.localeCompare(b.joinedAt);
  })[0];
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  groupId: string;
  isOwner: boolean;
  myBalance: number;
  otherMembers: OtherMember[];
};

export function LeaveGroupSheet({ visible, onClose, onClosed, groupId, isOwner, myBalance, otherMembers }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { leaveGroup, loading } = useLeaveGroup();
  const state = resolveState(isOwner, myBalance, otherMembers);
  const nextAdmin = getNextAdmin(otherMembers);
  const nextAdminName = nextAdmin?.name ?? t('leaveGroup.nextParticipantFallback');
  const nextAdminFirstName = nextAdmin ? nextAdmin.name.split(' ')[0] : t('leaveGroup.nextPersonFallback');
  // Se o herdeiro já é admin, sair não muda papel nenhum aos olhos de quem usa
  // o app — não faz sentido anunciar transferência nem oferecer "escolher
  // outro admin". Só quando a coroa cai num membro comum é que alguém sobe.
  const promotesSomeone = nextAdmin !== undefined && nextAdmin.role !== 'admin';

  async function handleLeave() {
    try {
      await leaveGroup(groupId);
      onClose();
      router.replace('/grupos');
    } catch (err) {
      // TEMPORÁRIO: mostra o erro real (em vez da mensagem genérica) pra
      // diagnosticar por que "Sair da resenha" não estava removendo o grupo da
      // lista — reverter pra t('common.tryAgain') depois de confirmado.
      console.error('[LeaveGroupSheet] handleLeave falhou:', err);
      Alert.alert(t('leaveGroup.leaveFailedTitle'), err instanceof Error ? err.message : String(err));
    }
  }

  function handleChooseOtherAdmin() {
    onClose();
    router.push({ pathname: '/(app)/grupo/participantes' as never, params: { groupId } });
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} onClosed={onClosed}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('leaveGroup.action')}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {state === 'blocked' && (
        <View style={styles.warnCard}>
          <View style={styles.warnIconCircle}>
            <AlertCircle size={16} color={colors.coral} strokeWidth={2} />
          </View>
          <View style={styles.warnTextCol}>
            <Text style={styles.warnTitle}>{t('leaveGroup.blockedTitle')}</Text>
            <Text style={styles.warnMessage}>
              {myBalance > 0
                ? t('leaveGroup.blockedReceivable', { amount: formatMoney(Math.abs(myBalance)) })
                : t('leaveGroup.blockedOwe', { amount: formatMoney(Math.abs(myBalance)) })}
            </Text>
          </View>
        </View>
      )}

      {state === 'owner-others-open' && (
        <>
          <Text style={styles.explain}>
            {promotesSomeone ? (
              <>
                {t('leaveGroup.ownerOthersOpenPre')}{' '}
                <Text style={styles.explainBold}>{nextAdminName}</Text> {t('leaveGroup.ownerOthersOpenPost')}
              </>
            ) : (
              t('leaveGroup.ownerOthersOpenHasAdmin')
            )}
          </Text>
          <View style={styles.actions}>
            {/* Texto puro, como todo botão de confirmação do app (ver
                ConfirmSheet): o título já nomeia a ação e a cor já carrega a
                gravidade. */}
            <TouchableOpacity style={styles.solidBtn} onPress={handleLeave} activeOpacity={0.85} disabled={loading}>
              <Text style={styles.solidBtnLabel}>
                {loading
                  ? t('leaveGroup.leaving')
                  : promotesSomeone
                    ? t('leaveGroup.leaveAndTransfer', { name: nextAdminFirstName })
                    : t('leaveGroup.action')}
              </Text>
            </TouchableOpacity>
            {promotesSomeone && (
              <TouchableOpacity style={styles.outlineBtn} onPress={handleChooseOtherAdmin} activeOpacity={0.7}>
                <ArrowRightLeft size={16} color={colors.coral} strokeWidth={2.2} />
                <Text style={styles.outlineBtnLabel}>{t('leaveGroup.chooseOtherAdmin')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {state === 'owner-alone' && (
        <>
          <Text style={styles.explain}>
            {t('leaveGroup.aloneBefore')} <Text style={styles.explainBold}>{t('leaveGroup.aloneBold')}</Text> {t('leaveGroup.aloneAfter')}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.solidBtn} onPress={handleLeave} activeOpacity={0.85} disabled={loading}>
              <Text style={styles.solidBtnLabel}>{loading ? t('leaveGroup.leaving') : t('leaveGroup.leaveAndDelete')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {state === 'owner-all-quite' && (
        <>
          <Text style={styles.explain}>
            {promotesSomeone ? (
              <>
                {t('leaveGroup.ownerAllQuietPre')} <Text style={styles.explainBold}>{nextAdminName}</Text>{' '}
                {t('leaveGroup.ownerAllQuietPost')}
              </>
            ) : (
              t('leaveGroup.ownerAllQuietHasAdmin')
            )}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.solidBtn} onPress={handleLeave} activeOpacity={0.85} disabled={loading}>
              <Text style={styles.solidBtnLabel}>{loading ? t('leaveGroup.leaving') : t('leaveGroup.action')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {state === 'member-ok' && (
        <>
          <Text style={styles.explain}>
            {t('leaveGroup.memberOkExplain')}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.solidBtn} onPress={handleLeave} activeOpacity={0.85} disabled={loading}>
              <Text style={styles.solidBtnLabel}>{loading ? t('leaveGroup.leaving') : t('leaveGroup.action')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {state !== 'blocked' && (
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.cancelBtn}>
          <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      )}
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
  warnCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,118,67,0.1)',
  },
  warnIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,118,67,0.15)',
  },
  warnTextCol: {
    flex: 1,
    gap: 2,
  },
  warnTitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  warnMessage: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  explain: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  explainBold: {
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  actions: {
    gap: spacing.sm,
  },
  solidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.coral,
  },
  solidBtnLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.white,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,118,67,0.3)',
  },
  outlineBtnLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.coral,
  },
  cancelBtn: {
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
});
