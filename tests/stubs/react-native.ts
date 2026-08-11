// Só o que a cadeia de import dos módulos sob teste toca: `Alert`, importado no
// topo de hooks/useExpenseForm.ts. Nenhum teste chama.
export const Alert = { alert: () => {} };
