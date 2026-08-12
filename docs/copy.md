# Copy do Resenha

Todas as **866 strings** de `lib/i18n.ts`, na ordem em que a pessoa
encontra as telas — porque incoerência de vocabulário aparece entre telas
vizinhas, não dentro de uma.

> **Gerado automaticamente.** Não edite este arquivo pra mudar a copy — ele é
> um espelho. Anote aqui o que quer mudar e a alteração acontece em
> `lib/i18n.ts`, que é a fonte.

Convenções nas células:

| Marca | Significa |
| --- | --- |
| `{valor}` | Interpolação — o app substitui em tempo de execução. |
| `[palavra]` | Sai destacada em amarelo na tela. |
| `<br>` | Quebra de linha forçada no texto. |
| _(gasto)_ | Usa "gasto"; a UI usa "despesa" na maioria dos pontos. |
| _(nome do app)_ | O app se autodenomina — o CLAUDE.md pede "a gente". |
| _(formal)_ | Imperativo formal; o app usa "Toca", "Digita", "Chama". |

## Índice

- [Abertura e tour](#abertura-e-tour) — 76 strings
- [Premium](#premium) — 54 strings
- [Cadastro e acesso](#cadastro-e-acesso) — 68 strings
- [Resenhas](#resenhas) — 178 strings
- [Despesas](#despesas) — 150 strings
- [Acertos e carteira](#acertos-e-carteira) — 135 strings
- [Histórico e insights](#historico-e-insights) — 93 strings
- [Conta e ajustes](#conta-e-ajustes) — 58 strings
- [Sistema](#sistema) — 54 strings

---

## Abertura e tour

A intro e os seis passos do onboarding. — **76 strings**

### `login` · 4

| Chave | Texto |
| --- | --- |
| `headline` | RACHA A CONTA <br> COM A GALERA! |
| `cardCopy` | Cria a resenha, lança o que rolou <br> e a gente faz as contas. |
| `cta` | Criar minha resenha |
| `haveAccount` | Já tenho conta |

### `onboarding` · 72

| Chave | Texto |
| --- | --- |
| `welcomeEyebrow` | Tour rapidinho |
| `welcomeTitle` | Bora montar sua primeira [resenha]? |
| `welcomeSubtitle` | Em dois passos, você escolhe a resenha, define a divisão e já vê como tudo funciona. |
| `welcomeItem1` | Escolhe o tipo da resenha |
| `welcomeItem2` | Define como a galera divide |
| `welcomeItem3` | Vê a divisão acontecer na hora |
| `welcomeCta` | Começar |
| `skip` | Pular |
| `stepBadge` | {current} de {total} |
| `typeTitle` | Qual vai ser a resenha? |
| `typeSubtitle` | Escolhe o tipo e a gente deixa tudo no jeito pra você. |
| `typeViagem` | Viagem |
| `typeViagemDesc` | Praia, mochilão, road trip |
| `typeRepublica` | Casa |
| `typeRepublicaDesc` | Aluguel, mercado, contas |
| `typeGalera` | Rolê com a galera |
| `typeGaleraDesc` | Bar, churras, aniversário |
| `typeOutro` | Outro |
| `typeOutroDesc` | Qualquer despesa pra dividir |
| `splitTitle` | E a conta, como vai ser? |
| `splitSubtitle` | Escolhe o jeito mais comum dessa resenha. Dá pra mudar em cada despesa depois. |
| `splitEqual` | Igual |
| `splitEqualDesc` | Todo mundo paga a mesma parte |
| `splitExact` | Por consumo |
| `splitExactDesc` | Cada um paga o que consumiu |
| `splitShares` | Por partes |
| `splitSharesDesc` | Uns entram com mais, outros com menos |
| `previewBadge` | Tudo certo! |
| `previewTitle` | Sua resenha tá pronta |
| `previewSubtitle` | Agora chama a galera e começa a lançar as despesas de verdade. |
| `previewNewGroup` | Nova resenha |
| `previewSolo` | Só você por enquanto · você é admin |
| `previewInviteTitle` | Chama a galera por: |
| `previewInviteLocked` | Após criar conta |
| `previewInviteCode` | Código |
| `previewCta` | Começar minha resenha |
| `nameViagem` | Resenha da praia |
| `nameRepublica` | Nossa casa |
| `nameGalera` | Resenha da galera |
| `nameOutro` | Minha primeira resenha |
| `voiceBadge` | Premium |
| `voiceTitle` | Só fala. A gente lança. |
| `voiceSubtitle` | Segura o botão, fala o que rolou e a gente preenche a despesa pra você. |
| `voiceRecording` | Gravando despesa… |
| `voiceExampleLabel` | Exemplo |
| `demoViagem` | Almoço na praia |
| `demoRepublica` | Mercado do mês |
| `demoGalera` | Conta do bar |
| `demoOutro` | Pedido do delivery |
| `demoViagemSpoken` | no almoço na praia |
| `demoRepublicaSpoken` | no mercado do mês |
| `demoGaleraSpoken` | na conta do bar |
| `demoOutroSpoken` | no pedido do delivery |
| `voiceMe` | eu |
| `voicePhraseEqual` | Paguei {amount} {title}. Divide entre {people} |
| `voicePhraseExact` | Paguei {amount} {title}. Eu consumi {mine}, {others} |
| `voiceAnd` | e |
| `voicePhraseShares` | Paguei {amount} {title}. Eu entro com 2 partes e {others} com 1 cada |
| `voiceHint` | Pode falar do seu jeito. |
| `voiceCta` | Ver a divisão |
| `resultBadge` | Pronto |
| `resultTitle` | Pronto. A conta tá rachada. |
| `resultSubtitle` | Você lança a despesa e a gente calcula na hora quanto fica pra cada um. |
| `resultSplitEqual` | Dividido igualmente · {n} pessoas |
| `resultSplitExact` | Dividido por consumo · {n} pessoas |
| `resultSplitShares` | Dividido por partes · {n} pessoas |
| `resultYou` | Você |
| `resultYourShare` | sua parte {amount} |
| `resultOwes` | deve {amount} |
| `resultYouReceive` | Você vai receber |
| `resultFootnote` | Depois, você acerta com a galera pelo WhatsApp. |
| `resultCta` | Continuar |

---

## Premium

O paywall pós-tour e o sheet de limite — os dois leem `limitPaywall.*`, então mexer aqui muda as duas telas. — **54 strings**

### `paywall` · 23

| Chave | Texto |
| --- | --- |
| `notAvailableYet` | A assinatura ainda não está disponível no app. |
| `title` | Deixa a resenha no [Premium] |
| `subtitle` | Menos trabalho pra lançar, acompanhar e acertar tudo com a galera. |
| `planMonthly` | Mensal |
| `planMonthlyNote` | Cobrado mensalmente |
| `planAnnual` | Anual |
| `planAnnualNote` | 7 dias grátis |
| `planLifetime` | Vitalício |
| `planLifetimeNote` | Pague uma vez, é seu |
| `mostChosen` | Mais escolhido |
| `trialHeading` | Seus 7 dias grátis |
| `trialDay0` | Hoje |
| `trialDay0Desc` | Tudo liberado na hora. |
| `trialDay5` | Dia 5 |
| `trialDay5Desc` | A gente te lembra antes da cobrança. |
| `trialDay7` | Dia 7 |
| `trialDay7Desc` | A assinatura começa se você não cancelar. |
| `restore` | Restaurar compras |
| `footerAnnual` | 7 dias grátis · depois {price} · cancele quando quiser |
| `footerMonthly` | {price}/mês · cancele quando quiser |
| `footerLifetime` | Pagamento único · sem renovação |
| `ctaTrial` | Experimentar Premium grátis |
| `ctaLifetime` | Comprar vitalício |

### `limitPaywall` · 31

| Chave | Texto |
| --- | --- |
| `rolesEyebrow` | Tá rendendo, hein? |
| `genericEyebrow` | Só no Premium |
| `titleSuffix` | com Premium |
| `rolesTitle` | Resenhas ilimitadas |
| `rolesSubtitle` | Já tem 5 resenhas rolando. No Premium, pode criar quantas quiser. |
| `voiceTitle` | Lança falando |
| `voiceSubtitle` _(gasto)_ | Fala o gasto do seu jeito e a IA preenche a despesa pra você conferir. |
| `batchSettleTitle` | Tudo pra acertar num só lugar |
| `batchSettleSubtitle` | Vê quem você deve e quem te deve sem precisar abrir cada resenha. |
| `exportTitle` | Exportar insights |
| `exportSubtitle` | Leva sua resenha pra PDF ou CSV quando quiser. |
| `recurringTitle` | Despesas que repetem |
| `recurringSubtitle` | Lança uma vez e a gente repete pra você. |
| `generalTitle` | Libera tudo |
| `generalSubtitle` | Assina o Premium e deixa todos os recursos liberados. |
| `benefit1` | Resenhas ilimitadas |
| `benefit1Desc` | Cria e participa de quantas resenhas quiser. |
| `benefit3` | Lançar despesas com IA |
| `benefit3Desc` | Só fala a despesa e a gente registra tudo pra você. |
| `benefit4` | Todos os acertos num só lugar |
| `benefit4Desc` | Vê quem você deve e quem te deve em todas as resenhas, sem abrir uma por uma. |
| `benefit5` | Leva sua resenha com você |
| `benefit5Desc` | Exporta em PDF ou CSV o que a galera gastou, por categoria e período. |
| `benefit6` | Tudo que rolou, sem perder nada |
| `benefit6Desc` | Acompanha despesas, edições, entradas, saídas e acertos em ordem. |
| `benefit7` | Novidades do Premium |
| `benefit7Desc` | Novos recursos entram no seu plano assim que forem lançados. |
| `benefit8` | Despesas recorrentes |
| `benefit8Desc` | Configura uma vez e a gente repete no dia, semana, mês ou ano. |
| `cta` | Assinar Premium |
| `dismiss` | Agora não |

---

## Cadastro e acesso

Criar conta, entrar, código por e-mail, senha. — **68 strings**

### `signup` · 14

| Chave | Texto |
| --- | --- |
| `title` | Bora criar sua conta? |
| `subtitle` | É rapidinho. Depois você já entra na sua resenha. |
| `nameLabel` | Nome |
| `namePlaceholder` | Como a galera te chama |
| `whatsappHelper` | Usamos pra facilitar os acertos pelo WhatsApp. Seu número não aparece pra galera no app. |
| `submitting` | Enviando código... |
| `submit` | Criar conta e continuar |
| `disclaimer` | Ao continuar, você concorda com os termos de uso. |
| `footerText` | Já tem conta?  |
| `footerLink` | Entrar |
| `errorAlreadyRegistered` | Este e-mail já está cadastrado. |
| `errorRateLimit` | Você já pediu um código pra esse e-mail há pouco. Espera um pouquinho e tenta de novo. |
| `errorGeneric` | Não deu pra criar a conta. Tenta de novo. |
| `errorEmailSend` | Não deu pra enviar o e-mail de confirmação. Já estamos vendo isso — tenta daqui a pouco. |

### `entrar` · 9

| Chave | Texto |
| --- | --- |
| `title` | Entrar |
| `subtitle` | Bom te ver de novo por aqui. |
| `submitting` | Entrando... |
| `submit` | Entrar |
| `forgotPassword` | Esqueci minha senha |
| `errorEmptyFields` | Preenche e-mail e senha. |
| `errorInvalidCredentials` | E-mail ou senha incorretos. |
| `footerText` | Novo por aqui?  |
| `footerLink` | Criar conta |

### `auth` · 6

| Chave | Texto |
| --- | --- |
| `emailLabel` | E-mail |
| `emailPlaceholder` | voce@email.com |
| `passwordLabel` | Senha |
| `orContinueWith` | ou continue com |
| `googleButton` | Continuar com Google |
| `appleButton` | Continuar com Apple |

### `verificarCodigo` · 9

| Chave | Texto |
| --- | --- |
| `title` | Confere seu e-mail |
| `subtitle` | Enviamos um código de 6 dígitos para |
| `submitting` | Conferindo... |
| `submit` | Confirmar código |
| `resendIn` | Reenviar em {seconds}s |
| `resend` | Reenviar código |
| `changeEmail` | Trocar e-mail |
| `errorInvalidOrExpired` | Código inválido ou expirado. Confere os dígitos ou pede um novo. |
| `errorResendFailed` | Não deu pra reenviar o código. Tenta de novo. |

### `recuperarSenha` · 7

| Chave | Texto |
| --- | --- |
| `title` | Esqueceu a senha? |
| `subtitle` | Sem estresse. Manda seu e-mail que a gente <br> envia um código. |
| `submitting` | Enviando... |
| `submit` | Enviar código |
| `errorGeneric` | Não deu pra enviar o código. Tenta de novo. |
| `footerText` | Lembrou?  |
| `footerLink` | Voltar pro login |

### `novaSenha` · 10

| Chave | Texto |
| --- | --- |
| `title` | Nova senha |
| `subtitle` | Agora salva num lugar seguro pra não esquecer. |
| `newPasswordLabel` | Nova senha |
| `confirmPasswordLabel` | Confirmar senha |
| `matchValid` | As senhas batem. |
| `matchInvalid` | As senhas não batem ainda. |
| `submitting` | Salvando... |
| `submit` | Salvar nova senha |
| `errorDifferent` | A nova senha precisa ser diferente da anterior. |
| `errorGeneric` | Não deu pra salvar a senha. Tenta de novo. |

### `senhaAlterada` · 2

| Chave | Texto |
| --- | --- |
| `title` | Senha atualizada! |
| `subtitle` | Tá tudo certo por aqui. Bora voltar pro app. |

### `passwordRules` · 4

| Chave | Texto |
| --- | --- |
| `length` | 8+ caracteres |
| `upper` | 1 maiúscula |
| `lower` | 1 minúscula |
| `digit` | 1 número |

### `bemVindo` · 4

| Chave | Texto |
| --- | --- |
| `title` | Tudo pronto, {name}! |
| `subtitle` | Sua conta tá confirmada. Agora é só rachar contas sem drama. |
| `cta` | Ver minhas resenhas |
| `fallbackName` | você |

### `avatar` · 3

| Chave | Texto |
| --- | --- |
| `title` | Escolhe seu avatar |
| `subtitle` | É assim que você vai aparecer por aqui. |
| `continuing` | Continuando... |

---

## Resenhas

Criar, entrar, participantes, convite, opções. — **178 strings**

### `groups` · 22

| Chave | Texto |
| --- | --- |
| `balanceGeneral` | Seu saldo |
| `balanceCaption` | somando o que você tem pra pagar e receber |
| `active` | Ativas |
| `archived` | Arquivadas |
| `searchPlaceholder` | Buscar resenha ou pessoa |
| `loadErrorTitle` | Não deu pra carregar suas resenhas. |
| `retry` | Tenta de novo |
| `emptyActiveTitle` | Bora criar a primeira? |
| `emptyArchivedTitle` | Nenhuma resenha arquivada |
| `emptyActiveSubtitle` | Cria uma resenha nova ou entra na resenha da galera pelo QR Code. |
| `emptyArchivedSubtitle` | As resenhas encerradas aparecem aqui. |
| `emptySearchTitle` | Nenhuma resenha encontrada |
| `emptySearchSubtitle` | Tenta outro nome ou pessoa. |
| `createCta` | Nova resenha |
| `createCtaSubtitle` | Viagem, casa, churras ou qualquer rolê |
| `notFoundTitle` | Resenha não encontrada |
| `notFoundBody` | Esse QR code não é de nenhuma resenha. Confere com quem te chamou. |
| `joinFailedTitle` | Não deu pra entrar na resenha |
| `alreadyInGroup` | Você já está nessa resenha. |
| `invalidCodeInput` | Digita um código de resenha válido. |
| `codeNotFound` | Esse código não corresponde a nenhuma resenha. |
| `archivedBadge` | arquivada |

### `createRole` · 9

| Chave | Texto |
| --- | --- |
| `title` | Bora criar uma resenha? |
| `createdTitle` | Resenha criada! |
| `namePlaceholder` | Ex: Floripa 2026, Churras de sábado |
| `creating` | Criando... |
| `submit` | Criar resenha |
| `createFailedTitle` | Não deu pra criar a resenha |
| `createdButPhotoFailedTitle` | Resenha criada |
| `createdButPhotoFailedBody` | Não deu pra salvar a foto: {error} |
| `aloneCaption` | só você por enquanto |

### `joinRole` · 11

| Chave | Texto |
| --- | --- |
| `title` | Entrar na resenha da galera |
| `codeTitle` | Código de convite |
| `scanHint` | Aponta a câmera pro QR Code e entra na resenha na hora. |
| `openCamera` | Abrir câmera |
| `haveCode` | Tenho um código |
| `enterCodeHint` | Digita o código que te mandaram. |
| `codePlaceholder` | K3M9X2P |
| `submit` | Entrar na resenha |
| `backToQr` | Voltar pro QR code |
| `notFoundBody` | Esse código não é de nenhuma resenha. Confere e tenta de novo. |
| `joinFailedBody` | Confere o código e tenta de novo. |

### `groupSheet` · 1

| Chave | Texto |
| --- | --- |
| `nameLabel` | Nome da resenha |

### `groupDetail` · 59

| Chave | Texto |
| --- | --- |
| `fallbackName` _(nome do app)_ | Resenha |
| `loadErrorTitle` | Não deu pra carregar essa resenha. |
| `summaryErrorTitle` | Não deu pra carregar o resumo. |
| `expensesErrorTitle` | Não deu pra carregar as despesas. |
| `archiveFailedTitle` | Não deu pra atualizar a resenha |
| `archiveNotSettledTitle` | Falta acertar as contas |
| `archiveNotSettledBody` | Ainda tem saldo pendente ou acerto esperando confirmação nessa resenha. Resolve isso antes de arquivar. |
| `archiveConfirmTitle` | Arquivar resenha |
| `archiveConfirmBody` | Ela some da sua lista de ativas, mas continua disponível em Arquivadas. |
| `archiveConfirmAction` | Arquivar |
| `memberSingular` | participante |
| `memberPlural` | participantes |
| `lastActivity` | {members} · última atividade {time} |
| `netReceivable` | Pra você receber |
| `netOwed` | Pra você pagar |
| `netEven` | Tá tudo certo por aqui |
| `netReceivableShort` | a receber |
| `netOwedShort` | você deve |
| `netEvenShort` | quites |
| `statPaid` | Você bancou |
| `statTotal` | Total da resenha |
| `statReceivable` | A receber |
| `statPayable` | A pagar |
| `expenseCountSingular` | {count} despesa registrada nessa resenha. |
| `expenseCountPlural` | {count} despesas registradas nessa resenha. |
| `settleUp` | Acertar |
| `viewBalances` | Ver saldos |
| `tabResumo` | Resumo |
| `tabDespesas` | Despesas |
| `tabSaldos` | Saldos |
| `tabHistorico` | Atividade |
| `searchPlaceholder` | Buscar por título, valor ou quem bancou |
| `expensesEmptyTitle` | Nada lançado ainda |
| `expensesEmptyDefaultSubtitle` | Toca no + e lança o que rolou. |
| `searchEmptyTitle` | Nenhuma despesa encontrada |
| `searchEmptySubtitle` | Tenta outro título, valor ou nome. |
| `paidByMeSubtitle` | Você bancou · dividido entre {count} |
| `paidByOtherSubtitle` | {name} bancou · você deve {amount} |
| `paidByOtherNotInSubtitle` | {name} bancou · você tá fora |
| `balanceEven` | tudo certo |
| `balanceLegend` | Positivo é pra receber. Negativo é o que você tá devendo. |
| `archiving` | Arquivando... |
| `archiveBlockedReceivable` | Ainda faltam {amount} pra você receber. Pede pra galera acertar antes de arquivar. |
| `archiveRecurrenceWarnTitle` | AINDA TÁ REPETINDO |
| `archiveRecurrenceWarnSingular` | Esta resenha tem 1 despesa que se repete e inclui você. Ela continua sendo lançada depois de a resenha ser arquivada, e seu saldo vai voltar a mudar. |
| `archiveRecurrenceWarnPlural` | Esta resenha tem {count} despesas que se repetem e incluem você. Elas continuam sendo lançadas depois de a resenha ser arquivada, e seu saldo vai voltar a mudar. |
| `archiveBlockedOwe` | Você ainda deve {amount} pra galera. Vai em "Saldos" e acerta antes de arquivar. |
| `recurringSingular` | 1 despesa se repetindo |
| `recurringPlural` | {count} despesas se repetindo |
| `recurringNext` | próximo lançamento em {date} |
| `recurringYouIn` | Você entra em {count} de {total} |
| `recurringYouInOne` | Você entra nessa |
| `recurringYouOut` | Você não entra em nenhuma |
| `recurringYouOutOne` | Você não entra nessa |
| `recurringSheetTitle` | Despesas se repetindo |
| `recurringRowPaidByMe` | Você banca · dividido entre {count} |
| `recurringRowPaidByOther` | {name} banca · você deve {amount} |
| `recurringRowNotIn` | {name} banca · você tá fora |
| `recurringRowRhythm` | {rhythm} · próxima em {date} |

### `groupOptions` · 7

| Chave | Texto |
| --- | --- |
| `title` | Mais da resenha |
| `members` | Participantes |
| `insights` | Insights |
| `insightsHint` | despesas por categoria |
| `unarchive` | Desarquivar resenha |
| `archive` | Arquivar resenha |
| `archiveHint` | só pra você |

### `editGroup` · 3

| Chave | Texto |
| --- | --- |
| `title` | Editar resenha |
| `saveFailedTitle` | Não deu pra salvar |
| `submit` | Salvar alterações |

### `participants` · 11

| Chave | Texto |
| --- | --- |
| `loadErrorTitle` | Não deu pra carregar os participantes. |
| `title` | Participantes |
| `countSingular` | {count} PARTICIPANTE |
| `countPlural` | {count} PARTICIPANTES |
| `adminTag` | Admin |
| `statusEven` | tudo certo por aqui |
| `statusReceivable` | tem a receber {amount} |
| `statusOwing` | tá devendo {amount} |
| `leaveGroup` | Sair da resenha |
| `leaveLegendOwner` | Pra sair, seu saldo precisa estar zerado. Se você for o único admin, quem entrou primeiro assume no seu lugar. A resenha só é apagada se só tiver você nela. |
| `leaveLegendMember` | Pra sair, seu saldo precisa estar zerado. |

### `member` · 20

| Chave | Texto |
| --- | --- |
| `roleAdmin` | admin da resenha |
| `roleMember` | participante |
| `makeAdmin` | Virar admin da resenha |
| `removeAdmin` | Remover admin |
| `removeFromGroup` | Remover da resenha |
| `removeBlockedHint` | Não dá pra remover com saldo pendente. Acertem antes. |
| `confirmMakeAdminTitle` | Tornar {name} admin da resenha |
| `confirmMakeAdminBody` | Vai poder editar a resenha, convidar e remover participantes. |
| `confirmMakeAdminAction` | Virar admin |
| `makingAdmin` | Tornando admin... |
| `removingAdmin` | Removendo... |
| `removing` | Removendo... |
| `makeAdminFailedTitle` | Não deu pra tornar admin |
| `confirmRemoveAdminTitle` | Tirar {name} dos admins |
| `confirmRemoveAdminBody` | {name} continua na resenha, só deixa de ser admin. |
| `removeAdminFailedTitle` | Não deu pra remover admin |
| `confirmRemoveTitle` | Remover {name} da resenha |
| `confirmRemoveBody` | As despesas passadas continuam contando, mas a pessoa sai da lista. |
| `confirmRemoveAction` | Remover |
| `removeFailedTitle` | Não deu pra remover |

### `leaveGroup` · 21

| Chave | Texto |
| --- | --- |
| `action` | Sair da resenha |
| `leaving` | Saindo... |
| `blockedTitle` | Falta acertar as contas |
| `blockedReceivable` | Você ainda tem {amount} pra receber nessa resenha. Pede pra galera acertar antes de sair. |
| `blockedOwe` | Você ainda deve {amount} pra galera. Vai em "Saldos" e acerta antes de sair. |
| `ownerOthersOpenPre` | Ainda tem gente com saldo aberto nessa resenha. Se você sair agora, o admin passa pra |
| `ownerOthersOpenPost` | — ele fica responsável por cobrar e acertar com a galera. |
| `ownerOthersOpenHasAdmin` | Ainda tem gente com saldo aberto nessa resenha. Se você sair agora, quem já é admin fica responsável por cobrar e acertar com a galera. |
| `leaveAndTransfer` | Sair e passar admin pra {name} |
| `chooseOtherAdmin` | Prefiro escolher outro admin |
| `aloneBefore` | Você é o único na resenha. Ao sair, a resenha é |
| `aloneBold` | apagada de vez |
| `aloneAfter` | — o histórico some pra sempre. |
| `leaveAndDelete` | Sair e apagar a resenha |
| `ownerAllQuietPre` | Todo mundo tá quite. Ao sair, o admin passa pra |
| `ownerAllQuietPost` | e a resenha continua ativa pra galera. |
| `ownerAllQuietHasAdmin` | Todo mundo tá quite. Ao sair, a resenha continua ativa pra galera e quem já é admin cuida dela. |
| `memberOkExplain` | Você tá quite com a galera. Ao sair, essa resenha some da sua lista, mas continua ativa pros outros participantes. |
| `leaveFailedTitle` | Não deu pra sair da resenha |
| `nextParticipantFallback` | o próximo participante |
| `nextPersonFallback` | a próxima pessoa |

### `invite` · 2

| Chave | Texto |
| --- | --- |
| `codeLabel` | Código pra entrar |
| `shareMessage` _(nome do app)_ | Bora rachar as contas de "{name}" comigo? Entra no Resenha com o código {code}. |

### `inviteQr` · 7

| Chave | Texto |
| --- | --- |
| `title` | Chama a galera |
| `regenFailedTitle` | Não deu pra gerar um novo código |
| `regenSuccess` | Novo código gerado. O anterior não vale mais. |
| `regenConfirmBody` | Isso invalida o código atual. Quem ainda não entrou vai precisar do novo. |
| `regenerating` | Gerando... |
| `regenerateConfirm` | Gerar novo |
| `regenerateLink` | Gerar novo código |

### `qrScanner` · 2

| Chave | Texto |
| --- | --- |
| `cameraPermissionBody` | Libera o acesso à câmera pra ler o QR Code. |
| `hint` | Aponta a câmera pro QR Code da resenha |

### `tabs` · 3

| Chave | Texto |
| --- | --- |
| `groups` | Resenhas |
| `wallet` | Carteira |
| `profile` | Perfil |

---

## Despesas

Formulário, detalhe, voz e categorias. — **150 strings**

### `expenseForm` · 55

| Chave | Texto |
| --- | --- |
| `modeEqual` | Igual |
| `modeShares` | Partes |
| `modeExact` | Por consumo |
| `sectionEqual` | Dividir com |
| `sectionShares` | Quantas partes cada um paga |
| `sectionExact` | Quanto cada um deve |
| `today` | Hoje |
| `yesterday` | Ontem |
| `description` | Descrição |
| `descriptionPlaceholder` | Ex: Hambúrguer |
| `dateSheetTitle` | Data da despesa |
| `paidBy` | Quem bancou |
| `paidBySheetTitle` | Quem bancou? |
| `makeRecurring` | Fazer repetir |
| `recurringSummaryDaily` | Repete todo dia |
| `recurringSummaryWeekly` | Repete toda semana |
| `recurringSummaryMonthly` | Repete todo mês |
| `recurringSummaryYearly` | Repete todo ano |
| `recurringSummaryCustom` | Repete a cada {days} dias |
| `tapToEdit` | toca pra editar |
| `recurringCancelPending` | Vai pausar ao salvar · toca pra desfazer |
| `recurrenceTitle` | Essa despesa se repete? |
| `recurrenceConfirm` | Pronto |
| `recurrenceFrequencyLabel` | FREQUÊNCIA |
| `recurrenceDaily` | Todo dia |
| `recurrenceWeekly` | Toda semana |
| `recurrenceMonthly` | Todo mês |
| `recurrenceYearly` | Todo ano |
| `recurrenceCustom` | Personalizado |
| `recurrenceStart` | Início |
| `recurrenceSetEndDate` | Escolher quando termina |
| `recurrenceIntervalLabel` | A cada quantos dias? |
| `recurrenceHintDaily` | Ex: café da manhã, estacionamento diário |
| `recurrenceHintWeekly` | Ex: faxina, feira da semana, aula |
| `recurrenceHintMonthly` | Ex: aluguel, internet, mensalidade |
| `recurrenceHintYearly` | Ex: seguro do apê, IPVA, assinatura anual |
| `recurrenceHintCustom` | Ex: quinzenal, a cada 3 meses |
| `upcomingTitle` | Próximos lançamentos |
| `upcomingNone` | Sem próximos lançamentos — a data de término já passou. |
| `upcomingNext` | Próx |
| `upcomingLast` | Última |
| `splitMethod` | Forma de divisão |
| `dividedAmong` | Dividido entre {count} |
| `eachShare` | {amount} cada |
| `sharesFooter` | {people} pessoas · {parts} partes no total |
| `exactProgress` | {distributed} de {total} |
| `exactOnPoint` | no ponto ✨ |
| `exactAutoPair` | Muda o valor de uma pessoa e o outro se ajeita sozinho. |
| `exactOver` | sobrou {amount} |
| `exactMissing` | faltam {amount} |
| `recurrence` | Repetição |
| `receiptUnavailable` | Não deu pra carregar o comprovante |
| `receipt` | Comprovante |
| `attachReceipt` | Anexar comprovante |
| `receiptGalleryPermissionBody` | Libera o acesso às fotos pra escolher o comprovante. |

### `expenseDetail` · 51

| Chave | Texto |
| --- | --- |
| `title` | Detalhe da despesa |
| `couponLabel` | CUPOM |
| `loadErrorTitle` | Não deu pra carregar essa despesa. |
| `date` | Data |
| `paidBy` | Quem bancou |
| `splitType` | Divisão |
| `recurrenceHeader` | REPETIÇÃO |
| `recurrenceStartedOn` | Começou em {date} |
| `recurrenceNoEnd` | sem término |
| `recurrencePaused` | Repetição pausada |
| `editScopeTitle` | Essa despesa se repete |
| `editScopeOnlyThis` | Salvar só nesta |
| `editScopeOnlyThisHint` | As próximas continuam como estão |
| `editScopeFuture` | Salvar nesta e nas próximas |
| `editScopeFutureHint` | As próximas passam a ser lançadas assim |
| `recurrenceUntil` | até {date} |
| `nextOccurrenceLabel` | Próxima |
| `occurrenceLabel` | Essa aqui |
| `occurrenceOfTotal` | {ordinal} de {total} |
| `recurrenceTotalLabel` | Total |
| `recurrenceFinished` | Parou de repetir em {date}. |
| `splitEqual` | Igual |
| `splitByShares` | Partes |
| `splitExact` | Por consumo |
| `peopleCountLabel` | {count} pessoas |
| `partsSingular` | {n} parte |
| `partsPlural` | {n} partes |
| `splitWithHeader` | DIVIDIDO COM |
| `receiptHeader` | COMPROVANTE |
| `viewReceipt` | Ver |
| `noReceipt` | Sem comprovante anexado. |
| `totalizerReceivable` | Você tem a receber |
| `totalizerOwed` | Você deve |
| `totalizerNotIncluded` | Você ficou fora dessa divisão |
| `edit` | Editar |
| `delete` | Apagar |
| `editTitle` | Editar despesa |
| `saveChanges` | Salvar alterações |
| `deleteConfirmTitle` | Apagar despesa |
| `deleteConfirmBody` | "{title}" ({amount}) vai sumir pra todo mundo da resenha. Não dá pra desfazer. |
| `deleteLastExpenseWarningTitle` | Essa é a última despesa da resenha — depois de apagar, ela fica sem nenhuma. Mas: |
| `deleteLastExpenseWarningLine` | {name} continua com {amount} pendente, de um pagamento já confirmado. |
| `deleteAction` | Apagar |
| `deleteEndsSeries` | Esta é a última despesa desta repetição, então ela acaba junto — nenhuma nova vai ser lançada. |
| `deleteSeriesContinues` | Esta despesa faz parte de uma repetição, e ela continua: a próxima vai ser lançada normalmente. Só quem criou a repetição ou um admin da resenha pode pará-la. |
| `deleteScopeOnlyThis` | Apagar só esta |
| `deleteScopeOnlyThisHint` | A repetição continua, e a próxima despesa é lançada normalmente |
| `deleteScopeFuture` | Apagar e parar de repetir |
| `deleteScopeFutureHint` | Pausa a repetição. As despesas anteriores ficam, e dá pra retomar depois |
| `saveFailedTitle` | Não deu pra salvar |
| `deleteFailedTitle` | Não deu pra apagar |

### `expense` · 1

| Chave | Texto |
| --- | --- |
| `paymentFallbackTitle` | Pagamento |

### `lancar` · 7

| Chave | Texto |
| --- | --- |
| `title` | O que rolou? |
| `dictateAgain` | Ditar de novo |
| `dictate` | Falar despesa |
| `aiHint` | Fala do seu jeito que a IA preenche pra você |
| `submitFailedTitle` | Não deu pra lançar a despesa |
| `submit` | Salvar despesa |
| `categoryLabel` | Categoria |

### `falar` · 12

| Chave | Texto |
| --- | --- |
| `instructionsIdle` | Conta o que rolou, quanto deu e com quem dividiu. Se quiser, fala também quem bancou, a data e se a despesa se repete. A IA preenche tudo pra você conferir. |
| `instructionsRecording` | Gravando… conta o que rolou. Toca em parar quando terminar. |
| `instructionsProcessing` | Transcrevendo e entendendo o que você falou… |
| `micPermissionBody` | Libera o acesso ao microfone pra lançar despesa por voz. |
| `startRecording` | Iniciar gravação |
| `stopRecording` | Parar gravação |
| `processingA11y` | Processando |
| `exampleHint` | Ex: "Churrasco 180 reais, o Léo bancou, dividido comigo e com a Ju" |
| `premiumTitle` | Recurso premium |
| `premiumBody` | Lançar despesa por voz é um recurso premium. A assinatura ainda não está disponível no app. |
| `title` | Falar despesa |
| `understandFailedTitle` | Não deu pra entender o áudio |

### `voice` · 4

| Chave | Texto |
| --- | --- |
| `emptyAudio` | Não deu pra ouvir nada. Tenta falar mais perto do microfone. |
| `emptyTranscript` | Não deu pra entender. Tenta falar o valor, o que foi e com quem dividiu. |
| `groupNotFound` | Não deu pra confirmar a resenha. |
| `understandFailed` | Não deu pra entender o áudio. |

### `category` · 16

| Chave | Texto |
| --- | --- |
| `alimentacao` | Alimentação |
| `alimentacaoDesc` | Mercado, restaurante, iFood, lanche |
| `bebidas` | Bebidas |
| `bebidasDesc` | Bar, cerveja, suco, café, refri |
| `transporte` | Transporte |
| `transporteDesc` | Uber, gasolina, passagem, estacionamento |
| `hospedagem` | Hospedagem |
| `hospedagemDesc` | Hotel, Airbnb, pousada |
| `lazer` | Lazer |
| `lazerDesc` | Show, cinema, festa, passeio, streaming |
| `compras` | Compras |
| `comprasDesc` | Roupas, presentes, farmácia, itens |
| `contas` | Contas |
| `contasDesc` | Aluguel, luz, água, internet, condomínio |
| `outros` | Outros |
| `outrosDesc` | O que não se encaixa acima |

### `categoryPicker` · 3

| Chave | Texto |
| --- | --- |
| `title` | Categoria da despesa |
| `usageCountSingular` | {count} despesa |
| `usageCountPlural` | {count} despesas |

### `recurrences` · 1

| Chave | Texto |
| --- | --- |
| `pausedHint` | Não lança nada até alguém retomar |

---

## Acertos e carteira

Quem deve quanto, acerto avulso e em lote. — **135 strings**

### `wallet` · 28

| Chave | Texto |
| --- | --- |
| `title` | Carteira |
| `subtitle` | Tudo o que você tem pra pagar e receber, em um só lugar. |
| `netReceivable` | Pra receber |
| `netOwed` | Pra pagar |
| `netEven` | Tá tudo acertado |
| `toReceive` | A RECEBER |
| `toPay` | A PAGAR |
| `batchSettle` | Acertar com a galera |
| `batchPerson` | pessoa |
| `batchPeople` | pessoas |
| `batchSubtitle` | tudo das suas resenhas em um só lugar |
| `filterAll` | Pendentes |
| `filterReceivable` | A receber |
| `filterPayable` | A pagar |
| `filterSettled` | Acertados |
| `movementsHeader` | MOVIMENTAÇÕES |
| `byPersonHeader` | POR PESSOA |
| `loadErrorTitle` | Não deu pra carregar sua carteira. |
| `emptyTitle` | Tá tudo tranquilo por aqui |
| `emptySubtitle` | Quando tiver algo pra pagar ou receber, aparece aqui. |
| `waitingConfirmation` | Esperando confirmação |
| `today` | hoje |
| `yesterday` | ontem |
| `multiGroupSummary` | {groups} resenhas · {items} movimentações |
| `movementSingular` | movimentação |
| `movementPlural` | movimentações |
| `pending` | pendente |
| `settled` | tudo acertado |

### `saldoDetail` · 30

| Chave | Texto |
| --- | --- |
| `loadErrorTitle` | Não deu pra carregar esse participante. |
| `meSuffix` | {name} (você) |
| `balanceLabel` | Saldo na resenha |
| `twoNames` | {a} e {b} |
| `moreNames` | {a}, {b} e outras pessoas |
| `meBothLabel` | Você tem a receber e a pagar |
| `meReceiveLabel` | Você tem a receber de {names} |
| `meOweLabel` | Você deve pra {names} |
| `noneLabel` | Sem pendências |
| `otherBothLabel` | {name} tem a receber e a pagar |
| `otherReceiveLabel` | {name} tem a receber de {names} |
| `otherOweLabel` | {name} deve pra {names} |
| `chargeMessage` | Oi, {name}! Ficou *{amount}* pra você nessa resenha 🙏 |
| `payMessage` | Oi, {name}! Vou te mandar *{amount}* dessa resenha 🙏 |
| `confirmReceiveTitle` | Registrar recebimento |
| `confirmReceiveBody` | Confirma que {name} já te pagou {amount}? O saldo de vocês dois é acertado na hora. |
| `recordFailedTitle` | Não deu pra registrar |
| `removeConfirmTitle` | Remover participante |
| `removeConfirmBody` | Remover {name} da resenha? |
| `removeAction` | Remover |
| `removeFailedTitle` | Não deu pra remover |
| `relatedPeopleHeader` | Pessoas relacionadas |
| `owesYou` | Deve pra você |
| `owesOther` | Deve pra {name} |
| `meOwesTo` | Você deve pra {name} |
| `otherOwesTo` | {payer} deve pro {payee} |
| `marking` | Registrando... |
| `markReceived` | Já recebi |
| `removing` | Removendo... |
| `removeFromGroup` | Remover da resenha |

### `settle` · 27

| Chave | Texto |
| --- | --- |
| `title` | Acertar com a galera |
| `confirmTitle` | Confirmar pagamento |
| `proofTitle` | Comprovante |
| `progress` | {done} de {total} acertos concluídos |
| `allSettled` | Fechou! Tá tudo acertado. |
| `pendingTab` | Falta acertar ({n}) |
| `settledTab` | Acertados ({n}) |
| `noSettledYet` | Nenhum acerto concluído ainda. |
| `nothingToSettleYet` | Tá tudo certo por aqui. |
| `settledTotalLabel` | Total acertado |
| `yourShareBoth` | Você recebeu {received} · pagou {paid} |
| `yourShareReceived` | Você recebeu {amount} |
| `yourSharePaid` | Você pagou {amount} |
| `noExpensesNotice` | Essa resenha não tem nenhuma despesa lançada — esses valores vêm de um pagamento já confirmado, provavelmente de uma despesa que foi apagada depois. |
| `noExpensesTag` | Sem despesa na resenha — vem de um pagamento anterior |
| `footerHint` | Combina o pagamento no WhatsApp e depois volta aqui pra registrar. |
| `recordReceiptTitle` | Confirmar que recebi |
| `recordReceiptBody` | Confirma que {name} já te pagou {amount}? O saldo de vocês dois é acertado na hora. |
| `confirmFailedTitle` | Não deu pra confirmar |
| `proofUploadFailedBody` | Não deu pra enviar o comprovante. Tenta de novo. |
| `confirmFailedInline` | Não deu pra confirmar. Tenta de novo. |
| `undoFailedInline` | Não deu pra desfazer. Tenta de novo. |
| `msgDebtorMarkedPaid` | Oi, {name}! Acabei de te mandar {amount} da resenha. Quando cair, confirma pra mim? 🙌 |
| `msgDebtorPending` | Oi, {name}! Tenho {amount} pra te pagar da resenha "{group}" 💸 Combinamos por aqui? |
| `msgCreditorMarkedPaid` | Oi, {name}! Vi que você marcou {amount} como pago. Vou conferir e já confirmo por aqui. |
| `msgCreditorPending` | Oi, {name}! Ainda ficaram {amount} da resenha "{group}". Te passo por aqui como acertar 😄 |
| `msgPixSuffix` |  <br>  <br> Minha chave Pix ({type}): {key} |

### `confirmPaid` · 8

| Chave | Texto |
| --- | --- |
| `photoPermissionBody` | Libera o acesso às fotos pra anexar o comprovante. |
| `fileTooBigTitle` | Foto grande demais |
| `fileTooBigBody` | O comprovante tem que ser menor que {mb} MB. |
| `summaryLabel` | Você vai marcar como pago |
| `forPerson` | pra {name} |
| `proofLabel` | Comprovante |
| `proofExplain` | Dá mais segurança pro {name} confirmar sem ficar em dúvida. Só vocês dois veem. |
| `attachProof` | Anexar comprovante |

### `batch` · 15

| Chave | Texto |
| --- | --- |
| `explain` | A gente junta o que você deve e tem pra receber de cada pessoa em todas as resenhas. Aí é só tocar no WhatsApp. |
| `receiveTab` | Receber ({count}) |
| `payTab` | Pagar ({count}) |
| `remaining` | RESTAM {amount} |
| `groupsSubtitle` | {count} resenhas · {names} |
| `groupsSubtitleSingular` | {count} resenha · {name} |
| `resolveFailedTitle` | Não deu pra concluir |
| `resolveFailedBody` | Algumas resenhas podem não ter sido atualizadas. Tenta de novo. |
| `undoTitle` | Desfazer a marcação |
| `undoBodySingular` | Isso apaga a marcação de pagamento da resenha "{names}" — o que você deve pro {name} volta como estava. |
| `undoBody` | Isso apaga a marcação de pagamento de {count} resenhas ({names}) — o que você deve pro {name} volta como estava. |
| `undoProofSuffix` |  O comprovante que você anexou vai junto. |
| `undoing` | Desfazendo... |
| `receberMessage` | Oi, {name}! Fechando nossas resenhas: <br> {bullets} <br> Total: {total} <br>  <br> Quando pagar, me manda o comprovante 🙏 |
| `pagarMessage` | Oi, {name}! Fechando nossas resenhas: <br> {bullets} <br> Total: {total} <br>  <br> Te aviso assim que pagar! |

### `transfer` · 12

| Chave | Texto |
| --- | --- |
| `confirmed` | Confirmado |
| `markedPaidBy` | {name} marcou como pago |
| `waitingConfirm` | Esperando {name} confirmar |
| `paysTo` | paga pra |
| `paidTo` | pagou pra |
| `viewProof` | Ver comprovante |
| `payWithPix` | PAGAR VIA PIX ({type}) |
| `pixCopied` | Chave copiada |
| `marking` | Registrando... |
| `markAsPaid` | Já paguei |
| `undoMarkedPaid` | Marquei sem querer |
| `confirmReceipt` | Já recebi |

### `pixSheet` · 15

| Chave | Texto |
| --- | --- |
| `explain` | Essa chave aparece só pra quem tem acerto com você e pode ir junto nas mensagens do WhatsApp. |
| `typeLabel` | Tipo |
| `keyLabel` | Chave |
| `save` | Salvar Pix |
| `removeKey` | Remover chave |
| `saveFailedTitle` | Não deu pra salvar a chave |
| `removeFailedTitle` | Não deu pra remover a chave |
| `type.cpf` | CPF |
| `type.email` | E-mail |
| `type.phone` | Celular |
| `type.random` | Chave aleatória |
| `placeholder.cpf` | 000.000.000-00 |
| `placeholder.email` | voce@email.com |
| `placeholder.phone` | (11) 98765-4321 |
| `placeholder.random` | Cole a chave do seu banco |

---

## Histórico e insights

A linha do tempo e os gráficos. — **93 strings**

### `history` · 49

| Chave | Texto |
| --- | --- |
| `emptyTitle` | Ainda não rolou nada por aqui |
| `emptySubtitle` | Despesas, acertos e entradas na resenha aparecem aqui. |
| `upgradeCta` | Ver histórico completo com Premium |
| `titleExpenseCreated` | {actor} lançou {title} |
| `titleExpenseEdited` | {actor} editou {title} |
| `titleExpenseDeleted` | {actor} apagou {title} |
| `detailExpenseDeleted` | {amount} estornado dos saldos |
| `detailAmountChanged` | Valor: {from} → {to} |
| `detailPaidByChanged` | Quem bancou: {from} → {to} |
| `detailParticipantsChanged` | Divisão alterada |
| `detailSplitChanged` | Tipo de divisão alterado |
| `detailTitleChanged` | Renomeada de "{from}" |
| `detailDateChanged` | Data alterada |
| `detailSplitValuesChanged` | Valores da divisão alterados |
| `detailSplitChangedFromTo` | Divisão: {from} → {to} |
| `detailCategoryChanged` | Categoria: {from} → {to} |
| `detailReceiptAdded` | Anexou comprovante |
| `detailReceiptRemoved` | Removeu o comprovante |
| `detailReceiptChanged` | Trocou o comprovante |
| `detailRecurringOn` | Passou a repetir |
| `detailRecurringOff` | Parou de repetir |
| `detailSplitEqual` | Dividido igualmente entre {n} |
| `detailSplitShares` | Por partes — {list} |
| `detailSplitExact` | Por consumo — {list} |
| `titleSettlement` | {from} acertou com {to} |
| `detailSettlementProof` | Comprovante anexado |
| `detailSettlementConfirmed` | Confirmado |
| `titleMemberJoined` | {actor} entrou na resenha |
| `detailMemberJoined` | Pelo link de convite |
| `titleMemberLeftSelf` | {member} saiu da resenha |
| `detailMemberLeftSelf` | Saiu por conta própria |
| `titleMemberLeftRemoved` | {member} foi removido da resenha |
| `detailMemberLeftRemoved` | Removido por {actor} |
| `titleAdminGranted` | {member} virou admin |
| `detailAdminGranted` | Promovido por {actor} |
| `titleAdminRevoked` | {member} deixou de ser admin |
| `detailAdminRevoked` | Rebaixado por {actor} |
| `titleGroupEdited` | {actor} editou a resenha |
| `detailGroupNameAndAvatar` | Nome e foto atualizados |
| `detailGroupName` | Nome atualizado para {name} |
| `detailGroupAvatar` | Foto atualizada |
| `detailGroupCurrency` | Moeda atualizada para {currency} |
| `titleGroupCreated` | {actor} criou a resenha |
| `titleRecurrencePaused` | {actor} pausou a repetição de {title} |
| `titleRecurrenceResumed` | {actor} retomou a repetição de {title} |
| `titleRecurrenceEdited` | {actor} alterou a repetição de {title} |
| `detailRecurrencePaused` | Não lança mais nada até alguém retomar |
| `detailRecurrenceRhythm` | Agora: {rhythm} |
| `detailRecurrenceEndDate` | Data de término alterada |

### `insight` · 44

| Chave | Texto |
| --- | --- |
| `eyebrow` | Insights |
| `loadErrorTitle` | Não deu pra carregar os dados desta resenha. |
| `scopeMe` | Só eu |
| `scopeGroup` | Toda a resenha |
| `periodMonth` | Mês |
| `periodYear` | Ano |
| `periodAll` | Tudo |
| `spentByMe` | Sua parte |
| `spentByGroup` | Total da resenha |
| `sinceBeginning` | desde o começo |
| `noPrevData` | Sem dados do {period} anterior pra comparar. |
| `periodWordYear` | ano |
| `periodWordMonth` | mês |
| `deltaEqual` | igual ao {period} anterior |
| `deltaMore` | {pct}% a mais que o {period} anterior |
| `deltaLess` | {pct}% a menos que o {period} anterior |
| `byCategory` | Pra onde foi o dinheiro |
| `categorySheetTotal` | Total na categoria |
| `categorySheetMyTotal` | Sua parte na categoria |
| `categorySheetRowSubtitle` | {name} bancou · {amount} no total |
| `categorySheetCount` | {count} despesas |
| `categorySheetCountSingular` | {count} despesa |
| `emptyPeriodTitle` | Nada nesse período |
| `emptyPeriodSubtitle` | Troca o mês ou o ano pra ver as outras despesas. |
| `percentOfTotal` | {pct}% do total |
| `groupFallback` _(nome do app)_ | Resenha |
| `exportButtonLabel` | Exportar |
| `exportTitle` | Levar esses dados com você |
| `exportSubtitleCount` | {count} despesas · {period} |
| `exportEmptyMessage` | Sem despesas no período — nada pra exportar. |
| `exportCsvTitle` | CSV (planilha) |
| `exportCsvDesc` | Abre no Excel ou Google Sheets. Inclui todos os dados da resenha. |
| `exportPdfTitle` | PDF (resumo visual) |
| `exportPdfDesc` | Bom pra mandar no WhatsApp ou guardar o fechamento da resenha. |
| `exportErrorTitle` | Não deu pra exportar agora |
| `exportErrorBody` | Tenta de novo. |
| `csvHeaderDate` | Data |
| `csvHeaderDescription` | Descrição |
| `csvHeaderCategory` | Categoria |
| `csvHeaderPaidBy` | Quem pagou |
| `csvHeaderAmount` | Valor |
| `csvHeaderParticipants` | Participantes |
| `csvHeaderMyShare` | Minha parte |
| `pdfExpensesTitle` | Despesas |

---

## Conta e ajustes

Perfil, senha, WhatsApp. — **58 strings**

### `profile` · 40

| Chave | Texto |
| --- | --- |
| `title` | Perfil |
| `subtitle` | Tudo do seu jeito. |
| `you` | Você |
| `notifPermissionBody` | Libera as notificações nas configurações do sistema pra receber avisos da resenha. |
| `photoPermissionBody` | Libera o acesso às fotos pra escolher uma imagem. |
| `photoUpdateFailedTitle` | Não deu pra atualizar a foto |
| `logoutFailedTitle` | Não deu pra sair |
| `addNumber` | Adicionar número |
| `section.personalInfo` | DADOS PESSOAIS |
| `section.security` | SEGURANÇA |
| `section.subscription` | ASSINATURA |
| `section.appearance` | APARÊNCIA |
| `section.notifications` | NOTIFICAÇÕES |
| `section.support` | SUPORTE |
| `section.account` | CONTA |
| `name` | Nome |
| `addName` | Adicionar nome |
| `whatsapp` | WhatsApp |
| `pixKey` | Chave Pix |
| `addPixKey` | Adicionar chave |
| `changePassword` | Alterar senha |
| `changePasswordHelper` | Muda a senha que você usa pra entrar |
| `freePlan` | Grátis |
| `upgradeHelper` | Libera IA, insights, exportações e resenhas ilimitadas |
| `premiumPlan` | Premium |
| `activeHelper` | Tá tudo liberado |
| `plan.cta` | Ver planos |
| `pushTitle` | Avisos da resenha |
| `pushHelper` | Avisos quando rolar despesa nova ou acerto |
| `help` | Ajuda |
| `terms` | Termos de uso |
| `privacy` | Política de privacidade |
| `logout` | Sair da conta |
| `logoutConfirmTitle` | Sair da conta |
| `logoutConfirmBody` | Você vai precisar entrar de novo pra ver suas resenhas. |
| `signingOut` | Saindo... |
| `signOut` | Sair |
| `theme.light` | Claro |
| `theme.dark` | Escuro |
| `theme.system` | Sistema |

### `changePassword` · 9

| Chave | Texto |
| --- | --- |
| `subtitle` | Pra sua segurança, confirma a senha atual e escolhe uma nova. |
| `currentLabel` | Senha atual |
| `newLabel` | Nova senha |
| `confirmLabel` | Confirmar nova senha |
| `currentWrong` | Senha atual incorreta. |
| `sameAsCurrent` | A nova senha precisa ser diferente da atual. |
| `matches` | As senhas batem. |
| `noMatch` | As senhas não batem ainda. |
| `failedTitle` | Não deu pra alterar a senha |

### `nameSheet` · 4

| Chave | Texto |
| --- | --- |
| `explain` | É assim que a galera vê você nas resenhas — nos participantes, nas despesas e nos acertos. |
| `nameLabel` | Seu nome |
| `placeholder` | Como te chamam |
| `saveFailedTitle` | Não deu pra salvar o nome |

### `whatsappSheet` · 5

| Chave | Texto |
| --- | --- |
| `explain` | A gente usa esse número pra abrir o WhatsApp quando alguém da resenha for falar com você sobre um acerto. Ele não aparece na lista de participantes. |
| `numberLabel` | Número de telefone |
| `saveFailedTitle` | Não deu pra salvar o WhatsApp |
| `removeFailedTitle` | Não deu pra remover o número |
| `removeNumber` | Remover número |

---

## Sistema

Botões genéricos, erros e datas relativas. — **54 strings**

### `common` · 32

| Chave | Texto |
| --- | --- |
| `tryAgain` | Tenta de novo daqui a pouco. |
| `permissionNeeded` | Só falta liberar o acesso |
| `cancel` | Cancelar |
| `done` | Pronto |
| `more` | Mais |
| `total` | Total |
| `save` | Salvar |
| `saving` | Salvando... |
| `confirm` | Confirmar |
| `confirming` | Confirmando... |
| `swap` | Trocar |
| `nudge` | Dar um toque |
| `notify` | Avisar |
| `optional` | (opcional) |
| `openSettings` | Abrir ajustes |
| `addPhoto` | adicionar foto |
| `changePhoto` | Trocar foto |
| `profilePhotoTitle` | Foto de perfil |
| `groupPhotoTitle` | Foto da resenha |
| `takePhoto` | Tirar foto |
| `chooseFromGallery` | Pegar da galeria |
| `cameraPermissionBody` | Libera o acesso à câmera pra tirar uma foto. |
| `galleryErrorTitle` | Não deu pra abrir a galeria |
| `whatsappOpenFailed` | Não deu pra abrir o WhatsApp |
| `you` | você |
| `today` | Hoje |
| `yesterday` | Ontem |
| `retry` | Tenta de novo |
| `youCapitalized` | Você |
| `categoryFallback` | Sem categoria |
| `paidTag` | Bancou |
| `continue` | Continuar |

### `errors` · 10

| Chave | Texto |
| --- | --- |
| `sessionInvalid` | Sessão inválida |
| `loadGroupsFailed` | Não deu pra carregar as resenhas |
| `loadGroupFailed` | Não deu pra carregar a resenha |
| `loadExpensesFailed` | Não deu pra carregar as despesas |
| `loadHistoryFailed` | Não deu pra carregar o histórico |
| `loadWalletFailed` | Não deu pra carregar a carteira |
| `loadExpenseFailed` | Não deu pra carregar a despesa |
| `loadBalancesFailed` | Não deu pra calcular os saldos |
| `loadProfileFailed` | Não deu pra carregar o perfil |
| `loadRecurrencesFailed` | Não deu pra carregar as repetições |

### `relativeTime` · 9

| Chave | Texto |
| --- | --- |
| `now` | agora |
| `minutesAgo` | há {n}min |
| `hoursAgo` | há {n}h |
| `yesterday` | ontem |
| `daysAgo` | há {n} dias |
| `monthAgo` | há {n} mês |
| `monthsAgo` | há {n} meses |
| `yearAgo` | há {n} ano |
| `yearsAgo` | há {n} anos |

### `offline` · 3

| Chave | Texto |
| --- | --- |
| `title` | Sem internet |
| `needsInternet` | Esse recurso precisa de internet. Quando a conexão voltar, tenta de novo. |
| `gateBody` _(nome do app)_ | O Resenha precisa de internet pra carregar seus dados. Quando a conexão voltar, você continua de onde parou. |
