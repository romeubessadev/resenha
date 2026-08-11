// @vitest-environment jsdom
//
// jsdom só neste diretório: o resto da suíte roda em node, que é mais rápido.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createHarness, waitFor, type Harness } from '../support/hookHarness';
import { resetStorage } from '../stubs/async-storage';
import { useMyProfile, useUpdateMyProfile, useUpdateMyAvatar } from '@/hooks/useProfile';
import { useOnboardingGroup } from '@/hooks/useOnboardingGroup';
import { saveOnboardingAnswers, getOnboardingAnswers, EMPTY_ANSWERS } from '@/lib/onboarding';

const EU = 'ana';
const session = { user: { id: EU } };

const perfil = (over: Record<string, unknown> = {}) => ({
  id: EU, name: 'Ana', whatsapp: null, avatar_path: null,
  pix_key: null, pix_key_type: null, ...over,
});

let h: Harness;
beforeEach(() => resetStorage());
afterEach(() => h?.dispose());

describe('useMyProfile', () => {
  it('carrega o perfil de quem está logado', async () => {
    h = createHarness({ session, tables: { profiles: [perfil()] } });
    const { result } = h.run(() => useMyProfile());
    await waitFor(() => expect(result.current.data).toBeTruthy());

    expect(result.current.data).toMatchObject({ id: EU, name: 'Ana' });
  });

  it('erro de banco vira mensagem amigável, nunca o texto do Postgres', async () => {
    h = createHarness({
      session,
      tables: { profiles: [perfil()] },
      fail: { 'profiles:select': 'new row violates row-level security policy' },
    });
    const { result } = h.run(() => useMyProfile());
    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.error).toBe('Erro ao carregar perfil');
    expect(result.current.error).not.toContain('row-level security');
  });

  it('sem sessão não consulta o banco', async () => {
    h = createHarness({ session: null, tables: { profiles: [perfil()] } });
    h.run(() => useMyProfile());
    await new Promise(r => setTimeout(r, 20));

    expect(h.mock.of('select').filter(c => c.table === 'profiles')).toHaveLength(0);
  });
});

describe('useUpdateMyProfile', () => {
  it('manda só o que mudou', async () => {
    h = createHarness({ session, tables: { profiles: [perfil()] } });
    const { result } = await h.runReady(() => useUpdateMyProfile());

    await result.current.updateMyProfile(EU, { name: 'Ana Maria' });

    expect(h.mock.of('update')[0].values).toEqual({ name: 'Ana Maria' });
  });

  it('chave Pix e TIPO viajam sempre juntos', async () => {
    // Espelha o profiles_pix_key_pair_check da 0104: chave sem tipo não sabe
    // se formatar, tipo sem chave não mostra nada.
    h = createHarness({ session, tables: { profiles: [perfil()] } });
    const { result } = await h.runReady(() => useUpdateMyProfile());

    await result.current.updateMyProfile(EU, { pix: { key: 'ana@x.com', type: 'email' } });

    expect(h.mock.of('update')[0].values).toEqual({ pix_key: 'ana@x.com', pix_key_type: 'email' });
  });

  it('remover o Pix zera as DUAS colunas', async () => {
    h = createHarness({ session, tables: { profiles: [perfil({ pix_key: 'x', pix_key_type: 'email' })] } });
    const { result } = await h.runReady(() => useUpdateMyProfile());

    await result.current.updateMyProfile(EU, { pix: null });

    expect(h.mock.of('update')[0].values).toEqual({ pix_key: null, pix_key_type: null });
  });

  it('o nome tem alcance de resenha e de despesa — invalida os dois', async () => {
    // O nome aparece na lista de membros de cada resenha e nos participantes de
    // cada despesa; sem isso ele só mudava no perfil até reabrir o app.
    h = createHarness({ session, tables: { profiles: [perfil()] } });
    const { result } = await h.runReady(() => useUpdateMyProfile());

    await result.current.updateMyProfile(EU, { name: 'Outro' });

    expect(h.invalidatedNames()).toEqual(
      expect.arrayContaining(['my-profile', 'my-groups', 'wallet', 'group', 'expense']),
    );
  });

  it('erro propaga e não invalida nada', async () => {
    h = createHarness({
      session, tables: { profiles: [perfil()] },
      fail: { 'profiles:update': 'RLS negou' },
    });
    const { result } = await h.runReady(() => useUpdateMyProfile());

    await expect(result.current.updateMyProfile(EU, { name: 'X' })).rejects.toMatchObject({ message: 'RLS negou' });
    expect(h.invalidatedNames()).toEqual([]);
  });
});

describe('useUpdateMyAvatar', () => {
  // `uploadProfileAvatar` lê o arquivo local com `fetch(uri)` — o jsdom não
  // implementa isso. Aqui o `fetch` só devolve bytes, pra o teste chegar no
  // que interessa: a ORDEM (subir antes de apontar) e o alcance da invalidação.
  const comArquivoLocal = () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(new Uint8Array([1, 2, 3]))) as typeof fetch;
    return () => { globalThis.fetch = original; };
  };

  it('sobe o arquivo ANTES de apontar a coluna pra ele', async () => {
    const restaurar = comArquivoLocal();
    // Na ordem inversa, a linha apontaria pra um objeto que ainda não existe.
    h = createHarness({ session, tables: { profiles: [perfil()] } });
    const { result } = await h.runReady(() => useUpdateMyAvatar());

    await result.current.updateMyAvatar(EU, 'file:///foto.jpg', 'image/jpeg');

    const ordem = h.mock.calls.map(c => (c.kind === 'storage' ? `storage:${c.op}` : `${c.kind}`));
    expect(ordem.indexOf('storage:upload')).toBeLessThan(ordem.indexOf('update'));
    restaurar();
  });

  it('a foto nova alcança toda tela que lista gente', async () => {
    const restaurar = comArquivoLocal();
    h = createHarness({ session, tables: { profiles: [perfil()] } });
    const { result } = await h.runReady(() => useUpdateMyAvatar());

    await result.current.updateMyAvatar(EU, 'file:///foto.jpg', 'image/jpeg');

    expect(h.invalidatedNames()).toEqual(
      expect.arrayContaining(['my-profile', 'my-groups', 'wallet', 'group', 'expense']),
    );
    restaurar();
  });

  it('trocar a foto apaga a ANTIGA do bucket', async () => {
    const restaurar = comArquivoLocal();
    h = createHarness({ session, tables: { profiles: [perfil({ avatar_path: 'ana/velha.jpg' })] } });
    const { result } = await h.runReady(() => useUpdateMyAvatar());

    await result.current.updateMyAvatar(EU, 'file:///foto.jpg', 'image/jpeg', 'ana/velha.jpg');

    const remove = h.mock.of('storage').filter(c => c.op === 'remove');
    expect(remove).toHaveLength(1);
    expect(remove[0].args[0]).toEqual(['ana/velha.jpg']);
    restaurar();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('useOnboardingGroup — a resenha do tour viranda resenha de verdade', () => {
  const respostas = { groupType: 'viagem' as const, split: 'equal' as const, name: 'Praia' };

  /** Espera o efeito assíncrono do hook terminar. */
  const assentar = () => new Promise(r => setTimeout(r, 30));

  it('cria a resenha com o nome e a divisão que a pessoa escolheu no tour', async () => {
    await saveOnboardingAnswers(respostas);
    h = createHarness({ session, tables: { group_members: [] }, rpc: { create_group_with_owner: () => ({}) } });
    h.run(() => useOnboardingGroup());
    await waitFor(() => expect(h.mock.rpcNames()).toContain('create_group_with_owner'));

    expect(h.mock.of('rpc')[0].args).toMatchObject({ p_name: 'Praia', p_default_split_type: 'equal' });
  });

  it('as respostas só são apagadas DEPOIS de a resenha existir', async () => {
    // Senão uma falha de rede perderia o que a pessoa configurou.
    await saveOnboardingAnswers(respostas);
    h = createHarness({ session, tables: { group_members: [] }, rpc: { create_group_with_owner: () => ({}) } });
    h.run(() => useOnboardingGroup());
    await waitFor(() => expect(h.mock.rpcNames()).toContain('create_group_with_owner'));
    await assentar();

    expect(await getOnboardingAnswers()).toEqual(EMPTY_ANSWERS);
    expect(h.invalidatedNames()).toContain('my-groups');
  });

  it('RPC que falha PRESERVA as respostas pra próxima abertura tentar', async () => {
    await saveOnboardingAnswers(respostas);
    h = createHarness({
      session, tables: { group_members: [] },
      rpc: { create_group_with_owner: () => ({ error: { message: 'caiu' } }) },
    });
    h.run(() => useOnboardingGroup());
    await waitFor(() => expect(h.mock.rpcNames()).toContain('create_group_with_owner'));
    await assentar();

    expect(await getOnboardingAnswers()).toMatchObject({ name: 'Praia' });
  });

  it('quem NÃO terminou o tour não ganha resenha', async () => {
    await saveOnboardingAnswers({ groupType: 'viagem', split: null, name: null });
    h = createHarness({ session, tables: { group_members: [] } });
    h.run(() => useOnboardingGroup());
    await assentar();

    expect(h.mock.rpcNames()).not.toContain('create_group_with_owner');
  });

  it('conta que JÁ TEM resenha não recebe a resenha do tour', async () => {
    // Quem fez o tour e no fim entrou numa conta antiga não pode achar um
    // "Resenha da praia" perdido no meio das resenhas de verdade dela.
    await saveOnboardingAnswers(respostas);
    h = createHarness({
      session,
      tables: { group_members: [{ group_id: 'g-antigo', user_id: EU }] },
    });
    h.run(() => useOnboardingGroup());
    await assentar();

    expect(h.mock.rpcNames()).not.toContain('create_group_with_owner');
    // E as respostas continuam guardadas — não foram consumidas.
    expect(await getOnboardingAnswers()).toMatchObject({ name: 'Praia' });
  });

  it('sem sessão não faz nada', async () => {
    await saveOnboardingAnswers(respostas);
    h = createHarness({ session: null, tables: { group_members: [] } });
    h.run(() => useOnboardingGroup());
    await assentar();

    expect(h.mock.calls).toHaveLength(0);
  });

  it('tenta UMA vez por montagem, mesmo com re-render', async () => {
    // Sem a trava, o re-render que o próprio insert provoca reentraria aqui
    // antes de as respostas terem sido limpas — e criaria duas resenhas.
    await saveOnboardingAnswers(respostas);
    h = createHarness({ session, tables: { group_members: [] }, rpc: { create_group_with_owner: () => ({}) } });
    const { rerender } = h.run(() => useOnboardingGroup());
    rerender();
    rerender();

    const chamadas = () => h.mock.rpcNames().filter(n => n === 'create_group_with_owner');
    // Espera a criação acontecer — `assentar()` sozinho é tempo fixo e já
    // falhou com a máquina sob carga, contando 0 em vez de 1.
    await waitFor(() => expect(chamadas()).toHaveLength(1));
    // E só então confirma que ela não se repetiu: `waitFor` para na primeira
    // vez que dá certo, então sem esta segunda espera uma chamada duplicada
    // logo depois passaria batida.
    await assentar();
    expect(chamadas()).toHaveLength(1);
  });
});
