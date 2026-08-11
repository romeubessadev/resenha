import { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { X, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { BottomSheetModal } from './BottomSheetModal';
import { ConfirmSheet } from './ConfirmSheet';
import { useRemoveMember, usePromoteToAdmin, useDemoteAdmin, type GroupMember } from '@/hooks/useGroup';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import type { TranslationKey } from '@/lib/i18n';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  groupId: string;
  member: GroupMember | null;
  targetBalance: number;
};

type PendingAction = 'promote' | 'demote' | 'remove';

// Textos e gravidade de cada confirmação num lugar só — as três têm a mesma
// forma (título com o nome, corpo, rótulo do botão) e só mudam de conteúdo.
const CONFIRM_TEXTS: Record<PendingAction, {
  title: TranslationKey;
  body: TranslationKey;
  action: TranslationKey;
  /** Rótulo enquanto roda — o app conta progresso no texto do botão. */
  running: TranslationKey;
  failed: TranslationKey;
  danger?: boolean;
}> = {
  promote: {
    title: 'member.confirmMakeAdminTitle',
    body: 'member.confirmMakeAdminBody',
    action: 'member.confirmMakeAdminAction',
    running: 'member.makingAdmin',
    failed: 'member.makeAdminFailedTitle',
  },
  demote: {
    title: 'member.confirmRemoveAdminTitle',
    body: 'member.confirmRemoveAdminBody',
    action: 'member.removeAdmin',
    running: 'member.removingAdmin',
    failed: 'member.removeAdminFailedTitle',
  },
  remove: {
    title: 'member.confirmRemoveTitle',
    body: 'member.confirmRemoveBody',
    action: 'member.confirmRemoveAction',
    running: 'member.removing',
    failed: 'member.removeFailedTitle',
    danger: true,
  },
};

const ROLE_SUBTITLE_KEY: Record<GroupMember['role'], TranslationKey> = {
  // O sheet nunca abre pro dono (canActOn barra), mas se abrisse ele se
  // apresentaria como admin — o papel de dono não é exposto na interface.
  owner: 'member.roleAdmin',
  admin: 'member.roleAdmin',
  member: 'member.roleMember',
};

export function MemberActionsSheet({ visible, onClose, onClosed, groupId, member, targetBalance }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { removeMember, loading: removing } = useRemoveMember();
  const { promoteToAdmin, loading: promoting } = usePromoteToAdmin();
  const { demoteAdmin, loading: demoting } = useDemoteAdmin();
  const canRemove = targetBalance === 0;

  // A confirmação é um sheet (Modal próprio), e este também é um Modal — dois
  // nativos abertos ao mesmo tempo travam a apresentação. Então este fecha
  // PRIMEIRO e a confirmação abre no `onClosed`.
  //
  // O membro vai junto no ref porque a tela zera `member` ao fechar, e nesse
  // ponto o diálogo ainda nem apareceu.
  const [pending, setPending] = useState<{ action: PendingAction; member: GroupMember } | null>(null);
  const pendingRef = useRef<{ action: PendingAction; member: GroupMember } | null>(null);
  const confirmTexts = pending ? CONFIRM_TEXTS[pending.action] : null;
  const confirmLoading = pending?.action === 'promote' ? promoting
    : pending?.action === 'demote' ? demoting
    : removing;

  // Modelo do WhatsApp: qualquer admin rebaixa qualquer admin — só quem criou
  // a resenha é intocável, e esse caso o `canActOn` da tela de participantes já
  // barra antes de abrir este sheet.
  const showTornarAdmin = member?.role === 'member';
  const showRemoverAdmin = member?.role === 'admin';

  function askConfirm(action: PendingAction) {
    if (!member) return;
    pendingRef.current = { action, member };
    onClose();
  }

  function handleSheetClosed() {
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next) setPending(next);
    onClosed?.();
  }

  async function handleConfirm() {
    if (!pending) return;
    const { action, member: target } = pending;
    try {
      if (action === 'promote') await promoteToAdmin(groupId, target.id);
      else if (action === 'demote') await demoteAdmin(groupId, target.id);
      else await removeMember(groupId, target.id);
      setPending(null);
    } catch {
      setPending(null);
      // Erro continua no Alert nativo: é interrupção de uma opção só, não
      // decisão — mesmo critério dos outros 50 do app.
      Alert.alert(t(CONFIRM_TEXTS[action].failed), t('common.tryAgain'));
    }
  }

  return (
    <>
    <BottomSheetModal visible={visible} onClose={onClose} onClosed={handleSheetClosed}>
      {member && (
        <>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Avatar name={member.name} id={member.id} photoUrl={member.photoUrl ?? undefined} size={44} variant="colorful" />
              <View>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberSubtitle}>{t(ROLE_SUBTITLE_KEY[member.role])}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
              <X size={22} color={colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Sem indicador de carregando nas linhas: o sheet fecha assim que a
              ação é escolhida, e quem mostra o progresso é o botão do diálogo. */}
          {showTornarAdmin && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => askConfirm('promote')}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconCircle}>
                <ShieldCheck size={20} color={colors.textPrimary} strokeWidth={2} />
              </View>
              <Text style={styles.actionLabel}>{t('member.makeAdmin')}</Text>
            </TouchableOpacity>
          )}

          {showRemoverAdmin && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => askConfirm('demote')}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconCircle}>
                <ShieldOff size={20} color={colors.textPrimary} strokeWidth={2} />
              </View>
              <Text style={styles.actionLabel}>{t('member.removeAdmin')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionRow, !canRemove && styles.actionRowDisabled]}
            onPress={() => askConfirm('remove')}
            activeOpacity={canRemove ? 0.7 : 1}
            disabled={!canRemove}
          >
            <View style={[styles.actionIconCircle, styles.actionIconCircleDanger]}>
              <Trash2 size={20} color={colors.danger} strokeWidth={2} />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={[styles.actionLabel, styles.actionLabelDanger]}>{t('member.removeFromGroup')}</Text>
              {!canRemove && (
                <Text style={styles.actionHint}>{t('member.removeBlockedHint')}</Text>
              )}
            </View>
          </TouchableOpacity>
        </>
      )}
    </BottomSheetModal>

    {pending && confirmTexts && (
      <ConfirmSheet
        visible
        onClose={() => { if (!confirmLoading) setPending(null); }}
        title={t(confirmTexts.title, { name: pending.member.name })}
        description={t(confirmTexts.body)}
        confirmLabel={t(confirmTexts.action)}
        confirmLoadingLabel={t(confirmTexts.running)}
        onConfirm={handleConfirm}
        variant={confirmTexts.danger ? 'danger' : 'default'}
        loading={confirmLoading}
      />
    )}
    </>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  memberName: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  memberSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionRowDisabled: {
    opacity: 0.4,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  actionIconCircleDanger: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  actionLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  actionLabelDanger: {
    color: colors.danger,
  },
  actionTextCol: {
    flex: 1,
    gap: 2,
  },
  actionHint: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
