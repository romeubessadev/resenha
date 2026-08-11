/**
 * Mensagem de erro de uma query — ou null quando não há o que reclamar.
 *
 * A regra que importa: só é erro quando NÃO HÁ DADO. Um refetch que falha com
 * dado já em mãos (voltar pra tela pelo `useRefreshOnFocus`, puxar pra
 * atualizar) não pode virar tela de erro — o que está na tela continua válido,
 * e apagá-lo troca informação boa por uma mensagem. Quem quiser insistir tem o
 * pull-to-refresh ali mesmo.
 *
 * Sem isto, toda tela do app tinha o mesmo defeito: `query.error` continua
 * preenchido depois de uma tentativa falha, mesmo com `query.data` intacto, e
 * as telas checavam só o erro. Uma oscilação de rede de um segundo derrubava o
 * rolê inteiro pra "não foi possível carregar".
 *
 * `data === undefined` e não `!data`: lista vazia (`[]`) é dado — significa
 * "carregou e não tem nada", que é diferente de "não carregou".
 *
 * O texto que vai pra tela é SEMPRE o `fallback`. Antes daqui saía
 * `error.message` quando o erro fosse instância de `Error`, na crença de que o
 * Supabase devolvia objeto simples e que só erro nosso passaria por ali. Ele
 * não devolve: `PostgrestError` (e as famílias Auth/Functions/Storage) herdam
 * de `Error`, e nenhum `queryFn` do app lança mensagem curada — todos repassam
 * o erro do servidor. Resultado: o ramo do fallback nunca rodava e as oito
 * telas que chamam isto mostravam o texto cru do Postgres, do tipo
 * 'new row violates row-level security policy for table "groups"'.
 *
 * Quem um dia quiser mostrar uma mensagem curada de dentro de um `queryFn`
 * precisa mudar esta função de propósito — não basta lançar um `Error`.
 */
export function queryErrorMessage(
  query: { error: unknown; data: unknown },
  fallback: string,
): string | null {
  if (!query.error || query.data !== undefined) return null;
  return fallback;
}
