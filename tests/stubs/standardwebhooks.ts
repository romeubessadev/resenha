// `npm:standardwebhooks@1.0.0` — especificador que só o Deno resolve.
//
// A `send-auth-email` verifica a assinatura do Send Email Hook da Supabase com
// esta lib. O stub guarda o segredo recebido no construtor, porque isso É um
// caso de teste: o dashboard entrega o segredo como "v1,whsec_…" e a lib espera
// só a parte "whsec_…". Sem tirar o prefixo, `new Webhook(...)` estoura ao
// decodificar o base64 e TODA chamada real cai em "assinatura inválida".

/** Segredo com que a function construiu o Webhook na última chamada. */
export let ultimoSegredo: string | null = null;

/** Quando true, `verify` lança — simula assinatura inválida. */
let recusar = false;

/** Payload que `verify` devolve quando aceita. */
let payload: unknown = null;

export function configurarWebhook(opts: { recusar?: boolean; payload?: unknown }): void {
  recusar = opts.recusar ?? false;
  payload = opts.payload ?? null;
}

export function resetWebhook(): void {
  ultimoSegredo = null;
  recusar = false;
  payload = null;
}

export class Webhook {
  constructor(segredo: string) {
    // A lib real decodifica o segredo em base64 aqui — e é aqui que ela
    // estourava com o prefixo "v1," na frente.
    if (/^v1,/.test(segredo)) throw new Error('secret inválido: prefixo de versão não foi removido');
    ultimoSegredo = segredo;
  }

  verify(_body: string, _headers: Record<string, string>): unknown {
    if (recusar) throw new Error('assinatura inválida');
    return payload;
  }
}
