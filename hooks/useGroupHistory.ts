import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys, SHARED_STALE_TIME } from '@/lib/queryKeys';
import { queryErrorMessage } from '@/lib/queryError';
import type { SplitType } from './useExpenses';
import { useLanguage } from './useLanguage';
import { useRefreshOnFocus } from './useRefreshOnFocus';

export type HistoryEventType =
  | 'expense_created'
  | 'expense_edited'
  | 'expense_deleted'
  | 'settlement'
  | 'member_joined'
  | 'member_left'
  | 'admin_changed'
  | 'group_edited'
  | 'recurrence_paused'
  | 'recurrence_resumed'
  | 'recurrence_edited'
  | 'group_created';

export type ExpenseParticipantSnapshot = {
  userId: string;
  name: string;
  shares: number | null;
  exactAmount: number | null;
};

type HistoryEventBase = {
  id: string;
  actorId: string;
  actorName: string;
  actorAvatarPath: string | null;
  at: string;
};

export type HistoryEvent = HistoryEventBase & (
  | {
      type: 'expense_created' | 'expense_edited';
      payload: {
        expenseId: string;
        title: string;
        amount: number;
        prevAmount: number | null;
        splitType: SplitType;
        participants: ExpenseParticipantSnapshot[];
        /** O que mudou nesta edição, comparado ao evento anterior da mesma
         *  despesa. Vazio na criação; ausente em evento
         *  gravado antes desse campo existir — daí o opcional. */
        changed?: (
          | 'amount' | 'title' | 'paidBy' | 'date'
          | 'splitType' | 'participants' | 'splitValues'
          | 'category'
          | 'receiptAdded' | 'receiptRemoved' | 'receiptChanged'
          | 'recurringOn' | 'recurringOff'
        )[];
        paidById?: string;
        paidByName?: string;
        /** Preenchidos só quando o campo mudou, pra montar o "de → para". */
        prevPaidByName?: string | null;
        prevTitle?: string | null;
        categoryId?: string | null;
        prevCategoryId?: string | null;
        prevSplitType?: string | null;
      };
    }
  | {
      type: 'recurrence_paused' | 'recurrence_resumed' | 'recurrence_edited';
      payload: {
        recurrenceId: string;
        title: string;
        freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
        intervalDays: number | null;
        endDate: string | null;
        prevFreq: string | null;
        prevIntervalDays: number | null;
        prevEndDate: string | null;
        endDateChanged: boolean;
      };
    }
  | {
      type: 'expense_deleted';
      payload: {
        expenseId: string;
        title: string;
        amount: number;
      };
    }
  | {
      type: 'settlement';
      payload: {
        settlementId: string;
        fromUserId: string;
        fromName: string;
        toUserId: string;
        toName: string;
        amount: number;
        hasProof: boolean;
      };
    }
  | { type: 'member_joined'; payload: { memberUserId: string; memberName: string } }
  | { type: 'member_left'; payload: { memberUserId: string; memberName: string; removedByActor: boolean } }
  | { type: 'admin_changed'; payload: { memberUserId: string; memberName: string; roleFrom: string; roleTo: string } }
  | {
      type: 'group_edited';
      payload: { nameChanged: boolean; avatarChanged: boolean; currencyChanged: boolean; newName: string; newCurrency: string };
    }
  | { type: 'group_created'; payload: Record<string, never> }
);

async function fetchGroupHistory(groupId: string): Promise<HistoryEvent[]> {
  const { data, error } = await supabase
    .from('group_events')
    .select('id, type, actor_id, actor_name, actor_avatar_path, at, payload')
    .eq('group_id', groupId)
    .order('at', { ascending: false });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    type: row.type as HistoryEventType,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorAvatarPath: row.actor_avatar_path,
    at: row.at,
    payload: row.payload,
  } as HistoryEvent));
}

export function useGroupHistory(groupId: string | undefined) {
  const { t } = useLanguage();

  const query = useQuery({
    queryKey: queryKeys.groupHistory(groupId ?? ''),
    queryFn: () => fetchGroupHistory(groupId!),
    enabled: !!groupId,
    staleTime: SHARED_STALE_TIME,
  });
  useRefreshOnFocus(query);

  return {
    data: query.data ?? [],
    loading: query.isFetching,
    isInitialLoading: query.isLoading,
    error: queryErrorMessage(query, t('errors.loadHistoryFailed')),
    refetch: query.refetch,
  };
}
