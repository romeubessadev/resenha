# RESENHA

## Comportamento

**Cautela > velocidade.** Para tarefa trivial, use bom senso.

- **Pense antes de codar.** Diga suas suposições. Se há mais de uma interpretação,
  mostre as opções — não escolha em silêncio. Se estiver confuso, pare e pergunte.
- **Simplicidade.** Código mínimo que resolve o problema. Sem feature não pedida,
  sem abstração pra uso único, sem "flexibilidade" especulativa.
- **Cirúrgico.** Toque só no que precisa. Não "melhore" código adjacente nem
  formatação. Combine com o estilo existente. Remova só órfãos que sua mudança
  criou — nunca código morto pré-existente sem pedir.
- **Critério de sucesso.** Tarefa vaga → meta verificável. Em tarefa multi-passo,
  declare o plano e como verificar cada etapa antes de começar.
- **Reporte decisões fora do pedido.** Ao fim da tarefa, liste o que você
  decidiu, mudou ou trocou que eu não pedi, tradeoffs que precisou fazer, e
  qualquer coisa que eu deva saber. Sugira o que vale virar regra permanente,
  mas não edite o CLAUDE.md sozinho.

## Stack

- React Native + Expo (expo-router), SDK 54, TypeScript
- Supabase (banco, auth, edge functions)
- RevenueCat (assinaturas)
- AsyncStorage (persistência local)

## Decisões de arquitetura

- Backend é só Supabase, sem servidor próprio. Lógica sensível mora em Edge Functions.
  (Por quê: Supabase cobre banco + auth + funções; servidor próprio é infra à toa.)
- Fluxo Onboarding → Paywall → Auth, nessa ordem.
  (Por quê: o usuário se engaja e vê o paywall antes de criar conta — converte melhor.)
- Dados de antes do cadastro ficam no AsyncStorage e migram pro banco após o signup.
  (Por quê: deixa a pessoa usar o app sem conta e não perde o que ela fez.)
- Limite free vs premium é verificado no servidor (Edge Function), nunca no client.
  (Por quê: client é burlável; limite tem que ser imposto fora dele.)
- Chamadas a APIs externas e modelos de IA passam por Edge Functions do Supabase,
  nunca direto do client. Chave de API nunca vai no app.
  (Por quê: chave embutida no app é facilmente extraída do bundle; o servidor
  ainda controla custo e abuso.)
- "Última atividade" e qualquer medida de recência vêm de `group_events`, nunca
  de `max(created_at)` de tabela com hard delete (despesa é hard delete).
  (Por quê: a conta sobre linhas vivas ignora apagar/editar e chega a ANDAR PRA
  TRÁS — apagar a despesa mais recente derruba o max pra anterior, e a resenha que
  você acabou de mexer aparece como "há 4 dias". Já custou QUATRO migrations pra
  acertar. Some `group_events` às fontes em vez de trocá-las: resenha antiga não
  tem evento, e somando o valor nunca regride.)
- Acerto passa SEMPRE por `settlements`: `record_receipt` quando o credor registra
  o recebimento, `confirm_settlement` quando o devedor marcou e o credor confirma.
  Nunca INSERT direto em `payments`.
  (Por quê: o evento de histórico e o push pro devedor penduram no UPDATE de
  `settlements` pra 'confirmed'. Inserindo em `payments` o saldo zera em
  SILÊNCIO: o outro não é avisado, nada aparece no histórico da resenha, e a
  marcação "Já paguei" dele fica pendurada pra sempre porque nada confirma
  aquela linha. A RPC `record_receipt` existe exatamente pra isso e mesmo assim
  passou batido — são três telas com "Já recebi" e uma seguiu chamando o
  caminho antigo.)
- Não existe realtime. O frescor de dado que OUTRA pessoa mudou vem de três
  camadas, e as três são necessárias: `invalidateQueries` no `onSuccess` da mutação
  (só alcança o aparelho de quem fez), invalidação ao RECEBER push
  (`hooks/usePushToken.ts`) e `SHARED_STALE_TIME` nas queries de dado compartilhado.
  Query nova que mostra dado de resenha nasce com ele. Qual mutação invalida o quê
  mora em `lib/queryKeys.ts`.
  (Por quê: sozinha, a invalidação deixa a Carteira mentindo até a pessoa arrastar
  pra atualizar — foi o sintoma que abriu isso. O push cobre o app aberto, mas não
  existe pra despesa editada ou apagada, e some com push desligado ou no Expo Go;
  o staleTime é o que segura esses furos, não o mecanismo principal. Antes de
  trocar tudo isso por realtime, medir: é um canal POR resenha — `postgres_changes`
  filtra com um `eq` só — mais migration de publication, RLS e debounce.)

## Comandos

- Rodar: `npx expo start --tunnel`
- Limpar cache: `npx expo start --tunnel --clear`
- Instalar dependência: `npx expo install <pkg>`
- Checar tipos: `npx tsc --noEmit`
- Lint: `npx eslint .`

## Estrutura

- `app/` — telas (expo-router). `(pre-auth)/` e `(app)/`
- `components/` — componentes reutilizáveis
- `hooks/` — acesso a dados
- `lib/` — config do Supabase e RevenueCat
- `theme/` — tokens do design system (cor, tipografia, espaçamento)

## Convenções

- Estilo SEMPRE pelos tokens do design system. Não hardcode cor/tamanho na tela.
- Ícones com lucide-react-native em TODA a UI — navegação, ações, estados e
  também o rosto da despesa, que é o ícone da categoria (`lib/categories.ts`,
  renderizado por `components/CategoryIcon.tsx`). **Emoji não entra na UI.**
  (Por quê: emoji por despesa já foi tentado TRÊS vezes e saiu as três. Da
  última, por densidade visual: numa lista de vinte lançamentos, vinte glifos
  multicoloridos disputam atenção sem hierarquia. Traço monocromático vira
  textura calma e o trabalho de distinguir volta pra COR da categoria; quem
  individualiza a despesa é o título.)
- Ícone novo de categoria precisa: bater com a DESCRIÇÃO da categoria, não só
  com o nome (`bebidas` inclui suco e café, então não pode ser um chopp), e ter
  silhueta legível a 16px, que é o menor tamanho de uso.
- "resenha" é o GRUPO — o que antes se chamava "rolê". Feminino: "a resenha",
  "essa resenha", "nenhuma resenha", "resenha arquivada". Plural "resenhas".
  (Por quê: o app passou a se chamar Resenha, e a palavra virou o nome da coisa
  que a pessoa cria — churras, viagem, casa. A troca não foi substituir palavra:
  "rolê" é masculino e "resenha" é feminino, então artigo, contração, pronome e
  particípio mudaram junto em 277 lugares. Um find-and-replace teria produzido
  "o resenha", "esse resenha", "Resenha criado" — e produziu, em 10 pontos que
  só apareceram numa varredura de concordância.)
- O app NÃO se autodenomina no texto: onde antes lia-se "o Bros já sabe quem
  paga o quê", hoje é "a gente já sabe". A única exceção é a mensagem de
  CONVITE (`invite.shareMessage`), que sai pelo WhatsApp pra quem ainda não
  conhece o produto — ali o nome é informação, não marca. Mesmo critério do
  header de CSV abaixo.
  (Por quê: com o grupo chamado "resenha", dizer "a Resenha" no texto colocaria
  a mesma palavra duas vezes com sentidos diferentes na mesma frase — "monta
  sua primeira resenha pra ver como a Resenha funciona".)
- O plano pago é **"Premium"**, sem marca. Era "Bros+".
- Vocabulário de dinheiro — três sentidos, não misturar:
  - "bancar" é quem desembolsou pro ESTABELECIMENTO, e é o padrão em toda a UI
    do app: resumo, lista, detalhe, formulário, busca, histórico e a etiqueta
    `common.paidTag` ("Quem bancou", "{name} bancou · você deve {amount}").
  - "acerto/acertar" é o REGISTRO de quitação entre pessoas
    (`history.titleSettlement`, `settle.settledTab`, "Acertar contas"). O gesto
    nunca é verbo de comando: os botões relatam fato na primeira pessoa,
    "Já paguei"/"Já recebi".
  - "pagar" fica com a DIREÇÃO do dinheiro, par simétrico com "receber" (abas
    do lote, "A pagar"/"A receber"), e com todo texto que precisa casar com
    linguagem de FORA do app — e só por esses motivos:
    fala do usuário pra IA (`falar.*`, e o prompt de `parse-voice-expense`
    lista "eu paguei"/"o Léo pagou"; ensinar "banquei" degrada o
    reconhecimento), header de CSV (lido em planilha, fora do app) e
    onboarding (explica antes da pessoa ter o vocabulário).
    Já foram QUATRO exceções: a data do detalhe da despesa era "Pago em", que
    virou só "Data" e saiu da lista. Exceção que morre sai daqui — lista de
    exceção que cresce sozinha deixa de ser regra.
  - **"reembolso" e "resolvido" não entram** — seriam um quarto nome pro que já
    é "acerto". "Resolvidos" era o pill da Carteira que filtra as linhas de
    `payments` — o MESMO registro da aba `settle.settledTab`. Virou "Acertados",
    e o par de status da Carteira é pendente/acertado
    (`wallet.pending`/`wallet.settled`).
  (Por quê: "Você pagou" e "A pagar" moravam na MESMA linha de stats da resenha
  apontando pra dinheiros que não conversam — um saiu do seu bolso pro bar, o
  outro você deve pra galera. Duas fronteiras mais estreitas já foram tentadas
  e caíram: "só onde colide" e "campo vs. narração". As duas deixavam a lista
  dizendo "Bruno bancou" e o detalhe, um toque depois, "Quem pagou" — mesmo
  fato, duas palavras. Se for mexer de novo, mexa na UI TODA de uma vez, e
  encoste só no que sai do app pelos motivos funcionais acima.
  Os concorrentes resolvem o nome do registro com "reembolso"; aqui esse slot
  já é "acerto", que cabe na voz do app — "Já reembolsei" ainda quebraria o
  par com "Já recebi".)
- Sem `any`. Tipos simples e legíveis.

## Regras do projeto (IMPORTANTE)

- Sem mock data — dados reais ou estado de lista vazia.
- Quando houver mockup/imagem, replique fielmente: layout, espaçamentos, fontes,
  cores, raios e sombras. Não aproxime nem simplifique sem pedir.
- Uma fase por vez. Mostrar o plano e aguardar aprovação antes de executar.
- Não instale bibliotecas novas sem aprovação prévia.
- Antes de terminar qualquer tarefa, rode `npx tsc --noEmit` e o lint, e corrija
  o que aparecer.

## Variáveis de ambiente (.env)

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_REVENUECAT_API_KEY