import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { computeShares, simplifyDebts, type Transfer } from '@/lib/balances';
import { deleteReceipt } from '@/lib/receipt';
import { buildRecurrenceRow, materializeRecurrenceNow, type ExpenseRecurrenceRow } from './useRecurrence';
import type { RecurrenceConfig } from './useExpenseForm';
import type { ExpenseDetail } from './useExpense';
import type { ExpenseRecurrenceInfo } from './useExpenseRecurrenceInfo';
import { queryKeys, SHARED_STALE_TIME } from '@/lib/queryKeys';
import { queryErrorMessage } from '@/lib/queryError';
import type { TranslationKey } from '@/lib/i18n';
import { useAuth } from './useAuth';
import { useLanguage } from './useLanguage';
import { useRefreshOnFocus } from './useRefreshOnFocus';

export type SplitType = 'equal' | 'shares' | 'exact';

export type LancamentoItem = {
  id: string;
  type: 'expense' | 'payment';
  title: string;
  categoryId: string | null;
  amount: number;
  paidById: string;
  paidByName: string;
  paidByMe: boolean;
  /** Só em 'expense': fui EU quem lançou, mesmo que quem pagou seja outro.
   *  Vale junto com `paidByMe` pra decidir se dá pra editar/apagar — é a
   *  mesma regra da RLS. Falso em despesa antiga, que não tem
   *  evento pra dizer quem lançou. */
  createdByMe?: boolean;
  /** Dia do lançamento: a data escolhida no seletor, na despesa ('YYYY-MM-DD'),
   *  e o instante do pagamento, no acerto. Use pra exibir, agrupar e filtrar. */
  date: string;
  /** Instante real da inserção. Use pra "última atividade" e como desempate de
   *  ordenação — `date` pode ser retroativo ou futuro, este nunca. */
  createdAt: string;
  toUserId?: string;
  toUserName?: string;
  /** Só em 'expense': quantas pessoas dividem essa despesa. */
  splitCount?: number;
  /** Só em 'expense': quanto eu devo dela — undefined se eu não estiver no rateio. */
  myShare?: number;
  /** Só em 'expense': quanto CADA participante deve. Já era calculado aqui pra
   *  tirar o `myShare`; fica exposto porque o efeito otimista de apagar precisa
   *  reverter a contribuição da despesa no saldo, e pra isso precisa da parte
   *  de todos. */
  participantShares?: Record<string, number>;
  /** Só em 'expense': nomes de quem divide essa despesa. */
  participantNames?: string[];
  /** Só em 'expense': id da receita de recorrência, quando essa despesa nasceu de uma (ver hooks/useRecurrence.ts). */
  recurrenceId?: string | null;
};

async function fetchLancamentos(groupId: string, myUserId: string, t: (key: TranslationKey) => string): Promise<LancamentoItem[]> {
  const [{ data: expenses, error: eErr }, { data: payments, error: payErr }] = await Promise.all([
    supabase.from('expenses').select('*').eq('group_id', groupId),
    supabase.from('payments').select('*').eq('group_id', groupId),
  ]);
  if (eErr) throw eErr;
  if (payErr) throw payErr;

  const expenseIds = expenses.map(e => e.id);
  const { data: allParticipants, error: partErr } = expenseIds.length
    ? await supabase.from('expense_participants').select('expense_id, user_id, shares, exact_amount').in('expense_id', expenseIds)
    : { data: [] as Tables<'expense_participants'>[], error: null };
  if (partErr) throw partErr;

  // Precisa incluir quem SÓ divide despesa (nunca pagou nada nem entrou num
  // acerto) — sem isso, o nome desse participante vinha vazio (nameById sem
  // entrada pra ele), e a lista de participantes exportada em CSV ficava
  // com uma vírgula solta no lugar do nome que faltou.
  const userIds = new Set<string>();
  expenses.forEach(e => userIds.add(e.paid_by));
  payments.forEach(p => { userIds.add(p.from_user); userIds.add(p.to_user); });
  allParticipants.forEach(p => userIds.add(p.user_id));

  const { data: profiles, error: pErr } = userIds.size
    ? await supabase.from('profiles').select('id, name').in('id', Array.from(userIds))
    : { data: [] as Pick<Tables<'profiles'>, 'id' | 'name'>[], error: null };
  if (pErr) throw pErr;
  const nameById = new Map(profiles.map(p => [p.id, p.name]));

  const participantsByExpense = new Map<string, Tables<'expense_participants'>[]>();
  for (const p of allParticipants) {
    const list = participantsByExpense.get(p.expense_id) ?? [];
    list.push(p);
    participantsByExpense.set(p.expense_id, list);
  }

  const expenseItems: LancamentoItem[] = expenses.map(e => {
    const parts = participantsByExpense.get(e.id) ?? [];
    const shares = computeShares(e.amount, e.split_type as SplitType, parts);
    return {
      id: e.id,
      type: 'expense',
      title: e.title,
      categoryId: e.category_id,
      amount: e.amount,
      paidById: e.paid_by,
      paidByName: nameById.get(e.paid_by) ?? '',
      paidByMe: e.paid_by === myUserId,
      createdByMe: e.created_by === myUserId,
      // Fallback pro created_at enquanto a coluna `date` não existir: em
      // despesa antiga (ou enquanto o cache de schema do PostgREST não
      // recarregou) o campo vem undefined, e sem isso a ordenação abaixo
      // estoura e derruba a tela inteira do rolê.
      date: e.date ?? e.created_at,
      createdAt: e.created_at,
      splitCount: parts.length,
      myShare: shares[myUserId],
      participantShares: shares,
      participantNames: parts.map(p => nameById.get(p.user_id) ?? ''),
      recurrenceId: e.recurrence_id,
    };
  });

  const paymentItems: LancamentoItem[] = payments.map(p => ({
    id: p.id,
    type: 'payment',
    title: p.description ?? t('expense.paymentFallbackTitle'),
    categoryId: null,
    amount: p.amount,
    paidById: p.from_user,
    paidByName: nameById.get(p.from_user) ?? '',
    paidByMe: p.from_user === myUserId,
    // Pagamento não tem data escolhida — ele acontece quando é confirmado.
    date: p.created_at,
    createdAt: p.created_at,
    toUserId: p.to_user,
    toUserName: nameById.get(p.to_user) ?? '',
  }));

  return sortLancamentos([...expenseItems, ...paymentItems]);
}

// Por dia primeiro, e dentro do mesmo dia pela ordem de criação. Compara só
// os 10 primeiros caracteres porque despesa traz 'YYYY-MM-DD' e pagamento
// traz o timestamp inteiro — comparar as strings cruas jogaria toda despesa
// pra trás do pagamento do mesmo dia.
//
// Exportada porque a linha otimista (ver registerExpenseMutationDefaults)
// precisa entrar na MESMA ordem: a lista agrupa por dia, e uma despesa
// retroativa jogada no topo quebraria o cabeçalho de data.
export function sortLancamentos(items: LancamentoItem[]): LancamentoItem[] {
  const day = (d: string) => d.slice(0, 10);
  return [...items].sort((a, b) => {
    const byDay = day(b.date).localeCompare(day(a.date));
    return byDay !== 0 ? byDay : b.createdAt.localeCompare(a.createdAt);
  });
}

export function useExpenses(groupId: string | undefined) {
  const { session } = useAuth();
  const { t } = useLanguage();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: queryKeys.expenses(groupId ?? ''),
    queryFn: () => fetchLancamentos(groupId!, userId!, t),
    enabled: !!groupId && !!userId,
    staleTime: SHARED_STALE_TIME,
  });
  useRefreshOnFocus(query);

  return {
    data: query.data ?? [],
    loading: query.isFetching,
    // true só na primeira carga (sem dado em cache ainda) — usar pra gate de skeleton,
    // ao contrário de `loading`, que também liga em todo refetch de fundo (focus, etc.)
    isInitialLoading: query.isLoading,
    error: queryErrorMessage(query, t('errors.loadExpensesFailed')),
    refetch: query.refetch,
  };
}

export type ExpenseParticipantInput = {
  userId: string;
  shares?: number;
  exactAmount?: number;
};

export type CreateExpenseInput = {
  groupId: string;
  title: string;
  description?: string;
  // Sem `categoryId`: despesa nova NUNCA nasce categorizada, nem digitada nem
  // ditada — quem resolve é sempre a fila, logo depois do insert (ver
  // DESCRIBE_EXPENSE_MUTATION_KEY). O ditado por voz já mandou a sua, decidida
  // com a frase inteira em mãos, mas isso dava dois comportamentos pra mesma
  // ação: a ditada nascia com ícone e a digitada só ganhava o dele segundos
  // depois.
  amount: number;
  splitType: SplitType;
  paidById?: string;
  /** Nome e foto de cada pessoa envolvida (pagador + participantes), resolvidos
   *  pela TELA. Não são gravados — o banco só guarda ids —, existem pra montar
   *  a despesa otimista (linha da lista E tela de detalhe) sem depender de
   *  nenhuma outra query, já que ela pode ser renderizada sem rede e até
   *  depois de reabrir o app. */
  memberInfo: Record<string, { name: string; photoUrl: string | null }>;
  participants: ExpenseParticipantInput[];
  receiptPath?: string;
  /** 'YYYY-MM-DD' escolhido no form (permite retroativo e futuro). Obrigatório:
   *  a coluna é NOT NULL e sem default — quem preenche pra client antigo, que
   *  não conhece o campo, é o trigger expenses_set_date. */
  date: string;
  /** Repetição configurada no formulário. A receita é criada pela MESMA
   *  mutação da despesa, e não antes dela: em chamadas separadas, a despesa
   *  poderia tentar gravar antes da receita existir, quebrando a chave
   *  estrangeira. */
  recurrence?: RecurrenceConfig | null;
};

/** O que de fato é enviado: a entrada da tela mais o que precisa estar
 *  RESOLVIDO na hora do toque, não na hora do envio. Id e pagador entram aqui
 *  porque a mutação pode ser repetida pelo retry, já sem a tela que a
 *  originou. */
export type CreateExpenseVariables = Omit<CreateExpenseInput, 'recurrence'> & {
  id: string;
  paidById: string;
  /** Receita da recorrência já convertida em linha de banco (datas viraram
   *  string). Null quando a despesa não repete. */
  recurrenceRow: ExpenseRecurrenceRow | null;
  recurrenceId: string | null;
  /** Quem está lançando. Vai nas variáveis, e não lido da sessão dentro da
   *  mutação, porque a mutação é registrada uma vez no boot do app — antes de
   *  existir sessão — e pode ser retomada depois. Serve só pra montar a linha
   *  otimista ("paguei eu?", "quanto é a minha parte?"). */
  myUserId: string;
};

export const CREATE_EXPENSE_MUTATION_KEY = ['createExpense'] as const;

/**
 * Escopo compartilhado por TODA mutação de despesa — criar, e futuramente
 * editar e apagar.
 *
 * Sem escopo, mutações de despesa correm EM PARALELO. Rede boa esconde isso,
 * rede ruim não: cada mutação repete até 3 vezes com espera crescente (~40s no
 * pior caso), então lançar uma despesa, corrigir o valor e apagar pode deixar
 * três envios no ar ao mesmo tempo — e a exclusão chegar antes da criação, o
 * que ressuscitaria a despesa.
 *
 * Mutações com o mesmo `scope.id` rodam em SÉRIE, na ordem em que foram
 * chamadas (ver canRun/runNext no MutationCache). Um id global, e não um por
 * despesa, porque o escopo é estático nas defaults — não dá pra derivá-lo das
 * variáveis. O custo é serializar despesas independentes também; com o volume
 * que uma pessoa lança seguido, é irrelevante perto de ressuscitar um
 * lançamento.
 *
 * Quem adicionar uma mutação de despesa nova PRECISA reusar esta constante.
 */
export const EXPENSE_MUTATION_SCOPE = { id: 'expense-mutations' };

export const UPDATE_EXPENSE_MUTATION_KEY = ['updateExpense'] as const;

/** O que fazer com a recorrência ao salvar a edição. Vai junto da mesma
 *  mutação, e não em chamadas separadas, pelo mesmo motivo da criação: duas
 *  mutações independentes correriam em paralelo, e a despesa poderia gravar
 *  o vínculo antes da receita existir. */
export type RecurrenceIntent =
  /** Não mexe na configuração — mas o id vem junto (quando existe) porque a
   *  categoria da despesa precisa acompanhar a receita mesmo assim: o título da
   *  recorrente é sempre o mesmo, então a categoria certa também é. */
  | { action: 'none'; id: string | null }
  /** Passou a ser recorrente agora: cria a receita e vincula a despesa a ela. */
  | { action: 'create'; id: string; row: ExpenseRecurrenceRow }
  /** Desligou o "Repetir" de uma série ativa. Sem uso desde que pausar saiu do
   *  formulário de despesa — a chave só cria hoje. */
  | { action: 'cancel'; id: string }
  /** Já era recorrente: acerta ritmo/término/pausa e, se a pessoa pedir, o
   *  conteúdo das próximas ocorrências. */
  | {
    action: 'update';
    id: string;
    freq: ExpenseRecurrenceInfo['freq'];
    intervalDays: number | null;
    endDate: string | null;
    amount: number;
    /** Propaga o CONTEÚDO da despesa pras próximas ocorrências, e não só o
     *  ritmo. Falso quando a pessoa escolheu "só esta ocorrência": aí a receita
     *  mantém o que tinha e a correção fica na despesa aberta.
     *
     *  Antes isto não existia e o valor SEMPRE vazava pro futuro, sem aviso —
     *  corrigir a luz de um mês mais cara mudava todos os meses seguintes. */
    applyToFuture: boolean;
    /** Série pausada — para de gerar ocorrências e guarda a configuração. É o
     *  que a chave do "Editar despesa" faz ao ser desligada. */
    paused: boolean;
  };

export type UpdateExpenseVariables = {
  expenseId: string;
  groupId: string;
  myUserId: string;
  /** Campo do formulário de editar. Null quando a IA não conseguiu decidir e
   *  ninguém corrigiu ainda. */
  categoryId: string | null;
  title: string;
  amount: number;
  splitType: SplitType;
  paidById: string;
  date: string;
  receiptPath: string | null;
  /** O que estava gravado ANTES desta edição. Serve pra apagar o objeto do
   *  bucket quando a foto foi trocada ou removida. */
  previousReceiptPath?: string | null;
  participants: ExpenseParticipantInput[];
  /** Mesma razão do create: a despesa otimista precisa de nome e foto sem
   *  depender de outra query. */
  memberInfo: Record<string, { name: string; photoUrl: string | null }>;
  recurrence: RecurrenceIntent;
  /** O título mudou nesta edição. Renomear "Pipoca cinema" pra "Uber pro
   *  cinema" invalida a categoria que a IA escolheu — ela respondeu sobre outra
   *  pergunta. Só isto dispara a redescrição; mexer em valor, data ou
   *  participantes não muda o que a despesa É. */
  titleChanged: boolean;
  /** O usuário escolheu a categoria no seletor nesta edição. Protege a escolha
   *  dele: com o seletor à disposição, a IA passando por cima o transformaria
   *  em decoração. */
  categoryTouched: boolean;
};

// Uma chamada atômica pra despesa e, quando houver, as operações da
// recorrência — nesta ordem, porque a receita precisa existir antes da despesa
// apontar pra ela.
async function updateExpenseMutationFn(input: UpdateExpenseVariables): Promise<void> {
  const rec = input.recurrence;

  // O comprovante já subiu no formulário (ver handleComprovanteAsset) — aqui só
  // se aponta pro caminho que ele devolveu.
  const receiptPath = input.receiptPath;

  if (rec.action === 'create') {
    const { error } = await supabase
      .from('expense_recurrences')
      .upsert(rec.row, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }

  const { error } = await supabase.rpc('update_expense_with_participants', {
    p_id: input.expenseId,
    p_title: input.title,
    p_amount: input.amount,
    p_paid_by: input.paidById,
    p_split_type: input.splitType,
    p_date: input.date,
    p_participants: participantRows(input.splitType, input.participants),
    p_category_id: input.categoryId,
    p_receipt_path: receiptPath,
    // Só vincula quando a recorrência nasceu agora; nos outros casos o campo
    // fica como está (cancelar já desvincula sozinho, via on delete set null).
    p_set_recurrence: rec.action === 'create',
    p_recurrence_id: rec.action === 'create' ? rec.id : null,
  });
  if (error) throw error;

  if (rec.action === 'cancel') {
    const { error: cancelErr } = await supabase.from('expense_recurrences').delete().eq('id', rec.id);
    if (cancelErr) throw cancelErr;
  }

  if (rec.action === 'update') {
    // O RITMO é sempre da série: mudar de mensal pra semanal só pode significar
    // a série inteira, então não passa pela pergunta de escopo.
    //
    // O CONTEÚDO (valor, título, quem paga, divisão, participantes, categoria)
    // só vai quando a pessoa escolheu "esta e as próximas". E vai INTEIRO —
    // antes só o valor era propagado, então corrigir o título de uma recorrente
    // não pegava nas ocorrências futuras, o que contradizia a promessa.
    const { error: updateErr } = await supabase
      .from('expense_recurrences')
      .update({
        freq: rec.freq,
        interval_days: rec.intervalDays,
        end_date: rec.endDate,
        paused: rec.paused,
        ...(rec.applyToFuture ? {
          amount: rec.amount,
          title: input.title,
          paid_by: input.paidById,
          split_type: input.splitType,
          category_id: input.categoryId,
          participants: participantRows(input.splitType, input.participants),
        } : {}),
      })
      .eq('id', rec.id);
    if (updateErr) throw updateErr;
  }

  // A categoria acompanha a receita mesmo quando a configuração da recorrência
  // não mudou: sem isso, a correção teria que ser refeita a cada ocorrência
  // nova que o cron criasse.
  if (rec.action === 'none' && rec.id) {
    const { error: categoryErr } = await supabase
      .from('expense_recurrences')
      .update({ category_id: input.categoryId })
      .eq('id', rec.id);
    if (categoryErr) throw categoryErr;
  }

  // Só depois da despesa existir com o vínculo — ver materializeRecurrenceNow.
  if (rec.action === 'create') await materializeRecurrenceNow(rec.id);

  // Faxina do comprovante antigo, DEPOIS da despesa já apontar pro novo: na
  // ordem inversa, uma falha da RPC deixaria a linha apontando pra um arquivo
  // que já não existe. Sem `throw` — a edição está gravada e correta, e um
  // objeto sobrando no bucket não vale repetir a mutação inteira.
  if (input.previousReceiptPath && input.previousReceiptPath !== receiptPath) {
    await deleteReceipt(input.previousReceiptPath).catch(() => {});
  }
}

export const DELETE_EXPENSE_MUTATION_KEY = ['deleteExpense'] as const;

export type DeleteExpenseVariables = {
  expenseId: string;
  groupId: string;
  /** Série da despesa, quando ela é ocorrência de uma. Serve pra encerrar a
   *  receita que ficar sem nenhuma ocorrência — independente da escolha de
   *  alcance abaixo. */
  recurrenceId: string | null;
  /** Receita a pausar junto — preenchida só quando a pessoa escolheu "apagar
   *  esta e encerrar as próximas" no sheet de exclusão. Null apaga só esta
   *  ocorrência e a série continua gerando as seguintes. */
  pauseRecurrenceId: string | null;
};

async function deleteExpenseMutationFn(input: DeleteExpenseVariables): Promise<void> {
  // A pausa vem ANTES do delete de propósito. Se a exclusão falhar de vez (as 3
  // tentativas), o otimista é desfeito e a despesa volta pra lista — coerente,
  // porque ela de fato continua no servidor; o que sobra é a série pausada, um
  // estado visível na tela e que dá pra retomar. Na ordem inversa, a despesa
  // apagada no servidor voltaria pra lista (o rollback não sabe que o delete
  // passou) e a série seguiria gerando ocorrência, que é exatamente o que a
  // pessoa pediu pra parar.
  //
  // Pausar, e não apagar a receita: a FK é ON DELETE SET NULL, então apagar
  // zeraria o recurrence_id de TODA ocorrência passada — mesma razão do
  // pendingPauseRecurrence no detalhe da despesa.
  if (input.pauseRecurrenceId) {
    const { error: pauseErr } = await supabase
      .from('expense_recurrences')
      .update({ paused: true })
      .eq('id', input.pauseRecurrenceId);
    if (pauseErr) throw pauseErr;
  }

  const { error } = await supabase.from('expenses').delete().eq('id', input.expenseId);
  if (error) throw error;

  // Série que ficou sem NENHUMA ocorrência é encerrada, sem perguntar: ela
  // continuaria lançando despesa todo mês e não haveria por onde alcançá-la —
  // a lista de recorrências chega na série pela despesa, e não sobrou nenhuma.
  //
  // A contagem é no servidor, e não no que o client tinha em cache: entre abrir
  // o sheet e a mutação subir, alguém pode ter lançado outra ocorrência, e aí a
  // série tem futuro de novo.
  //
  // `deleted_at` e não delete de verdade — a FK é ON DELETE SET NULL e zeraria
  // o vínculo das ocorrências passadas.
  if (input.recurrenceId) {
    const { count, error: countErr } = await supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('recurrence_id', input.recurrenceId);
    if (countErr) throw countErr;

    if ((count ?? 0) === 0) {
      const { error: endErr } = await supabase
        .from('expense_recurrences')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', input.recurrenceId);
      if (endErr) throw endErr;
    }
  }
}

export const DESCRIBE_EXPENSE_MUTATION_KEY = ['describeExpense'] as const;

export type DescribeExpenseVariables = {
  expenseId: string;
  groupId: string;
  /** Só pra invalidar a chave certa quando a descrição chega. */
  recurrenceId: string | null;
};

// Descrição de uma despesa que JÁ existe no banco. É mutação separada da
// criação, e não um passo dentro dela, por duas razões:
//
//   · a despesa nunca é perdida por causa da IA — quando esta falha, o insert
//     já terminou e nada é desfeito;
//   · e, ao contrário do best-effort que ela substituiu (que engolia o próprio
//     erro e devolvia nulo), aqui a falha SOBE — erro vira retry, e o retry é
//     generoso (6 tentativas), porque a despesa já está gravada quando esta
//     roda e insistir não segura nada.
//
// Quem grava é a Edge Function, com service role — o UPDATE direto daqui
// falharia calado sempre que a despesa fosse paga por outra pessoa (ver o
// cabeçalho de supabase/functions/categorize-expense/index.ts).
async function describeExpenseMutationFn(input: DescribeExpenseVariables): Promise<void> {
  const { error } = await supabase.functions.invoke('categorize-expense', {
    body: { expenseId: input.expenseId },
  });
  if (error) throw error;
}

/** Dispara a descrição direto pelo MutationCache, e não por `useMutation`:
 *  quem chama é o `onSuccess` da criação, que roda fora de qualquer componente
 *  — e pode rodar com a tela que originou o lançamento já fechada. `build`
 *  aplica as defaults registradas (retry, escopo). */
function enqueueDescribe(queryClient: QueryClient, input: DescribeExpenseVariables) {
  queryClient
    .getMutationCache()
    .build(queryClient, { mutationKey: DESCRIBE_EXPENSE_MUTATION_KEY })
    // O erro final já é tratado pelas defaults — o catch existe só pra não
    // virar rejeição solta.
    .execute(input)
    .catch(() => {});
}

function participantRows(splitType: SplitType, participants: ExpenseParticipantInput[]) {
  return participants.map(p => ({
    userId: p.userId,
    shares: splitType === 'shares' ? (p.shares ?? 1) : null,
    exactAmount: splitType === 'exact' ? (p.exactAmount ?? 0) : null,
  }));
}

// Uma chamada só, atômica e idempotente. Não é otimização:
// como esta função é REPETIDA pelo retry, os dois inserts antigos podiam falhar
// no meio e deixar despesa sem participante — que some do saldo de todo mundo
// sem aviso.
// Três passos numa mutação só, nesta ordem, porque cada um depende do anterior
// — e porque separá-los não funcionaria: mutações independentes correm em
// paralelo, então a despesa poderia tentar gravar antes da receita de
// recorrência existir.
//
// Todos os passos são repetíveis: a receita ignora conflito de id e a RPC da
// despesa é idempotente. É isso que permite o retry em rede instável.
async function createExpenseMutationFn(input: CreateExpenseVariables): Promise<void> {
  // 1. O comprovante já subiu no formulário (ver handleComprovanteAsset) —
  //    aqui só se aponta pro caminho que ele devolveu.
  const receiptPath = input.receiptPath ?? null;

  // 2. Receita da recorrência antes da despesa: é ela que a coluna
  //    recurrence_id referencia.
  if (input.recurrenceRow) {
    const { error } = await supabase
      .from('expense_recurrences')
      .upsert(
        { ...input.recurrenceRow, receipt_path: receiptPath },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  // 3. A despesa em si. Nasce SEM categoria — quem preenche é a mutação de
  //    descrição, disparada logo depois desta (ver
  //    DESCRIBE_EXPENSE_MUTATION_KEY).
  const { error } = await supabase.rpc('create_expense_with_participants', {
    p_id: input.id,
    p_group_id: input.groupId,
    p_title: input.title,
    p_category_id: null,
    p_amount: input.amount,
    p_paid_by: input.paidById,
    p_split_type: input.splitType,
    p_date: input.date,
    p_participants: participantRows(input.splitType, input.participants),
    p_description: input.description ?? null,
    p_receipt_path: receiptPath,
    p_recurrence_id: input.recurrenceId ?? null,
  });
  if (error) throw error;

  // 4. Ocorrências já vencidas (recorrência retroativa, ou dias sem abrir o
  //    app). Só
  //    depois da semente existir — ver o comentário em materializeRecurrenceNow.
  if (input.recurrenceId) await materializeRecurrenceNow(input.recurrenceId);
}

/** O mínimo pra saber o que uma despesa faz com o saldo. Criar e editar
 *  satisfazem esta forma, então as contas de saldo servem às duas. */
type ExpenseContribution = {
  paidById: string;
  amount: number;
  splitType: SplitType;
  participants: ExpenseParticipantInput[];
};

/** Quanto cada participante deve — mesma conta do saldo real, pra a prévia
 *  nunca divergir do que vai ser gravado. */
function optimisticShares(input: ExpenseContribution): Record<string, number> {
  return computeShares(input.amount, input.splitType, participantRows(input.splitType, input.participants)
    .map(p => ({ user_id: p.userId, shares: p.shares, exact_amount: p.exactAmount })));
}

/** A despesa como a LISTA precisa vê-la antes de existir no servidor. */
function optimisticLancamento(input: CreateExpenseVariables): LancamentoItem {
  const myUserId = input.myUserId;
  const shares = optimisticShares(input);
  return {
    id: input.id,
    type: 'expense',
    title: input.title,
    // Sem categoria até a descrição responder — a linha mostra o ícone neutro
    // nesse meio-tempo, e o invalidate do onSuccess da descrição a traz.
    categoryId: null,
    amount: input.amount,
    paidById: input.paidById,
    paidByName: input.memberInfo[input.paidById]?.name ?? '',
    paidByMe: input.paidById === myUserId,
    // Sempre eu: esta linha só existe porque EU acabei de lançar.
    createdByMe: true,
    date: input.date,
    createdAt: new Date().toISOString(),
    splitCount: input.participants.length,
    myShare: shares[myUserId],
    participantShares: shares,
    participantNames: input.participants.map(p => input.memberInfo[p.userId]?.name ?? ''),
    recurrenceId: input.recurrenceId ?? null,
  };
}

/** A despesa como a tela de DETALHE precisa vê-la.
 *
 *  Sem isto, abrir uma despesa recém-lançada quebra: `fetchExpenseDetail` usa
 *  `.single()` numa linha que ainda não existe. Semeando o cache, o detalhe
 *  funciona desde o primeiro toque e é substituído pelo dado do servidor assim
 *  que a criação responde. */
function optimisticExpenseDetail(input: CreateExpenseVariables): ExpenseDetail {
  const shares = optimisticShares(input);
  const rows = participantRows(input.splitType, input.participants);
  return {
    id: input.id,
    groupId: input.groupId,
    title: input.title,
    description: input.description ?? null,
    categoryId: null,
    amount: input.amount,
    splitType: input.splitType,
    paidById: input.paidById,
    paidByName: input.memberInfo[input.paidById]?.name ?? '',
    paidByPhotoUrl: input.memberInfo[input.paidById]?.photoUrl ?? null,
    paidByMe: input.paidById === input.myUserId,
    // Sempre eu: esta linha só existe porque EU acabei de lançar. Sem isso, uma
    // despesa lançada em nome de outro abriria sem os botões de editar/apagar
    // até o primeiro refetch.
    createdByMe: true,
    date: input.date,
    receiptPath: input.receiptPath ?? null,
    recurrenceId: input.recurrenceId ?? null,
    participants: rows.map(p => ({
      userId: p.userId,
      name: input.memberInfo[p.userId]?.name ?? '',
      photoUrl: input.memberInfo[p.userId]?.photoUrl ?? null,
      isMe: p.userId === input.myUserId,
      shareAmount: shares[p.userId] ?? 0,
      shares: p.shares,
      exactAmount: p.exactAmount,
    })),
  };
}

/** A receita da recorrência como o detalhe precisa vê-la — mesma razão do
 *  detalhe da despesa: a linha só existe no banco depois que a criação responde.
 *
 *  `firstOccurrenceDate` é a data da despesa que está criando a série: ela É a
 *  primeira ocorrência, tanto ao lançar quanto ao ligar "Repetir" numa despesa
 *  que já existia. */
function recurrenceInfoFromRow(row: ExpenseRecurrenceRow, firstOccurrenceDate: string): ExpenseRecurrenceInfo {
  return {
    createdBy: row.created_by,
    freq: row.freq,
    intervalDays: row.interval_days,
    nextRunDate: row.next_run_date,
    endDate: row.end_date,
    active: true,
    // Série que nasce agora nunca nasce pausada.
    paused: false,
    firstOccurrenceDate,
    anchorDay: row.anchor_day,
  };
}

function optimisticRecurrenceInfo(input: CreateExpenseVariables): ExpenseRecurrenceInfo | null {
  return input.recurrenceRow ? recurrenceInfoFromRow(input.recurrenceRow, input.date) : null;
}

/** Reflete na hora o que a edição fez com a recorrência. Sem isto, ligar
 *  "Repetir" não mostra nada no detalhe até a resposta chegar — a seção lê de
 *  uma linha que só passa a existir depois. Devolve o valor anterior, pro
 *  rollback. */
function applyRecurrenceIntentToCache(
  queryClient: QueryClient,
  rec: RecurrenceIntent,
  firstOccurrenceDate: string,
): ExpenseRecurrenceInfo | null | undefined {
  if (rec.action === 'none') return undefined;

  const key = queryKeys.expenseRecurrenceInfo(rec.id);
  const previous = queryClient.getQueryData<ExpenseRecurrenceInfo | null>(key);

  if (rec.action === 'create') {
    queryClient.setQueryData<ExpenseRecurrenceInfo | null>(key, recurrenceInfoFromRow(rec.row, firstOccurrenceDate));
  } else if (rec.action === 'cancel') {
    // null é o mesmo que o servidor devolveria pra uma receita apagada, então a
    // seção some do detalhe imediatamente.
    queryClient.setQueryData<ExpenseRecurrenceInfo | null>(key, null);
  } else if (previous) {
    const next: ExpenseRecurrenceInfo = {
      ...previous,
      freq: rec.freq,
      intervalDays: rec.intervalDays,
      endDate: rec.endDate,
      paused: rec.paused,
    };
    queryClient.setQueryData<ExpenseRecurrenceInfo | null>(key, next);
  }

  return previous ?? null;
}

type OptimisticContext = {
  previousExpenses: LancamentoItem[] | undefined;
  previousBalances: BalancesSnapshot | undefined;
};

/** A edição mexe em dois caches a mais que a criação: o detalhe (que já
 *  existia) e a receita da recorrência. `undefined` em previousRecurrenceInfo
 *  significa "não mexi", diferente de `null`, que significa "não havia". */
type UpdateOptimisticContext = OptimisticContext & {
  previousDetail: ExpenseDetail | undefined;
  previousRecurrenceInfo: ExpenseRecurrenceInfo | null | undefined;
};

/** Caches semeados no onMutate que não precisam de rollback: a chave é o id da
 *  despesa nova, então em caso de erro basta remover a entrada — não havia
 *  nada ali antes. */
function removeOptimisticDetail(queryClient: QueryClient, input: CreateExpenseVariables) {
  queryClient.removeQueries({ queryKey: queryKeys.expense(input.id) });
  if (input.recurrenceId) {
    queryClient.removeQueries({ queryKey: queryKeys.expenseRecurrenceInfo(input.recurrenceId) });
  }
}

type BalancesSnapshot = {
  balances: Record<string, number>;
  transfers: Transfer[];
  paymentsOnlyBalances: Record<string, number>;
};

// Saldo é uma query SEPARADA da lista, e as duas leem as mesmas linhas do
// servidor — então mexer só na lista faria a despesa aparecer sem o saldo se
// mover, que é pior do que não mostrar nada. Aqui o delta é aplicado à mão em
// vez de refazer a conta: o cache guarda o RESULTADO (saldos já somados), não
// as linhas cruas, e o delta de uma despesa é exatamente o que computeBalances
// faria com ela — pagador recebe o total, cada participante devolve sua parte.
function applyExpenseToBalances(snapshot: BalancesSnapshot, input: ExpenseContribution): BalancesSnapshot {
  const balances = { ...snapshot.balances };
  balances[input.paidById] = (balances[input.paidById] ?? 0) + input.amount;

  const shares = computeShares(input.amount, input.splitType, participantRows(input.splitType, input.participants)
    .map(p => ({ user_id: p.userId, shares: p.shares, exact_amount: p.exactAmount })));
  for (const [userId, share] of Object.entries(shares)) {
    balances[userId] = (balances[userId] ?? 0) - share;
  }
  for (const id of Object.keys(balances)) balances[id] = Math.round(balances[id] * 100) / 100;

  return { ...snapshot, balances, transfers: simplifyDebts(balances) };
}

// Inverso exato de applyExpenseToBalances: devolve ao pagador o que ele
// adiantou e tira de cada participante a parte que devia.
//
// A guarda de lista vazia não é defensiva à toa — computeBalances IGNORA
// despesa sem participante (lib/balances.ts). Sem ela, apagar uma dessas
// tiraria do pagador um valor que nunca tinha sido somado.
function removeExpenseFromBalances(snapshot: BalancesSnapshot, item: LancamentoItem): BalancesSnapshot {
  const shares = item.participantShares ?? {};
  if (Object.keys(shares).length === 0) return snapshot;

  const balances = { ...snapshot.balances };
  balances[item.paidById] = (balances[item.paidById] ?? 0) - item.amount;
  for (const [userId, share] of Object.entries(shares)) {
    balances[userId] = (balances[userId] ?? 0) + share;
  }
  for (const id of Object.keys(balances)) balances[id] = Math.round(balances[id] * 100) / 100;

  return { ...snapshot, balances, transfers: simplifyDebts(balances) };
}

/** Para onde a recorrência da despesa vai depois da edição. */
function nextRecurrenceId(previous: string | null | undefined, rec: RecurrenceIntent): string | null {
  if (rec.action === 'create') return rec.id;
  if (rec.action === 'cancel') return null;
  return previous ?? null;
}

/** A linha da lista com os valores novos, preservando o que a edição não toca
 *  (categoria, instante de criação). */
function optimisticUpdatedLancamento(previous: LancamentoItem, input: UpdateExpenseVariables): LancamentoItem {
  const shares = optimisticShares(input);
  return {
    ...previous,
    title: input.title,
    categoryId: input.categoryId,
    amount: input.amount,
    paidById: input.paidById,
    paidByName: input.memberInfo[input.paidById]?.name ?? previous.paidByName,
    paidByMe: input.paidById === input.myUserId,
    date: input.date,
    splitCount: input.participants.length,
    myShare: shares[input.myUserId],
    participantShares: shares,
    participantNames: input.participants.map(p => input.memberInfo[p.userId]?.name ?? ''),
    recurrenceId: nextRecurrenceId(previous.recurrenceId, input.recurrence),
  };
}

/** O detalhe com os valores novos — sem isso a tela de onde a edição partiu
 *  continuaria mostrando os antigos até a resposta chegar. */
function optimisticUpdatedDetail(previous: ExpenseDetail, input: UpdateExpenseVariables): ExpenseDetail {
  const shares = optimisticShares(input);
  const rows = participantRows(input.splitType, input.participants);
  return {
    ...previous,
    title: input.title,
    categoryId: input.categoryId,
    amount: input.amount,
    splitType: input.splitType,
    paidById: input.paidById,
    paidByName: input.memberInfo[input.paidById]?.name ?? previous.paidByName,
    paidByPhotoUrl: input.memberInfo[input.paidById]?.photoUrl ?? null,
    paidByMe: input.paidById === input.myUserId,
    date: input.date,
    receiptPath: input.receiptPath,
    recurrenceId: nextRecurrenceId(previous.recurrenceId, input.recurrence),
    participants: rows.map(p => ({
      userId: p.userId,
      name: input.memberInfo[p.userId]?.name ?? '',
      photoUrl: input.memberInfo[p.userId]?.photoUrl ?? null,
      isMe: p.userId === input.myUserId,
      shareAmount: shares[p.userId] ?? 0,
      shares: p.shares,
      exactAmount: p.exactAmount,
    })),
  };
}

/**
 * Registra o que cada mutação de despesa faz: a função em si, o efeito otimista
 * e as invalidações. Fica fora dos hooks porque `useCreateExpense` e companhia
 * montam o `useMutation` só com a CHAVE — é daqui que sai o resto.
 */
export function registerExpenseMutationDefaults(queryClient: QueryClient) {
  queryClient.setMutationDefaults(CREATE_EXPENSE_MUTATION_KEY, {
    mutationFn: createExpenseMutationFn,

    // Roda em série com as outras mutações de despesa — ver EXPENSE_MUTATION_SCOPE.
    scope: EXPENSE_MUTATION_SCOPE,

    // Rede ruim não é rede ausente: os primeiros pacotes saem e falham. Sem
    // repetir, uma oscilação de segundos descartaria o lançamento. Repetir é
    // seguro justamente porque a RPC é idempotente — no pior caso a
    // segunda tentativa encontra a despesa já gravada.
    retry: 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000),

    onMutate: async (input: CreateExpenseVariables): Promise<OptimisticContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.expenses(input.groupId) });
      await queryClient.cancelQueries({ queryKey: queryKeys.groupBalances(input.groupId) });

      const previousExpenses = queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(input.groupId));
      const previousBalances = queryClient.getQueryData<BalancesSnapshot>(queryKeys.groupBalances(input.groupId));

      if (previousExpenses) {
        queryClient.setQueryData<LancamentoItem[]>(
          queryKeys.expenses(input.groupId),
          sortLancamentos([optimisticLancamento(input), ...previousExpenses]),
        );
      }
      if (previousBalances) {
        queryClient.setQueryData<BalancesSnapshot>(
          queryKeys.groupBalances(input.groupId),
          applyExpenseToBalances(previousBalances, input),
        );
      }

      // Detalhe e recorrência: sem estes, tocar na despesa recém-lançada abre a
      // tela de erro — a linha ainda não existe pra ser buscada.
      queryClient.setQueryData<ExpenseDetail>(queryKeys.expense(input.id), optimisticExpenseDetail(input));
      if (input.recurrenceId) {
        queryClient.setQueryData<ExpenseRecurrenceInfo | null>(
          queryKeys.expenseRecurrenceInfo(input.recurrenceId),
          optimisticRecurrenceInfo(input),
        );
      }

      return { previousExpenses, previousBalances };
    },

    // Só depois do retry esgotar. Enquanto ele insiste, a linha otimista é o
    // que a pessoa vê — e na maioria das vezes a tentativa seguinte passa.
    onError: (_err: unknown, input: CreateExpenseVariables, context: OptimisticContext | undefined) => {
      if (context?.previousExpenses) {
        queryClient.setQueryData(queryKeys.expenses(input.groupId), context.previousExpenses);
      }
      if (context?.previousBalances) {
        queryClient.setQueryData(queryKeys.groupBalances(input.groupId), context.previousBalances);
      }
      removeOptimisticDetail(queryClient, input);
    },

    onSuccess: (_data: void, input: CreateExpenseVariables) => {
      // O detalhe e a recorrência foram SEMEADOS no onMutate — sem invalidar,
      // ficariam pra sempre com o dado otimista (sem categoria, apontando pro
      // arquivo local em vez do Storage), porque a chave já tem valor e o
      // staleTime de 5min impede o refetch.
      queryClient.invalidateQueries({ queryKey: queryKeys.expense(input.id) });
      if (input.recurrenceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.expenseRecurrenceInfo(input.recurrenceId) });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.expenses(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupBalances(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupHistory(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      // A contagem por categoria do seletor conta despesas — criar, editar ou
      // apagar uma muda esse número.
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryUsage(input.groupId) });
      // A lista de recorrências mostra a 1ª ocorrência e a despesa mais recente
      // de cada série — as duas mudam quando uma despesa entra ou sai.
      queryClient.invalidateQueries({ queryKey: queryKeys.groupRecurrences(input.groupId) });

      // Emenda a descrição logo atrás: mesmo escopo, então ela roda em seguida,
      // sem esperar nada. Sempre — a despesa nova nunca chega aqui já
      // categorizada.
      enqueueDescribe(queryClient, {
        expenseId: input.id,
        groupId: input.groupId,
        recurrenceId: input.recurrenceId,
      });
    },
  });

  // ── Descrever (categoria) ─────────────────────────────────────────────────
  //
  // Disparada pelo onSuccess da criação, no mesmo escopo — roda logo depois do
  // insert.
  //
  // A diferença que importa em relação ao best-effort que ela substituiu: aqui
  // a falha SOBE, e erro vira retry em vez de desistência silenciosa.
  //
  // Retry maior que o das outras: a despesa em si já está a salvo quando esta
  // roda, então insistir aqui não segura nada nem arrisca nada.
  queryClient.setMutationDefaults(DESCRIBE_EXPENSE_MUTATION_KEY, {
    mutationFn: describeExpenseMutationFn,
    scope: EXPENSE_MUTATION_SCOPE,
    retry: 6,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000),

    // Sem onMutate e sem onError: não há nada de otimista pra desfazer. A
    // despesa cinza que já está na tela É o estado correto enquanto isso.
    onSuccess: (_data: void, input: DescribeExpenseVariables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.expense(input.expenseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryUsage(input.groupId) });
      if (input.recurrenceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.expenseRecurrenceInfo(input.recurrenceId) });
        // A categoria da receita acompanha a da despesa, e o card da lista
        // mostra o ícone dela.
        queryClient.invalidateQueries({ queryKey: queryKeys.groupRecurrences(input.groupId) });
      }
    },
  });

  // ── Editar ────────────────────────────────────────────────────────────────
  //
  // Mesmo escopo dos outros, então editar uma despesa cuja criação ainda está
  // no ar espera ela terminar. Repetir é seguro: reescrever os mesmos campos
  // leva ao mesmo estado final.
  queryClient.setMutationDefaults(UPDATE_EXPENSE_MUTATION_KEY, {
    mutationFn: updateExpenseMutationFn,
    scope: EXPENSE_MUTATION_SCOPE,
    retry: 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000),

    onMutate: async (input: UpdateExpenseVariables): Promise<UpdateOptimisticContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.expenses(input.groupId) });
      await queryClient.cancelQueries({ queryKey: queryKeys.groupBalances(input.groupId) });

      const previousExpenses = queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(input.groupId));
      const previousBalances = queryClient.getQueryData<BalancesSnapshot>(queryKeys.groupBalances(input.groupId));
      const previousDetail = queryClient.getQueryData<ExpenseDetail>(queryKeys.expense(input.expenseId));
      const target = previousExpenses?.find(l => l.id === input.expenseId && l.type === 'expense');

      if (previousExpenses && target) {
        queryClient.setQueryData<LancamentoItem[]>(
          queryKeys.expenses(input.groupId),
          sortLancamentos(previousExpenses.map(l =>
            l.id === input.expenseId ? optimisticUpdatedLancamento(target, input) : l)),
        );
      }
      // Saldo: tira a contribuição ANTIGA e põe a nova. Não dá pra só somar a
      // diferença — valor, pagador e rateio podem ter mudado todos de uma vez.
      if (previousBalances && target) {
        queryClient.setQueryData<BalancesSnapshot>(
          queryKeys.groupBalances(input.groupId),
          applyExpenseToBalances(removeExpenseFromBalances(previousBalances, target), input),
        );
      }
      if (previousDetail) {
        queryClient.setQueryData<ExpenseDetail>(
          queryKeys.expense(input.expenseId),
          optimisticUpdatedDetail(previousDetail, input),
        );
      }
      const previousRecurrenceInfo = applyRecurrenceIntentToCache(queryClient, input.recurrence, input.date);

      return { previousExpenses, previousBalances, previousDetail, previousRecurrenceInfo };
    },

    onError: (_err: unknown, input: UpdateExpenseVariables, context: UpdateOptimisticContext | undefined) => {
      if (context?.previousExpenses) {
        queryClient.setQueryData(queryKeys.expenses(input.groupId), context.previousExpenses);
      }
      if (context?.previousBalances) {
        queryClient.setQueryData(queryKeys.groupBalances(input.groupId), context.previousBalances);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.expense(input.expenseId), context.previousDetail);
      }
      if (input.recurrence.action !== 'none' && context?.previousRecurrenceInfo !== undefined) {
        queryClient.setQueryData(
          queryKeys.expenseRecurrenceInfo(input.recurrence.id),
          context.previousRecurrenceInfo,
        );
      }
    },

    onSuccess: (_data: void, input: UpdateExpenseVariables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expense(input.expenseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupBalances(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupHistory(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryUsage(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupRecurrences(input.groupId) });
      if (input.recurrence.action !== 'none') {
        queryClient.invalidateQueries({ queryKey: queryKeys.expenseRecurrenceInfo(input.recurrence.id) });
      }

      // Título novo, categoria velha: recategoriza. Mesmo escopo da criação.
      //
      // Mas só quando ninguém mexeu no seletor nesta edição — quem corrigiu à
      // mão tem a palavra final, senão o seletor viraria decoração.
      //
      // Antes, mexer no seletor E no título ainda valia uma ida à IA, porque
      // sobrava o emoji pra redecidir. Sem emoji não sobra nada: a chamada
      // gastaria rede e modelo pra descartar a resposta.
      if (input.titleChanged && !input.categoryTouched) {
        enqueueDescribe(queryClient, {
          expenseId: input.expenseId,
          groupId: input.groupId,
          recurrenceId: input.recurrence.id,
        });
      }
    },
  });

  // ── Apagar ────────────────────────────────────────────────────────────────
  //
  // Mesmo escopo da criação, então apagar uma despesa cuja criação ainda está
  // no ar espera ela terminar. O resultado é a despesa nascer e morrer no
  // servidor — desperdício, mas correto; sem a série, a exclusão poderia
  // chegar antes e a despesa ressuscitaria.
  //
  // Idempotente sem esforço: apagar uma linha que já não existe afeta zero
  // linhas e não é erro, e pausar uma série já pausada grava o mesmo valor —
  // então o retry é seguro.
  queryClient.setMutationDefaults(DELETE_EXPENSE_MUTATION_KEY, {
    mutationFn: deleteExpenseMutationFn,
    scope: EXPENSE_MUTATION_SCOPE,
    retry: 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000),

    onMutate: async (input: DeleteExpenseVariables): Promise<OptimisticContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.expenses(input.groupId) });
      await queryClient.cancelQueries({ queryKey: queryKeys.groupBalances(input.groupId) });

      const previousExpenses = queryClient.getQueryData<LancamentoItem[]>(queryKeys.expenses(input.groupId));
      const previousBalances = queryClient.getQueryData<BalancesSnapshot>(queryKeys.groupBalances(input.groupId));
      const target = previousExpenses?.find(l => l.id === input.expenseId && l.type === 'expense');

      if (previousExpenses) {
        queryClient.setQueryData<LancamentoItem[]>(
          queryKeys.expenses(input.groupId),
          previousExpenses.filter(l => l.id !== input.expenseId),
        );
      }
      if (previousBalances && target) {
        queryClient.setQueryData<BalancesSnapshot>(
          queryKeys.groupBalances(input.groupId),
          removeExpenseFromBalances(previousBalances, target),
        );
      }
      return { previousExpenses, previousBalances };
    },

    onError: (_err: unknown, input: DeleteExpenseVariables, context: OptimisticContext | undefined) => {
      if (context?.previousExpenses) {
        queryClient.setQueryData(queryKeys.expenses(input.groupId), context.previousExpenses);
      }
      if (context?.previousBalances) {
        queryClient.setQueryData(queryKeys.groupBalances(input.groupId), context.previousBalances);
      }
    },

    onSuccess: (_data: void, input: DeleteExpenseVariables) => {
      queryClient.removeQueries({ queryKey: queryKeys.expense(input.expenseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupBalances(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupHistory(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryUsage(input.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupRecurrences(input.groupId) });
      // Vale pra pausada E pra encerrada por ficar sem ocorrência — nos dois
      // casos o que o detalhe de qualquer despesa da série mostra mudou.
      if (input.recurrenceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.expenseRecurrenceInfo(input.recurrenceId),
        });
      }
    },
  });
}

export function useCreateExpense() {
  const { session } = useAuth();
  const { t } = useLanguage();

  // Sem mutationFn aqui: ela vem do setMutationDefaults desta mesma chave (ver
  // registerExpenseMutationDefaults).
  const mutation = useMutation<void, Error, CreateExpenseVariables>({
    mutationKey: CREATE_EXPENSE_MUTATION_KEY,
  });

  return {
    // Não devolve promessa de propósito, e usa `mutate` em vez de
    // `mutateAsync`: com retry, uma tentativa ruim pode levar dezenas de
    // segundos, e a tela de lançar ficaria travada em "Lançando..." esse tempo
    // todo. Não há o que esperar mesmo — o `onMutate` já colocou a despesa na
    // lista e no saldo antes de qualquer ida à rede.
    createExpense: (input: CreateExpenseInput, onFailure?: (message: string) => void) => {
      const userId = session?.user.id;
      if (!userId) throw new Error(t('errors.sessionInvalid'));
      // Ids gerados AQUI, e não pelo banco: a linha otimista já nasce com o id
      // definitivo (abrir o detalhe funciona antes de sincronizar), um envio
      // repetido bate na chave primária em vez de duplicar a despesa, e a
      // despesa já sai da tela sabendo a qual receita vai se ligar — sem
      // precisar de uma ida ao servidor pra descobrir.
      const { recurrence, ...rest } = input;
      const paidById = input.paidById ?? userId;
      const recurrenceId = recurrence ? randomUUID() : null;
      const recurrenceRow = recurrence
        ? buildRecurrenceRow(
          {
            groupId: input.groupId,
            title: input.title,
            // Igual à despesa: a receita nasce sem categoria e recebe a da IA
            // junto com a semente — a categorize-expense grava nas duas quando
            // a despesa tem `recurrence_id`.
            categoryId: null,
            amount: input.amount,
            splitType: input.splitType,
            paidById,
            participants: input.participants,
            receiptPath: input.receiptPath,
            recurrence,
          },
          userId,
          recurrenceId!,
        )
        : null;

      mutation.mutate(
        { ...rest, id: randomUUID(), paidById, myUserId: userId, recurrenceRow, recurrenceId },
        // Falha depois do retry esgotar. O desfazimento do otimista é feito
        // pelo onError registrado nos defaults; isto aqui só avisa a pessoa,
        // que a essa altura já saiu da tela de lançar.
        { onError: err => onFailure?.(err instanceof Error ? err.message : t('common.tryAgain')) },
      );
    },
  };
}

export function useUpdateExpense() {
  const { session } = useAuth();
  const { t } = useLanguage();

  // Sem mutationFn aqui: vem do setMutationDefaults desta chave (ver
  // registerExpenseMutationDefaults).
  const mutation = useMutation<void, Error, UpdateExpenseVariables>({
    mutationKey: UPDATE_EXPENSE_MUTATION_KEY,
  });

  return {
    // Igual a criar e apagar: não devolve promessa e usa `mutate`, pra o sheet
    // de editar não ficar travado em "Salvando..." durante o retry. A lista, o
    // saldo e o detalhe já mostram os valores novos pelo efeito otimista.
    updateExpense: (
      input: Omit<UpdateExpenseVariables, 'myUserId'>,
      onFailure?: (message: string) => void,
    ) => {
      const userId = session?.user.id;
      if (!userId) throw new Error(t('errors.sessionInvalid'));
      mutation.mutate(
        { ...input, myUserId: userId },
        { onError: err => onFailure?.(err instanceof Error ? err.message : t('common.tryAgain')) },
      );
    },
  };
}

export function useDeleteExpense() {
  // Sem mutationFn aqui: vem do setMutationDefaults desta chave (ver
  // registerExpenseMutationDefaults).
  const mutation = useMutation<void, Error, DeleteExpenseVariables>({
    mutationKey: DELETE_EXPENSE_MUTATION_KEY,
  });

  return {
    // Igual ao createExpense: não devolve promessa e usa `mutate`, pra a tela
    // não ficar travada durante o retry. A despesa já sumiu da lista e do saldo
    // pelo efeito otimista, então não há o que aguardar.
    deleteExpense: (
      expenseId: string,
      groupId: string,
      recurrenceId: string | null,
      /** "Apagar e parar de repetir" — pausa a série junto. */
      pauseRecurrence: boolean,
      onFailure?: (message: string) => void,
    ) => {
      mutation.mutate(
        {
          expenseId,
          groupId,
          recurrenceId,
          pauseRecurrenceId: pauseRecurrence ? recurrenceId : null,
        },
        { onError: err => onFailure?.(err instanceof Error ? err.message : '') },
      );
    },
  };
}
