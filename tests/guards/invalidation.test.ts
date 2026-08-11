import { describe, it, expect } from 'vitest';
import { readSource } from './source';

// ═══════════════════════════════════════════════════════════════════════════
// O contrato de invalidação — a 1ª das três camadas de frescura.
//
// A regra do CLAUDE.md: "invalide tudo que MOSTRA o dado que você mexeu, não só
// a tela de onde a mutação partiu". Despesa aparece na lista da resenha, no saldo,
// no histórico, na Carteira e na contagem por categoria.
//
// Estes guards não executam mutação nenhuma — travam a LISTA. Existem porque a
// lista completa é fácil de esquecer numa mutação nova, e o sintoma (número
// velho na tela de outra pessoa) não aparece em teste manual de um aparelho só.
// ═══════════════════════════════════════════════════════════════════════════

/** Bloco `{...}` que começa depois de `marker`, casando chaves. */
function blockAfter(code: string, marker: string): string {
  const at = code.indexOf(marker);
  if (at === -1) throw new Error(`marcador não encontrado no fonte: ${marker}`);
  const open = code.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return code.slice(open, i + 1);
  }
  throw new Error(`bloco não fechou: ${marker}`);
}

/**
 * Corpo do handler `nome: (...) => { ... }`.
 *
 * Ancora no `=>`, não no primeiro `{`: em `onSuccess: (_data, { groupId }) => {`
 * o primeiro `{` é o destructuring do parâmetro, e casar nele devolvia
 * `{ groupId }` — um bloco sem nenhuma invalidação, fazendo o guard passar
 * vazio. Foi exatamente o que aconteceu na primeira versão.
 */
function handlerBlock(code: string, name: string): string {
  const at = code.indexOf(name);
  if (at === -1) throw new Error(`handler não encontrado: ${name}`);
  const arrow = code.indexOf('=>', at);
  if (arrow === -1) throw new Error(`handler sem arrow: ${name}`);
  return blockAfter(code.slice(arrow), '=>');
}

/** Corpo de uma função exportada, até a próxima `export function`. */
function exportedFn(code: string, name: string): string {
  const at = code.indexOf(`export function ${name}(`);
  if (at === -1) throw new Error(`função não encontrada: ${name}`);
  const next = code.indexOf('\nexport function ', at + 1);
  return code.slice(at, next === -1 ? code.length : next);
}

const keysIn = (block: string): string[] =>
  [...new Set([...block.matchAll(/queryKeys\.([A-Za-z0-9_]+)/g)].map(m => m[1]))].sort();

const expenses = readSource('hooks/useExpenses.ts').code;
const settlements = readSource('hooks/useSettlements.ts').code;
const profile = readSource('hooks/useProfile.ts').code;

// Só o onSuccess: o onMutate também cita queryKeys (update otimista) e contá-lo
// faria um guard passar por engano, sem invalidação nenhuma de verdade.
const onSuccessOf = (code: string, marker: string) => keysIn(handlerBlock(blockAfter(code, marker), 'onSuccess'));

/** Tudo que mostra dinheiro mexido. Derivado do que as mutações de despesa —
 *  as mais completas do app — já fazem hoje. É o piso, não o teto. */
const MONEY_SET = ['expenses', 'groupBalances', 'myGroups', 'wallet', 'groupHistory'];

describe('mutação de despesa invalida tudo que mostra despesa', () => {
  const CASOS = [
    ['criar',   'setMutationDefaults(CREATE_EXPENSE_MUTATION_KEY'],
    ['editar',  'setMutationDefaults(UPDATE_EXPENSE_MUTATION_KEY'],
    ['apagar',  'setMutationDefaults(DELETE_EXPENSE_MUTATION_KEY'],
  ] as const;

  for (const [nome, marker] of CASOS) {
    it(`${nome}: invalida o conjunto de dinheiro inteiro`, () => {
      const got = onSuccessOf(expenses, marker);
      const falta = MONEY_SET.filter(k => !got.includes(k));
      expect(falta, `${nome} esqueceu: ${falta.join(', ')}. Invalida hoje: ${got.join(', ')}`).toEqual([]);
    });

    it(`${nome}: invalida a contagem por categoria e as recorrências da resenha`, () => {
      const got = onSuccessOf(expenses, marker);
      expect(got).toContain('categoryUsage');
      expect(got).toContain('groupRecurrences');
    });
  }

  it('criar e editar invalidam o DETALHE da despesa; apagar não precisa', () => {
    expect(onSuccessOf(expenses, 'setMutationDefaults(CREATE_EXPENSE_MUTATION_KEY')).toContain('expense');
    expect(onSuccessOf(expenses, 'setMutationDefaults(UPDATE_EXPENSE_MUTATION_KEY')).toContain('expense');
  });

  it('categorizar pela IA invalida lista, detalhe e contagem — mas não o saldo', () => {
    // Categoria não move dinheiro: invalidar saldo aqui seria rede à toa.
    const got = onSuccessOf(expenses, 'setMutationDefaults(DESCRIBE_EXPENSE_MUTATION_KEY');
    expect(got).toEqual(expect.arrayContaining(['expenses', 'expense', 'categoryUsage']));
    expect(got).not.toContain('groupBalances');
  });
});

describe('acerto que mexe em saldo invalida o mesmo conjunto', () => {
  for (const fn of ['useConfirmReceived', 'useRecordReceipt'] as const) {
    it(`${fn}: conjunto de dinheiro + settlements`, () => {
      const got = keysIn(handlerBlock(exportedFn(settlements, fn), 'onSuccess'));
      const falta = [...MONEY_SET, 'settlements'].filter(k => !got.includes(k));
      expect(falta, `${fn} esqueceu: ${falta.join(', ')}`).toEqual([]);
    });
  }

  it('marcar e desmarcar "Já paguei" invalidam settlements e Carteira', () => {
    // Marcação não cria pagamento, então NÃO mexe em saldo nem em histórico —
    // o evento e o push penduram na confirmação (0027, 0068).
    for (const fn of ['useMarkAsPaid', 'useUnmarkAsPaid'] as const) {
      const got = keysIn(handlerBlock(exportedFn(settlements, fn), 'onSuccess'));
      expect(got, fn).toEqual(expect.arrayContaining(['settlements', 'wallet']));
    }
  });
});

describe('mudança de perfil alcança onde nome e foto estão embutidos', () => {
  // Nome e foto são copiados em cada lista de membros e em cada despesa, então
  // trocar a foto sem os prefixos deixa a cara velha espalhada pelo app.
  for (const fn of ['useUpdateMyProfile', 'useUpdateMyAvatar'] as const) {
    it(`${fn}: perfil + prefixos de resenha e despesa`, () => {
      const got = keysIn(handlerBlock(exportedFn(profile, fn), 'onSuccess'));
      const falta = ['myProfile', 'allGroupDetails', 'allExpenseDetails'].filter(k => !got.includes(k));
      expect(falta, `${fn} esqueceu: ${falta.join(', ')}`).toEqual([]);
    });
  }
});

describe('a ferramenta destes guards', () => {
  it('blockAfter casa chaves aninhadas', () => {
    expect(blockAfter('x = { a: { b: 1 }, c: 2 }; y', 'x =')).toBe('{ a: { b: 1 }, c: 2 }');
  });

  it('blockAfter falha alto quando o marcador sai do código', () => {
    // Sem isto, renomear uma chave de mutação faria o guard virar no-op silencioso.
    expect(() => blockAfter('nada aqui', 'MARCADOR_QUE_NAO_EXISTE')).toThrow(/não encontrado/);
  });

  it('exportedFn não vaza pra a função seguinte', () => {
    const src = 'export function useA() { queryKeys.wallet }\nexport function useB() { queryKeys.myGroups }';
    expect(keysIn(exportedFn(src, 'useA'))).toEqual(['wallet']);
  });
});
