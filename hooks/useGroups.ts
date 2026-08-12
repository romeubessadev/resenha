import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { computeBalances, type BalanceExpense } from '@/lib/balances';
import { queryKeys, SHARED_STALE_TIME } from '@/lib/queryKeys';
import { queryErrorMessage } from '@/lib/queryError';
import { getProfileAvatarUrl } from '@/lib/profileAvatar';
import { useAuth } from './useAuth';
import { useLanguage } from './useLanguage';
import { useRefreshOnFocus } from './useRefreshOnFocus';
import type { SplitType } from './useExpenses';

export type GroupSummary = {
  id: string;
  name: string;
  avatarKey: string | null;
  avatarPath: string | null;
  memberNames: string[];
  memberIds: string[];
  memberPhotoUrls: (string | null)[];
  /** Moeda da resenha (não a do usuário) — cada resenha tem a sua. */
  /** Já convertido pra moeda principal do usuário (useGroups é tela de agregação). */
  netBalance: number;
  archived: boolean;
  archivedAt: string | null;
  lastActivityAt: string;
};

async function fetchGroupSummaries(userId: string): Promise<GroupSummary[]> {
  const { data: myMemberships, error: mErr } = await supabase
    .from('group_members')
    .select('group_id, archived_at')
    .eq('user_id', userId);
  if (mErr) throw mErr;

  const groupIds = (myMemberships ?? []).map(m => m.group_id);
  if (groupIds.length === 0) return [];

  const myArchivedAtByGroup = new Map((myMemberships ?? []).map(m => [m.group_id, m.archived_at]));

  const [{ data: groups, error: gErr }, { data: allMembers, error: gmErr }] = await Promise.all([
    supabase.from('groups').select('*').in('id', groupIds),
    supabase.from('group_members').select('group_id, user_id').in('group_id', groupIds),
  ]);
  if (gErr) throw gErr;
  if (gmErr) throw gmErr;

  const groupCreatedAtById = new Map((groups ?? []).map(g => [g.id, g.created_at]));

  const memberUserIds = Array.from(new Set((allMembers ?? []).map(m => m.user_id)));
  const { data: profiles, error: pErr } = memberUserIds.length
    ? await supabase.from('profiles').select('id, name, avatar_path').in('id', memberUserIds)
    : { data: [] as Pick<Tables<'profiles'>, 'id' | 'name' | 'avatar_path'>[], error: null };
  if (pErr) throw pErr;
  const nameById = new Map((profiles ?? []).map(p => [p.id, p.name]));
  const avatarPathById = new Map((profiles ?? []).map(p => [p.id, p.avatar_path]));

  const { data: expenses, error: eErr } = await supabase
    .from('expenses')
    .select('id, group_id, amount, paid_by, split_type, created_at')
    .in('group_id', groupIds);
  if (eErr) throw eErr;

  const expenseIds = (expenses ?? []).map(e => e.id);
  const { data: participants, error: partErr } = expenseIds.length
    ? await supabase.from('expense_participants').select('expense_id, user_id, shares, exact_amount').in('expense_id', expenseIds)
    : { data: [] as Pick<Tables<'expense_participants'>, 'expense_id' | 'user_id' | 'shares' | 'exact_amount'>[], error: null };
  if (partErr) throw partErr;

  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('group_id, from_user, to_user, amount, created_at')
    .in('group_id', groupIds);
  if (payErr) throw payErr;

  // Último evento de cada resenha. É o que faz apagar despesa contar como
  // atividade — despesa é hard delete, então a conta abaixo, sozinha, olha só
  // as linhas vivas e anda pra trás ao apagar a mais recente.
  const { data: lastEvents, error: evErr } = await supabase
    .rpc('group_last_activity', { p_group_ids: groupIds });
  if (evErr) throw evErr;
  const lastEventAtByGroup = new Map((lastEvents ?? []).map(e => [e.gid, e.last_at]));

  const summaries = (groups ?? []).map((g): GroupSummary => {
    const groupMembers = (allMembers ?? []).filter(gm => gm.group_id === g.id);
    const memberIds = groupMembers.map(gm => gm.user_id);
    const memberNames = groupMembers.map(gm => nameById.get(gm.user_id) ?? '');
    const memberPhotoUrls = groupMembers.map(gm => getProfileAvatarUrl(avatarPathById.get(gm.user_id)));
    const groupExpenses = (expenses ?? []).filter(e => e.group_id === g.id);
    const groupExpenseIds = new Set(groupExpenses.map(e => e.id));
    const groupParticipants = (participants ?? []).filter(p => groupExpenseIds.has(p.expense_id));
    const groupPayments = (payments ?? [])
      .filter(p => p.group_id === g.id)
      .map(p => ({ from_user: p.from_user, to_user: p.to_user, amount: p.amount }));
    const balances = computeBalances(memberIds, groupExpenses as BalanceExpense[], groupParticipants, groupPayments);
    const myArchivedAt = myArchivedAtByGroup.get(g.id) ?? null;

    const groupPaymentsRaw = (payments ?? []).filter(p => p.group_id === g.id);
    // Despesas e pagamentos continuam na conta porque resenha antigo não
    // tem evento nenhum pra `group_last_activity` achar.
    const lastEventAt = lastEventAtByGroup.get(g.id);
    const activityDates = [
      groupCreatedAtById.get(g.id) ?? g.created_at,
      ...groupExpenses.map(e => e.created_at),
      ...groupPaymentsRaw.map(p => p.created_at),
      ...(lastEventAt ? [lastEventAt] : []),
    ];
    const lastActivityAt = activityDates.reduce((latest, d) => (d > latest ? d : latest));

    return {
      id: g.id,
      name: g.name,
      avatarKey: g.avatar_key,
      avatarPath: g.avatar_path,
      memberNames,
      memberIds,
      memberPhotoUrls,
      netBalance: balances[userId] ?? 0,
      archived: myArchivedAt != null,
      archivedAt: myArchivedAt,
      lastActivityAt,
    };
  });

  // Mais recente primeiro. Sem isto a lista saía na ordem que o banco devolveu
  // as participações — arbitrária, e estável o bastante pra parecer intencional.
  // O `lastActivityAt` já era calculado, mas só alimentava o "há 4 dias" do card.
  //
  // Compara as strings ISO direto: todas vêm do Postgres no mesmo formato UTC,
  // onde ordem lexicográfica e cronológica coincidem. Sem `new Date()` por item.
  return summaries.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export function useGroups() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const userId = session?.user.id;
  const query = useQuery({
    queryKey: queryKeys.myGroups,
    queryFn: () => fetchGroupSummaries(userId!),
    enabled: !!userId,
    staleTime: SHARED_STALE_TIME,
  });
  useRefreshOnFocus(query);

  return {
    data: query.data ?? [],
    loading: query.isFetching,
    // true só na primeira carga (sem dado em cache ainda) — usar pra gate de skeleton,
    // ao contrário de `loading`, que também liga em todo refetch de fundo (focus, etc.)
    isInitialLoading: query.isLoading,
    error: queryErrorMessage(query, t('errors.loadGroupsFailed')),
    refetch: query.refetch,
  };
}

export class RoleLimitError extends Error {}

export function useCreateGroup() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ name, avatarKey, defaultSplitType }: {
      name: string; avatarKey: string | null; defaultSplitType?: SplitType;
    }): Promise<Tables<'groups'>> => {
      if (!session?.user.id) throw new Error(t('errors.sessionInvalid'));

      // RPC faz os dois inserts (groups + group_members) numa transação só —
      // se o limite de resenhas (trigger em group_members) travar, nenhum dos
      // dois sobe, em vez de deixar um grupo órfão sem membro.
      // O gerador de tipos do Supabase não enxerga nullability de parâmetro de
      // função (só de coluna) — `p_avatar_key text` aceita null em runtime
      // (caso real), só o tipo gerado é otimista.
      const { data: group, error } = await supabase
        .rpc('create_group_with_owner', {
          p_name: name, p_avatar_key: avatarKey as string,
          // Omitido, o banco assume 'equal' — mesmo comportamento de antes pra
          // quem cria resenha fora do onboarding.
          ...(defaultSplitType ? { p_default_split_type: defaultSplitType } : {}),
        });
      if (error) {
        if (error.message.includes('role_limit_reached')) throw new RoleLimitError();
        throw error;
      }

      return group;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
    },
  });

  return {
    createGroup: (name: string, avatarKey: string | null, defaultSplitType?: SplitType) =>
      mutation.mutateAsync({ name, avatarKey, defaultSplitType }),
    loading: mutation.isPending,
  };
}

export class GroupNotFoundError extends Error {}

export function useJoinGroup() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (rawCode: string): Promise<Tables<'groups'>> => {
      const userId = session?.user.id;
      if (!userId) throw new Error(t('errors.sessionInvalid'));

      // Ainda aceita o prefixo "CAP-" de convites compartilhados antes dessa mudança.
      const code = rawCode.trim().replace(/^CAP-/i, '').toLowerCase();
      if (!code) throw new GroupNotFoundError(t('groups.invalidCodeInput'));

      const { data: group, error } = await supabase.rpc('find_group_by_invite_code', { code });
      if (error) throw error;
      if (!group) throw new GroupNotFoundError(t('groups.codeNotFound'));

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: userId, role: 'member' });
      if (memberError) {
        if (memberError.code === '23505') throw new Error(t('groups.alreadyInGroup'));
        if (memberError.message.includes('role_limit_reached')) throw new RoleLimitError();
        throw memberError;
      }

      return group;
    },
    onSuccess: group => {
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.groupHistory(group.id) });
      // Resenha que já tinha despesa entra com dívida — ela precisa aparecer na
      // Carteira na hora, não só na próxima vez que ela expirar.
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });

  return { joinGroup: (rawCode: string) => mutation.mutateAsync(rawCode), loading: mutation.isPending };
}
