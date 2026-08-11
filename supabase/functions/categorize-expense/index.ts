// ═══════════════════════════════════════════════════════════════════════════
// categorize-expense
//
// Recebe { expenseId } e decide qual das 8 categorias fixas (ver
// _shared/categories.ts) representa a despesa. A categoria alimenta a agregação
// do Insight e, na lista e no detalhe, aparece como ícone + cor.
//
// Já devolveu também um emoji por despesa (churrasco → 🥩). Saiu por densidade
// visual: vinte glifos multicoloridos numa lista viram ruído. Ver
// components/CategoryIcon.tsx.
//
// SEM gate premium, de propósito. Categoria não é dado pessoal, é COMPARTILHADO:
// numa resenha de cinco pessoas, o Insight que uma delas paga pra ver depende de
// como as outras quatro categorizaram. Deixar isso na mão de quem não vê a tela
// (e portanto não tem motivo pra caprichar) seria vender um relatório e
// terceirizar a qualidade dele. O que se cobra é ver agrupado, comparar
// períodos e exportar — gerar o dado é infraestrutura.
//
// Quem chama é a FILA de sincronização (ver hooks/useExpenses.ts), nunca a
// tela: roda DEPOIS do insert, como mutação própria enfileirada logo atrás
// dele. Sem rede, espera na fila com o resto. Nada aqui está no caminho de quem
// está lançando.
//
// É esta função que GRAVA a descrição, e não quem chama, por causa do RLS: a
// policy `expenses_update_payer_or_admin` só deixa o pagador ou o admin
// editar a despesa, e hoje qualquer membro pode lançar em nome de
// outro. Um UPDATE do client falharia calado — zero linhas — sempre que a
// despesa fosse paga por outra pessoa. Aqui a checagem é a certa: precisa ser
// MEMBRO da resenha, verificado com o token de quem chamou, e só então a service
// role escreve.
//
// Nunca cria a despesa em si.
//
// Repetir a mesma chamada é seguro: descrever de novo o mesmo título dá o mesmo
// resultado e regrava as mesmas colunas. É o que permite o retry da fila.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { FIXED_CATEGORIES, getFixedCategory, isFixedCategoryKey } from '../_shared/categories.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function categorizeExpense(title: string, apiKey: string): Promise<string> {
  const options = FIXED_CATEGORIES
    .map(c => `"${c.key}" (${c.label}: ${c.examples})`)
    .join('; ');
  const system = [
    'Você classifica uma despesa de um app de divisão de gastos em grupo a partir do título dela.',
    '',
    `Escolha EXATAMENTE uma destas chaves, sem inventar outra: ${options}.`,
    // A fronteira é bebida SOZINHA vs. refeição, não álcool vs. sem álcool.
    // Sem dizer isso, "jantar com vinho" vira bebida e a compra do mercado
    // oscila entre as duas categorias a cada lançamento.
    'Bebida é "bebidas", com ou sem álcool — cerveja, vinho, drink, suco, café, refrigerante, água, conta de bar. ' +
      'Refeição é "alimentacao", mesmo que venha com bebida junto. Compra de mercado é "alimentacao", mesmo que leve bebida na lista.',
    'Se nada combinar bem, use "outros".',
    '',
    'Responda SEMPRE em JSON, sem nenhum texto fora do JSON: { "categoryKey": string }.',
  ].join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // mini, e não gpt-4o: escolher uma de 8 chaves com os exemplos no
      // próprio prompt é classificação, não raciocínio. Custa ~16x menos e a
      // fronteira difícil (bebida sozinha vs. refeição) já está escrita
      // explicitamente abaixo, que é o que o modelo pequeno precisa.
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Título da despesa: "${title}"` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`categorize_failed_${res.status}`);
  const data = await res.json();

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  } catch {
    raw = {};
  }

  const categoryKey = typeof raw.categoryKey === 'string' ? raw.categoryKey : '';
  if (!isFixedCategoryKey(categoryKey)) throw new Error('invalid_category_key');
  return categoryKey;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    const expenseId = typeof body?.expenseId === 'string' ? body.expenseId : '';
    if (!expenseId) return json({ error: 'missing_expense_id' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Título lido do banco, e não do corpo do pedido: é a fonte da verdade, e
    // a leitura serve de checagem de acesso ao mesmo tempo. A policy
    // `expenses_select_member` só devolve linha pra quem é membro do
    // resenha — despesa inexistente e despesa de resenha alheio caem os dois aqui,
    // sem precisar de consulta separada a group_members.
    //
    // Sem checagem de is_premium (ver cabeçalho): categoria é dado
    // compartilhado da resenha, não um recurso individual.
    const { data: expense, error: expenseErr } = await userClient
      .from('expenses')
      .select('id, title, category_id, recurrence_id')
      .eq('id', expenseId)
      .maybeSingle();
    if (expenseErr) return json({ error: 'unauthorized' }, 401);
    if (!expense) return json({ error: 'expense_not_found' }, 404);

    const title = (expense.title ?? '').trim();
    if (!title) return json({ error: 'missing_title' }, 400);

    // Falha da IA vira 502, e não mais "outros": quem chama é a
    // fila, então erro aqui é uma nova tentativa daqui a pouco — o modelo fora
    // do ar por um minuto deixou de custar uma categoria errada gravada pra
    // sempre. Esgotado o retry, a despesa fica com category_id nulo, que é a
    // verdade ("nunca foi descrita") e não uma categoria inventada.
    let categoryKey: string;
    try {
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiKey) throw new Error('server_misconfigured');
      categoryKey = await categorizeExpense(title, openaiKey);
    } catch (err) {
      console.error('categorize failed:', err);
      return json({ error: 'categorize_failed' }, 502);
    }

    // Sempre grava o que a IA decidiu, sem preservar o que já estava lá. Quem
    // chama só enfileira esta função quando quer a IA decidindo: na criação a
    // categoria está SEMPRE nula (nenhuma despesa nasce categorizada, nem a
    // ditada por voz), e na edição só quando o título mudou E ninguém mexeu no
    // seletor. Proteger escolha manual é trabalho de quem enfileira, não daqui.
    const categoryId = getFixedCategory(categoryKey).key;

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: writeErr } = await adminClient
      .from('expenses')
      .update({ category_id: categoryId })
      .eq('id', expenseId);
    // Erro de escrita SOBE como 500: quem chama é a fila, e é o 500 que faz a
    // tentativa se repetir. Devolver 200 aqui deixaria a despesa cinza pra
    // sempre, que é exatamente o buraco que este desenho fecha.
    if (writeErr) {
      console.error('categorize write failed:', writeErr);
      return json({ error: 'write_failed' }, 500);
    }

    // A receita da recorrência carrega a mesma categoria: sem isso, cada
    // ocorrência que o cron criasse depois nasceria sem categoria de novo.
    if (expense.recurrence_id) {
      const { error: recErr } = await adminClient
        .from('expense_recurrences')
        .update({ category_id: categoryId })
        .eq('id', expense.recurrence_id);
      if (recErr) {
        console.error('categorize recurrence write failed:', recErr);
        return json({ error: 'write_failed' }, 500);
      }
    }

    return json({ category: { id: categoryId } });
  } catch (err) {
    console.error(err);
    return json({ error: 'internal_error' }, 500);
  }
});
