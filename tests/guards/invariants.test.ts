import { describe, it, expect } from 'vitest';
import { sourceFiles, readSource, findAll, stripComments } from './source';

const fail = (hits: string[]) => `\n  ${hits.join('\n  ')}\n`;

describe('stripComments (a ferramenta dos guards precisa estar certa)', () => {
  it('remove comentário de linha e de bloco', () => {
    expect(stripComments('a // b').trim()).toBe('a');
    expect(stripComments('a /* b */ c').replace(/\s+/g, ' ')).toBe('a c');
  });

  it('NÃO come a barra dupla dentro de string', () => {
    expect(stripComments(`const u = 'https://x.com'`)).toContain('https://x.com');
  });

  it('preserva a contagem de linhas', () => {
    expect(stripComments('a\n// b\nc').split('\n')).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Acerto passa SEMPRE por `settlements` — migrations 0027, 0068, 0079
// ═══════════════════════════════════════════════════════════════════════════
describe('acerto nunca escreve direto em payments', () => {
  it('nenhum insert/upsert em payments no client', () => {
    const hits = sourceFiles()
      .filter(f => /from\(['"]payments['"]\)[\s\S]{0,240}?\.(insert|upsert)\(/.test(f.code))
      .map(f => f.rel);
    expect(hits, `payments só é LIDO no client; escrita é via RPC.${fail(hits)}`).toEqual([]);
  });

  it('os três caminhos de "Já recebi" usam useRecordReceipt', () => {
    for (const rel of [
      'app/(app)/grupo/saldo.tsx',
      'components/BatchSettleSheet.tsx',
      'components/SettleUpSheet.tsx',
    ]) {
      expect(readSource(rel).code, `${rel} deve chamar useRecordReceipt`).toContain('useRecordReceipt');
    }
  });

  it('as duas RPCs de acerto continuam sendo as únicas portas', () => {
    const s = readSource('hooks/useSettlements.ts').code;
    expect(s).toContain("rpc('record_receipt'");
    expect(s).toContain("rpc('confirm_settlement'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Frescura de dado compartilhado — as três camadas
// ═══════════════════════════════════════════════════════════════════════════
describe('frescura de dado compartilhado', () => {
  // Toda query que mostra dado que OUTRA pessoa da resenha pode mudar.
  // `myProfile` fica fora: só o dono altera o próprio perfil.
  const SHARED_QUERY_HOOKS = [
    'hooks/useCategories.ts',
    'hooks/useExpense.ts',
    'hooks/useExpenseRecurrenceInfo.ts',
    'hooks/useExpenses.ts',
    'hooks/useGroup.ts',
    'hooks/useGroupBalances.ts',
    'hooks/useGroupHistory.ts',
    'hooks/useGroupRecurrences.ts',
    'hooks/useGroups.ts',
    'hooks/useSettlements.ts',
    'hooks/useWallet.ts',
  ];

  // ─── RATCHET ──────────────────────────────────────────────────────────────
  // Lacunas que EXISTEM hoje e ainda não foram decididas. A lista não pode
  // CRESCER (query nova nasce com o staleTime) nem ficar desatualizada: ao
  // corrigir uma, remova daqui — o teste falha nos dois sentidos de propósito.
  //
  // Impacto de cada uma, pra priorizar:
  //   useGroupRecurrences       — série criada/pausada por outro membro.
  //   useExpenseRecurrenceInfo  — status da série no detalhe da despesa.
  //   useCategories             — só a contagem informativa do picker.
  const PENDENTE = [
    'hooks/useCategories.ts',
    'hooks/useExpenseRecurrenceInfo.ts',
    'hooks/useGroupRecurrences.ts',
  ];

  it('nenhuma query compartilhada NOVA sem SHARED_STALE_TIME', () => {
    const offenders = SHARED_QUERY_HOOKS.filter(
      rel => !readSource(rel).code.includes('staleTime: SHARED_STALE_TIME'),
    );
    const novos = offenders.filter(o => !PENDENTE.includes(o));
    expect(
      novos,
      `Query de dado compartilhado nasce com staleTime: SHARED_STALE_TIME.${fail(novos)}`,
    ).toEqual([]);
  });

  it('a lista PENDENTE está atualizada (corrigiu? remova de lá)', () => {
    const offenders = SHARED_QUERY_HOOKS.filter(
      rel => !readSource(rel).code.includes('staleTime: SHARED_STALE_TIME'),
    );
    const jaCorrigidos = PENDENTE.filter(p => !offenders.includes(p));
    expect(
      jaCorrigidos,
      `Já têm SHARED_STALE_TIME — tire de PENDENTE pra o ratchet continuar apertando.${fail(jaCorrigidos)}`,
    ).toEqual([]);
  });

  it('o push invalida tudo que o aviso pode ter mudado', () => {
    const push = readSource('hooks/usePushToken.ts').code;
    for (const key of ['wallet', 'myGroups', 'group(', 'groupBalances(', 'expenses(', 'groupHistory(', 'settlements(', 'allExpenseDetails']) {
      expect(push, `usePushToken deve invalidar queryKeys.${key}`).toContain(`queryKeys.${key}`);
    }
  });

  it('useRefreshOnFocus só refaz fetch se a query está stale', () => {
    // Sem esse guard, trocar de aba viraria rede a cada toque.
    expect(readSource('hooks/useRefreshOnFocus.ts').code).toMatch(/isStale\s*\)?\s*\)?\s*(&&|\?|\{|\)|$)/m);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Recência — migrations 0077, 0078, 0082, 0083
// ═══════════════════════════════════════════════════════════════════════════
describe('recência nunca sai só de max(created_at)', () => {
  it('a lista de resenhas usa group_last_activity (que lê group_events)', () => {
    expect(readSource('hooks/useGroups.ts').code).toContain('group_last_activity');
  });

  it('group_events é SOMADO às outras fontes, não trocado por elas', () => {
    // O reduce de máximo sobre várias datas é o que garante que o número nunca
    // REGRIDE quando a despesa mais recente é apagada.
    const g = readSource('hooks/useGroups.ts').code;
    expect(g).toMatch(/activityDates[\s\S]{0,200}reduce/);
  });

  it('nenhum lugar do client pede max(created_at) ao banco', () => {
    const hits = findAll(/max\(\s*created_at\s*\)/i);
    expect(hits, `Recência vem de group_events somado às fontes.${fail(hits)}`).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Vocabulário do dinheiro
// ═══════════════════════════════════════════════════════════════════════════
describe('vocabulário do dinheiro', () => {
  it('"reembolso" não entra — esse slot já é "acerto"', () => {
    const hits = findAll(/reembols/i);
    expect(hits, `Use "acerto/acertar".${fail(hits)}`).toEqual([]);
  });

  it('"resolvido" não é status de acerto — o par é pendente/acertado', () => {
    // Só o vocabulário de STATUS. "resolvida pela IA" é outro sentido e passa.
    const hits = findAll(/['"][^'"]*\bResolvid[oa]s?\b[^'"]*['"]/);
    expect(hits, `A Carteira usa "Acertados" (wallet.settled).${fail(hits)}`).toEqual([]);
  });

  it('os botões de acerto relatam fato na 1ª pessoa, não dão ordem', () => {
    const i18n = readSource('lib/i18n.ts').code;
    expect(i18n).toContain("'Já paguei'");
    expect(i18n).toContain("'Já recebi'");
  });

  it('a etiqueta de quem desembolsou usa "bancou"', () => {
    expect(readSource('lib/i18n.ts').code).toMatch(/bancou|Quem bancou/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Ícones e emoji — migrations 0013, 0084, 0087, 0093
// ═══════════════════════════════════════════════════════════════════════════
describe('emoji fora da UI', () => {
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;

  // Exceção explícita e documentada em código: os dois paywalls e o tour batem
  // com os mockups. i18n e countries não são UI de tela — mensagem de WhatsApp
  // sai do app, e a bandeira é derivada do ISO2.
  const PERMITIDO = [
    'app/(pre-auth)/paywall.tsx',
    'app/(pre-auth)/onboarding.tsx',
    'components/LimitPaywallSheet.tsx',
    'lib/i18n.ts',
    'lib/countries.ts',
  ];

  it('nenhum emoji na UI fora da exceção dos paywalls e do tour', () => {
    const hits = sourceFiles()
      .filter(f => !PERMITIDO.includes(f.rel) && EMOJI.test(f.code))
      .map(f => f.rel);
    expect(hits, `Ícone é lucide-react-native.${fail(hits)}`).toEqual([]);
  });

  it('categoria não tem emoji — o rosto da despesa é o ícone lucide', () => {
    expect(EMOJI.test(readSource('lib/categories.ts').code)).toBe(false);
    expect(readSource('components/CategoryIcon.tsx').code).toContain('lucide-react-native');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Convenções de código
// ═══════════════════════════════════════════════════════════════════════════
describe('convenções', () => {
  it('sem any', () => {
    const hits = findAll(/:\s*any\b|\bas\s+any\b|<any>|\bany\[\]/);
    expect(hits, `Tipos simples e legíveis, sem any.${fail(hits)}`).toEqual([]);
  });

  it('sem mock data — dados reais ou estado vazio', () => {
    const hits = findAll(/\b(mock(?!up)\w*|dummyData|loremIpsum|fakeData|FAKE_\w+)\b/i);
    expect(hits, `Sem mock: dado real ou lista vazia.${fail(hits)}`).toEqual([]);
  });

  it('estilo vem dos tokens do design system, não de hex na tela', () => {
    // Cada exceção abaixo é uma cor que NÃO é do design system:
    const PERMITIDO: Record<string, string> = {
      'components/Button.tsx':         'lateral escura do botão levantado',
      'components/QrScannerModal.tsx': 'preto do overlay da câmera',
      'components/WhatsAppIcon.tsx':   'branco padrão do ícone da marca',
      'app/(pre-auth)/avatar.tsx':     'paleta de fundo do avatar pré-auth',
      // Estes dois não pintam tela: manipulam cor como DADO.
      'lib/categoryColors.ts':         'converte o hex da categoria em rgba por luminância',
      'lib/insightsExport.ts':         'CSS do PDF — documento que sai do app, fora do tema de RN',
    };
    const hits = sourceFiles()
      .filter(f => !PERMITIDO[f.rel] && /#[0-9a-fA-F]{3,8}\b/.test(f.code))
      .map(f => f.rel);
    expect(hits, `Use os tokens de theme/.${fail(hits)}`).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Segurança — nada sensível no bundle
// ═══════════════════════════════════════════════════════════════════════════
describe('nada sensível no client', () => {
  it('sem service_role nem chave secreta no app', () => {
    const hits = findAll(/service_role|SERVICE_ROLE|\bsk-[a-zA-Z0-9]/);
    expect(hits, `Chave sensível mora em Edge Function.${fail(hits)}`).toEqual([]);
  });

  it('todo process.env lido no client é EXPO_PUBLIC_', () => {
    const hits: string[] = [];
    for (const f of sourceFiles()) {
      for (const m of f.code.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        if (!m[1].startsWith('EXPO_PUBLIC_')) hits.push(`${f.rel}  ${m[1]}`);
      }
    }
    expect(hits, `Só variável EXPO_PUBLIC_ existe no bundle.${fail(hits)}`).toEqual([]);
  });

  it('IA e API externa passam por Edge Function, nunca direto do client', () => {
    const hits = findAll(/https?:\/\/[^'"`\s]*(openai|anthropic|googleapis|api\.[a-z]+\.(com|ai))/i);
    expect(hits, `Chame via supabase.functions.invoke.${fail(hits)}`).toEqual([]);
  });

  it('o limite de plano não é decidido no client', () => {
    // O client REAGE ao erro do servidor; não é ele que calcula o limite.
    expect(readSource('hooks/useGroups.ts').code).toContain('role_limit_reached');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// "rolê" não volta
//
// O grupo se chama RESENHA. A troca mexeu em 277 lugares porque o gênero mudou
// junto (masculino → feminino), e a palavra antiga é sinônimo natural demais
// pra não ser tentadora: já foi proposta de volta uma vez, pra evitar repetir
// "resenha" em duas linhas seguidas. O jeito certo de evitar a repetição é
// reescrever a frase, não trazer um segundo nome pra mesma coisa.
//
// Comentário PODE citar — é onde a história fica registrada. Por isso a
// inspeção usa `code`, que tem os comentários trocados por espaço.
// ═══════════════════════════════════════════════════════════════════════════
describe('a palavra "rolê" não volta pro texto do app', () => {
  it('nenhum arquivo de código usa "rolê" fora de comentário', () => {
    // Só a forma ACENTUADA. Aceitar "role" sem acento pegaria `role` em
    // inglês — que é coluna do banco (owner/admin/member), tipo do TypeScript
    // e prop de acessibilidade — em 11 lugares legítimos.
    //
    // Sem `\b`: em regex de JavaScript a fronteira de palavra é definida sobre
    // ASCII, e `ê` não é caractere de palavra. `\brolês?\b` NUNCA casa — o
    // guard passava com "Qual vai ser o rolê?" no arquivo. O acento já torna a
    // sequência distintiva o bastante pra dispensar fronteira.
    // Exceções onde "rolê" nomeia a OCASIÃO, não a entidade — ambas listam
    // tipos de encontro ao lado de viagem, casa e churras. Quem escolhe "Rolê
    // com a galera" ganha uma resenha chamada "Resenha da galera": nesse
    // sentido as duas palavras convivem.
    //
    // São LINHAS, não arquivos: qualquer outro "rolê" continua quebrando.
    const ALLOWED = [
      "'onboarding.typeGalera': 'Rolê com a galera',",
      "'groups.createCtaSubtitle': 'Viagem, casa, churras ou qualquer rolê',",
    ];
    const hits = findAll(/rolê/i).filter(h => !ALLOWED.some(a => h.includes(a)));
    expect(
      hits,
      `O GRUPO é "resenha" — "rolê" só vale como rótulo de OCASIÃO.${fail(hits)}`,
    ).toEqual([]);
  });

  it('as exceções são exatamente as que a gente escolheu', () => {
    // Trava o buraco: se uma linha permitida mudar de texto ela deixa de casar
    // e o teste acima volta a acusar. E o total impede que apareça uma terceira
    // sem passar por aqui.
    const all = findAll(/rolê/i);
    expect(all).toHaveLength(2);
    expect(all.some(h => h.includes('onboarding.typeGalera'))).toBe(true);
    expect(all.some(h => h.includes('groups.createCtaSubtitle'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Fluxo Onboarding → Paywall → Auth
//
// O CLAUDE.md define essa ordem porque a pessoa se engaja e vê o paywall ANTES
// de criar conta. O link "Criar conta" do entrar.tsx ia direto pro formulário
// e furava o funil pra quem entrasse por "já tenho conta" e mudasse de ideia.
// ═══════════════════════════════════════════════════════════════════════════
describe('nada leva ao cadastro sem passar pelo tour', () => {
  it('toda navegação pro signup checa se o tour já foi visto', () => {
    // Exceção: o paywall é o PASSO SEGUINTE do funil — quem chega lá já viu o
    // tour, então mandar pro cadastro dali é o caminho correto.
    const excecoes = ['app/(pre-auth)/paywall.tsx'];

    const hits = sourceFiles()
      .filter(f => /['"]\/\(pre-auth\)\/signup['"]/.test(f.code))
      .filter(f => !excecoes.includes(f.rel))
      .filter(f => !f.code.includes('isOnboardingDone'))
      .map(f => f.rel);

    expect(
      hits,
      `Roteie com \`tourDone ? '/(pre-auth)/signup' : '/(pre-auth)/onboarding'\`.${fail(hits)}`,
    ).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Texto de erro do SERVIDOR não chega na tela
//
// `queryErrorMessage` decidia por `error instanceof Error`, na crença de que o
// Supabase devolvia objeto simples. `PostgrestError` HERDA de Error, e nenhum
// `queryFn` do app lança mensagem curada — então o fallback nunca rodava e as
// telas mostravam coisas como 'new row violates row-level security policy for
// table "groups"'. Passou despercebido porque o mock de teste devolvia objeto
// simples, e o teste concordava com a crença errada.
// ═══════════════════════════════════════════════════════════════════════════
describe('erro de query vira texto do app, nunca do Postgres', () => {
  it('queryErrorMessage não ramifica por instanceof Error', () => {
    const s = readSource('lib/queryError.ts').code;
    expect(
      /instanceof\s+Error/.test(s),
      'Erro do Supabase É instância de Error — ramificar por isso devolve o texto cru do banco.',
    ).toBe(false);
  });

  it('toda tela que mostra erro de carga passa por queryErrorMessage', () => {
    // O risco é um hook novo expor `query.error` direto e furar a regra.
    const hits = sourceFiles()
      .filter(f => f.rel.startsWith('hooks/'))
      .filter(f => /\berror:\s*query\.error\b/.test(f.code))
      .map(f => f.rel);
    expect(hits, `Use queryErrorMessage(query, t('...')).${fail(hits)}`).toEqual([]);
  });

  it('o fallback de cada hook é texto do i18n, não string solta', () => {
    // Texto do app mora em lib/i18n.ts — é lá que se revisa a voz do produto.
    const hits: string[] = [];
    for (const f of sourceFiles().filter(s => s.rel.startsWith('hooks/'))) {
      for (const m of f.code.matchAll(/queryErrorMessage\(\s*query\s*,\s*(['"`])/g)) {
        hits.push(`${f.rel}  fallback literal ${m[1]}...`);
      }
    }
    expect(hits, `Troque a string pelo t('errors.*') correspondente.${fail(hits)}`).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// "resenha" concorda no FEMININO
//
// A troca de "rolê" (masculino) por "resenha" (feminino) obrigou artigo,
// contração, pronome e particípio a mudarem junto em 277 lugares. Uma
// varredura de concordância já tinha pegado 10 sobras — e ainda escaparam
// QUATRO na UI: "Resenha não encontrado", "podem não ter sido marcados",
// "só é apagado" e "Sua resenha tá montado".
//
// Não pegam em review porque cada uma está no fim de uma frase longa, longe
// da palavra que rege. Toda string nova de resenha passa por aqui.
// ═══════════════════════════════════════════════════════════════════════════
describe('"resenha" concorda no feminino', () => {
  // Sem `\b` e sem `\w` perto de acento: em JavaScript os dois são definidos
  // sobre ASCII, então `tá` quebraria a fronteira e "resenha tá montado"
  // passaria batido — foi exatamente assim que o guard de "rolê" nasceu
  // vazio. Aqui o limite é explícito: `(?![\p{L}])` com a flag `u`.
  const DET = ['o', 'os', 'um', 'uns', 'ao', 'aos', 'do', 'dos', 'no', 'nos', 'pelo', 'pelos',
    'esse', 'este', 'aquele', 'esses', 'estes', 'seu', 'seus', 'meu', 'meus', 'nosso', 'nossos',
    'primeiro', 'novo', 'novos', 'outro', 'outros', 'todo', 'todos', 'mesmo', 'mesmos'].join('|');
  const PART = ['criado', 'apagado', 'arquivado', 'montado', 'marcado', 'salvo', 'selecionado',
    'encontrado', 'deletado', 'removido', 'atualizado', 'compartilhado', 'fechado', 'aberto',
    'pronto', 'cheio', 'vazio'].map(w => `${w}s?`).join('|');

  // O particípio pode estar até 4 palavras depois ("a resenha só é apagado").
  //
  // O ramo do DETERMINANTE exige "resenha" em MINÚSCULA, e essa é a parte
  // sutil: o GRUPO é feminino ("a resenha"), mas o APP é masculino ("o
  // Resenha", em invite.shareMessage e offline.gateBody). Sem separar os dois,
  // o guard acusava a marca como erro de concordância. A inicial maiúscula é o
  // que distingue os sentidos — por isso some a flag `i`.
  const AGREEMENT = new RegExp(
    `(?:^|[^\p{L}])(?:${DET})[ ](?:primeir[oa][ ])?resenhas?(?![\p{L}])`
    + `|[Rr]esenhas?(?![\p{L}])(?:[ ][^ ]+){0,4}[ ](?:${PART})(?![\p{L}])`,
    'gu',
  );

  it('o regex reconhece os quatro erros que passaram batido', () => {
    // Guard sem este teste é guard que pode nunca disparar.
    for (const s of [
      'Resenha não encontrado',
      'Algumas resenhas podem não ter sido marcados.',
      'A resenha só é apagado se você for o único participante.',
      'Sua resenha tá montado',
      'o primeira resenha nasce sem os padrões',
    ]) {
      expect(new RegExp(AGREEMENT).test(s), `deveria acusar: ${s}`).toBe(true);
    }
  });

  it('o regex não acusa a forma correta', () => {
    for (const s of [
      'Resenha não encontrada',
      'Algumas resenhas podem não ter sido marcadas.',
      'A resenha só é apagada se você for o único participante.',
      'Sua resenha tá montada',
      'Monte uma resenha do seu jeito',
      'Já tem 5 resenhas rolando.',
      'nenhuma resenha arquivada',
      // O APP é masculino; só o GRUPO é feminino. Estas duas são as frases
      // reais que fizeram o guard acusar a marca.
      'Entra no Resenha com o código {code}.',
      'O Resenha precisa de internet pra carregar seus dados.',
    ]) {
      expect(new RegExp(AGREEMENT).test(s), `não deveria acusar: ${s}`).toBe(false);
    }
  });

  it('nenhuma string do app erra a concordância', () => {
    const hits = findAll(AGREEMENT);
    expect(hits, `"resenha" é feminino — corrija artigo/particípio.${fail(hits)}`).toEqual([]);
  });
});
