// @vitest-environment jsdom
//
// jsdom só neste diretório: o resto da suíte roda em node, que é mais rápido.
import { describe, it, expect, afterEach } from 'vitest';
import { createHarness, waitFor, type Harness } from '../support/hookHarness';
import type { MockRow } from '../support/supabaseMock';
import {
  useGroup,
  useUpdateGroup,
  useSetGroupArchived,
  useRemoveMember,
  usePromoteToAdmin,
  useDemoteAdmin,
  useLeaveGroup,
  useRegenerateInviteCode,
  useUpdateGroupAvatar,
  ArchiveNotSettledError,
} from '@/hooks/useGroup';
import { RoleLimitError } from '@/hooks/useGroups';

const GROUP = 'g1';
const ANA = 'ana';
const BRUNO = 'bruno';
const session = { user: { id: ANA } };

const baseTables = (over: Record<string, MockRow[]> = {}): Record<string, MockRow[]> => ({
  groups: [{
    id: GROUP, name: 'Viagem', avatar_key: 'praia', avatar_path: null,
    invite_code: 'ABC123', default_split_type: 'equal', created_at: '2026-01-01T00:00:00Z',
  }],
  group_members: [
    { group_id: GROUP, user_id: ANA, role: 'owner', archived_at: null, created_at: '2026-01-01T00:00:00Z' },
    { group_id: GROUP, user_id: BRUNO, role: 'member', archived_at: null, created_at: '2026-02-01T00:00:00Z' },
  ],
  profiles: [
    { id: ANA, name: 'Ana', avatar_path: null, whatsapp: '+5511999998888', pix_key: 'ana@x.com', pix_key_type: 'email' },
    { id: BRUNO, name: 'Bruno', avatar_path: null, whatsapp: null, pix_key: 'bruno@x.com', pix_key_type: null },
  ],
  expenses: [],
  ...over,
});

let h: Harness;
afterEach(() => h?.dispose());

describe('useGroup — o detalhe da resenha', () => {
  it('monta a resenha com seus membros e diz qual sou eu', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = h.run(() => useGroup(GROUP));
    await waitFor(() => expect(result.current.data).toBeTruthy());

    expect(result.current.data).toMatchObject({ name: 'Viagem', inviteCode: 'ABC123' });
    expect(result.current.data!.members.map(m => [m.name, m.role, m.isMe])).toEqual([
      ['Ana', 'owner', true],
      ['Bruno', 'member', false],
    ]);
  });

  it('chave Pix sem TIPO não vale — o par vai junto ou não vai', async () => {
    // A coluna é texto solto; sem o tipo não dá pra saber como formatar (0104).
    h = createHarness({ session, tables: baseTables() });
    const { result } = h.run(() => useGroup(GROUP));
    await waitFor(() => expect(result.current.data).toBeTruthy());

    const [ana, bruno] = result.current.data!.members;
    expect(ana).toMatchObject({ pixKey: 'ana@x.com', pixKeyType: 'email' });
    expect(bruno).toMatchObject({ pixKey: null, pixKeyType: null });
  });

  it('`archivedAt` é o MEU arquivamento, não o de outro membro', async () => {
    const t = baseTables();
    t.group_members[1].archived_at = '2026-05-01T00:00:00Z';
    h = createHarness({ session, tables: t });
    const { result } = h.run(() => useGroup(GROUP));
    await waitFor(() => expect(result.current.data).toBeTruthy());

    expect(result.current.data!.archivedAt).toBeNull();
  });

  it('hasExpenses vem da CONTAGEM no servidor — trava a troca de moeda', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = h.run(() => useGroup(GROUP));
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data!.hasExpenses).toBe(false);

    h.dispose();
    h = createHarness({
      session,
      tables: baseTables({ expenses: [{ id: 'e1', group_id: GROUP }] }),
    });
    const segundo = h.run(() => useGroup(GROUP));
    await waitFor(() => expect(segundo.result.current.data).toBeTruthy());
    expect(segundo.result.current.data!.hasExpenses).toBe(true);
  });

  it('erro de banco vira mensagem amigável, nunca o texto do Postgres', async () => {
    h = createHarness({
      session,
      tables: baseTables(),
      fail: { 'groups:select': 'new row violates row-level security policy' },
    });
    const { result } = h.run(() => useGroup(GROUP));
    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.error).toBe('Erro ao carregar resenha');
    expect(result.current.error).not.toContain('row-level security');
  });

  it('sem groupId não consulta o banco', async () => {
    h = createHarness({ session, tables: baseTables() });
    h.run(() => useGroup(undefined));
    await new Promise(r => setTimeout(r, 20));
    expect(h.mock.of('select').filter(c => c.table === 'groups')).toHaveLength(0);
  });
});

describe('editar a resenha', () => {
  it('manda só os campos que mudaram', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateGroup());

    await result.current.updateGroup(GROUP, { name: 'Viagem 2027' });

    expect(h.mock.of('update')[0].values).toEqual({ name: 'Viagem 2027' });
  });

  it('trocar só a FOTO não invalida a Carteira', async () => {
    // Foto não aparece lá, e o fetch da Carteira varre todos os suas resenhas.
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateGroup());

    await result.current.updateGroup(GROUP, { avatarKey: 'montanha' });

    expect(h.invalidatedNames()).not.toContain('wallet');
    expect(h.invalidatedNames()).toEqual(expect.arrayContaining(['group', 'my-groups', 'group-history']));
  });

  it('trocar o NOME invalida a Carteira — cada linha mostra de que resenha é', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateGroup());

    await result.current.updateGroup(GROUP, { name: 'Outro nome' });

    expect(h.invalidatedNames()).toContain('wallet');
  });
});

describe('arquivar a resenha', () => {
  it('vai pela RPC, que é quem conhece as regras', async () => {
    h = createHarness({ session, tables: baseTables(), rpc: { set_my_group_archived: () => ({}) } });
    const { result } = await h.runReady(() => useSetGroupArchived());

    await result.current.setGroupArchived(GROUP, true);

    expect(h.mock.of('rpc')[0]).toMatchObject({ name: 'set_my_group_archived', args: { gid: GROUP, archived: true } });
  });

  it('resenha com conta em aberto não arquiva, e o erro é RECONHECÍVEL pela tela', async () => {
    // A tela precisa distinguir este caso pra explicar o que falta (0036).
    h = createHarness({
      session, tables: baseTables(),
      rpc: { set_my_group_archived: () => ({ error: { message: 'archive_requires_settled' } }) },
    });
    const { result } = await h.runReady(() => useSetGroupArchived());

    await expect(result.current.setGroupArchived(GROUP, true)).rejects.toBeInstanceOf(ArchiveNotSettledError);
  });

  it('desarquivar acima do limite do plano vira RoleLimitError', async () => {
    // Desarquivar volta a ocupar vaga — por isso o limite é checado aqui (0035).
    h = createHarness({
      session, tables: baseTables(),
      rpc: { set_my_group_archived: () => ({ error: { message: 'role_limit_reached' } }) },
    });
    const { result } = await h.runReady(() => useSetGroupArchived());

    await expect(result.current.setGroupArchived(GROUP, false)).rejects.toBeInstanceOf(RoleLimitError);
  });

  it('erro que não é regra de negócio sobe como veio', async () => {
    h = createHarness({
      session, tables: baseTables(),
      rpc: { set_my_group_archived: () => ({ error: { message: 'deu ruim' } }) },
    });
    const { result } = await h.runReady(() => useSetGroupArchived());

    const erro = await result.current.setGroupArchived(GROUP, true).catch((e: unknown) => e);
    expect(erro).not.toBeInstanceOf(ArchiveNotSettledError);
    expect(erro).not.toBeInstanceOf(RoleLimitError);
  });
});

describe('mexer nos membros', () => {
  it('remover apaga a linha do membro naquela resenha', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useRemoveMember());

    await result.current.removeMember(GROUP, BRUNO);

    expect(h.mock.of('delete')[0].filters).toEqual([
      { op: 'eq', column: 'group_id', value: GROUP },
      { op: 'eq', column: 'user_id', value: BRUNO },
    ]);
  });

  it('remoção que não apagou NENHUMA linha é falha, não sucesso', async () => {
    // A RLS pode barrar em silêncio: sem esse check, a tela dizia que removeu.
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useRemoveMember());

    await expect(result.current.removeMember(GROUP, 'fantasma'))
      .rejects.toThrow(/remove_member_no_rows_affected/);
  });

  it('remover redistribui despesa e pode pausar série — invalida saldo, carteira e recorrências', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useRemoveMember());

    await result.current.removeMember(GROUP, BRUNO);

    expect(h.invalidatedNames()).toEqual(expect.arrayContaining([
      'group', 'group-balances', 'group-history', 'group-recurrences', 'my-groups', 'wallet',
    ]));
  });

  it('promover é UPDATE direto; rebaixar passa por RPC', async () => {
    // Rebaixar precisa garantir que não fica resenha sem admin (0091).
    h = createHarness({ session, tables: baseTables(), rpc: { demote_admin: () => ({}) } });
    const promover = await h.runReady(() => usePromoteToAdmin());
    await promover.result.current.promoteToAdmin(GROUP, BRUNO);
    expect(h.mock.of('update')[0].values).toEqual({ role: 'admin' });

    const rebaixar = await h.runReady(() => useDemoteAdmin());
    await rebaixar.result.current.demoteAdmin(GROUP, BRUNO);
    expect(h.mock.of('rpc')[0]).toMatchObject({ name: 'demote_admin', args: { gid: GROUP, target_user_id: BRUNO } });
  });
});

describe('sair da resenha', () => {
  it('com mais gente, só remove a MINHA linha — a resenha continua', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useLeaveGroup());

    await result.current.leaveGroup(GROUP);

    expect(h.mock.of('delete').filter(c => c.table === 'groups')).toHaveLength(0);
    expect(h.mock.of('delete')[0].filters).toContainEqual({ op: 'eq', column: 'user_id', value: ANA });
  });

  it('sendo o ÚLTIMO membro, sair apaga a resenha inteira', async () => {
    const t = baseTables();
    t.group_members = [t.group_members[0]];
    h = createHarness({ session, tables: t });
    const { result } = await h.runReady(() => useLeaveGroup());

    await result.current.leaveGroup(GROUP);

    expect(h.mock.of('delete').some(c => c.table === 'groups')).toBe(true);
  });

  it('resenha travada (sem admin) não apaga em silêncio — a saída FALHA', async () => {
    // A RLS exige is_group_admin. Sem esse check seguíamos apagando a foto de
    // uma resenha que continuava de pé (0058).
    const t = baseTables();
    t.group_members = [t.group_members[0]];
    h = createHarness({ session, tables: t, fail: { 'groups:delete': 'permissão negada' } });
    const { result } = await h.runReady(() => useLeaveGroup());

    await expect(result.current.leaveGroup(GROUP)).rejects.toBeTruthy();
  });

  it('sair tira as dívidas da resenha da Carteira', async () => {
    // Sem isto elas continuavam lá, apontando pra uma resenha que a pessoa não vê.
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useLeaveGroup());

    await result.current.leaveGroup(GROUP);

    expect(h.invalidatedNames()).toContain('wallet');
  });
});

describe('foto da resenha', () => {
  // `uploadGroupAvatar` lê o arquivo local com `fetch(uri)` — o jsdom não
  // implementa. O stub só devolve bytes; o que se testa é a ORDEM e por onde
  // a gravação passa.
  const comArquivoLocal = () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(new Uint8Array([1, 2, 3]))) as typeof fetch;
    return () => { globalThis.fetch = original; };
  };

  it('sobe o arquivo ANTES de apontar a coluna pra ele', async () => {
    // Na ordem inversa, a linha apontaria pra um objeto que ainda não existe.
    const restaurar = comArquivoLocal();
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateGroupAvatar());

    await result.current.updateGroupAvatar(GROUP, 'file:///foto.jpg', 'image/jpeg');

    const ordem = h.mock.calls.map(c => (c.kind === 'storage' ? `storage:${c.op}` : c.kind));
    expect(ordem.indexOf('storage:upload')).toBeLessThan(ordem.indexOf('update'));
    restaurar();
  });

  it('trocar a foto apaga a ANTIGA do bucket', async () => {
    const restaurar = comArquivoLocal();
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateGroupAvatar());

    await result.current.updateGroupAvatar(GROUP, 'file:///nova.jpg', 'image/jpeg', 'g1/velha.jpg');

    const remove = h.mock.of('storage').filter(c => c.op === 'remove');
    expect(remove[0].args[0]).toEqual(['g1/velha.jpg']);
    restaurar();
  });

  it('foto escolhida NA CRIAÇÃO grava por RPC, não por UPDATE', async () => {
    // O gatilho de histórico não sabe que aquilo faz parte da criação — pelo
    // UPDATE, a resenha nasceria com "fulano editou a resenha" logo depois de
    // "fulano criou a resenha".
    const restaurar = comArquivoLocal();
    h = createHarness({ session, tables: baseTables(), rpc: { set_group_avatar_on_create: () => ({}) } });
    const { result } = await h.runReady(() => useUpdateGroupAvatar());

    await result.current.setGroupAvatarOnCreate(GROUP, 'file:///foto.jpg', 'image/jpeg');

    expect(h.mock.rpcNames()).toContain('set_group_avatar_on_create');
    expect(h.mock.of('update').filter(c => c.table === 'groups')).toHaveLength(0);
    restaurar();
  });

  it('remover zera a coluna e SÓ DEPOIS apaga o arquivo', async () => {
    // Na ordem inversa, uma falha no UPDATE deixaria a linha apontando pra um
    // arquivo que já não existe.
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateGroupAvatar());

    await result.current.removeGroupAvatar(GROUP, 'g1/velha.jpg');

    const ordem = h.mock.calls.map(c => (c.kind === 'storage' ? `storage:${c.op}` : c.kind));
    expect(ordem.indexOf('update')).toBeLessThan(ordem.indexOf('storage:remove'));
    expect(h.mock.of('update')[0].values).toEqual({ avatar_path: null });
  });

  it('a foto nova alcança a lista de resenhas e o histórico', async () => {
    const restaurar = comArquivoLocal();
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateGroupAvatar());

    await result.current.updateGroupAvatar(GROUP, 'file:///foto.jpg', 'image/jpeg');

    expect(h.invalidatedNames()).toEqual(expect.arrayContaining(['group', 'my-groups', 'group-history']));
    restaurar();
  });

  it('falha ao gravar a coluna propaga — não fica foto órfã dada como salva', async () => {
    const restaurar = comArquivoLocal();
    h = createHarness({ session, tables: baseTables(), fail: { 'groups:update': 'RLS negou' } });
    const { result } = await h.runReady(() => useUpdateGroupAvatar());

    await expect(result.current.updateGroupAvatar(GROUP, 'file:///foto.jpg', 'image/jpeg'))
      .rejects.toMatchObject({ message: 'RLS negou' });
    restaurar();
  });

  it('falha ao REMOVER propaga antes de apagar o arquivo', async () => {
    // Se o UPDATE falhou, a linha ainda aponta pro arquivo — apagá-lo deixaria
    // a resenha com foto quebrada.
    h = createHarness({ session, tables: baseTables(), fail: { 'groups:update': 'boom' } });
    const { result } = await h.runReady(() => useUpdateGroupAvatar());

    await expect(result.current.removeGroupAvatar(GROUP, 'g1/velha.jpg'))
      .rejects.toMatchObject({ message: 'boom' });
    expect(h.mock.of('storage').filter(c => c.op === 'remove')).toHaveLength(0);
  });

  it('falha da RPC na criação propaga', async () => {
    const restaurar = comArquivoLocal();
    h = createHarness({
      session, tables: baseTables(),
      rpc: { set_group_avatar_on_create: () => ({ error: { message: 'boom' } }) },
    });
    const { result } = await h.runReady(() => useUpdateGroupAvatar());

    await expect(result.current.setGroupAvatarOnCreate(GROUP, 'file:///foto.jpg', 'image/jpeg'))
      .rejects.toMatchObject({ message: 'boom' });
    restaurar();
  });
});

describe('erro do banco não passa calado', () => {
  // Foi um erro DESCARTADO que fez todo push sair sem o nome da resenha. Estes
  // testes fixam que cada caminho de escrita propaga em vez de engolir.
  const casos: [string, string, (h: Harness) => Promise<unknown>][] = [
    ['contagem de despesas', 'expenses:select', async harness => {
      const { result } = harness.run(() => useGroup(GROUP));
      await waitFor(() => expect(result.current.error).toBeTruthy());
      return result.current.error;
    }],
    ['leitura de membros', 'group_members:select', async harness => {
      const { result } = harness.run(() => useGroup(GROUP));
      await waitFor(() => expect(result.current.error).toBeTruthy());
      return result.current.error;
    }],
    ['leitura de perfis', 'profiles:select', async harness => {
      const { result } = harness.run(() => useGroup(GROUP));
      await waitFor(() => expect(result.current.error).toBeTruthy());
      return result.current.error;
    }],
  ];

  it.each(casos)('falha na %s vira erro na tela', async (_nome, chave, rodar) => {
    h = createHarness({ session, tables: baseTables(), fail: { [chave]: 'boom' } });
    expect(await rodar(h)).toBe('Erro ao carregar resenha');
  });

  it('editar a resenha propaga a falha', async () => {
    h = createHarness({ session, tables: baseTables(), fail: { 'groups:update': 'boom' } });
    const { result } = await h.runReady(() => useUpdateGroup());
    await expect(result.current.updateGroup(GROUP, { name: 'X' })).rejects.toMatchObject({ message: 'boom' });
    expect(h.invalidatedNames()).toEqual([]);
  });

  it('promover propaga a falha', async () => {
    h = createHarness({ session, tables: baseTables(), fail: { 'group_members:update': 'boom' } });
    const { result } = await h.runReady(() => usePromoteToAdmin());
    await expect(result.current.promoteToAdmin(GROUP, BRUNO)).rejects.toMatchObject({ message: 'boom' });
  });

  it('rebaixar propaga a falha da RPC', async () => {
    h = createHarness({
      session, tables: baseTables(),
      rpc: { demote_admin: () => ({ error: { message: 'boom' } }) },
    });
    const { result } = await h.runReady(() => useDemoteAdmin());
    await expect(result.current.demoteAdmin(GROUP, BRUNO)).rejects.toMatchObject({ message: 'boom' });
  });

  it('remover membro propaga a falha', async () => {
    h = createHarness({ session, tables: baseTables(), fail: { 'group_members:delete': 'boom' } });
    const { result } = await h.runReady(() => useRemoveMember());
    await expect(result.current.removeMember(GROUP, BRUNO)).rejects.toMatchObject({ message: 'boom' });
  });

  it('sair sem sessão é barrado antes de tocar no banco', async () => {
    h = createHarness({ session: null, tables: baseTables() });
    const { result } = await h.runReady(() => useLeaveGroup());
    await expect(result.current.leaveGroup(GROUP)).rejects.toThrow('Sessão inválida');
  });

  it('falha ao CONTAR membros aborta a saída', async () => {
    // Sem a contagem não dá pra saber se sair apaga a resenha ou só a sua linha.
    h = createHarness({ session, tables: baseTables(), fail: { 'group_members:select': 'boom' } });
    const { result } = await h.runReady(() => useLeaveGroup());
    await expect(result.current.leaveGroup(GROUP)).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('sair sendo o último membro', () => {
  const soEu = () => {
    const t = baseTables();
    t.group_members = [t.group_members[0]];
    return t;
  };

  it('RLS que barra em SILÊNCIO (zero linhas) vira falha explícita', async () => {
    // O delete não dá erro — simplesmente não apaga nada. Sem este check,
    // seguíamos pra apagar a foto de uma resenha que continuava de pé.
    const t = soEu();
    t.groups = [];
    h = createHarness({ session, tables: t });
    const { result } = await h.runReady(() => useLeaveGroup());

    await expect(result.current.leaveGroup(GROUP)).rejects.toThrow(/leave_group_delete_blocked/);
  });

  it('resenha com foto apaga o arquivo junto', async () => {
    const t = soEu();
    (t.groups[0] as Record<string, unknown>).avatar_path = 'g1/foto.jpg';
    h = createHarness({ session, tables: t });
    const { result } = await h.runReady(() => useLeaveGroup());

    await result.current.leaveGroup(GROUP);
    await new Promise(r => setTimeout(r, 20));

    const remove = h.mock.of('storage').filter(c => c.op === 'remove');
    expect(remove[0].args[0]).toEqual(['g1/foto.jpg']);
  });
});

describe('regenerar o código de convite', () => {
  it('pede o código novo ao banco e grava na resenha', async () => {
    // O código não é sorteado no client: a RPC garante que é único.
    h = createHarness({
      session, tables: baseTables(),
      rpc: { generate_invite_code: () => ({ data: 'XYZ789' }) },
    });
    const { result } = await h.runReady(() => useRegenerateInviteCode());

    const novo = await result.current.regenerate(GROUP);

    expect(novo).toBe('XYZ789');
    expect(h.mock.of('update')[0].values).toEqual({ invite_code: 'XYZ789' });
  });

  it('falha ao SORTEAR o código não grava nada', async () => {
    // Sem código novo em mãos, gravar deixaria o convite em branco.
    h = createHarness({
      session, tables: baseTables(),
      rpc: { generate_invite_code: () => ({ error: { message: 'boom' } }) },
    });
    const { result } = await h.runReady(() => useRegenerateInviteCode());

    await expect(result.current.regenerate(GROUP)).rejects.toMatchObject({ message: 'boom' });
    expect(h.mock.of('update')).toHaveLength(0);
  });

  it('falha ao GRAVAR o código propaga', async () => {
    h = createHarness({
      session, tables: baseTables(),
      rpc: { generate_invite_code: () => ({ data: 'XYZ789' }) },
      fail: { 'groups:update': 'boom' },
    });
    const { result } = await h.runReady(() => useRegenerateInviteCode());

    await expect(result.current.regenerate(GROUP)).rejects.toMatchObject({ message: 'boom' });
    expect(h.invalidatedNames()).toEqual([]);
  });
});
