// `jsr:@supabase/supabase-js@2` — o especificador que só o Deno resolve.
//
// As Edge Functions criam o client com service role e escrevem por ele. Aqui
// `createClient` devolve o MESMO mock dos testes de hook, então as chamadas
// caem em `mock.calls` e o teste afirma sobre elas do jeito de sempre.
import type { SupabaseMock } from '../support/supabaseMock';

type Client = SupabaseMock['client'];

let impl: Client | null = null;

export function setEdgeSupabaseMock(mock: Client | null): void {
  impl = mock;
}

// O 3º argumento existe: `parse-voice-expense` cria o client repassando o
// Authorization de quem chamou, pra a RLS valer pelo usuário e não pela chave.
export function createClient(_url: string, _key: string, _opts?: unknown): Client {
  if (!impl) {
    throw new Error(
      'mock do Supabase não instalado na Edge Function: use loadEdgeFunction() do tests/edge/harness.',
    );
  }
  return impl;
}
