// hooks/useExpenseForm.ts importa estes no topo, e lib/receipt.ts puxa o client
// do Supabase. Nenhum teste de lógica pura mexe com recibo — se algum chamar,
// que estoure em vez de fingir sucesso.
export const uploadReceipt = () => {
  throw new Error('stub: uploadReceipt não é exercitado nos testes de lógica pura');
};
export const deleteReceipt = () => {
  throw new Error('stub: deleteReceipt não é exercitado nos testes de lógica pura');
};
