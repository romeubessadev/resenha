// Ponto de injeção do mock: o vitest.config aponta `@/lib/supabase` pra cá.
//
// O client real chama `createClient(url, key)` com as env vars vazias e estoura
// no import, então nem dá pra carregá-lo em teste. Aqui `supabase` é um Proxy
// que delega pro mock que o teste instalou.
//
// Sem mock instalado ele LANÇA em vez de devolver undefined: um hook que toca no
// banco sem o teste ter preparado a resposta é bug de teste, e falhar alto é
// melhor que passar por acidente com `undefined`.
import type { SupabaseMock } from '../support/supabaseMock';

type Client = SupabaseMock['client'];

let impl: Client | null = null;

export function setSupabaseMock(mock: Client | null): void {
  impl = mock;
}

export const supabase = new Proxy({} as Client, {
  get(_target, prop: string | symbol) {
    if (!impl) {
      throw new Error(
        `supabase mock não instalado: algo tocou em supabase.${String(prop)}. ` +
        'Chame setSupabaseMock(mock.client) no beforeEach do teste.',
      );
    }
    return impl[prop as keyof Client];
  },
});
