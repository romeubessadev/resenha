// O CSV sai do app e é lido numa PLANILHA — é o único artefato do BROS que
// precisa agradar software de fora. Quase toda decisão aqui existe por causa
// disso (o BOM, o `;`, a vírgula decimal, o espaço comum antes do R$), e
// nenhuma delas é visível na tela pra alguém notar que quebrou.
import { describe, it, expect } from 'vitest';
import { buildFileBase, buildInsightsCsv, buildInsightsPdfHtml } from '@/lib/insightsExport';
import type { TranslationKey } from '@/lib/i18n';

const BOM = String.fromCharCode(0xfeff);

/** Devolve a própria chave — o teste afirma sobre ESTRUTURA, não sobre texto. */
const t = (key: TranslationKey) => key;

const categorias = new Map([['c1', 'Restaurante']]);

const csv = (expenses: Parameters<typeof buildInsightsCsv>[0]['expenses']) =>
  buildInsightsCsv({
    expenses,
    categoryNameById: categorias,
    fallbackCategoryLabel: 'Outros',
    language: 'pt-BR',
    t,
  });

const despesa = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  title: 'Jantar',
  date: '2026-03-10',
  categoryId: 'c1',
  amount: 120.5,
  paidByName: 'Bruno',
  participantNames: ['Ana', 'Bruno'],
  myShare: 60.25,
  ...over,
});

describe('buildFileBase — nome de arquivo', () => {
  it('tira acento, espaço e maiúscula', () => {
    expect(buildFileBase('Férias na Praia', 'Março 2026')).toBe('insights-ferias-na-praia-marco-2026');
  });

  it('nome só de símbolo não deixa traço solto nas pontas', () => {
    expect(buildFileBase('!!!', '2026')).toBe('insights--2026');
  });
});

describe('buildInsightsCsv — o arquivo que abre na planilha', () => {
  it('começa com BOM, senão o Excel come o acento', () => {
    expect(csv([despesa()]).startsWith(BOM)).toBe(true);
  });

  it('separa colunas por ponto e vírgula, não por vírgula', () => {
    // A vírgula é o separador DECIMAL em pt-BR; usá-la como separador de coluna
    // partiria todo valor em duas células.
    const linhas = csv([despesa()]).replace(BOM, '').split('\n');
    expect(linhas[0].split(';')).toHaveLength(7);
    expect(linhas[1].split(';')).toHaveLength(7);
  });

  it('valor sai com vírgula decimal e espaço COMUM antes do símbolo', () => {
    // O Intl usa espaço não-quebrável, e a planilha tropeça nele ao reconhecer
    // a célula como moeda.
    const linha = csv([despesa()]).split('\n')[1];
    expect(linha).toContain('R$ 120,50');
    expect(linha).not.toContain(String.fromCharCode(0x00a0));
  });

  it('não agrupa milhar — o resultado não pode depender do ICU do aparelho', () => {
    // Num Android sem dados de locale completos, agrupar devolveria "1,234.56",
    // que é formato errado pro Excel pt-BR e colide com o `;`.
    const linha = csv([despesa({ amount: 1234.56 })]).split('\n')[1];
    expect(linha).toContain('R$ 1234,56');
  });

  it('a data não anda pra trás em fuso negativo', () => {
    // Despesa materializada nasce à meia-noite UTC; `new Date(iso)` a jogaria
    // pro dia anterior no relógio do Brasil.
    const linha = csv([despesa({ date: '2026-03-10T00:00:00Z' })]).split('\n')[1];
    expect(linha).toContain('10/03/2026');
  });

  it('descrição com ponto e vírgula, aspas ou quebra de linha é escapada', () => {
    const linha = csv([despesa({ title: 'Bar; "do Zé"' })]).split('\n')[1];
    expect(linha).toContain('"Bar; ""do Zé"""');
  });

  it('despesa sem categoria cai no rótulo de reserva', () => {
    expect(csv([despesa({ categoryId: null })]).split('\n')[1]).toContain('Outros');
  });

  it('participante sem nome não vira vírgula solta', () => {
    // Era o sintoma de quem só dividia e nunca tinha bancado nada.
    const linha = csv([despesa({ participantNames: ['Ana', '', 'Bruno'] })]).split('\n')[1];
    expect(linha).toContain('Ana, Bruno');
    expect(linha).not.toContain(', ,');
  });

  it('sem a minha parte, a célula fica VAZIA — não "R$ 0,00"', () => {
    // Zero diria que eu devo nada dessa despesa; vazio diz que eu não entro nela.
    const cells = csv([despesa({ myShare: undefined })]).split('\n')[1].split(';');
    expect(cells[6]).toBe('');
  });

  it('lista vazia ainda produz o cabeçalho', () => {
    expect(csv([]).replace(BOM, '').split('\n')).toHaveLength(1);
  });
});

describe('buildInsightsPdfHtml', () => {
  const html = (over: Record<string, unknown> = {}) =>
    buildInsightsPdfHtml({
      groupName: 'Viagem',
      periodLabel: 'Março 2026',
      scopeLabel: 'Total do rolê',
      total: 500,
      categories: [{ key: 'c1', label: 'Restaurante', amount: 300, pct: 60 }],
      expenses: [despesa()],
      categoryNameById: categorias,
      fallbackCategoryLabel: 'Outros',
      language: 'pt-BR',
      t,
      ...over,
    });

  it('escapa HTML vindo de nome digitado pelo usuário', () => {
    // Nome de rolê e título de despesa são texto livre — sem escapar, um `<`
    // quebraria a tabela do PDF.
    const out = html({ groupName: '<script>alert(1)</script>' });
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('uma linha por despesa e uma por categoria', () => {
    const out = html();
    expect(out.match(/<tr>/g)?.length).toBe(4); // 2 cabeçalhos + 1 categoria + 1 despesa
  });

  it('usa a MESMA ordem de colunas do CSV — os dois saem do mesmo botão', () => {
    const out = html();
    const ordem = ['csvHeaderDate', 'csvHeaderDescription', 'csvHeaderCategory', 'csvHeaderPaidBy', 'csvHeaderAmount'];
    const posicoes = ordem.map(k => out.lastIndexOf(k));
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });
});
