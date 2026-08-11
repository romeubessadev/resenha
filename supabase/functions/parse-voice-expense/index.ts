// ═══════════════════════════════════════════════════════════════════════════
// parse-voice-expense
//
// Recebe um áudio (corpo bruto da requisição) + o id do grupo (header
// x-group-id), transcreve com o gpt-4o-mini-transcribe da OpenAI e extrai
// título/valor/categoria/participantes com o GPT-4o-mini. Só pra usuários
// premium.
//
// Categoria: a IA escolhe uma das 7 fixas (ver _shared/categories.ts) — não há
// mais categoria por resenha/criada pela IA. O app ATUAL ignora esse campo: desde
// que o ditado virou duas fases (preenche o form, e a fila categoriza depois de
// salvar, igual ao lançamento digitado), quem decide é a categorize-expense. O
// campo continua na resposta porque app já publicado lê `category.id` direto —
// tirar daqui quebraria esse build com TypeError.
//
// Nunca cria a despesa — só devolve os campos extraídos; quem grava é o
// cliente, depois que o usuário revisa e confirma na tela de sempre.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { FIXED_CATEGORIES, getFixedCategory, isFixedCategoryKey } from '../_shared/categories.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-group-id',
};

type Member = { id: string; name: string };

type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

type ExtractedRecurrence = {
  freq: RecurrenceFreq;
  intervalDays: number | null;
  startDate: string | null;
  endDate: string | null;
};

type ExtractedExpense = {
  title: string;
  amount: number;
  date: string | null;
  categoryKey: string;
  paidById: string;
  participantIds: string[];
  splitType: 'equal' | 'shares' | 'exact';
  shares: Record<string, number>;
  exactAmounts: Record<string, number>;
  recurrence: ExtractedRecurrence | null;
};

// A IA não tem noção de "hoje" sozinha — calcula com base no relógio do
// servidor (UTC), mas o app é BR, então ancora em America/Sao_Paulo pra
// "ontem"/"anteontem" não escorregarem de dia perto da virada UTC.
function todayInBrazil(): { iso: string; weekday: string } {
  const now = new Date();
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const weekday = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'long',
  }).format(now);
  return { iso, weekday };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function transcribeAudio(audio: ArrayBuffer, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/m4a' }), 'audio.m4a');
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append('language', 'pt');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`transcription_failed_${res.status}`);
  const data = await res.json();
  return typeof data.text === 'string' ? data.text : '';
}

async function extractExpense(
  transcript: string,
  members: Member[],
  meUserId: string,
  apiKey: string,
): Promise<ExtractedExpense> {
  const memberLines = members
    .map(m => `- ${m.id}: ${m.name}${m.id === meUserId ? ' (você — quem está ditando)' : ''}`)
    .join('\n');
  const categoryOptions = FIXED_CATEGORIES
    .map(c => `"${c.key}" (${c.label}: ${c.examples})`)
    .join('; ');
  const today = todayInBrazil();

  const system = [
    'Você extrai os dados de UMA despesa a partir de uma frase falada em português (já transcrita), para um app de divisão de gastos em grupo.',
    'A pessoa pode falar de qualquer jeito, em qualquer ordem, sem seguir um roteiro fixo — seu trabalho é entender o sentido, não casar com um padrão de frase.',
    'Os três dados que mais importam são: o que foi comprado/gasto, quanto custou, e quem entra na divisão. A categoria você infere sozinho a partir do que foi gasto — nunca peça isso pro usuário.',
    `Hoje é ${today.weekday}, ${today.iso} (formato AAAA-MM-DD, fuso America/Sao_Paulo).`,
    '',
    'Responda SEMPRE em JSON, com exatamente estas chaves:',
    '{ "title": string, "amount": number, "date": string | null, "categoryKey": string, "paidById": string, "participantIds": string[], "splitType": "equal" | "shares" | "exact", "shares": object, "exactAmounts": object, "recurrence": object | null, "installmentCount": number | null, "installmentTotalAmount": number | null }',
    '',
    '── title ──',
    'Descrição curta do gasto (ex.: "Almoço no restaurante", "Linguiça", "Uber pro aeroporto"), nunca vazio.',
    'Remova verbos/pedidos de comando do início ou meio da fala (ex.: "lança", "lançar", "registra", "anota", ' +
      '"cria despesa de", "adiciona", "coloca aí", "bota") — eles não fazem parte da descrição do gasto.',
    'Ex.: "Lança linguiça, 100 reais" → title = "Linguiça", não "Lançar linguiça".',
    '',
    '── amount ──',
    'Valor como número puro (sem símbolo de moeda). Toda resenha é em reais, então é sempre o número em reais — ' +
      'se a pessoa mencionar outra moeda, extraia o número mesmo assim e NUNCA converta. Entenda valores por ' +
      'extenso, com decimais e gírias comuns de dinheiro:',
    '"85 reais" → 85 | "cinquenta reais" → 50 | "trinta e cinco e cinquenta" → 35.5 | "vinte pila" → 20 | ' +
      '"R$120,90" → 120.9 | "10 dólares" → 10 | "cem euros" → 100.',
    'É sempre o valor TOTAL da despesa, nunca o valor por pessoa — mesmo quando a fala menciona entre quantas ' +
      'pessoas divide. Ex.: "100 reais, dividido entre eu e o Mateus" → amount = 100 (NÃO 50).',
    'Só divida o valor falado pelo número de participantes se a pessoa disser explicitamente "cada" ou ' +
      '"por pessoa" (ex.: "50 reais cada, eu e o Mateus" → amount = 100).',
    'Se a fala não disser o valor total, mas disser quanto cada pessoa paga/deve (ex.: "eu pago 30 e o Mateus ' +
      'paga 20"), use a SOMA desses valores como o total (30 + 20 = 50).',
    'Se a fala não deixar claro nenhum valor, devolva 0.',
    '',
    '── date ──',
    '"date" é a data da despesa, no formato AAAA-MM-DD, calculada em cima do "Hoje é..." acima — pode ser ' +
      'passada, hoje, ou futura (ex.: aluguel do mês que vem, lançado adiantado).',
    'Termos relativos simples (hoje, ontem, anteontem, amanhã, "sexta passada") são resolvidos depois por ' +
      'código — não precisa acertar a conta exata desses, um valor plausível já basta. Pra data absoluta ' +
      '("dia 15", "dia 15 de março", "dia 1º de agosto"), assuma o ano e o mês atuais quando não ditos.',
    'Se a fala não mencionar nenhuma referência de data, devolva null (o app assume hoje sozinho).',
    '',
    '── categoryKey ──',
    `"categoryKey" é qual categoria melhor representa esse gasto — escolha EXATAMENTE uma destas chaves, sem inventar outra: ${categoryOptions}.`,
    // Fronteira explícita: bebida SOZINHA vs. refeição — não álcool vs. sem
    // álcool. Sem dizer isso, "jantar com vinho" cai em bebidas.
    'Bebida é "bebidas", com ou sem álcool — cerveja, vinho, drink, suco, café, refrigerante, água, conta de bar. ' +
      'Refeição é "alimentacao", mesmo que venha com bebida junto. Compra de mercado é "alimentacao", mesmo que leve bebida na lista.',
    '"contas" é a categoria de gastos fixos de moradia/serviços: aluguel, condomínio, água, luz, gás, internet, ' +
      'telefone, assinaturas fixas (streaming, academia etc.).',
    'Se nada combinar bem, use "outros".',
    '',
    '── paidById ──',
    '"paidById" é o id do membro que PAGOU a despesa (quem tirou o dinheiro do bolso/cartão) — não confunda ' +
      'com quem está ditando nem com os participantes da divisão.',
    'Se a fala disser quem pagou (ex.: "o Léo pagou", "eu paguei", "foi a Ju que pagou o jantar"), use o id ' +
      'desse membro — compare o nome de forma flexível, igual em "participantIds".',
    'Se a fala não disser quem pagou, assuma que foi quem está ditando (o "(você)" da lista abaixo).',
    '',
    '── participantIds ──',
    'Lista de ids dos membros do grupo que a fala menciona como quem participa/divide a despesa.',
    'Compare o nome falado com os nomes da lista de forma flexível — aceite primeiro nome, apelido ou nome ' +
      'parcial (ex.: "Mateus" bate com "Mateus Silva").',
    'Se a fala disser que é para todo mundo, sem citar nomes (ex.: "todos", "todo mundo", "geral", "o grupo ' +
      'inteiro", "dividido igualmente entre todos"), inclua os ids de TODOS os membros da lista abaixo.',
    'Se a fala disser "todo mundo menos o X" ou "todos exceto o X", inclua todos os ids da lista EXCETO o(s) ' +
      'que a pessoa citou pra excluir.',
    'Se a fala não mencionar nomes nem "todos"/"todo mundo", ou você não tiver certeza de ninguém, devolva ' +
      'uma lista vazia — não adivinhe.',
    '',
    '── splitType / shares / exactAmounts ──',
    '"splitType" diz COMO a despesa é dividida entre os participantes: "equal" (padrão — todo mundo paga igual), ' +
      '"shares" (divisão desigual por partes/pesos, sem valor em reais) ou "exact" (cada pessoa deve um valor em ' +
      'reais específico).',
    'Use "shares" quando a fala falar em partes/pesos SEM dizer reais — ex.: "divide em partes, 2x pra mim e 1x ' +
      'pra cada um dos outros", "eu fico com 2 partes", "o dobro pra mim", "3 partes pra mim, 1 parte pro resto".',
    '"Parcela"/"parcelar"/"parcelado"/"parcelamento" NUNCA é pista de "shares", mesmo soando parecido com ' +
      '"parte" — falar em parcelar/dividir a despesa em N (seção "installmentCount" abaixo) é sobre ESTICAR o ' +
      'pagamento ao longo de N meses, igual pra todo mundo, não sobre dar peso desigual entre as pessoas. Ex.: ' +
      '"divide entre eu e o Mateus, e parcela essa despesa em 3" → "splitType": "equal" (participantIds: eu e o ' +
      'Mateus, sem shares nenhum) + "installmentCount": 3 — são dois eixos completamente independentes ' +
      '(pessoas vs. tempo), nunca misture um com o outro.',
    'Use "exact" quando a fala disser quanto (no valor total, na mesma moeda dele) cada pessoa paga/deve — ex.: ' +
      '"eu pago 30 e o Mateus paga 20", "minha parte é 30, a dele é 20", "50 reais, sendo 30 meu e 20 dele". ' +
      'Isso é sobre quanto cada um deve do total, não sobre quem entregou o dinheiro pro vendedor.',
    'Nunca invente uma divisão desigual (partes ou valor) que a fala não disse.',
    'Quando "splitType" for "shares", preencha "shares" como um objeto { "id_do_membro": número_de_partes }, ' +
      'com uma entrada pra CADA membro do grupo listado abaixo — quem não teve peso mencionado entra com 1 ' +
      '(peso padrão/igual). Deixe "exactAmounts" vazio ({}).',
    'Quando "splitType" for "exact", preencha "exactAmounts" como um objeto { "id_do_membro": valor }, só com ' +
      'os membros que tiveram um valor mencionado (na mesma moeda de "amount") — não invente valor pra quem ' +
      'não foi citado. Deixe "shares" vazio ({}).',
    '"Mim"/"eu"/"minha parte" se refere ao membro marcado como "(você)" na lista.',
    'Quando a fala não der nenhuma pista de divisão desigual (nem partes nem valor exato), use "splitType": ' +
      '"equal" e devolva "shares": {} e "exactAmounts": {}.',
    '',
    '── recurrence ──',
    '"recurrence" indica se a despesa se repete regularmente com o MESMO valor sempre (assinatura, aluguel, ' +
      'mensalidade etc.) — só preencha quando a fala CONFIRMAR explicitamente que é recorrente/repete (ex.: ' +
      '"todo mês", "toda semana", "todo dia", "todo ano", "é uma assinatura", "vai ser recorrente", "repete", ' +
      '"a cada 15 dias"). Se não houver nenhuma confirmação de recorrência, devolva null pra "recurrence" ' +
      'inteiro (não invente). NÃO use "recurrence" pra falar de parcelamento (compra dividida em N vezes) — ' +
      'isso é "installmentCount"/"installmentTotalAmount" logo abaixo, um campo separado.',
    'Quando houver, o formato é { "freq": "daily" | "weekly" | "monthly" | "yearly" | "custom", "intervalDays": ' +
      'number | null, "startDate": string | null, "endDate": string | null, "durationValue": number | null, ' +
      '"durationUnit": "days" | "weeks" | "months" | "years" | null }.',
    '"freq": "daily" = todo dia; "weekly" = toda semana/todo [dia da semana]; "monthly" = todo mês; "yearly" = ' +
      'todo ano; "custom" = "a cada N dias" (preencha "intervalDays" com N). Pros outros valores de "freq", ' +
      'deixe "intervalDays": null.',
    'Se a pessoa confirmar que é recorrente mas NÃO disser a cadência (não falou "todo mês"/"toda semana"/' +
      'etc.), NÃO devolva "recurrence" null por causa disso — assuma "freq": "monthly", que é a cadência mais ' +
      'comum pra despesa recorrente (aluguel, mensalidade, assinatura).',
    '"startDate" é quando a recorrência COMEÇA, só quando a fala disser isso explicitamente e for DIFERENTE da ' +
      'data da própria despesa (campo "date" acima) — ex.: "começa segunda que vem", "a partir do dia 1", ' +
      '"começando dia 05 do mês que vem", "começa agora dia 01/08", "começa dia 01". Ao contrário de "date" (que ' +
      'nunca é futuro), "startDate" normalmente é hoje ou uma data FUTURA — calcule em cima do "Hoje é..." do ' +
      'topo, mesmo formato AAAA-MM-DD. Quando a fala não disser o mês e/ou o ano (ex.: "começa dia 01"), assuma ' +
      'o mês/ano atual — a menos que essa data já tenha passado no mês/ano atual, aí avance pro próximo mês (ou ' +
      'ano, se também não disse o mês) em que ela ainda esteja no futuro. Se a fala não mencionar um início ' +
      'diferente da data da própria despesa, devolva null (o app assume a própria data da despesa como início).',
    'Pra até quando a recorrência dura, a fala pode dizer de dois jeitos diferentes — trate cada um separado:',
    '1) Duração relativa ("por 6 meses", "durante 3 semanas", "por 10 dias", "por 1 ano"): NÃO calcule a data ' +
      'final você mesmo (contas de somar meses/anos são fáceis de errar). Devolva só "durationValue" (o número, ' +
      'ex.: 6) e "durationUnit" ("days" | "weeks" | "months" | "years"), e deixe "endDate": null — quem calcula ' +
      'a data final exata é o servidor, a partir do "startDate".',
    '2) Data-limite absoluta ("até dezembro", "até o dia 15/03", "até o fim do ano"): devolva direto em ' +
      '"endDate", formato AAAA-MM-DD, aplicando a mesma regra de mês/ano do "startDate" acima quando não ditos. ' +
      'Deixe "durationValue" e "durationUnit" null nesse caso.',
    'Se a fala não mencionar prazo nem duração, devolva "endDate", "durationValue" e "durationUnit" todos null ' +
      '(recorrência sem fim).',
    '',
    '── installmentCount / installmentTotalAmount ──',
    'Parcelamento é DIFERENTE de "recurrence": é uma compra ÚNICA cujo valor é dividido em N vezes ao longo dos ' +
      'meses (ex.: fatura de cartão, hospedagem parcelada) — não uma despesa que se repete indefinidamente.',
    '"installmentCount" é o número de vezes/parcelas. O sinal mais forte é o VERBO "dividir" (dividi, dividido, ' +
      'divide, vou dividir) seguido de um número — ISSO SEMPRE indica parcelamento, não importa se a palavra ' +
      'depois do número é "vezes", "parcelas" ou "meses". Ex.: "dividi em 3 meses" e "dividido em 3 vezes" são ' +
      'EXATAMENTE o mesmo caso → "installmentCount": 3. Outros jeitos comuns de falar isso, sem usar "dividir": ' +
      '"parcelado em 3x", "em 3 parcelas", "3x de 500". Se a fala não mencionar nenhum número de vezes/parcelas ' +
      'nem usar o verbo "dividir" com um número, devolva null.',
    'Não confunda com a duração de uma recorrência aberta ("assinatura por 6 meses", "durante 3 semanas" — ' +
      'seção "recurrence" acima): ali o valor se REPETE igual sem fim definido pelo próprio valor, e o gatilho é ' +
      '"por"/"durante", não "dividir". Já "dividir X em N meses/vezes" SEMPRE quer dizer que o valor falado deve ' +
      'ser fatiado em N partes — nunca trate isso como recurrence comum.',
    'Também não confunda com "dividido entre pessoas" (isso é "participantIds"/"splitType" acima) — "dividido em ' +
      '3 vezes/meses" fala de TEMPO (parcelas), "dividido entre eu e o Mateus" fala de PESSOAS. Preste atenção no ' +
      'que vem depois de "entre": nome de gente = pessoas, número = parcelas.',
    '"installmentTotalAmount" só é preenchido quando o valor falado (o mesmo de "amount") for o TOTAL a ser ' +
      'dividido pelas parcelas — ex.: "paguei 1500 no hotel, dividi em 3 meses" → "amount": 1500, ' +
      '"installmentCount": 3, "installmentTotalAmount": 1500 (o app faz a conta de dividir, você NUNCA divide ' +
      'o valor sozinho — nunca devolva "amount" já dividido nesse caso). Quando a fala já disser o valor DE CADA ' +
      'parcela (ex.: "3x de 500", "500 por mês, em 3 vezes"), "amount" já é esse valor por parcela e ' +
      '"installmentTotalAmount" fica null — nesse caso não há conta nenhuma pra fazer.',
    '',
    'Membros do grupo (id: nome):',
    memberLines,
  ].join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Frase transcrita: "${transcript}"` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`extraction_failed_${res.status}`);
  const data = await res.json();

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  } catch {
    raw = {};
  }

  const title = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim().slice(0, 80)
    : '';
  // Aceita o prefixo AAAA-MM-DD mesmo se a IA devolver algo com sobra (ex.:
  // horário junto) — antes rejeitava tudo que não fosse EXATAMENTE esse
  // formato, então qualquer variação virava null e a data caía em "hoje".
  // Datas futuras são válidas aqui (ex.: "aluguel pro dia 1º de agosto") —
  // o formulário manual também não trava nisso, então a IA não deveria.
  const modelDateMatch = typeof raw.date === 'string' ? raw.date.match(/^\d{4}-\d{2}-\d{2}/) : null;
  const modelDate = modelDateMatch ? modelDateMatch[0] : null;
  // Termos relativos comuns ("ontem", "sexta passada") têm prioridade sobre o
  // que a IA calculou — a IA erra a conta de data com frequência, o cálculo
  // determinístico não erra.
  const date = extractRelativeDate(transcript, today.iso) ?? modelDate;
  const rawCategoryKey = typeof raw.categoryKey === 'string' ? raw.categoryKey : '';
  const categoryKey = isFixedCategoryKey(rawCategoryKey) ? rawCategoryKey : 'outros';
  const validIds = new Set(members.map(m => m.id));
  const paidById = typeof raw.paidById === 'string' && validIds.has(raw.paidById) ? raw.paidById : meUserId;
  const participantIds = Array.isArray(raw.participantIds)
    ? raw.participantIds.filter((id): id is string => typeof id === 'string' && validIds.has(id))
    : [];

  const splitType: 'equal' | 'shares' | 'exact' =
    raw.splitType === 'shares' ? 'shares' : raw.splitType === 'exact' ? 'exact' : 'equal';

  const shares: Record<string, number> = {};
  if (splitType === 'shares') {
    const rawShares = raw.shares && typeof raw.shares === 'object' ? raw.shares as Record<string, unknown> : {};
    for (const m of members) {
      const v = rawShares[m.id];
      shares[m.id] = typeof v === 'number' && v > 0 ? Math.round(v) : 1;
    }
  }

  const exactAmounts: Record<string, number> = {};
  if (splitType === 'exact') {
    const rawExact = raw.exactAmounts && typeof raw.exactAmounts === 'object' ? raw.exactAmounts as Record<string, unknown> : {};
    for (const [id, v] of Object.entries(rawExact)) {
      if (validIds.has(id) && typeof v === 'number' && v > 0) {
        exactAmounts[id] = Math.round(v * 100) / 100;
      }
    }
  }

  const exactTotal = Object.values(exactAmounts).reduce((sum, v) => sum + v, 0);
  let amount = typeof raw.amount === 'number' && raw.amount > 0
    ? Math.round(raw.amount * 100) / 100
    : exactTotal > 0 ? Math.round(exactTotal * 100) / 100 : 0;

  // Parcelamento é uma compra única com valor dividido em N vezes — diferente
  // de "recurrence" (repete o MESMO valor indefinidamente). Quando presente,
  // ignora o "recurrence" que a IA possa ter devolvido em paralelo e monta um
  // do zero, sempre mensal (única frequência suportada pra parcelamento hoje)
  // com N-1 meses de duração a partir da própria despesa (a semente já conta
  // como parcela 1). A divisão do valor é feita AQUI, em código — nunca
  // confiando na IA pra aritmética, mesmo princípio já usado acima pra data.
  const installmentCount = typeof raw.installmentCount === 'number' && raw.installmentCount > 1
    ? Math.round(raw.installmentCount)
    : null;
  let recurrence = parseRecurrence(raw.recurrence, date, today.iso);
  if (installmentCount) {
    const installmentTotal = typeof raw.installmentTotalAmount === 'number' && raw.installmentTotalAmount > 0
      ? raw.installmentTotalAmount
      : null;
    if (installmentTotal) {
      amount = Math.round((installmentTotal / installmentCount) * 100) / 100;
    }
    const seed = parseIsoDateLocal(date ?? today.iso);
    recurrence = {
      freq: 'monthly',
      intervalDays: null,
      startDate: null,
      endDate: toIsoDateString(addDuration(seed, 'months', installmentCount - 1)),
    };
  }

  return { title, amount, date, categoryKey, paidById, participantIds, splitType, shares, exactAmounts, recurrence };
}

const RECURRENCE_FREQS = new Set(['daily', 'weekly', 'monthly', 'yearly', 'custom']);
const DURATION_UNITS = new Set(['days', 'weeks', 'months', 'years']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parse manual (não `new Date(iso)`) — evita o shift de fuso do parser nativo
// (um "YYYY-MM-DD" puro vira UTC meia-noite, que "escorrega" pro dia anterior
// em fusos negativos como o do Brasil).
function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Termos relativos comuns ("ontem", "sexta passada") pedem conta de data —
// a IA erra com frequência nisso (é uma extração JSON grande, com várias
// outras coisas pra prestar atenção, e subtração de dias/dia-da-semana não é
// o forte de um modelo pequeno). Calcula em código, de forma determinística,
// e essa data tem prioridade sobre a que a IA devolveu — mais confiável do
// que confiar na conta da IA pros casos mais comuns. Índice 0 = domingo,
// igual `Date.getDay()`.
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const SAME_DAY_TERMS = ['hoje'];
const YESTERDAY_TERMS = ['ontem'];
const DAY_BEFORE_YESTERDAY_TERMS = ['anteontem'];
const TOMORROW_TERMS = ['amanha'];

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Espaços nas pontas + pontuação virada espaço, pra `hasWord` só bater em
// palavra inteira (senão "segunda-feira" bateria em "segunda" só por
// conter o prefixo, o que já funcionaria, mas também evita falso positivo
// tipo um nome de pessoa/lugar que contenha a palavra colada a outra).
function normalizeForMatch(transcript: string): string {
  return ` ${stripAccents(transcript.toLowerCase()).replace(/[^a-z0-9]+/g, ' ')} `;
}

function extractRelativeDate(transcript: string, todayIso: string): string | null {
  const norm = normalizeForMatch(transcript);
  const hasWord = (word: string) => norm.includes(` ${word} `);
  const anchor = parseIsoDateLocal(todayIso);

  if (DAY_BEFORE_YESTERDAY_TERMS.some(hasWord)) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - 2);
    return toIsoDateString(d);
  }
  if (YESTERDAY_TERMS.some(hasWord)) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - 1);
    return toIsoDateString(d);
  }
  if (TOMORROW_TERMS.some(hasWord)) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + 1);
    return toIsoDateString(d);
  }

  const weekdayIdx = WEEKDAY_NAMES.findIndex(name => hasWord(name));
  if (weekdayIdx >= 0) {
    let diff = anchor.getDay() - weekdayIdx;
    if (diff <= 0) diff += 7; // nunca hoje nem futuro — sempre a ocorrência passada mais recente
    const d = new Date(anchor);
    d.setDate(d.getDate() - diff);
    return toIsoDateString(d);
  }

  if (SAME_DAY_TERMS.some(hasWord)) return todayIso;

  return null;
}

function addDuration(base: Date, unit: string, value: number): Date {
  const d = new Date(base);
  if (unit === 'days') d.setDate(d.getDate() + value);
  else if (unit === 'weeks') d.setDate(d.getDate() + value * 7);
  else if (unit === 'months') d.setMonth(d.getMonth() + value);
  else d.setFullYear(d.getFullYear() + value);
  return d;
}

// Só valida formato aqui (enum de freq, regex de data) — cruzar startDate/
// endDate com a data da despesa e recalcular o mínimo do fim é a mesma
// lógica que o RecurrenceSheet já faz manualmente; o client reconcilia.
//
// A soma de duração ("por 6 meses") é feita AQUI, em código, e não pela IA —
// pedir pro modelo somar meses a uma data que ele mesmo calculou é uma conta
// encadeada de dois passos, e ele erra (testado: "começa dia 1 do mês que
// vem" + "dura 6 meses" virou uma data qualquer, nem 6 meses do início nem
// de hoje). A IA só extrai o número e a unidade; a data final é determinística.
function parseRecurrence(raw: unknown, expenseDate: string | null, todayIso: string): ExtractedRecurrence | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.freq !== 'string' || !RECURRENCE_FREQS.has(r.freq)) return null;
  const freq = r.freq as RecurrenceFreq;

  const intervalDays = freq === 'custom' && typeof r.intervalDays === 'number' && r.intervalDays > 0
    ? Math.round(r.intervalDays)
    : null;
  if (freq === 'custom' && !intervalDays) return null;

  const startDate = typeof r.startDate === 'string' && ISO_DATE_RE.test(r.startDate) ? r.startDate : null;
  let endDate = typeof r.endDate === 'string' && ISO_DATE_RE.test(r.endDate) ? r.endDate : null;

  if (!endDate && typeof r.durationValue === 'number' && r.durationValue > 0
    && typeof r.durationUnit === 'string' && DURATION_UNITS.has(r.durationUnit)) {
    const anchor = parseIsoDateLocal(startDate ?? expenseDate ?? todayIso);
    // -1 dia: a janela é FECHADA nas duas pontas (a própria semente já é o dia
    // 1), então "por 10 dias" a partir de 31/07 termina em 09/08, não em 10/08
    // — senão a série ganha uma ocorrência a mais ("1ª de 11"). Voltar um DIA,
    // e não uma unidade, é o que acerta também quando a duração não usa a
    // mesma unidade da cadência (café todo dia "por 6 meses" tem que durar os
    // 6 meses inteiros, não 5).
    const windowEnd = addDuration(anchor, r.durationUnit, Math.round(r.durationValue));
    windowEnd.setDate(windowEnd.getDate() - 1);
    endDate = toIsoDateString(windowEnd);
  }

  return { freq, intervalDays, startDate, endDate };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const groupId = req.headers.get('x-group-id');
    if (!groupId) return json({ error: 'missing_group_id' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    const { data: profile, error: profileErr } = await userClient
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .single();
    if (profileErr || !profile?.is_premium) {
      return json({ error: 'premium_required' }, 403);
    }

    // RLS (is_group_member) garante que só volta se o usuário for do grupo.
    const { data: memberRows, error: membersErr } = await userClient
      .from('group_members')
      .select('user_id, archived_at, profiles(name)')
      .eq('group_id', groupId);
    if (membersErr || !memberRows || memberRows.length === 0) {
      return json({ error: 'group_not_found' }, 404);
    }
    // Quem arquivou a resenha (pra si) não entra na lista que a IA enxerga —
    // mesma regra do formulário manual (lancar.tsx): arquivar exige estar
    // quite, incluir a pessoa numa despesa nova a colocaria devendo de novo
    // sem ela saber.
    const members: Member[] = memberRows
      .filter(m => !m.archived_at)
      .map(m => ({
        id: m.user_id,
        name: (m.profiles as unknown as { name: string } | null)?.name ?? '',
      }));

    const audio = await req.arrayBuffer();
    if (audio.byteLength === 0) return json({ error: 'empty_audio' }, 400);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return json({ error: 'server_misconfigured' }, 500);

    const transcript = await transcribeAudio(audio, openaiKey);
    if (!transcript.trim()) return json({ error: 'empty_transcript' }, 422);

    const parsed = await extractExpense(transcript, members, userId, openaiKey);
    const category = getFixedCategory(parsed.categoryKey);

    return json({
      transcript,
      title: parsed.title,
      amount: parsed.amount,
      date: parsed.date,
      paidById: parsed.paidById,
      participantIds: parsed.participantIds,
      splitType: parsed.splitType,
      shares: parsed.shares,
      exactAmounts: parsed.exactAmounts,
      recurrence: parsed.recurrence,
      category: { id: category.key },
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'internal_error' }, 500);
  }
});
