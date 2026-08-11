import { supabase } from '@/lib/supabase';
import type { ExpenseParticipantInput, SplitType } from './useExpenses';
import type { RecurrenceConfig } from './useExpenseForm';

export type CreateExpenseRecurrenceInput = {
  groupId: string;
  title: string;
  categoryId: string | null;
  amount: number;
  splitType: SplitType;
  paidById: string;
  participants: ExpenseParticipantInput[];
  receiptPath?: string | null;
  recurrence: RecurrenceConfig;
};

// Local, não UTC — toISOString() desloca a data em fusos negativos (ex.:
// confirmar às 22h no Amazonas viraria o dia seguinte em UTC).
function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** A linha da receita, pronta pro banco.
 *
 *  Existe separada do input porque `RecurrenceConfig` carrega objetos `Date`, e
 *  a criação de despesa pode ficar guardada em disco esperando internet — Date
 *  não sobrevive a JSON (volta como string e quebra `.getDate()`). Converter
 *  aqui, no momento do toque, deixa o que vai pra fila 100% serializável. */
export type ExpenseRecurrenceRow = ReturnType<typeof buildRecurrenceRow>;

export function buildRecurrenceRow(input: CreateExpenseRecurrenceInput, userId: string, id?: string) {
  return {
    ...(id ? { id } : {}),
    group_id: input.groupId,
    created_by: userId,
    title: input.title,
    category_id: input.categoryId,
    amount: input.amount,
    split_type: input.splitType,
    paid_by: input.paidById,
    receipt_path: input.receiptPath ?? null,
    participants: input.participants.map(p => ({
      userId: p.userId,
      shares: p.shares ?? null,
      exactAmount: p.exactAmount ?? null,
    })),
    freq: input.recurrence.freq,
    interval_days: input.recurrence.freq === 'custom' ? (input.recurrence.intervalDays ?? 1) : null,
    next_run_date: toDateOnly(input.recurrence.nextRunDate),
    end_date: input.recurrence.endDate ? toDateOnly(input.recurrence.endDate) : null,
    // Dia âncora da série. Omitido, o trigger no banco deriva o
    // mesmo valor do next_run_date — mandar explícito só deixa o client
    // dono do que ele já mostrou na prévia.
    anchor_day: input.recurrence.anchorDay ?? input.recurrence.nextRunDate.getDate(),
  };
}

// Materializa na hora se a 2ª cobrança já está vencida (ex.: recorrência
// retroativa) — não espera o cron horário. Escopado só nessa recorrência
// (p_recurrence_id): o cron sem argumento é quem cuida de todo o resto, sem
// essa chamada precisar varrer o app inteiro. Chamar só DEPOIS que a despesa-
// semente já foi criada com `recurrence_id` apontando pra essa recorrência —
// a function usa a menor `created_at` vinculada pra saber qual data pular
// (evitar duplicar a própria semente); chamando antes disso ela não encontra
// nada, acha que não há semente e cria uma cobrança fantasma pra hoje.
// Falha aqui não desfaz nada já criado, o cron pega no pior caso.
export async function materializeRecurrenceNow(recurrenceId: string): Promise<void> {
  try {
    await supabase.rpc('materialize_recurring_expenses', { p_recurrence_id: recurrenceId });
  } catch {
    // ignorado de propósito — ver comentário acima
  }
}

