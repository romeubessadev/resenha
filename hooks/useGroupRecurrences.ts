import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { queryErrorMessage } from '@/lib/queryError';
import { useLanguage } from './useLanguage';
import { computeShares } from '@/lib/balances';
import { computeOwnPosition, computeTotalOccurrences, parseDateOnly } from '@/lib/recurrence';
import type { Json } from '@/lib/database.types';
import type { SplitType } from './useExpenses';
import type { RecurrenceFreq } from './useExpenseForm';

/** Três estados distintos de propósito:
 *  `finished` acabou sozinha no término e não volta; `paused` está parada por
 *  alguém e tem "Retomar". Apagada não entra na lista. */
export type RecurrenceStatus = 'active' | 'paused' | 'finished';

export type GroupRecurrence = {
  id: string;
  title: string;
  amount: number;
  categoryId: string | null;
  paidBy: string;
  /** Quem entra no rateio — do JSON da receita, não das ocorrências (que podem
   *  ter sido editadas uma a uma). Serve pra saber se a série mexe no saldo de
   *  alguém em específico. */
  participantIds: string[];
  participantCount: number;
  /** Quanto cabe a cada participante em CADA cobrança. Sai da mesma conta do
   *  rateio da despesa (`computeShares`) pra não existir uma segunda matemática
   *  de divisão no app — a série ainda não tem ocorrência pra consultar. */
  participantShares: Record<string, number>;
  freq: RecurrenceFreq;
  intervalDays: number | null;
  anchorDay: number;
  /** date-only ISO. Numa série finalizada é a data DEPOIS da última cobrança —
   *  o cron avança e só então desativa. */
  nextRunDate: string;
  endDate: string | null;
  status: RecurrenceStatus;
  createdBy: string;
  /** Despesa mais recente da série, pro "Ver despesa". null quando todas as
   *  ocorrências foram apagadas — é a série que só a tela alcança. */
  latestExpenseId: string | null;
  /** Data da 1ª ocorrência ainda existente — âncora do progresso e da prévia
   *  do sheet "Repetir". null quando não sobrou nenhuma. */
  firstOccurrenceDate: string | null;
  /** Posição da próxima cobrança e total da série. Os dois são null quando não
   *  há término (série aberta) ou quando não sobrou ocorrência pra ancorar a
   *  contagem — sem âncora, um "1 de 12" seria invenção. */
  position: number | null;
  total: number | null;
};

type RecurrenceParticipant = { userId: string; shares: number | null; exactAmount: number | null };

/** Lê o JSON de participantes com desconfiança: a coluna é `jsonb` e nada no
 *  banco garante o formato de cada item. Campo fora do tipo esperado vira null,
 *  que é o que `computeShares` já trata (parte 1, valor exato 0). */
function readParticipants(participants: Json): RecurrenceParticipant[] {
  if (!Array.isArray(participants)) return [];
  return participants.flatMap(p => (
    p !== null && typeof p === 'object' && !Array.isArray(p) && typeof p.userId === 'string'
      ? [{
          userId: p.userId,
          shares: typeof p.shares === 'number' ? p.shares : null,
          exactAmount: typeof p.exactAmount === 'number' ? p.exactAmount : null,
        }]
      : []
  ));
}

function statusOf(active: boolean, paused: boolean): RecurrenceStatus {
  if (paused) return 'paused';
  return active ? 'active' : 'finished';
}

const STATUS_RANK: Record<RecurrenceStatus, number> = { active: 0, paused: 1, finished: 2 };

/** Recorrências vivas do rolê, na ordem da tela: as que vão cobrar primeiro no
 *  topo, paradas embaixo.
 *
 *  Lê `expense_recurrences` DIRETO, e não as despesas que ela gerou: uma série
 *  cujas ocorrências foram todas apagadas continua viva e cobrando, e nenhuma
 *  lista construída sobre `expenses` conseguiria mostrá-la — é justamente o
 *  caso que esta tela existe pra resolver. */
export function useGroupRecurrences(groupId: string | undefined) {
  const { t } = useLanguage();

  const query = useQuery({
    queryKey: queryKeys.groupRecurrences(groupId ?? ''),
    queryFn: async (): Promise<GroupRecurrence[]> => {
      const { data: rows, error } = await supabase
        .from('expense_recurrences')
        .select('id, title, amount, category_id, paid_by, participants, split_type, freq, interval_days, anchor_day, next_run_date, end_date, active, paused, created_by')
        .eq('group_id', groupId!)
        .is('deleted_at', null);
      if (error) throw error;
      if (!rows || rows.length === 0) return [];

      // Uma consulta só pras ocorrências de todas as séries — a primeira data
      // ancora o progresso e a última dá o destino do "Ver despesa".
      const { data: occurrences, error: occurrencesError } = await supabase
        .from('expenses')
        .select('id, recurrence_id, date')
        .in('recurrence_id', rows.map(r => r.id))
        .order('date', { ascending: true });
      if (occurrencesError) throw occurrencesError;

      const firstDate = new Map<string, string>();
      const latestId = new Map<string, string>();
      for (const occurrence of occurrences ?? []) {
        if (!occurrence.recurrence_id) continue;
        if (!firstDate.has(occurrence.recurrence_id)) firstDate.set(occurrence.recurrence_id, occurrence.date);
        // Ordenado por data crescente, então a última vista é a mais recente.
        latestId.set(occurrence.recurrence_id, occurrence.id);
      }

      return rows
        .map((row): GroupRecurrence => {
          const participants = readParticipants(row.participants);
          const participantIds = participants.map(p => p.userId);
          const pattern = {
            freq: row.freq as RecurrenceFreq,
            intervalDays: row.interval_days,
            anchorDay: row.anchor_day,
          };
          const status = statusOf(row.active, row.paused);
          const seed = firstDate.get(row.id);
          const total = seed ? computeTotalOccurrences(pattern, parseDateOnly(seed), row.end_date) : null;

          return {
            id: row.id,
            title: row.title,
            amount: row.amount,
            categoryId: row.category_id,
            paidBy: row.paid_by,
            participantIds,
            participantCount: participantIds.length,
            participantShares: computeShares(row.amount, row.split_type as SplitType, participants.map(p => ({
              user_id: p.userId,
              shares: p.shares,
              exact_amount: p.exactAmount,
            }))),
            ...pattern,
            nextRunDate: row.next_run_date,
            endDate: row.end_date,
            status,
            createdBy: row.created_by,
            latestExpenseId: latestId.get(row.id) ?? null,
            firstOccurrenceDate: seed ?? null,
            // Finalizada: o next_run_date já passou do término, então a
            // posição dele seria total + 1. A última cobrança É o total.
            position: total === null ? null
              : status === 'finished' ? total
              : computeOwnPosition(parseDateOnly(seed!), parseDateOnly(row.next_run_date), pattern),
            total,
          };
        })
        .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]
          || a.nextRunDate.localeCompare(b.nextRunDate));
    },
    enabled: !!groupId,
  });

  return {
    recurrences: query.data ?? [],
    loading: query.isLoading,
    error: queryErrorMessage(query, t('errors.loadRecurrencesFailed')),
    refetch: query.refetch,
  };
}
