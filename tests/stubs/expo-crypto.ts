// `randomUUID` do expo-crypto é módulo nativo e não resolve em node.
//
// Ids SEQUENCIAIS, e não aleatórios de verdade: quem cria a despesa gera o id
// no client (ver useCreateExpense), e o teste precisa saber qual id saiu pra
// afirmar sobre a linha otimista e sobre o argumento da RPC. `uuid-1`, `uuid-2`
// … é previsível e legível na mensagem de falha.
let counter = 0;

export function randomUUID(): string {
  counter += 1;
  return `uuid-${counter}`;
}

/** Zera a sequência — chame no beforeEach pra um teste não herdar a contagem
 *  do anterior. */
export function resetUUIDs(): void {
  counter = 0;
}
