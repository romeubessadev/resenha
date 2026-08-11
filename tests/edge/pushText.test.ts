// O texto do push, e a taxonomia de categoria que restringe a IA.
//
// Ambos são puros e vivem no Deno, duplicados de propósito: o runtime das
// functions é separado do bundle RN, então `lib/i18n.ts` e `lib/categories.ts`
// não podem ser importados de lá. Duplicata sem teste é duplicata que
// silenciosamente diverge.
import { describe, it, expect } from 'vitest';
import { buildPushText, type Language } from '@/supabase/functions/send-push/text.ts';
import {
  FIXED_CATEGORY_KEYS,
  OUTROS_CATEGORY_KEY,
  isFixedCategoryKey,
  getFixedCategory,
} from '@/supabase/functions/_shared/categories.ts';

const IDIOMAS: Language[] = ['pt-BR', 'en', 'es'];

/** Os 11 eventos combinados com o usuário. */
const KINDS = [
  'expense_you_owe', 'expense_you_receive', 'settle_paid_wait_confirm', 'proof_attached',
  'settle_confirmed', 'reminder_open_balance', 'member_joined', 'member_left',
  'admin_granted', 'admin_revoked', 'group_edited',
];

const meta = { actorName: 'Bruno', groupName: 'Viagem', payerName: 'Bruno', share: 25, amount: 50, balance: 80 };

/** Troca o espaço NÃO-QUEBRÁVEL por um comum antes de comparar.
 *
 *  O `Intl.NumberFormat` separa o símbolo com U+00A0, então "R$ 50,00" digitado
 *  à mão num teste NUNCA bate com o que a função devolve — e a mensagem de
 *  falha mostra as duas strings idênticas na tela, que é o pior jeito de
 *  descobrir isso. (É o mesmo caractere que o CSV do Insight evita de
 *  propósito, ver lib/insightsExport.ts.) */
const semNbsp = (s: string) => s.replace(/ /g, ' ');

describe('buildPushText — cobertura dos eventos', () => {
  it.each(KINDS)('%s tem texto nos três idiomas', kind => {
    for (const idioma of IDIOMAS) {
      const texto = buildPushText(kind, idioma, meta);
      expect(texto, `${kind}/${idioma}`).not.toBeNull();
      expect(texto!.title.length).toBeGreaterThan(0);
    }
  });

  it('kind desconhecido devolve null — a function decide não enviar', () => {
    // Null é o sinal combinado com index.ts; undefined passaria adiante e
    // estouraria no `.title`.
    expect(buildPushText('inventado', 'pt-BR', meta)).toBeNull();
  });

  it('nenhum texto sai com lacuna de interpolação', () => {
    for (const kind of KINDS) {
      for (const idioma of IDIOMAS) {
        const { title, body } = buildPushText(kind, idioma, meta)!;
        expect(`${title}${body}`, `${kind}/${idioma}`).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });
});

describe('buildPushText — o vocabulário de dinheiro', () => {
  it('despesa nova diz quanto EU devo e pra quem', () => {
    const texto = buildPushText('expense_you_owe', 'pt-BR', meta)!;
    expect(texto.title).toBe('Nova despesa em Viagem');
    expect(semNbsp(texto.body)).toBe('Você deve R$ 25,00 pra Bruno');
  });

  it('edição mostra o valor novo E o antigo — senão parece cobrança do nada', () => {
    const texto = buildPushText('expense_you_owe', 'pt-BR', { ...meta, isEdit: true, prevShare: 10 })!;
    expect(semNbsp(texto.body)).toContain('R$ 25,00');
    expect(semNbsp(texto.body)).toContain('R$ 10,00');
  });

  it('quem recebe vê "recebe", não "deve"', () => {
    const texto = buildPushText('expense_you_receive', 'pt-BR', meta)!;
    expect(texto.body).toContain('recebe');
    expect(texto.body).not.toContain('deve');
  });

  it('o lembrete muda de voz conforme o lado da dívida', () => {
    const credor = buildPushText('reminder_open_balance', 'pt-BR', { ...meta, role: 'creditor' })!;
    const devedor = buildPushText('reminder_open_balance', 'pt-BR', { ...meta, role: 'debtor', creditorName: 'Ana' })!;

    expect(credor.title).toContain('em aberto');
    expect(devedor.title).toContain('Você deve');
    expect(devedor.title).toContain('Ana');
  });

  it('devedor sem nome do credor não vira frase quebrada', () => {
    const texto = buildPushText('reminder_open_balance', 'pt-BR', { ...meta, role: 'debtor', creditorName: null })!;
    expect(semNbsp(texto.title)).toBe('Você deve R$ 80,00 há 7 dias');
  });

  it('valor é formatado como moeda, não número cru', () => {
    expect(semNbsp(buildPushText('settle_confirmed', 'pt-BR', meta)!.body)).toContain('R$ 50,00');
  });

  it('moeda desconhecida não derruba o push', () => {
    // O Intl lança pra código inválido; o fallback tem que segurar.
    const texto = buildPushText('settle_confirmed', 'pt-BR', { ...meta, groupCurrency: 'XX!' })!;
    expect(texto.body).toContain('50.00');
  });
});

describe('buildPushText — rolê editado', () => {
  it('nome e foto juntos viram uma frase só', () => {
    const texto = buildPushText('group_edited', 'pt-BR', { ...meta, nameChanged: true, avatarChanged: true })!;
    expect(texto.body).toBe('Nome e foto atualizados');
  });

  it('só o nome mostra o nome novo', () => {
    const texto = buildPushText('group_edited', 'pt-BR', { ...meta, nameChanged: true, newName: 'Praia' })!;
    expect(texto.body).toBe('Nome atualizado para Praia');
  });

  it('só a foto não promete nome novo', () => {
    const texto = buildPushText('group_edited', 'pt-BR', { ...meta, avatarChanged: true })!;
    expect(texto.body).toBe('Foto atualizada');
  });
});

describe('taxonomia de categoria — a coleira da IA', () => {
  it('as oito chaves fixas são reconhecidas', () => {
    for (const key of FIXED_CATEGORY_KEYS) expect(isFixedCategoryKey(key)).toBe(true);
  });

  it('chave inventada pela IA é rejeitada', () => {
    for (const lixo of ['viagem', 'ALIMENTACAO', '', null, undefined]) {
      expect(isFixedCategoryKey(lixo)).toBe(false);
    }
  });

  it('categoria não resolvida cai em "outros", nunca em undefined', () => {
    // A despesa precisa de um ícone mesmo quando a IA erra o nome.
    expect(getFixedCategory('inventada').key).toBe(OUTROS_CATEGORY_KEY);
    expect(getFixedCategory(null).key).toBe(OUTROS_CATEGORY_KEY);
  });

  it('"outros" é a ÚLTIMA da lista — é dela que o fallback depende', () => {
    expect(FIXED_CATEGORY_KEYS[FIXED_CATEGORY_KEYS.length - 1]).toBe(OUTROS_CATEGORY_KEY);
  });

  it('toda categoria tem rótulo e exemplos pro prompt', () => {
    // `examples` existe porque só o rótulo não resolve fronteira: sem ele a IA
    // mandava suco e café pra Alimentação em vez de Bebidas.
    for (const key of FIXED_CATEGORY_KEYS) {
      const cat = getFixedCategory(key);
      expect(cat.label.length, key).toBeGreaterThan(0);
      expect(cat.examples.length, key).toBeGreaterThan(0);
    }
  });
});
