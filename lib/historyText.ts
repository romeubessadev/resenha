import type { ExpenseParticipantSnapshot, HistoryEvent } from '@/hooks/useGroupHistory';
import type { SplitType } from '@/hooks/useExpenses';
import { formatMoney } from './currencies';
import { formatDayLabel } from './formatRelativeTime';
import { isFixedCategoryKey } from './categories';
import { rhythmLabel } from './recurrence';
import type { Language, TranslationKey } from './i18n';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

export type HistoryEventText = { title: string; detail: string | null };

function money(amount: number): string {
  return formatMoney(amount);
}

function who(userId: string, name: string, myUserId: string, t: T): string {
  return userId === myUserId ? t('common.youCapitalized') : name;
}

function whoLower(userId: string, name: string, myUserId: string, t: T): string {
  return userId === myUserId ? t('common.you') : name;
}

/** Nome traduzido da categoria a partir da chave gravada no evento. Passa pelo
 *  `isFixedCategoryKey` porque o histórico guarda o que estava na despesa na
 *  época — inclusive chaves que já saíram da lista ('local' foi removida,
 *  'diversao' renomeada). Chave desconhecida ou nula vira "Sem categoria",
 *  que é a verdade, em vez de estourar numa chave de tradução inexistente. */
function categoryName(id: string | null | undefined, t: T): string {
  if (!id || !isFixedCategoryKey(id)) return t('common.categoryFallback');
  return t(`category.${id}` as TranslationKey);
}

const SPLIT_TYPE_LABEL: Record<string, TranslationKey> = {
  equal: 'expenseForm.modeEqual',
  shares: 'expenseForm.modeShares',
  exact: 'expenseForm.modeExact',
};

/** Rótulo do tipo de divisão. Null pra tipo desconhecido ou ausente — o
 *  `prevSplitType` só existe em evento que guardou o tipo anterior, e quem chama
 *  cai numa frase genérica em vez de mostrar rótulo vazio. */
function splitTypeLabel(type: string | null | undefined, t: T): string | null {
  const key = type ? SPLIT_TYPE_LABEL[type] : undefined;
  return key ? t(key) : null;
}

/** O que mudou numa edição de despesa, em uma linha.
 *
 *  A ordem NÃO é a de leitura, é a de consequência: valor, quem pagou e a
 *  divisão mexem em quanto cada um deve, e é pra isso que o histórico existe.
 *  Título e data vêm depois porque não movem dinheiro.
 *
 *  Devolve null quando não dá pra dizer nada — evento antigo, gravado sem
 *  `changed`, ou uma edição que não tocou em nada comparável. Aí
 *  quem chama cai no resumo da divisão, que é o comportamento antigo.
 */
function editedDetail(
  payload: {
    changed?: string[];
    prevAmount: number | null;
    paidByName?: string;
    prevPaidByName?: string | null;
    prevTitle?: string | null;
    categoryId?: string | null;
    prevCategoryId?: string | null;
    splitType?: string;
    prevSplitType?: string | null;
  },
  displayAmount: number,
  t: T,
): string | null {
  const changed = payload.changed;
  if (!changed?.length) return null;

  const partes: string[] = [];

  if (changed.includes('amount') && payload.prevAmount != null) {
    partes.push(t('history.detailAmountChanged', {
      from: money(payload.prevAmount),
      to: money(displayAmount),
    }));
  }
  if (changed.includes('paidBy') && payload.prevPaidByName && payload.paidByName) {
    partes.push(t('history.detailPaidByChanged', { from: payload.prevPaidByName, to: payload.paidByName }));
  }
  // Ordem: quem entra > como divide > quanto cada um paga. Trocar o TIPO de
  // divisão sempre remexe os valores de cada um, então os dois chegam juntos em
  // `changed` — e o que a pessoa fez foi trocar o tipo; os valores mudaram por
  // consequência. Anunciar "valores alterados" nesse caso descreve o efeito e
  // esconde a causa.
  if (changed.includes('participants')) partes.push(t('history.detailParticipantsChanged'));
  else if (changed.includes('splitType')) {
    partes.push(splitTypeLabel(payload.prevSplitType, t)
      ? t('history.detailSplitChangedFromTo', {
        from: splitTypeLabel(payload.prevSplitType, t)!,
        to: splitTypeLabel(payload.splitType, t) ?? '',
      })
      : t('history.detailSplitChanged'));
  }
  else if (changed.includes('splitValues')) partes.push(t('history.detailSplitValuesChanged'));

  if (changed.includes('category')) {
    const from = categoryName(payload.prevCategoryId, t);
    const to = categoryName(payload.categoryId, t);
    partes.push(t('history.detailCategoryChanged', { from, to }));
  }

  if (changed.includes('receiptAdded')) partes.push(t('history.detailReceiptAdded'));
  else if (changed.includes('receiptRemoved')) partes.push(t('history.detailReceiptRemoved'));
  else if (changed.includes('receiptChanged')) partes.push(t('history.detailReceiptChanged'));

  if (changed.includes('recurringOn')) partes.push(t('history.detailRecurringOn'));
  else if (changed.includes('recurringOff')) partes.push(t('history.detailRecurringOff'));

  if (changed.includes('title') && payload.prevTitle) {
    partes.push(t('history.detailTitleChanged', { from: payload.prevTitle }));
  }
  if (changed.includes('date')) partes.push(t('history.detailDateChanged'));

  if (partes.length === 0) return null;
  // ' · ' é o separador que o app já usa pra encadear fatos curtos (carteira,
  // resumo da recorrência). É uma linha de apoio sob o título, não relatório.
  return partes.join(' · ');
}

function splitDetail(
  splitType: SplitType,
  participants: ExpenseParticipantSnapshot[],
  myUserId: string,
  t: T,
): string {
  if (splitType === 'shares') {
    const list = participants.map(p => `${whoLower(p.userId, p.name, myUserId, t)} ${p.shares ?? 1}`).join(', ');
    return t('history.detailSplitShares', { list });
  }
  if (splitType === 'exact') {
    const list = participants
      .map(p => `${whoLower(p.userId, p.name, myUserId, t)} ${money(p.exactAmount ?? 0)}`)
      .join(', ');
    return t('history.detailSplitExact', { list });
  }
  return t('history.detailSplitEqual', { n: participants.length });
}

/**
 * Valor + moeda "a mostrar" de uma despesa (criada/editada/apagada): regra 4
 * do handoff — se foi lançada numa moeda diferente da moeda do rolê, mostra o
 * valor original digitado, não o convertido pra moeda do grupo.
 */
// Todo rolê é em reais: não há mais "moeda original" diferente da do rolê, e
// as colunas que a guardavam saíram do banco.
function expenseDisplayAmount(payload: { amount: number }) {
  return payload.amount;
}

export type HistoryEventAmount = { text: string; variant: 'default' | 'deleted' | 'settlement' };

/** Valor pra coluna da direita — só os tipos com dinheiro envolvido têm. */
export function historyEventAmount(event: HistoryEvent): HistoryEventAmount | null {
  switch (event.type) {
    case 'expense_created':
    case 'expense_edited': {
      const amount = expenseDisplayAmount(event.payload);
      return { text: money(amount), variant: 'default' };
    }
    case 'expense_deleted': {
      const amount = expenseDisplayAmount(event.payload);
      return { text: money(amount), variant: 'deleted' };
    }
    case 'settlement':
      return { text: money(event.payload.amount), variant: 'settlement' };
    default:
      return null;
  }
}

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

/**
 * Eventos que valem uma linha no feed. Trocar a coroa entre quem já é admin
 * (admin→owner ao herdar, owner→admin ao passar) não muda nada na tela: os
 * dois papéis aparecem como "admin". A linha só anunciaria uma mudança que
 * ninguém consegue ver. O log em group_events continua registrando tudo.
 */
export function isVisibleHistoryEvent(event: HistoryEvent): boolean {
  if (event.type !== 'admin_changed') return true;
  const { roleFrom, roleTo } = event.payload;
  return !(isAdminRole(roleFrom) && isAdminRole(roleTo));
}

/** Título/detalhe traduzidos pro idioma atual, resolvendo "Você" conforme quem tá olhando. */
export function historyEventText(event: HistoryEvent, myUserId: string, t: T): HistoryEventText {
  const actor = who(event.actorId, event.actorName, myUserId, t);

  switch (event.type) {
    case 'expense_created':
    case 'expense_edited': {
      const { title, splitType, participants } = event.payload;
      const displayAmount = expenseDisplayAmount(event.payload);

      const titleKey = event.type === 'expense_created' ? 'history.titleExpenseCreated' : 'history.titleExpenseEdited';
      const eventTitle = t(titleKey, { actor, title });

      if (event.type === 'expense_edited') {
        const detail = editedDetail(event.payload, displayAmount, t);
        if (detail) return { title: eventTitle, detail };
      }
      return { title: eventTitle, detail: splitDetail(splitType, participants, myUserId, t) };
    }

    case 'expense_deleted': {
      const { title } = event.payload;
      const displayAmount = expenseDisplayAmount(event.payload);
      return {
        title: t('history.titleExpenseDeleted', { actor, title }),
        detail: t('history.detailExpenseDeleted', { amount: money(displayAmount) }),
      };
    }

    case 'settlement': {
      const { fromUserId, fromName, toUserId, toName, hasProof } = event.payload;
      return {
        title: t('history.titleSettlement', {
          from: who(fromUserId, fromName, myUserId, t),
          to: whoLower(toUserId, toName, myUserId, t),
        }),
        detail: t(hasProof ? 'history.detailSettlementProof' : 'history.detailSettlementConfirmed'),
      };
    }

    case 'member_joined':
      return { title: t('history.titleMemberJoined', { actor }), detail: t('history.detailMemberJoined') };

    case 'member_left': {
      const { memberUserId, memberName, removedByActor } = event.payload;
      const member = who(memberUserId, memberName, myUserId, t);
      if (removedByActor) {
        return { title: t('history.titleMemberLeftRemoved', { member }), detail: t('history.detailMemberLeftRemoved', { actor }) };
      }
      return { title: t('history.titleMemberLeftSelf', { member }), detail: t('history.detailMemberLeftSelf') };
    }

    case 'admin_changed': {
      // 'owner' não existe pra quem usa o app — dono e admin usam o mesmo
      // rótulo. Então virar owner se conta como "virou admin", e as trocas
      // entre admin e owner nem chegam aqui (isVisibleHistoryEvent as filtra).
      const { memberUserId, memberName, roleTo } = event.payload;
      const member = who(memberUserId, memberName, myUserId, t);
      if (isAdminRole(roleTo)) {
        return { title: t('history.titleAdminGranted', { member }), detail: t('history.detailAdminGranted', { actor }) };
      }
      return { title: t('history.titleAdminRevoked', { member }), detail: t('history.detailAdminRevoked', { actor }) };
    }

    case 'group_edited': {
      const { nameChanged, avatarChanged, currencyChanged, newName, newCurrency } = event.payload;
      const detail = nameChanged && avatarChanged
        ? t('history.detailGroupNameAndAvatar')
        : nameChanged
          ? t('history.detailGroupName', { name: newName })
          : avatarChanged
            ? t('history.detailGroupAvatar')
            : currencyChanged
              ? t('history.detailGroupCurrency', { currency: newCurrency })
              : null;
      return { title: t('history.titleGroupEdited', { actor }), detail };
    }

    case 'group_created':
      return { title: t('history.titleGroupCreated', { actor }), detail: null };

    case 'recurrence_paused':
      return {
        title: t('history.titleRecurrencePaused', { actor, title: event.payload.title }),
        detail: t('history.detailRecurrencePaused'),
      };

    case 'recurrence_resumed':
      return {
        title: t('history.titleRecurrenceResumed', { actor, title: event.payload.title }),
        detail: null,
      };

    case 'recurrence_edited': {
      const { title: expenseTitle, freq, intervalDays, prevFreq, endDateChanged } = event.payload;
      // Ritmo ganha do término quando os dois mudam: é a alteração que muda
      // quantas cobranças ainda vêm, não só até quando.
      const detail = prevFreq
        ? t('history.detailRecurrenceRhythm', { rhythm: rhythmLabel(freq, intervalDays, t) })
        : endDateChanged
          ? t('history.detailRecurrenceEndDate')
          : null;
      return { title: t('history.titleRecurrenceEdited', { actor, title: expenseTitle }), detail };
    }
  }
}

export type HistoryDayGroup = { label: string; events: HistoryEvent[] };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Assume `events` já vem ordenado desc por `at` (useGroupHistory). */
export function groupEventsByDay(events: HistoryEvent[], language: Language): HistoryDayGroup[] {
  const groups: HistoryDayGroup[] = [];
  let currentDayKey = '';

  for (const event of events) {
    const dayKey = startOfDay(new Date(event.at)).toISOString();
    if (dayKey !== currentDayKey) {
      // `at` é timestamptz — instante real, pode ir direto pro new Date().
      groups.push({ label: formatDayLabel(new Date(event.at), language), events: [event] });
      currentDayKey = dayKey;
    } else {
      groups[groups.length - 1].events.push(event);
    }
  }
  return groups;
}
