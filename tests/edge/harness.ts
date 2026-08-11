// Roda uma Edge Function de verdade dentro do vitest.
//
// As functions são Deno: chamam `Deno.serve(handler)` ao carregar e leem
// segredo com `Deno.env.get`. Não há Deno instalado aqui, e instalar um runtime
// só pra isso é caro — mas o handler em si é só `(Request) => Promise<Response>`,
// que o node executa bem. Então o que falta é o entorno:
//
//   · `Deno` global — um shim que CAPTURA o handler em vez de subir servidor;
//   · `jsr:@supabase/supabase-js@2` — apontado pro mock de sempre (vitest.config);
//   · `fetch` — as functions falam com Expo/OpenAI/Resend, que não existem aqui.
//
// Nada disso toca código de produção: a function testada é o arquivo que vai
// pro servidor, sem adaptação.
import { createSupabaseMock, type MockConfig, type SupabaseMock } from '../support/supabaseMock';
import { setEdgeSupabaseMock } from '../stubs/jsr-supabase';

export type EdgeHandler = (req: Request) => Promise<Response> | Response;

type DenoGlobal = {
  serve: (handler: EdgeHandler) => void;
  env: { get: (key: string) => string | undefined };
};

/** Resposta que o `fetch` estubado devolve, e o registro do que foi chamado. */
export type FetchCall = { url: string; body: unknown };

let captured: EdgeHandler | null = null;
let env: Record<string, string> = {};

// Módulo ESM só avalia UMA vez por processo, então `Deno.serve` só dispara na
// primeira importação. O handler fica guardado por nome pra as chamadas
// seguintes — o que muda entre testes é o mock e o env, não o handler.
const handlerByName = new Map<string, EdgeHandler>();

function installDenoShim(): void {
  const g = globalThis as typeof globalThis & { Deno?: DenoGlobal };
  g.Deno = {
    serve: (handler: EdgeHandler) => { captured = handler; },
    env: { get: (key: string) => env[key] },
  };
}

export type EdgeSetup = {
  /** Variáveis que a function lê com `Deno.env.get`. */
  env?: Record<string, string>;
  /** Linhas e RPCs do banco, igual aos testes de hook. */
  supabase?: MockConfig;
  /** Resposta do `fetch` externo (API de push, OpenAI, Resend).
   *
   *  Como função, decide pela URL — a `parse-voice-expense` faz DUAS chamadas
   *  em sequência (transcrever o áudio, depois extrair a despesa) e cada uma
   *  precisa de um corpo diferente. */
  fetchResponse?:
    | { status?: number; json?: unknown }
    | ((url: string, body: unknown) => { status?: number; json?: unknown });
};

export type LoadedEdge = {
  /** Chama a function como o servidor chamaria. */
  call: (req: Request) => Promise<Response>;
  mock: SupabaseMock;
  /** Todo `fetch` que a function disparou pra fora. */
  fetchCalls: FetchCall[];
};

/**
 * Carrega uma Edge Function e devolve o handler pronto pra receber `Request`.
 *
 * `name` identifica o módulo no cache; `importer` precisa ser um `import()`
 * literal pra o Vite conseguir resolvê-lo estaticamente.
 */
export async function loadEdgeFunction(
  name: string,
  importer: () => Promise<unknown>,
  setup: EdgeSetup = {},
): Promise<LoadedEdge> {
  env = {
    SUPABASE_URL: 'https://mock.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    ...(setup.env ?? {}),
  };

  const mock = createSupabaseMock(setup.supabase ?? {});
  setEdgeSupabaseMock(mock.client);

  const fetchCalls: FetchCall[] = [];
  const g = globalThis as typeof globalThis & { fetch: typeof fetch };
  g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let body: unknown = null;
    try { body = init?.body ? JSON.parse(String(init.body)) : null; } catch { body = init?.body ?? null; }
    const url = String(input);
    fetchCalls.push({ url, body });
    const resolved = typeof setup.fetchResponse === 'function'
      ? setup.fetchResponse(url, body)
      : setup.fetchResponse;
    return new Response(JSON.stringify(resolved?.json ?? {}), {
      status: resolved?.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  installDenoShim();

  if (!handlerByName.has(name)) {
    captured = null;
    await importer();
    if (!captured) throw new Error(`${name} não chamou Deno.serve ao carregar`);
    handlerByName.set(name, captured);
  }

  const handler = handlerByName.get(name)!;
  return {
    call: async (req: Request) => handler(req),
    mock,
    fetchCalls,
  };
}

/** Atalho pra montar o POST que o servidor entregaria à function. */
export function postJson(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://edge.local/fn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
