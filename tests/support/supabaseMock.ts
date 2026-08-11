// Mock do client do Supabase para testar os hooks de dados.
//
// Não é um Postgres em memória: aplica só os filtros que os hooks realmente
// usam pra ler (eq, in, is) e registra TODAS as chamadas pra o teste afirmar
// sobre elas. O valor está em duas coisas:
//   1. o hook chamou a RPC certa com os argumentos certos
//   2. o hook invalidou as queries certas depois
//
// Filtro que o mock registra mas NÃO aplica (not, filter, gte, ...) aparece em
// `calls`, então um teste que dependa dele consegue afirmar que foi pedido.

export type MockRow = Record<string, unknown>;

export type Call =
  | { kind: 'select'; table: string; columns: string; filters: Filter[] }
  | { kind: 'insert'; table: string; rows: MockRow[] }
  | { kind: 'update'; table: string; values: MockRow; filters: Filter[] }
  | { kind: 'upsert'; table: string; rows: MockRow[] }
  | { kind: 'delete'; table: string; filters: Filter[] }
  | { kind: 'rpc'; name: string; args: MockRow }
  | { kind: 'storage'; bucket: string; op: string; args: unknown[] }
  | { kind: 'invoke'; name: string; body: unknown };

export type Filter = { op: string; column: string; value: unknown };

type RpcHandler = (args: MockRow) => { data?: unknown; error?: unknown } | void;

export type MockConfig = {
  /** Linhas por tabela, para as leituras. */
  tables?: Record<string, MockRow[]>;
  /** Resposta por nome de RPC. Ausente = `{ data: null, error: null }`. */
  rpc?: Record<string, RpcHandler>;
  /** Erro forçado por tabela+operação, ex.: `{ 'settlements:insert': 'boom' }`. */
  fail?: Record<string, string>;
  session?: { user: { id: string } } | null;
};

const APPLIED = new Set(['eq', 'in', 'is']);

/**
 * Todo erro do mock sai como instância de `Error`.
 *
 * Não é detalhe: `PostgrestError`, `FunctionsError` e `AuthError` todos herdam
 * de Error, e o app decide POR ISSO — `err instanceof Error ? err.message :
 * t('common.tryAgain')` (useCreateExpense) escolhe entre mostrar a mensagem do
 * servidor e um texto genérico. Com objeto simples o mock caía sempre no ramo
 * genérico e um teste de mensagem "passava" pelo motivo errado.
 */
function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  const { message, ...rest } = (e ?? {}) as { message?: string };
  return Object.assign(new Error(message ?? 'erro do mock'), rest);
}

function applyFilters(rows: MockRow[], filters: Filter[]): MockRow[] {
  return rows.filter(row =>
    filters.every(f => {
      if (!APPLIED.has(f.op)) return true;
      const v = row[f.column];
      if (f.op === 'eq') return v === f.value;
      if (f.op === 'in') return Array.isArray(f.value) && (f.value as unknown[]).includes(v);
      if (f.op === 'is') return f.value === null ? v === null || v === undefined : v === f.value;
      return true;
    }),
  );
}

export function createSupabaseMock(config: MockConfig = {}) {
  const calls: Call[] = [];
  const tables: Record<string, MockRow[]> = { ...(config.tables ?? {}) };

  const failFor = (key: string) => config.fail?.[key];

  function builder(table: string) {
    const filters: Filter[] = [];
    let columns = '*';
    let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
    let payload: MockRow[] = [];
    let values: MockRow = {};
    let single: 'one' | 'maybe' | null = null;
    let recorded = false;
    /** `select('id', { count: 'exact', head: true })` — a contagem é o dado, e
     *  com `head` não vem linha nenhuma. Vários hooks decidem por ela (se o
     *  resenha tem despesa, se sobrou membro), então devolver `undefined` fazia o
     *  teste exercitar o ramo errado sem reclamar. */
    let wantsCount = false;
    let headOnly = false;
    /** `.delete().select()` / `.update().select()` devolvem as linhas afetadas.
     *  useRemoveMember e useLeaveGroup tratam lista vazia como falha de RLS —
     *  sem isto o mock devolvia null e os dois pareciam sempre falhar. */
    let returning = false;

    const record = () => {
      if (recorded) return;
      recorded = true;
      if (op === 'select') calls.push({ kind: 'select', table, columns, filters });
      else if (op === 'insert') calls.push({ kind: 'insert', table, rows: payload });
      else if (op === 'upsert') calls.push({ kind: 'upsert', table, rows: payload });
      else if (op === 'update') calls.push({ kind: 'update', table, values, filters });
      else calls.push({ kind: 'delete', table, filters });
    };

    const settle = () => {
      record();
      const err = failFor(`${table}:${op}`);
      if (err) return { data: null, error: toError({ message: err }) };

      if (op === 'select') {
        const rows = applyFilters(tables[table] ?? [], filters);
        if (wantsCount) return { data: headOnly ? null : rows, error: null, count: rows.length };
        if (single === 'one') {
          if (rows.length !== 1) return { data: null, error: toError({ message: `esperava 1 linha, veio ${rows.length}` }) };
          return { data: rows[0], error: null };
        }
        if (single === 'maybe') return { data: rows[0] ?? null, error: null };
        return { data: rows, error: null };
      }

      // Escrita: reflete no estado do mock pra uma leitura seguinte ver o efeito.
      if (op === 'insert' || op === 'upsert') {
        tables[table] = [...(tables[table] ?? []), ...payload];
        return { data: payload, error: null };
      }
      if (op === 'update') {
        const hit = applyFilters(tables[table] ?? [], filters);
        tables[table] = (tables[table] ?? []).map(r => (hit.includes(r) ? { ...r, ...values } : r));
        return { data: hit.map(r => ({ ...r, ...values })), error: null };
      }
      const kept = (tables[table] ?? []).filter(r => !applyFilters([r], filters).length);
      const removedRows = (tables[table] ?? []).filter(r => applyFilters([r], filters).length > 0);
      tables[table] = kept;
      return { data: returning ? removedRows : null, error: null, count: removedRows.length };
    };

    const chain: Record<string, unknown> = {
      // Depois de delete/update, `select()` pede as linhas afetadas de volta;
      // antes de qualquer coisa, é a leitura em si.
      select: (c = '*', opts?: { count?: string; head?: boolean }) => {
        if (op === 'select') {
          columns = c;
          if (opts?.count) wantsCount = true;
          if (opts?.head) headOnly = true;
        } else {
          returning = true;
        }
        return chain;
      },
      insert: (rows: MockRow | MockRow[]) => { op = 'insert'; payload = Array.isArray(rows) ? rows : [rows]; return chain; },
      upsert: (rows: MockRow | MockRow[]) => { op = 'upsert'; payload = Array.isArray(rows) ? rows : [rows]; return chain; },
      update: (v: MockRow) => { op = 'update'; values = v; return chain; },
      delete: () => { op = 'delete'; return chain; },
      single: () => { single = 'one'; return chain; },
      maybeSingle: () => { single = 'maybe'; return chain; },
      order: () => chain,
      limit: () => chain,
      range: () => chain,
      // `then` faz o builder ser await-ável, igual ao PostgrestFilterBuilder.
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(settle()).then(resolve, reject),
    };

    for (const f of ['eq', 'neq', 'in', 'is', 'not', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'contains', 'overlaps', 'match']) {
      chain[f] = (column: string, value: unknown) => { filters.push({ op: f, column, value }); return chain; };
    }
    chain.filter = (column: string, fop: string, value: unknown) => { filters.push({ op: fop, column, value }); return chain; };

    return chain;
  }

  const client = {
    from: (table: string) => builder(table),

    rpc: (name: string, args: MockRow = {}) => {
      calls.push({ kind: 'rpc', name, args });
      const handler = config.rpc?.[name];
      const out = handler ? handler(args) : undefined;
      return Promise.resolve({ data: out?.data ?? null, error: out?.error ? toError(out.error) : null });
    },

    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => {
          calls.push({ kind: 'storage', bucket, op: 'getPublicUrl', args: [path] });
          return { data: { publicUrl: `https://mock.local/${bucket}/${path}` } };
        },
        upload: (...args: unknown[]) => {
          calls.push({ kind: 'storage', bucket, op: 'upload', args });
          return Promise.resolve({ data: { path: String(args[0]) }, error: null });
        },
        remove: (...args: unknown[]) => {
          calls.push({ kind: 'storage', bucket, op: 'remove', args });
          return Promise.resolve({ data: null, error: null });
        },
      }),
    },

    functions: {
      // Falha por `fail: { 'invoke:categorize-expense': 'boom' }` — a Edge
      // Function fora do ar é um caminho que o app trata de propósito.
      invoke: (name: string, opts?: { body?: unknown }) => {
        calls.push({ kind: 'invoke', name, body: opts?.body });
        const err = failFor(`invoke:${name}`);
        return Promise.resolve({ data: null, error: err ? toError({ message: err }) : null });
      },
    },

    auth: {
      getSession: () => Promise.resolve({ data: { session: config.session ?? null }, error: null }),
      // As Edge Functions autenticam por aqui, não por sessão: elas montam o
      // client com o Authorization de quem chamou e perguntam quem é.
      getUser: () => Promise.resolve(
        config.session
          ? { data: { user: config.session.user }, error: null }
          : { data: { user: null }, error: toError({ message: 'not authenticated' }) },
      ),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { session: config.session ?? null }, error: null }),
      updateUser: () => Promise.resolve({ data: { user: config.session?.user ?? null }, error: null }),
      startAutoRefresh: () => {},
      stopAutoRefresh: () => {},
    },
  };

  return {
    client,
    calls,
    tables,
    /** Chamadas de um tipo, na ordem. */
    of: <K extends Call['kind']>(kind: K) => calls.filter(c => c.kind === kind) as Extract<Call, { kind: K }>[],
    rpcNames: () => calls.filter(c => c.kind === 'rpc').map(c => (c as Extract<Call, { kind: 'rpc' }>).name),
    reset: () => { calls.length = 0; },
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
