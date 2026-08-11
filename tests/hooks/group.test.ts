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

describe('useGroup — o detalhe do rolê', () => {
  it('monta o rolê com seus membros e diz qual sou eu', async () => {
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

    expect(result.current.error).toBe('Erro ao carregar rolê');
    expect(result.current.error).not.toContain('row-level security');
  });

  it('sem groupId não consulta o banco', async () => {
    h = createHarness({ session, tables: baseTables() });
    h.run(() => useGroup(undefined));
    await new Promise(r => setTimeout(r, 20));
    expect(h.mock.of('select').filter(c => c.table === 'groups')).toHaveLength(0);
  });
});

describe('editar o rolê', () => {
  it('manda só os campos que mudaram', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateGroup());

    await result.current.updateGroup(GROUP, { name: 'Viagem 2027' });

    expect(h.mock.of('update')[0].values).toEqual({ name: 'Viagem 2027' });
  });

  it('trocar só a FOTO não invalida a Carteira', async () => {
    // Foto não aparece lá, e o fetch da Carteira varre todos os seus rolês.
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateGroup());

    await result.current.updateGroup(GROUP, { avatarKey: 'montanha' });

    expect(h.invalidatedNames()).not.toContain('wallet');
    expect(h.invalidatedNames()).toEqual(expect.arrayContaining(['group', 'my-groups', 'group-history']));
  });

  it('trocar o NOME invalida a Carteira — cada linha mostra de que rolê é', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useUpdateGroup());

    await result.current.updateGroup(GROUP, { name: 'Outro nome' });

    expect(h.invalidatedNames()).toContain('wallet');
  });
});

describe('arquivar o rolê', () => {
  it('vai pela RPC, que é quem conhece as regras', async () => {
    h = createHarness({ session, tables: baseTables(), rpc: { set_my_group_archived: () => ({}) } });
    const { result } = await h.runReady(() => useSetGroupArchived());

    await result.current.setGroupArchived(GROUP, true);

    expect(h.mock.of('rpc')[0]).toMatchObject({ name: 'set_my_group_archived', args: { gid: GROUP, archived: true } });
  });

  it('rolê com conta em aberto não arquiva, e o erro é RECONHECÍVEL pela tela', async () => {
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
  it('remover apaga a linha do membro naquele rolê', async () => {
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
    // Rebaixar precisa garantir que não fica rolê sem admin (0091).
    h = createHarness({ session, tables: baseTables(), rpc: { demote_admin: () => ({}) } });
    const promover = await h.runReady(() => usePromoteToAdmin());
    await promover.result.current.promoteToAdmin(GROUP, BRUNO);
    expect(h.mock.of('update')[0].values).toEqual({ role: 'admin' });

    const rebaixar = await h.runReady(() => useDemoteAdmin());
    await rebaixar.result.current.demoteAdmin(GROUP, BRUNO);
    expect(h.mock.of('rpc')[0]).toMatchObject({ name: 'demote_admin', args: { gid: GROUP, target_user_id: BRUNO } });
  });
});

describe('sair do rolê', () => {
  it('com mais gente, só remove a MINHA linha — o rolê continua', async () => {
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useLeaveGroup());

    await result.current.leaveGroup(GROUP);

    expect(h.mock.of('delete').filter(c => c.table === 'groups')).toHaveLength(0);
    expect(h.mock.of('delete')[0].filters).toContainEqual({ op: 'eq', column: 'user_id', value: ANA });
  });

  it('sendo o ÚLTIMO membro, sair apaga o rolê inteiro', async () => {
    const t = baseTables();
    t.group_members = [t.group_members[0]];
    h = createHarness({ session, tables: t });
    const { result } = await h.runReady(() => useLeaveGroup());

    await result.current.leaveGroup(GROUP);

    expect(h.mock.of('delete').some(c => c.table === 'groups')).toBe(true);
  });

  it('rolê travado (sem admin) não apaga em silêncio — a saída FALHA', async () => {
    // A RLS exige is_group_admin. Sem esse check seguíamos apagando a foto de
    // um rolê que continuava de pé (0058).
    const t = baseTables();
    t.group_members = [t.group_members[0]];
    h = createHarness({ session, tables: t, fail: { 'groups:delete': 'permissão negada' } });
    const { result } = await h.runReady(() => useLeaveGroup());

    await expect(result.current.leaveGroup(GROUP)).rejects.toBeTruthy();
  });

  it('sair tira as dívidas do rolê da Carteira', async () => {
    // Sem isto elas continuavam lá, apontando pra um rolê que a pessoa não vê.
    h = createHarness({ session, tables: baseTables() });
    const { result } = await h.runReady(() => useLeaveGroup());

    await result.current.leaveGroup(GROUP);

    expect(h.invalidatedNames()).toContain('wallet');
  });
});

describe('regenerar o código de convite', () => {
  it('pede o código novo ao banco e grava no rolê', async () => {
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
});
