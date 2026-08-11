import { describe, it, expect } from 'vitest';
import { groupByPerson, groupByGroup } from '@/lib/walletGrouping';
import type { WalletTx } from '@/hooks/useWallet';

let seq = 0;
const tx = (over: Partial<WalletTx> = {}): WalletTx => ({
  id: `tx${++seq}`,
  personId: 'p1',
  personName: 'Bruno',
  personWhatsapp: null,
  personPhotoUrl: null,
  personPixKey: null,
  personPixKeyType: null,
  groupId: 'g1',
  groupName: 'Praia',
  createdAt: '2026-01-01T12:00:00.000Z',
  amount: 10,
  direction: 'in',
  status: 'pending',
  settlementId: null,
  proofPath: null,
  hasNoExpenses: false,
  ...over,
});

const identity = (t: WalletTx) => t.amount;

describe('groupByPerson', () => {
  it('soma "in" positivo e "out" negativo na mesma pessoa', () => {
    const groups = groupByPerson(
      [tx({ amount: 30, direction: 'in' }), tx({ amount: 12, direction: 'out' })],
      identity,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].net).toBe(18);
    expect(groups[0].items).toHaveLength(2);
  });

  it('separa pessoas diferentes', () => {
    const groups = groupByPerson(
      [tx({ personId: 'a', personName: 'Ana' }), tx({ personId: 'b', personName: 'Bia' })],
      identity,
    );
    expect(groups.map(g => g.personId).sort()).toEqual(['a', 'b']);
  });

  it('ordena por valor ABSOLUTO — quem você deve muito pesa igual a quem te deve muito', () => {
    const groups = groupByPerson(
      [
        tx({ personId: 'pequeno', amount: 5, direction: 'in' }),
        tx({ personId: 'devendo', amount: 90, direction: 'out' }),
        tx({ personId: 'medio', amount: 40, direction: 'in' }),
      ],
      identity,
    );
    expect(groups.map(g => g.personId)).toEqual(['devendo', 'medio', 'pequeno']);
    expect(groups[0].net).toBe(-90);
  });

  it('usa a função de conversão passada, não o amount cru', () => {
    const groups = groupByPerson([tx({ amount: 10, direction: 'in' })], t => t.amount * 2);
    expect(groups[0].net).toBe(20);
    // O item guardado mantém o valor CRU, pra montar mensagem/acerto real.
    expect(groups[0].items[0].amount).toBe(10);
  });

  it('mantém o perfil da pessoa (whatsapp, foto, chave Pix) no bucket', () => {
    const groups = groupByPerson(
      [tx({ personWhatsapp: '5511987654321', personPixKey: 'bros@exemplo.com', personPixKeyType: 'email' })],
      identity,
    );
    expect(groups[0].personWhatsapp).toBe('5511987654321');
    expect(groups[0].personPixKey).toBe('bros@exemplo.com');
    expect(groups[0].personPixKeyType).toBe('email');
  });

  it('agrupa a mesma pessoa mesmo vindo de resenhas diferentes', () => {
    const groups = groupByPerson(
      [tx({ groupId: 'g1', amount: 10 }), tx({ groupId: 'g2', amount: 25 })],
      identity,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].net).toBe(35);
  });

  it('devolve vazio sem movimentação', () => {
    expect(groupByPerson([], identity)).toEqual([]);
  });

  it('mantém a pessoa na lista mesmo com saldo zerado', () => {
    const groups = groupByPerson(
      [tx({ amount: 10, direction: 'in' }), tx({ amount: 10, direction: 'out' })],
      identity,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].net).toBe(0);
  });
});

describe('groupByGroup', () => {
  it('soma por resenha com o sinal da direção', () => {
    const buckets = groupByGroup([
      tx({ groupId: 'g1', amount: 30, direction: 'in' }),
      tx({ groupId: 'g1', amount: 10, direction: 'out' }),
      tx({ groupId: 'g2', groupName: 'Rep', amount: 7, direction: 'out' }),
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets.find(b => b.groupId === 'g1')!.net).toBe(20);
    expect(buckets.find(b => b.groupId === 'g2')!.net).toBe(-7);
  });

  it('preserva o nome da resenha e os itens', () => {
    const buckets = groupByGroup([tx({ groupId: 'g9', groupName: 'Churrasco' })]);
    expect(buckets[0].groupName).toBe('Churrasco');
    expect(buckets[0].items).toHaveLength(1);
  });

  it('devolve vazio sem movimentação', () => {
    expect(groupByGroup([])).toEqual([]);
  });
});
