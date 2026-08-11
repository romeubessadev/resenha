import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys, SHARED_STALE_TIME } from '@/lib/queryKeys';
import { deleteSettlementProof } from '@/lib/settlementProof';
import { useGroupBalances } from './useGroupBalances';
import { useRefreshOnFocus } from './useRefreshOnFocus';

export type SettlementStatus = 'pending' | 'marked_paid' | 'confirmed';

export type SettlementTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: SettlementStatus;
  settlementId: string | null;
  proofPath: string | null;
};

/** Acerto já confirmado pelo credor — não representa mais dívida em aberto,
 *  só o recibo do que já foi quitado. */
export type SettledSettlement = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  proofPath: string | null;
  confirmedAt: string | null;
};

type SettlementRow = {
  id: string;
  from_user: string;
  to_user: string;
  amount: number;
  status: 'marked_paid' | 'confirmed';
  proof_path: string | null;
  confirmed_at: string | null;
};

async function fetchSettlementRows(groupId: string): Promise<SettlementRow[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select('id, from_user, to_user, amount, status, proof_path, confirmed_at')
    .eq('group_id', groupId);
  if (error) throw error;
  return data as SettlementRow[];
}

/**
 * Junta as transferências mínimas (já calculadas por useGroupBalances via
 * simplifyDebts) com as settlements em andamento no rolê. Uma settlement
 * "stale" — cujo valor não bate mais com o recalculado agora, porque uma
 * despesa nova mudou o saldo — é ignorada e o par volta pro estado pending.
 */
export function useSettlements(groupId: string | undefined) {
  const { transfers: computed, loading: balancesLoading } = useGroupBalances(groupId);
  const rowsQuery = useQuery({
    queryKey: queryKeys.settlements(groupId ?? ''),
    queryFn: () => fetchSettlementRows(groupId!),
    enabled: !!groupId,
    staleTime: SHARED_STALE_TIME,
  });
  useRefreshOnFocus(rowsQuery);

  const rows = rowsQuery.data ?? [];
  const transfers: SettlementTransfer[] = computed.map(t => {
    // Só linha `marked_paid` casa com uma dívida viva: acerto confirmado já
    // virou pagamento e zerou o saldo daquele par, então nada do que está em
    // aberto agora pertence a ele. Sem esse filtro, uma dívida nova A→B de
    // valor idêntico ao de um acerto antigo casava com ele (o guard de stale
    // compara valor, e os valores batem) e o card travava em "Confirmado".
    const row = rows.find(r => r.status === 'marked_paid' && r.from_user === t.fromUserId && r.to_user === t.toUserId);
    const isStale = !!row && Math.abs(row.amount - t.amount) > 0.005;
    return {
      fromUserId: t.fromUserId,
      toUserId: t.toUserId,
      amount: t.amount,
      status: row && !isStale ? row.status : 'pending',
      settlementId: row && !isStale ? row.id : null,
      proofPath: row && !isStale ? row.proof_path : null,
    };
  });

  const settled: SettledSettlement[] = rows
    .filter(r => r.status === 'confirmed')
    .map(r => ({
      id: r.id,
      fromUserId: r.from_user,
      toUserId: r.to_user,
      amount: r.amount,
      proofPath: r.proof_path,
      confirmedAt: r.confirmed_at,
    }))
    .sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''));

  return {
    transfers,
    settled,
    loading: balancesLoading || rowsQuery.isFetching,
    refetch: rowsQuery.refetch,
  };
}

export function useMarkAsPaid() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ groupId, fromUserId, toUserId, amount, proofPath }: {
      groupId: string; fromUserId: string; toUserId: string; amount: number; proofPath?: string;
    }) => {
      const { error } = await supabase.from('settlements').insert({
        group_id: groupId,
        from_user: fromUserId,
        to_user: toUserId,
        amount,
        status: 'marked_paid',
        proof_path: proofPath ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.settlements(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });

  return {
    markAsPaid: (groupId: string, fromUserId: string, toUserId: string, amount: number, proofPath?: string) =>
      mutation.mutateAsync({ groupId, fromUserId, toUserId, amount, proofPath }),
    loading: mutation.isPending,
  };
}

export function useUnmarkAsPaid() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ settlementId, proofPath }: { settlementId: string; groupId: string; proofPath?: string | null }) => {
      const { error } = await supabase.from('settlements').delete().eq('id', settlementId);
      if (error) throw error;
      if (proofPath) await deleteSettlementProof(proofPath).catch(() => {});
    },
    onSuccess: (_data, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.settlements(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });

  return {
    unmarkAsPaid: (settlementId: string, groupId: string, proofPath?: string | null) =>
      mutation.mutateAsync({ settlementId, groupId, proofPath }),
    loading: mutation.isPending,
  };
}

export function useConfirmReceived() {
  const qc = useQueryClient();

  const mutation = useMutation({
    // Atualizar settlements.status e inserir em payments (é isso que
    // computeBalances soma) numa RPC só, em vez de 2 chamadas separadas —
    // sem isso, uma falha entre as duas deixava o acerto marcado
    // "confirmado" na tela sem o saldo realmente mudar.
    mutationFn: async ({ settlementId }: {
      settlementId: string; groupId: string; fromUserId: string; toUserId: string; amount: number;
    }) => {
      const { error } = await supabase.rpc('confirm_settlement', { p_settlement_id: settlementId });
      if (error) throw error;
    },
    onSuccess: (_data, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.settlements(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.groupBalances(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.expenses(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.groupHistory(groupId) });
    },
  });

  return {
    confirmReceived: (settlementId: string, groupId: string, fromUserId: string, toUserId: string, amount: number) =>
      mutation.mutateAsync({ settlementId, groupId, fromUserId, toUserId, amount }),
    loading: mutation.isPending,
  };
}

/**
 * Credor registrando que recebeu, sem depender de o devedor ter marcado como
 * pago antes. Serve tanto pro par que já tem marcação de
 * pé quanto pro que não tem nenhuma — a RPC resolve os dois casos, então quem
 * chama não precisa olhar o status.
 */
export function useRecordReceipt() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ groupId, fromUserId, amount }: { groupId: string; fromUserId: string; amount: number }) => {
      const { error } = await supabase.rpc('record_receipt', {
        p_group_id: groupId,
        p_from_user: fromUserId,
        p_amount: amount,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.settlements(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.groupBalances(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.expenses(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.groupHistory(groupId) });
    },
  });

  return {
    recordReceipt: (groupId: string, fromUserId: string, amount: number) =>
      mutation.mutateAsync({ groupId, fromUserId, amount }),
    loading: mutation.isPending,
  };
}
