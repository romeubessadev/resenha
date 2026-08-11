import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';

export type ExpenseRecurrenceInfo = {
  createdBy: string;
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  intervalDays: number | null;
  /** date-only ISO ("YYYY-MM-DD") — próxima ocorrência a materializar. */
  nextRunDate: string;
  endDate: string | null;
  /** false quando o cron já desativou (passou do término) — recorrência finalizada. */
  active: boolean;
  /** Pausada POR ALGUÉM. Separado de `active` de propósito: finalizada e
   *  pausada são estados diferentes, e só a segunda pode ser retomada. */
  paused: boolean;
  /** Data da 1ª despesa da série — âncora pra calcular a posição de cada despesa e o total quando há término. */
  firstOccurrenceDate: string;
  /** Dia do mês que ancora a série (1-31). */
  anchorDay: number;
};

// Mostra freq/próxima data/término no detalhe de uma despesa que faz parte de
// uma recorrência (expense.recurrenceId) — `null` tanto se não é recorrente
// quanto se a receita já foi cancelada ou apagada.
//
// Série apagada devolve null de propósito (soft delete): as ocorrências
// já lançadas continuam existindo e mantêm o `recurrence_id`, mas param de se
// apresentar como recorrentes — é o que "apagar a recorrência" promete.
export function useExpenseRecurrenceInfo(recurrenceId: string | null | undefined) {
  const query = useQuery({
    queryKey: queryKeys.expenseRecurrenceInfo(recurrenceId ?? ''),
    queryFn: async (): Promise<ExpenseRecurrenceInfo | null> => {
      const { data, error } = await supabase
        .from('expense_recurrences')
        .select('created_by, freq, interval_days, next_run_date, end_date, active, paused, anchor_day')
        .eq('id', recurrenceId!)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const { data: firstRow, error: firstError } = await supabase
        .from('expenses')
        .select('date')
        .eq('recurrence_id', recurrenceId!)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstError) throw firstError;

      return {
        createdBy: data.created_by,
        freq: data.freq as ExpenseRecurrenceInfo['freq'],
        intervalDays: data.interval_days,
        nextRunDate: data.next_run_date,
        endDate: data.end_date,
        active: data.active,
        paused: data.paused,
        firstOccurrenceDate: firstRow?.date ?? data.next_run_date,
        anchorDay: data.anchor_day,
      };
    },
    enabled: !!recurrenceId,
  });

  return {
    info: query.data ?? null,
    loading: query.isLoading,
  };
}
