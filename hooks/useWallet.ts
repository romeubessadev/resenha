import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys, SHARED_STALE_TIME } from '@/lib/queryKeys';
import { queryErrorMessage } from '@/lib/queryError';
import { computeBalances, simplifyDebts, type BalanceExpense } from '@/lib/balances';
import { getProfileAvatarUrl } from '@/lib/profileAvatar';
import type { PixKeyType } from '@/lib/pix';
import { useAuth } from './useAuth';
import { useLanguage } from './useLanguage';
import { useRefreshOnFocus } from './useRefreshOnFocus';

export type WalletTxStatus = 'pending' | 'waiting' | 'settled';

export type WalletTx = {
  id: string;
  personId: string;
  personName: string;
  personWhatsapp: string | null;
  personPhotoUrl: string | null;
  /** Chave Pix do perfil da outra pessoa — mostrada a quem DEVE, pra pagar sem
   *  ter que pedir a chave por fora. Só vem preenchida junto com o tipo; ver
   *  profiles_pix_key_pair_check. */
  personPixKey: string | null;
  personPixKeyType: PixKeyType | null;
  groupId: string;
  groupName: string;
  /** Moeda do rolê onde essa movimentação aconteceu — `amount` está nessa moeda. */
  createdAt: string;
  amount: number;
  direction: 'in' | 'out';
  status: WalletTxStatus;
  /** Id da linha em `settlements` — null quando ainda não existe (status pending). */
  settlementId: string | null;
  /** Comprovante anexado ao marcar como pago. Anda junto com `settlementId`
   *  porque desfazer a marcação apaga o arquivo — sem ele aqui, o Acertar em
   *  lote desfaria a linha e deixaria a imagem órfã no storage. */
  proofPath: string | null;
  /** Taxa (moeda do rolê → USD) carimbada no momento do pagamento — só existe
   *  pra status 'settled' (linha vem de `payments`); null nos outros status. */
  /** O rolê dessa movimentação não tem nenhuma despesa lançada agora — sinal
   *  de que a despesa que gerou essa cobrança foi apagada depois de já paga
   *  (ver hooks/useGroupBalances.ts, mesma ideia aplicada aqui pra Carteira). */
  hasNoExpenses: boolean;
};

/**
 * Agrega movimentações de TODOS os grupos do usuário — mesmo padrão de
 * fetch em lote de `fetchGroupSummaries` (hooks/useGroups.ts), mas expondo
 * a lista de transferências (via simplifyDebts), não só o saldo líquido.
 */
async function fetchWalletTxs(userId: string): Promise<WalletTx[]> {
  const { data: myMemberships, error: mErr } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (mErr) throw mErr;

  const groupIds = Array.from(new Set((myMemberships ?? []).map(m => m.group_id)));
  if (groupIds.length === 0) return [];

  const [{ data: groups, error: gErr }, { data: allMembers, error: gmErr }] = await Promise.all([
    supabase.from('groups').select('id, name').in('id', groupIds),
    supabase.from('group_members').select('group_id, user_id').in('group_id', groupIds),
  ]);
  if (gErr) throw gErr;
  if (gmErr) throw gmErr;

  const groupNameById = new Map((groups ?? []).map(g => [g.id, g.name]));

  const memberUserIds = Array.from(new Set((allMembers ?? []).map(m => m.user_id)));
  const { data: profiles, error: pErr } = memberUserIds.length
    ? await supabase.from('profiles').select('id, name, whatsapp, avatar_path, pix_key, pix_key_type').in('id', memberUserIds)
    : { data: [], error: null };
  if (pErr) throw pErr;
  const nameById = new Map((profiles ?? []).map(p => [p.id, p.name]));
  const whatsappById = new Map((profiles ?? []).map(p => [p.id, p.whatsapp]));
  const photoUrlById = new Map((profiles ?? []).map(p => [p.id, getProfileAvatarUrl(p.avatar_path)]));
  // Chave e tipo andam juntos ou não vão: chave sem tipo não sabe se formatar.
  const pixById = new Map((profiles ?? []).map(p => [
    p.id,
    p.pix_key && p.pix_key_type
      ? { key: p.pix_key, type: p.pix_key_type as PixKeyType }
      : null,
  ]));

  const { data: expenses, error: eErr } = await supabase
    .from('expenses')
    .select('id, group_id, amount, paid_by, split_type, created_at')
    .in('group_id', groupIds);
  if (eErr) throw eErr;

  const expenseIds = (expenses ?? []).map(e => e.id);
  const { data: participants, error: partErr } = expenseIds.length
    ? await supabase.from('expense_participants').select('expense_id, user_id, shares, exact_amount').in('expense_id', expenseIds)
    : { data: [], error: null };
  if (partErr) throw partErr;

  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, group_id, from_user, to_user, amount, created_at')
    .in('group_id', groupIds);
  if (payErr) throw payErr;

  const { data: settlementRows, error: sErr } = await supabase
    .from('settlements')
    .select('id, group_id, from_user, to_user, amount, status, marked_at, proof_path')
    .in('group_id', groupIds);
  if (sErr) throw sErr;

  const expenseCountByGroup = new Map<string, number>();
  for (const e of expenses ?? []) {
    expenseCountByGroup.set(e.group_id, (expenseCountByGroup.get(e.group_id) ?? 0) + 1);
  }

  const txs: WalletTx[] = [];

  for (const g of groups ?? []) {
    const groupMemberIds = (allMembers ?? []).filter(m => m.group_id === g.id).map(m => m.user_id);
    const groupExpenses = (expenses ?? []).filter(e => e.group_id === g.id);
    const groupExpenseIds = new Set(groupExpenses.map(e => e.id));
    const groupParticipants = (participants ?? []).filter(p => groupExpenseIds.has(p.expense_id));
    const groupPayments = (payments ?? [])
      .filter(p => p.group_id === g.id)
      .map(p => ({ from_user: p.from_user, to_user: p.to_user, amount: p.amount }));
    const balances = computeBalances(groupMemberIds, groupExpenses as BalanceExpense[], groupParticipants, groupPayments);
    const myTransfers = simplifyDebts(balances).filter(t => t.fromUserId === userId || t.toUserId === userId);
    const groupSettlements = (settlementRows ?? []).filter(s => s.group_id === g.id);

    // Sem linha própria de "pending" (é o estado implícito) — usa a despesa
    // mais recente do grupo como proxy de "quando essa dívida mexeu por
    // último". Simplificação consciente: não é a data exata da dívida.
    const latestExpenseAt = groupExpenses.reduce<string | null>(
      (latest, e) => (!latest || e.created_at > latest ? e.created_at : latest),
      null,
    );

    for (const t of myTransfers) {
      const row = groupSettlements.find(r => r.from_user === t.fromUserId && r.to_user === t.toUserId);
      const isStale = !!row && Math.abs(row.amount - t.amount) > 0.005;
      const isWaiting = !!row && !isStale && row.status === 'marked_paid';
      const isMeDebtor = t.fromUserId === userId;
      const otherUserId = isMeDebtor ? t.toUserId : t.fromUserId;

      txs.push({
        id: `${g.id}-${otherUserId}`,
        personId: otherUserId,
        personName: nameById.get(otherUserId) ?? '',
        personWhatsapp: whatsappById.get(otherUserId) ?? null,
        personPhotoUrl: photoUrlById.get(otherUserId) ?? null,
        personPixKey: pixById.get(otherUserId)?.key ?? null,
        personPixKeyType: pixById.get(otherUserId)?.type ?? null,
        groupId: g.id,
        groupName: groupNameById.get(g.id) ?? '',
        createdAt: (isWaiting && row ? row.marked_at : latestExpenseAt) ?? new Date().toISOString(),
        amount: t.amount,
        direction: isMeDebtor ? 'out' : 'in',
        status: isWaiting ? 'waiting' : 'pending',
        settlementId: isWaiting && row ? row.id : null,
        proofPath: isWaiting && row ? row.proof_path : null,
        hasNoExpenses: !expenseCountByGroup.get(g.id),
      });
    }
  }

  for (const p of payments ?? []) {
    if (p.from_user !== userId && p.to_user !== userId) continue;
    const isMeFrom = p.from_user === userId;
    const otherUserId = isMeFrom ? p.to_user : p.from_user;

    txs.push({
      id: p.id,
      personId: otherUserId,
      personName: nameById.get(otherUserId) ?? '',
      personWhatsapp: whatsappById.get(otherUserId) ?? null,
      personPhotoUrl: photoUrlById.get(otherUserId) ?? null,
      personPixKey: pixById.get(otherUserId)?.key ?? null,
      personPixKeyType: pixById.get(otherUserId)?.type ?? null,
      groupId: p.group_id,
      groupName: groupNameById.get(p.group_id) ?? '',
      createdAt: p.created_at,
      amount: p.amount,
      direction: isMeFrom ? 'out' : 'in',
      status: 'settled',
      settlementId: null,
      proofPath: null,
      hasNoExpenses: !expenseCountByGroup.get(p.group_id),
    });
  }

  txs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return txs;
}

export function useWallet() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const userId = session?.user.id;
  const query = useQuery({
    queryKey: queryKeys.wallet,
    queryFn: () => fetchWalletTxs(userId!),
    enabled: !!userId,
    staleTime: SHARED_STALE_TIME,
  });
  useRefreshOnFocus(query);

  return {
    data: query.data ?? [],
    loading: query.isFetching,
    error: queryErrorMessage(query, t('errors.loadWalletFailed')),
    refetch: query.refetch,
  };
}
