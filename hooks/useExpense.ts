import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { computeShares } from '@/lib/balances';
import { queryKeys, SHARED_STALE_TIME } from '@/lib/queryKeys';
import { queryErrorMessage } from '@/lib/queryError';
import { getProfileAvatarUrl } from '@/lib/profileAvatar';
import { useAuth } from './useAuth';
import { useLanguage } from './useLanguage';
import { useRefreshOnFocus } from './useRefreshOnFocus';
import type { SplitType } from './useExpenses';

export type ExpenseParticipantDetail = {
  userId: string;
  name: string;
  photoUrl: string | null;
  isMe: boolean;
  shareAmount: number;
  shares: number | null;
  exactAmount: number | null;
};

export type ExpenseDetail = {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  amount: number;
  splitType: SplitType;
  paidById: string;
  paidByName: string;
  paidByPhotoUrl: string | null;
  paidByMe: boolean;
  /** Fui EU quem lançou, mesmo que quem pagou seja outro. Junto com
   *  `paidByMe`, decide se dá pra editar/apagar — mesma regra da RLS.
   *  Falso em despesa antiga, que não tem evento de criação pra dizer
   *  quem lançou, e aí vale a regra antiga (pagador ou admin). */
  createdByMe: boolean;
  date: string;
  receiptPath: string | null;
  /** Taxa de câmbio (moeda da resenha → USD) carimbada no momento do lançamento
   *  — null se o registro é anterior a essa coluna, ou se `fx_rates` ainda
   *  não tinha essa moeda cacheada naquele momento. */
  /** Moeda/valor que a pessoa efetivamente digitou/ditou, se diferente da moeda da resenha. */
  /** Id da receita de recorrência (ver hooks/useRecurrence.ts) quando essa despesa nasceu de uma. */
  recurrenceId: string | null;
  participants: ExpenseParticipantDetail[];
};

async function fetchExpenseDetail(expenseId: string, myUserId: string): Promise<ExpenseDetail> {
  const { data: expense, error: eErr } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .single();
  if (eErr) throw eErr;

  const { data: participants, error: partErr } = await supabase
    .from('expense_participants')
    .select('user_id, shares, exact_amount')
    .eq('expense_id', expenseId);
  if (partErr) throw partErr;

  const userIds = Array.from(new Set([expense.paid_by, ...participants.map(p => p.user_id)]));
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, name, avatar_path')
    .in('id', userIds);
  if (pErr) throw pErr;
  const profileById = new Map(
    (profiles as Pick<Tables<'profiles'>, 'id' | 'name' | 'avatar_path'>[]).map(p => [p.id, p]),
  );

  const shares = computeShares(expense.amount, expense.split_type as SplitType, participants);

  return {
    id: expense.id,
    groupId: expense.group_id,
    title: expense.title,
    description: expense.description,
    categoryId: expense.category_id,
    amount: expense.amount,
    splitType: expense.split_type as SplitType,
    paidById: expense.paid_by,
    paidByName: profileById.get(expense.paid_by)?.name ?? '',
    paidByPhotoUrl: getProfileAvatarUrl(profileById.get(expense.paid_by)?.avatar_path),
    paidByMe: expense.paid_by === myUserId,
    createdByMe: expense.created_by === myUserId,
    // Mesmo fallback de useExpenses: `date` pode faltar em despesa antiga.
    date: expense.date ?? expense.created_at,
    receiptPath: expense.receipt_path,
    recurrenceId: expense.recurrence_id,
    participants: participants.map(p => ({
      userId: p.user_id,
      name: profileById.get(p.user_id)?.name ?? '',
      photoUrl: getProfileAvatarUrl(profileById.get(p.user_id)?.avatar_path),
      isMe: p.user_id === myUserId,
      shareAmount: shares[p.user_id] ?? 0,
      shares: p.shares,
      exactAmount: p.exact_amount,
    })),
  };
}

export function useExpense(expenseId: string | undefined) {
  const { session } = useAuth();
  const { t } = useLanguage();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: queryKeys.expense(expenseId ?? ''),
    queryFn: () => fetchExpenseDetail(expenseId!, userId!),
    enabled: !!expenseId && !!userId,
    staleTime: SHARED_STALE_TIME,
  });
  useRefreshOnFocus(query);

  return {
    data: query.data ?? null,
    loading: query.isFetching,
    error: queryErrorMessage(query, t('errors.loadExpenseFailed')),
    refetch: query.refetch,
  };
}
