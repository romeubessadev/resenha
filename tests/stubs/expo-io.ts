// expo-file-system, expo-print e expo-sharing num stub só.
//
// `lib/insightsExport.ts` importa os três no TOPO, mas o que interessa testar
// nele é puro: a montagem do CSV e do HTML. Sem estes símbolos o módulo nem
// carrega em node, e as funções puras ficariam inalcançáveis.
//
// Nada aqui escreve em disco — `exportInsightsCsv`/`exportInsightsPdf` são IO
// e não são exercitados.

export class File {
  uri: string;
  exists = false;

  constructor(...segments: unknown[]) {
    this.uri = segments.map(String).join('/');
  }

  delete(): void {}
  write(_content: string): void {}
  copy(_dest: File): void {}
}

export const Paths = { cache: 'file:///cache' };

export async function printToFileAsync({ html }: { html: string }): Promise<{ uri: string }> {
  return { uri: `file:///print/${html.length}.pdf` };
}

export async function shareAsync(_uri: string, _opts?: unknown): Promise<void> {}
