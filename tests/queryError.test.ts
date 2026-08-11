import { describe, it, expect } from 'vitest';
import { queryErrorMessage } from '@/lib/queryError';

const FALLBACK = 'Não foi possível carregar';

describe('queryErrorMessage — só é erro quando NÃO HÁ dado', () => {
  it('sem erro, sem mensagem', () => {
    expect(queryErrorMessage({ error: null, data: undefined }, FALLBACK)).toBeNull();
    expect(queryErrorMessage({ error: undefined, data: [1] }, FALLBACK)).toBeNull();
  });

  it('erro sem dado nenhum vira a mensagem AMIGÁVEL, nunca a do servidor', () => {
    // O erro do Supabase é instância de Error (PostgrestError herda dela), então
    // repassar `error.message` mandava o texto cru do Postgres pra tela.
    const rls = Object.assign(new Error('new row violates row-level security policy'), {
      name: 'PostgrestError', code: '42501',
    });
    expect(queryErrorMessage({ error: rls, data: undefined }, FALLBACK)).toBe(FALLBACK);
    expect(queryErrorMessage({ error: new Error('rede caiu'), data: undefined }, FALLBACK)).toBe(FALLBACK);
  });

  it('refetch que falha COM dado em mãos não derruba a tela', () => {
    // Foi o defeito que todas as telas tinham: uma oscilação de rede de um
    // segundo apagava informação boa e mostrava "não foi possível carregar".
    expect(queryErrorMessage({ error: new Error('timeout'), data: [{ id: 1 }] }, FALLBACK)).toBeNull();
  });

  it('lista VAZIA é dado — "carregou e não tem nada" não é falha', () => {
    // Por isso a checagem é `data !== undefined`, e não `!data`.
    expect(queryErrorMessage({ error: new Error('x'), data: [] }, FALLBACK)).toBeNull();
  });

  it('null, 0 e string vazia também contam como dado carregado', () => {
    for (const data of [null, 0, '', false]) {
      expect(queryErrorMessage({ error: new Error('x'), data }, FALLBACK)).toBeNull();
    }
  });

  it('qualquer formato de erro cai no fallback', () => {
    expect(queryErrorMessage({ error: 'string solta', data: undefined }, FALLBACK)).toBe(FALLBACK);
    expect(queryErrorMessage({ error: { code: 500 }, data: undefined }, FALLBACK)).toBe(FALLBACK);
  });
});
