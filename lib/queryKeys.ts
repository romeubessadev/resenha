// Mapa central de queryKeys — toda invalidação após mutação usa essas chaves.
//
// Qual mutação invalida o quê mora no `onSuccess` de cada uma (as de despesa
// ficam em registerExpenseMutationDefaults, hooks/useExpenses.ts). A regra
// prática: invalide tudo que MOSTRA o dado que você mexeu, não só a tela de
// onde a mutação partiu — despesa, por exemplo, aparece na lista da resenha, no
// saldo, no histórico, na carteira e na contagem por categoria.
// Dado que OUTRA pessoa da resenha pode mudar sem que este aparelho saiba: as
// invalidações só alcançam quem fez a mudança, e o push (ver usePushToken) só
// chega com o app aberto e permissão dada. Os 5min de staleTime global são
// longos demais aqui — significavam voltar pra aba e ainda ver o número velho.
//
// Não é o mesmo que "atualizar sempre que focar": ir e voltar de tela na hora
// segue usando cache. É só o teto de quanto tempo o número pode estar errado.
export const SHARED_STALE_TIME = 30 * 1000;

export const queryKeys = {
  myGroups: ['my-groups'] as const,
  myProfile: ['my-profile'] as const,
  notifications: ['notifications'] as const,
  wallet: ['wallet'] as const,
  fxRates: ['fx-rates'] as const,
  group: (groupId: string) => ['group', groupId] as const,
  // Prefixos: o React Query casa por elemento, então estes invalidam o detalhe
  // de TODOS as resenhas/despesas de uma vez. Servem pra mudança global que
  // aparece dentro deles — foto e nome de perfil, que são embutidos em cada
  // lista de membros e em cada despesa.
  allGroupDetails: ['group'] as const,
  allExpenseDetails: ['expense'] as const,
  groupBalances: (groupId: string) => ['group-balances', groupId] as const,
  expenses: (groupId: string) => ['expenses', groupId] as const,
  expense: (expenseId: string) => ['expense', expenseId] as const,
  categories: (groupId: string) => ['categories', groupId] as const,
  categoryUsage: (groupId: string) => ['category-usage', groupId] as const,
  settlements: (groupId: string) => ['settlements', groupId] as const,
  groupHistory: (groupId: string) => ['group-history', groupId] as const,
  expenseRecurrenceInfo: (recurrenceId: string) => ['expense-recurrence-info', recurrenceId] as const,
  groupRecurrences: (groupId: string) => ['group-recurrences', groupId] as const,
};
