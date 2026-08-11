// Leitura do código-fonte pros testes de invariante (tests/guards/).
//
// Estes testes não exercitam comportamento — eles vigiam REGRAS do CLAUDE.md que
// já regrediram no passado. A ideia é que a regra pare de depender de alguém
// lembrar dela na revisão.
import fs from 'node:fs';
import path from 'node:path';

// O vitest roda a partir da raiz do projeto (vitest.config.mts vive lá).
// `__dirname` não existe em módulo ESM, então não serve aqui.
const ROOT = process.cwd();

/** Pastas de código do app. `supabase/functions` entra à parte: é servidor. */
export const SRC_DIRS = ['app', 'components', 'hooks', 'lib'] as const;

export type SourceFile = {
  /** Caminho relativo à raiz, sempre com barra pra frente. */
  rel: string;
  /** Conteúdo cru, comentários incluídos. */
  raw: string;
  /** Conteúdo com comentários trocados por espaço — mesma posição de caractere.
   *  É o que as regras devem inspecionar: comentário citando o que NÃO fazer
   *  (e o CLAUDE.md manda documentar isso) não é violação. */
  code: string;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Troca comentário por espaço, respeitando string e template literal — um
 * `'https://x'` não pode virar `'https:` e esconder o resto da linha.
 */
export function stripComments(src: string): string {
  const out = src.split('');
  let i = 0;
  const n = src.length;
  type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'template';
  let state: State = 'code';

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c === '/' && next === '*') { state = 'block'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      i++;
      continue;
    }

    if (state === 'line') {
      if (c === '\n') { state = 'code'; i++; continue; }
      out[i] = ' ';
      i++;
      continue;
    }

    if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c !== '\n') out[i] = ' ';
      i++;
      continue;
    }

    // Dentro de string: só o fim dela (ou a escapada) interessa.
    if (c === '\\') { i += 2; continue; }
    if (state === 'single' && c === "'") state = 'code';
    else if (state === 'double' && c === '"') state = 'code';
    else if (state === 'template' && c === '`') state = 'code';
    i++;
  }

  return out.join('');
}

let cache: SourceFile[] | null = null;

/** Todos os arquivos de código do app, com comentários já separados. */
export function sourceFiles(): SourceFile[] {
  if (cache) return cache;
  const files: SourceFile[] = [];
  for (const dir of SRC_DIRS) {
    for (const full of walk(path.join(ROOT, dir))) {
      const raw = fs.readFileSync(full, 'utf8');
      files.push({
        rel: path.relative(ROOT, full).replace(/\\/g, '/'),
        raw,
        code: stripComments(raw),
      });
    }
  }
  cache = files;
  return files;
}

export function readSource(rel: string): SourceFile {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return { rel, raw, code: stripComments(raw) };
}

/** Arquivo + nº da linha de cada ocorrência, pra mensagem de falha acionável. */
export function findAll(re: RegExp, files: SourceFile[] = sourceFiles()): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const lines = f.code.split('\n');
    lines.forEach((line, idx) => {
      const rx = new RegExp(re.source, re.flags.replace('g', ''));
      if (rx.test(line)) hits.push(`${f.rel}:${idx + 1}  ${line.trim().slice(0, 110)}`);
    });
  }
  return hits;
}
