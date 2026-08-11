// @vitest-environment jsdom
//
// O formulário por onde TODA despesa passa. É estado puro (nenhuma ida ao
// banco), mas concentra a decisão mais delicada do app: quem entra no rateio e
// quanto cada um deve — inclusive o centavo que não divide.
//
// Vários comportamentos aqui existem porque a versão anterior era "esperta" e
// virou imprevisível. Os testes fixam a escolha por previsível.
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpenseForm } from '@/hooks/useExpenseForm';
import type { GroupMember } from '@/hooks/useGroup';

const membro = (id: string, name: string): GroupMember => ({
  id, name, role: 'member', isMe: false, photoUrl: null, whatsapp: null,
  pixKey: null, pixKeyType: null, joinedAt: '2026-01-01T00:00:00Z', archivedAt: null,
});

const ANA = 'ana', BRUNO = 'bruno', CARLA = 'carla';
const TRES = [membro(ANA, 'Ana'), membro(BRUNO, 'Bruno'), membro(CARLA, 'Carla')];
const DOIS = [membro(ANA, 'Ana'), membro(BRUNO, 'Bruno')];

const montar = (members = TRES, over: Record<string, unknown> = {}) =>
  renderHook(() => useExpenseForm({ members, meId: ANA, groupId: 'g1', seedDefaults: true, ...over }));

describe('como o formulário nasce', () => {
  it('todo mundo já entra na despesa, valendo uma parte cada', async () => {
    // Os três modos de rateio nascem significando a MESMA coisa. Antes cada um
    // partia de um lugar diferente, e trocar de modo mudava a resposta.
    const { result } = montar();
    expect(result.current.selecionados.sort()).toEqual([ANA, BRUNO, CARLA]);
    expect(result.current.partes).toEqual({ [ANA]: 1, [BRUNO]: 1, [CARLA]: 1 });
  });

  it('sem valor digitado, os campos de exato ficam VAZIOS — não "0,00"', async () => {
    // Zero parece preenchido; vazio deixa o placeholder aparecer.
    const { result } = montar();
    expect(result.current.valoresExatos).toEqual({});
  });

  it('quem paga por padrão sou eu', async () => {
    expect(montar().result.current.paidById).toBe(ANA);
  });

  it('abre na divisão padrão da resenha quando ela vem', async () => {
    const { result } = montar(TRES, { initialSplitType: 'shares' });
    expect(result.current.dividirTipo).toBe('por_valores');
    expect(result.current.splitType).toBe('shares');
  });
});

describe('o centavo que não divide', () => {
  it('R$100 entre 3 fecha exatamente 100 — a sobra vai pra quem pagou', async () => {
    // 33,33 três vezes daria 99,99 e o envio ficaria bloqueado pra sempre,
    // porque o form exige `restante` zero.
    const { result } = montar();
    await act(async () => { result.current.handleValorChange('10000'); });

    const v = result.current.valoresExatos;
    expect(v[ANA]).toBe('33,34');
    expect(v[BRUNO]).toBe('33,33');
    expect(v[CARLA]).toBe('33,33');
    expect(result.current.restante).toBe(0);
  });

  it('quando divide certinho, ninguém leva centavo a mais', async () => {
    const { result } = montar(DOIS);
    await act(async () => { result.current.handleValorChange('10000'); });

    expect(result.current.valoresExatos).toEqual({ [ANA]: '50,00', [BRUNO]: '50,00' });
  });

  it('a sobra segue quem paga, não a ordem da lista', async () => {
    const { result } = montar();
    await act(async () => { result.current.setPaidById(CARLA); });
    await act(async () => { result.current.handleValorChange('10000'); });

    expect(result.current.valoresExatos[CARLA]).toBe('33,34');
  });
});

describe('mudar o total refaz o rateio', () => {
  it('trocar o valor recomeça a divisão por cima do que estava digitado', async () => {
    // Deliberado: os valores anteriores foram escolhidos sobre um total que já
    // não vale. A versão que preservava o digitado criava um estado invisível
    // — nada na tela dizia quem estava travado.
    const { result } = montar(DOIS);
    await act(async () => { result.current.handleValorChange('10000'); });
    await act(async () => { result.current.handleValorExato(ANA, '8000'); });
    expect(result.current.valoresExatos[ANA]).toBe('80,00');

    await act(async () => { result.current.handleValorChange('6000'); });
    expect(result.current.valoresExatos).toEqual({ [ANA]: '30,00', [BRUNO]: '30,00' });
  });

  it('tirar alguém do rateio redivide entre quem sobrou', async () => {
    const { result } = montar();
    await act(async () => { result.current.handleValorChange('9000'); });
    expect(result.current.valoresExatos[ANA]).toBe('30,00');

    await act(async () => { result.current.toggleParticipant(CARLA); });
    expect(result.current.valoresExatos[ANA]).toBe('45,00');
    expect(result.current.valoresExatos[CARLA]).toBeUndefined();
  });
});

describe('digitar um valor exato à mão', () => {
  it('com DOIS na despesa, o outro vira o resto', async () => {
    // Único caso em que dá pra recalcular sem chutar.
    const { result } = montar(DOIS);
    await act(async () => { result.current.handleValorChange('10000'); });
    await act(async () => { result.current.handleValorExato(ANA, '7000'); });

    expect(result.current.valoresExatos).toEqual({ [ANA]: '70,00', [BRUNO]: '30,00' });
    expect(result.current.restante).toBe(0);
  });

  it('com TRÊS, nada se move — o rodapé assume o que falta', async () => {
    // "Qual dos outros absorve" não tem resposta, e os números pulariam
    // debaixo do dedo de quem digita.
    const { result } = montar();
    await act(async () => { result.current.handleValorChange('9000'); });
    await act(async () => { result.current.handleValorExato(ANA, '5000'); });

    expect(result.current.valoresExatos[BRUNO]).toBe('30,00');
    expect(result.current.valoresExatos[CARLA]).toBe('30,00');
    expect(result.current.restante).toBe(-20);
  });

  it('o ajuste conta PARTICIPANTES, não o tamanho da resenha', async () => {
    // Uma resenha de 3 rachando um Uber entre 2 é exatamente onde o ajuste ajuda.
    const { result } = montar();
    await act(async () => { result.current.toggleParticipant(CARLA); });
    await act(async () => { result.current.handleValorChange('10000'); });
    await act(async () => { result.current.handleValorExato(ANA, '7000'); });

    expect(result.current.valoresExatos[BRUNO]).toBe('30,00');
  });
});

describe('divisão por partes', () => {
  it('marcar alguém o coloca valendo 1 parte, nunca 0x', async () => {
    // 0x marcado mostraria a pessoa dentro da lista e fora da conta.
    const { result } = montar();
    await act(async () => { result.current.toggleParticipant(CARLA); });
    await act(async () => { result.current.toggleParticipant(CARLA); });

    expect(result.current.partes[CARLA]).toBe(1);
  });

  it('o stepper tem piso em 1 — sair da despesa é desmarcar, não zerar', async () => {
    const { result } = montar();
    await act(async () => { result.current.decrementPartes(ANA); });
    await act(async () => { result.current.decrementPartes(ANA); });

    expect(result.current.partes[ANA]).toBe(1);
  });

  it('valor por parte usa só quem está marcado', async () => {
    // Partes de gente desmarcada encolheriam o valor por parte.
    const { result } = montar();
    await act(async () => { result.current.setDividirTipo('por_valores'); });
    await act(async () => { result.current.handleValorChange('12000'); });
    await act(async () => { result.current.incrementPartes(ANA); });

    // Ana 2 partes + Bruno 1 + Carla 1 = 4 partes em R$120
    expect(result.current.totalPartes).toBe(4);
    expect(result.current.sharePerPart).toBe(30);

    await act(async () => { result.current.toggleParticipant(CARLA); });
    expect(result.current.totalPartes).toBe(3);
    expect(result.current.sharePerPart).toBe(40);
  });
});

describe('quando dá pra enviar', () => {
  it('precisa de título, valor e gente', async () => {
    const { result } = montar();
    expect(result.current.canSubmit).toBe(false);

    await act(async () => { result.current.handleValorChange('5000'); });
    expect(result.current.canSubmit).toBe(false);

    await act(async () => { result.current.setDescricao('Bar'); });
    expect(result.current.canSubmit).toBe(true);
  });

  it('título de uma letra não conta', async () => {
    const { result } = montar();
    await act(async () => { result.current.handleValorChange('5000'); });
    await act(async () => { result.current.setDescricao('a'); });
    expect(result.current.canSubmit).toBe(false);
  });

  it('no modo exato, só envia com o restante ZERADO', async () => {
    const { result } = montar();
    await act(async () => { result.current.setDescricao('Bar'); });
    await act(async () => { result.current.setDividirTipo('valores_exatos'); });
    await act(async () => { result.current.handleValorChange('9000'); });
    expect(result.current.canSubmit).toBe(true);

    await act(async () => { result.current.handleValorExato(ANA, '1000'); });
    expect(result.current.restante).not.toBe(0);
    expect(result.current.canSubmit).toBe(false);
  });

  it('sem ninguém marcado não envia', async () => {
    const { result } = montar(DOIS);
    await act(async () => { result.current.setDescricao('Bar'); });
    await act(async () => { result.current.handleValorChange('5000'); });
    await act(async () => { result.current.setSelecionados([]); });

    expect(result.current.canSubmit).toBe(false);
  });
});

describe('buildParticipants — o que vai pro banco', () => {
  it('igual: só os ids', async () => {
    const { result } = montar();
    expect(result.current.buildParticipants()).toEqual([
      { userId: ANA }, { userId: BRUNO }, { userId: CARLA },
    ]);
  });

  it('exato: quem está com zero fica de fora', async () => {
    const { result } = montar(DOIS);
    await act(async () => { result.current.setDividirTipo('valores_exatos'); });
    await act(async () => { result.current.handleValorChange('10000'); });
    await act(async () => { result.current.handleValorExato(ANA, '10000'); });

    expect(result.current.buildParticipants()).toEqual([{ userId: ANA, exactAmount: 100 }]);
  });

  it('DESMARCADO não entra, nem que tenha sobrado número no campo', async () => {
    // Caso da edição, onde o rateio vem do que foi salvo e nada recalcula.
    const { result } = montar();
    await act(async () => { result.current.setDividirTipo('valores_exatos'); });
    await act(async () => { result.current.handleValorChange('9000'); });
    await act(async () => { result.current.toggleParticipant(CARLA); });

    const saida = result.current.buildParticipants();
    expect(saida.map(p => p.userId)).not.toContain(CARLA);
  });

  it('partes: manda a contagem de cada um', async () => {
    const { result } = montar(DOIS);
    await act(async () => { result.current.setDividirTipo('por_valores'); });
    await act(async () => { result.current.incrementPartes(ANA); });

    expect(result.current.buildParticipants()).toEqual([
      { userId: ANA, shares: 2 }, { userId: BRUNO, shares: 1 },
    ]);
  });
});

describe('loadFromExpense — abrir uma despesa pra editar', () => {
  it('traz valor, título, pagador e rateio do que foi salvo', async () => {
    const { result } = montar();
    await act(async () => {
      result.current.loadFromExpense({
        id: 'e1', groupId: 'g1', title: 'Bar do Zé', description: null,
        categoryId: 'c1', amount: 120.5, splitType: 'shares', paidById: BRUNO,
        paidByName: 'Bruno', paidByPhotoUrl: null, paidByMe: false, createdByMe: true,
        date: '2026-03-10', receiptPath: null, recurrenceId: null,
        participants: [
          { userId: ANA, name: 'Ana', photoUrl: null, isMe: true, shareAmount: 40, shares: 1, exactAmount: null },
          { userId: BRUNO, name: 'Bruno', photoUrl: null, isMe: false, shareAmount: 80, shares: 2, exactAmount: null },
        ],
      });
    });

    expect(result.current.valor).toBe('120,50');
    expect(result.current.descricao).toBe('Bar do Zé');
    expect(result.current.paidById).toBe(BRUNO);
    expect(result.current.dividirTipo).toBe('por_valores');
    expect(result.current.selecionados).toEqual([ANA, BRUNO]);
    expect(result.current.partes).toEqual({ [ANA]: 1, [BRUNO]: 2 });
  });

  it('a data não anda um dia pra trás', async () => {
    // `new Date('2026-03-10')` seria meia-noite UTC — dia 9 no Brasil.
    const { result } = montar();
    await act(async () => {
      result.current.loadFromExpense({
        id: 'e1', groupId: 'g1', title: 'X', description: null, categoryId: null,
        amount: 10, splitType: 'equal', paidById: ANA, paidByName: 'Ana',
        paidByPhotoUrl: null, paidByMe: true, createdByMe: true,
        date: '2026-03-10', receiptPath: null, recurrenceId: null, participants: [],
      });
    });

    expect(result.current.date.getDate()).toBe(10);
    expect(result.current.date.getMonth()).toBe(2);
  });
});
