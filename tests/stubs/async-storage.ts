// AsyncStorage em memória.
//
// Antes isto caía no stub vazio, o que bastava enquanto nada exercitava
// persistência local. `lib/onboarding.ts` exercita: é ele que guarda as
// respostas do tour ANTES do cadastro e as entrega pra criação do primeiro
// resenha depois — o caminho que o CLAUDE.md descreve como "dados de antes do
// cadastro migram pro banco após o signup". Testar isso pede um storage que
// de fato guarde.
const store = new Map<string, string>();

/** Simula a falha de storage que `lib/onboarding.ts` trata em todo `catch` —
 *  as decisões de fallback dele (pular o tour, nascer sem padrões) só são
 *  observáveis com isto ligado. */
let failing = false;

export function setStorageFailing(value: boolean): void {
  failing = value;
}

export function resetStorage(): void {
  store.clear();
  failing = false;
}

function guard(): void {
  if (failing) throw new Error('storage indisponível');
}

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    guard();
    return store.get(key) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    guard();
    store.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    guard();
    store.delete(key);
  },
  multiRemove: async (keys: string[]): Promise<void> => {
    guard();
    keys.forEach(k => store.delete(k));
  },
};

export default AsyncStorage;
