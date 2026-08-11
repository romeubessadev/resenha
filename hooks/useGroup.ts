import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { uploadGroupAvatar, deleteGroupAvatar } from '@/lib/groupAvatar';
import { queryKeys, SHARED_STALE_TIME } from '@/lib/queryKeys';
import { queryErrorMessage } from '@/lib/queryError';
import { getProfileAvatarUrl } from '@/lib/profileAvatar';
import type { PixKeyType } from '@/lib/pix';
import { useAuth } from './useAuth';
import { useLanguage } from './useLanguage';
import { useRefreshOnFocus } from './useRefreshOnFocus';
import { RoleLimitError } from './useGroups';

export type GroupMember = {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  isMe: boolean;
  photoUrl: string | null;
  whatsapp: string | null;
  /** Chave Pix do perfil — mostrada a quem deve pra essa pessoa, no card
   *  de acerto. Só vem preenchida junto com o tipo; ver profiles_pix_key_pair_check. */
  pixKey: string | null;
  pixKeyType: PixKeyType | null;
  /** Data de entrada no grupo — usado pra decidir quem vira admin quando o atual sai. */
  joinedAt: string;
  /** Arquivado por essa pessoa (pra ela mesma) — quem está assim não pode
   *  ser selecionado como "quem pagou"/participante numa despesa nova. */
  archivedAt: string | null;
};

export type GroupDetail = {
  id: string;
  name: string;
  avatarKey: string | null;
  avatarPath: string | null;
  inviteCode: string;
  archivedAt: string | null;
  /** Divisão que uma despesa nova assume nesta resenha — vem da
   *  resposta do onboarding de quem criou. Cada despesa pode mudar a sua. */
  defaultSplitType: string;
  createdAt: string;
  /** Resenha com pelo menos 1 despesa não pode mais trocar de moeda (EditGroupSheet). */
  hasExpenses: boolean;
  members: GroupMember[];
};

async function fetchGroupDetail(groupId: string, myUserId: string): Promise<GroupDetail> {
  const { data: group, error: gErr } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();
  if (gErr) throw gErr;

  const { count: expenseCount, error: ecErr } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);
  if (ecErr) throw ecErr;

  const { data: members, error: mErr } = await supabase
    .from('group_members')
    .select('user_id, role, archived_at, created_at')
    .eq('group_id', groupId);
  if (mErr) throw mErr;

  const userIds = members.map(m => m.user_id);
  const { data: profiles, error: pErr } = userIds.length
    ? await supabase.from('profiles').select('id, name, avatar_path, whatsapp, pix_key, pix_key_type').in('id', userIds)
    : { data: [] as Pick<Tables<'profiles'>, 'id' | 'name' | 'avatar_path' | 'whatsapp' | 'pix_key' | 'pix_key_type'>[], error: null };
  if (pErr) throw pErr;
  const profileById = new Map(profiles.map(p => [p.id, p]));

  return {
    id: group.id,
    name: group.name,
    avatarKey: group.avatar_key,
    avatarPath: group.avatar_path,
    inviteCode: group.invite_code,
    archivedAt: members.find(m => m.user_id === myUserId)?.archived_at ?? null,
    defaultSplitType: group.default_split_type,
    createdAt: group.created_at,
    hasExpenses: (expenseCount ?? 0) > 0,
    members: members.map((m): GroupMember => {
      const profile = profileById.get(m.user_id);
      return {
        id: m.user_id,
        name: profile?.name ?? '',
        role: m.role as GroupMember['role'],
        isMe: m.user_id === myUserId,
        photoUrl: getProfileAvatarUrl(profile?.avatar_path),
        whatsapp: profile?.whatsapp ?? null,
        // O par só conta quando está completo — o check do banco garante isso no
        // banco, mas a coluna é texto solto e o tipo tem que ser afirmado aqui.
        pixKey: profile?.pix_key && profile.pix_key_type ? profile.pix_key : null,
        pixKeyType: profile?.pix_key && profile.pix_key_type ? profile.pix_key_type as PixKeyType : null,
        joinedAt: m.created_at,
        archivedAt: m.archived_at,
      };
    }),
  };
}

export function useGroup(groupId: string | undefined) {
  const { session } = useAuth();
  const { t } = useLanguage();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: queryKeys.group(groupId ?? ''),
    queryFn: () => fetchGroupDetail(groupId!, userId!),
    enabled: !!groupId && !!userId,
    staleTime: SHARED_STALE_TIME,
  });
  useRefreshOnFocus(query);

  return {
    data: query.data ?? null,
    loading: query.isFetching,
    error: queryErrorMessage(query, t('errors.loadGroupFailed')),
    refetch: query.refetch,
  };
}

export function useUpdateGroup() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ groupId, changes }: { groupId: string; changes: { name?: string; avatarKey?: string | null } }) => {
      const { error } = await supabase
        .from('groups')
        .update({
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.avatarKey !== undefined ? { avatar_key: changes.avatarKey } : {}),
        })
        .eq('id', groupId);
      if (error) throw error;
    },
    onSuccess: (_data, { groupId, changes }) => {
      qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.groupHistory(groupId) });
      // Só o nome: cada linha da Carteira mostra de que resenha é a dívida. Foto
      // não aparece lá, e o fetch dela é caro (varre todos os suas resenhas).
      if (changes.name !== undefined) qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });

  return {
    updateGroup: (groupId: string, changes: { name?: string; avatarKey?: string | null }) => mutation.mutateAsync({ groupId, changes }),
    loading: mutation.isPending,
  };
}

export class ArchiveNotSettledError extends Error {}

export function useSetGroupArchived() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ groupId, archived }: { groupId: string; archived: boolean }) => {
      const { error } = await supabase.rpc('set_my_group_archived', { gid: groupId, archived });
      if (error) {
        if (error.message.includes('role_limit_reached')) throw new RoleLimitError();
        if (error.message.includes('archive_requires_settled')) throw new ArchiveNotSettledError();
        throw error;
      }
    },
    onSuccess: (_data, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
    },
  });

  return {
    setGroupArchived: (groupId: string, archived: boolean) => mutation.mutateAsync({ groupId, archived }),
    loading: mutation.isPending,
  };
}

export function useUpdateGroupAvatar() {
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ groupId, uri, mimeType, previousPath }: {
      groupId: string; uri: string; mimeType: string; previousPath?: string | null;
    }): Promise<string> => {
      const path = await uploadGroupAvatar(groupId, uri, mimeType, previousPath);
      const { error } = await supabase.from('groups').update({ avatar_path: path }).eq('id', groupId);
      if (error) throw error;
      return path;
    },
    onSuccess: (_path, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.groupHistory(groupId) });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ groupId, currentPath }: { groupId: string; currentPath: string }): Promise<void> => {
      const { error } = await supabase.from('groups').update({ avatar_path: null }).eq('id', groupId);
      if (error) throw error;
      await deleteGroupAvatar(currentPath);
    },
    onSuccess: (_data, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.groupHistory(groupId) });
    },
  });

  // Foto escolhida ENQUANTO se cria a resenha. Grava pela RPC, e não pelo UPDATE
  // acima, porque o gatilho de histórico não tem como saber que aquilo faz
  // parte da criação — sem isto, criar uma resenha com foto registrava "fulano
  // editou a resenha" logo depois de "fulano criou a resenha".
  //
  // A foto não pode subir antes da resenha existir: o caminho no bucket começa
  // pelo id, e a policy de INSERT exige ser membro desse id. Então os
  // dois passos são obrigatórios — o que muda é quem declara a intenção.
  const createMutation = useMutation({
    mutationFn: async ({ groupId, uri, mimeType }: {
      groupId: string; uri: string; mimeType: string;
    }): Promise<string> => {
      const path = await uploadGroupAvatar(groupId, uri, mimeType);
      const { error } = await supabase.rpc('set_group_avatar_on_create', { p_group_id: groupId, p_path: path });
      if (error) throw error;
      return path;
    },
    onSuccess: (_path, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
    },
  });

  return {
    updateGroupAvatar: (groupId: string, uri: string, mimeType: string, previousPath?: string | null) =>
      updateMutation.mutateAsync({ groupId, uri, mimeType, previousPath }),
    setGroupAvatarOnCreate: (groupId: string, uri: string, mimeType: string) =>
      createMutation.mutateAsync({ groupId, uri, mimeType }),
    removeGroupAvatar: (groupId: string, currentPath: string) =>
      removeMutation.mutateAsync({ groupId, currentPath }),
    loading: updateMutation.isPending || removeMutation.isPending || createMutation.isPending,
  };
}

export function useRemoveMember() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { data, error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`remove_member_no_rows_affected (groupId=${groupId}, userId=${userId})`);
      }
    },
    onSuccess: (_data, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.groupBalances(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.groupHistory(groupId) });
      // Tirar alguém redistribui a divisão das despesas dele, então os saldos
      // que a Carteira mostra dessa resenha mudam junto.
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      // Quem sai pode ser criador ou pagador de uma série, e um trigger
      // pausa ela no banco — sem isto, quem removeu continuaria vendo "ativa"
      // no card do Resumo pelos 5min de staleTime.
      qc.invalidateQueries({ queryKey: queryKeys.groupRecurrences(groupId) });
    },
  });

  return {
    removeMember: (groupId: string, userId: string) => mutation.mutateAsync({ groupId, userId }),
    loading: mutation.isPending,
  };
}

export function usePromoteToAdmin() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { error } = await supabase
        .from('group_members')
        .update({ role: 'admin' })
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.groupHistory(groupId) });
    },
  });

  return {
    promoteToAdmin: (groupId: string, userId: string) => mutation.mutateAsync({ groupId, userId }),
    loading: mutation.isPending,
  };
}

export function useDemoteAdmin() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { error } = await supabase.rpc('demote_admin', { gid: groupId, target_user_id: userId });
      if (error) throw error;
    },
    onSuccess: (_data, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.groupHistory(groupId) });
    },
  });

  return {
    demoteAdmin: (groupId: string, userId: string) => mutation.mutateAsync({ groupId, userId }),
    loading: mutation.isPending,
  };
}

export function useLeaveGroup() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const { removeMember } = useRemoveMember();
  const qc = useQueryClient();

  const mutation = useMutation({
    // Se for o único membro, sair apaga o grupo (cascade cuida de membros/despesas/pagamentos).
    mutationFn: async (groupId: string) => {
      const userId = session?.user.id;
      if (!userId) throw new Error(t('errors.sessionInvalid'));

      const { count, error: countError } = await supabase
        .from('group_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('group_id', groupId);
      if (countError) throw countError;

      if (count === 1) {
        const { data: groupRow } = await supabase.from('groups').select('avatar_path').eq('id', groupId).single();
        const { data: deletedRows, error } = await supabase.from('groups').delete().eq('id', groupId).select();
        if (error) throw error;
        // RLS (groups_delete_admin) exige is_group_admin — se a linha não sumiu,
        // a pessoa não tinha owner/admin (resenha "travado").
        // Sem esse check, seguíamos pra apagar a foto mesmo com a resenha intacto.
        if (!deletedRows || deletedRows.length === 0) {
          throw new Error(`leave_group_delete_blocked (groupId=${groupId}, userId=${userId})`);
        }
        if (groupRow?.avatar_path) {
          deleteGroupAvatar(groupRow.avatar_path).catch(() => {});
        }
        return;
      }

      await removeMember(groupId, userId);
    },
    onSuccess: (_data, groupId) => {
      qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.groupHistory(groupId) });
      // Sair (ou apagar, no caminho de membro único) tira a resenha da Carteira —
      // sem isto as dívidas dele continuavam lá, apontando pra uma resenha que a
      // pessoa não vê mais.
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });

  return { leaveGroup: (groupId: string) => mutation.mutateAsync(groupId), loading: mutation.isPending };
}

export function useRegenerateInviteCode() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (groupId: string): Promise<string> => {
      const { data: newCode, error: rpcError } = await supabase.rpc('generate_invite_code');
      if (rpcError) throw rpcError;

      const { error: updateError } = await supabase
        .from('groups')
        .update({ invite_code: newCode })
        .eq('id', groupId);
      if (updateError) throw updateError;

      return newCode;
    },
    onSuccess: (_newCode, groupId) => {
      qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    },
  });

  return { regenerate: (groupId: string) => mutation.mutateAsync(groupId), loading: mutation.isPending };
}
