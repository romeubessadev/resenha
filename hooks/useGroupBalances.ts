import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { computeBalances, simplifyDebts, type BalanceExpense, type Transfer } from '@/lib/balances';
import { queryKeys, SHARED_STALE_TIME } from '@/lib/queryKeys';
import { queryErrorMessage } from '@/lib/queryError';
import { useLanguage } from './useLanguage';
import { useRefreshOnFocus } from './useRefreshOnFocus';

async function fetchBalances(groupId: string): Promise<{
  balances: Record<string, number>;
  transfers: Transfer[];
  paymentsOnlyBalances: Record<string, number>;
}> {
  const { data: members, error: mErr } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);
  if (mErr) throw mErr;
  const memberIds = members.map(m => m.user_id);

  const { data: expenses, error: eErr } = await supabase
    .from('expenses')
    .select('id, amount, paid_by, split_type')
    .eq('group_id', groupId);
  if (eErr) throw eErr;

  const expenseIds = expenses.map(e => e.id);
  const { data: participants, error: partErr } = expenseIds.length
    ? await supabase.from('expense_participants').select('expense_id, user_id, shares, exact_amount').in('expense_id', expenseIds)
    : { data: [], error: null };
  if (partErr) throw partErr;

  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('from_user, to_user, amount')
    .eq('group_id', groupId);
  if (payErr) throw payErr;

  const balances = computeBalances(memberIds, expenses as BalanceExpense[], participants ?? [], payments);
  const transfers = simplifyDebts(balances);
  // Saldo que sobraria só com os pagamentos, sem nenhuma despesa — usado pra
  // avisar antes de apagar a última despesa do rolê (ver grupo/[id].tsx e
  // grupo/despesa.tsx): um pagamento já confirmado continua de pé mesmo que
  // a despesa que motivou seja apagada depois, e isso pode deixar alguém
  // com saldo pendente num rolê que parece "vazio".
  const paymentsOnlyBalances = computeBalances(memberIds, [], [], payments);
  return { balances, transfers, paymentsOnlyBalances };
}

export function useGroupBalances(groupId: string | undefined) {
  const { t } = useLanguage();

  const query = useQuery({
    queryKey: queryKeys.groupBalances(groupId ?? ''),
    queryFn: () => fetchBalances(groupId!),
    enabled: !!groupId,
    staleTime: SHARED_STALE_TIME,
  });
  useRefreshOnFocus(query);

  return {
    balances: query.data?.balances ?? {},
    transfers: query.data?.transfers ?? [],
    paymentsOnlyBalances: query.data?.paymentsOnlyBalances ?? {},
    loading: query.isFetching,
    // true só na primeira carga (sem dado em cache ainda) — usar pra gate de skeleton,
    // ao contrário de `loading`, que também liga em todo refetch de fundo (focus, etc.)
    isInitialLoading: query.isLoading,
    error: queryErrorMessage(query, t('errors.loadBalancesFailed')),
    refetch: query.refetch,
  };
}
