// O app é exclusivo do Brasil: um idioma, uma moeda. Os dicionários en/es
// saíram junto com o seletor de idioma.
//
// O `t()` FICOU de propósito, mesmo sem tradução pra escolher. Ele não é
// máquina de i18n aqui, é o lugar onde o texto mora: 941 chamadas espalhadas
// por 76 arquivos, todas apontando pra este arquivo. Trocar cada uma pela
// string literal espalharia a cópia pela árvore inteira e tornaria "revisar o
// texto do app" impossível de fazer num lugar só. E se um dia voltar outro
// idioma, é acrescentar um dicionário.
//
// `Language` continua existindo porque `toLocaleDateString` e afins recebem
// locale — só que agora ele tem um valor só.
export type Language = 'pt-BR';

export const WEEKDAYS: Record<Language, string[]> = {
  'pt-BR': ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
};

const pt = {
  'tabs.groups': 'Resenhas',
  'tabs.wallet': 'Carteira',
  'tabs.profile': 'Perfil',

  // Segunda pessoa informal em TODO o app: "tenta", não "tente". Esta é a
  // string mais reaproveitada da casa — se ela destoa, o app inteiro destoa.
  'common.tryAgain': 'Tenta de novo daqui a pouco.',
  'common.permissionNeeded': 'Só falta liberar o acesso',

  'profile.title': 'Perfil',
  'profile.subtitle': 'Tudo do seu jeito.',
  'profile.you': 'Você',
  'profile.notifPermissionBody': 'Libera as notificações nas configurações do sistema pra receber avisos da resenha.',
  'profile.photoPermissionBody': 'Libera o acesso às fotos pra escolher uma imagem.',
  'profile.photoUpdateFailedTitle': 'Não deu pra atualizar a foto',
  'profile.logoutFailedTitle': 'Não deu pra sair',
  'profile.addNumber': 'Adicionar número',
  'profile.section.personalInfo': 'DADOS PESSOAIS',
  'profile.section.security': 'SEGURANÇA',
  'profile.section.subscription': 'ASSINATURA',
  'profile.section.appearance': 'APARÊNCIA',
  'profile.section.notifications': 'NOTIFICAÇÕES',
  'profile.section.support': 'SUPORTE',
  'profile.section.account': 'CONTA',
  'profile.name': 'Nome',
  'profile.addName': 'Adicionar nome',
  'profile.whatsapp': 'WhatsApp',
  'profile.pixKey': 'Chave Pix',
  'profile.addPixKey': 'Adicionar chave',
  'profile.changePassword': 'Alterar senha',
  'profile.changePasswordHelper': 'Muda a senha que você usa pra entrar',
  'profile.freePlan': 'Grátis',
  'profile.upgradeHelper': 'Libera IA, insights, exportações e resenhas ilimitadas',
  'profile.premiumPlan': 'Premium',
  'profile.activeHelper': 'Tá tudo liberado',
  'profile.plan.cta': 'Ver planos',
  'profile.pushTitle': 'Avisos da resenha',
  'profile.pushHelper': 'Avisos quando rolar despesa nova ou acerto',
  'profile.help': 'Ajuda',
  'profile.terms': 'Termos de uso',
  'profile.privacy': 'Política de privacidade',
  'profile.logout': 'Sair da conta',
  'profile.logoutConfirmTitle': 'Sair da conta',
  'profile.logoutConfirmBody': 'Você vai precisar entrar de novo pra ver suas resenhas.',
  'profile.signingOut': 'Saindo...',
  'profile.signOut': 'Sair',
  'profile.theme.light': 'Claro',
  'profile.theme.dark': 'Escuro',
  'profile.theme.system': 'Sistema',

  'wallet.title': 'Carteira',
  'wallet.subtitle': 'Tudo o que você tem pra pagar e receber, em um só lugar.',
  'wallet.netReceivable': 'Pra receber',
  'wallet.netOwed': 'Pra pagar',
  'wallet.netEven': 'Tá tudo acertado',
  'wallet.toReceive': 'A RECEBER',
  'wallet.toPay': 'A PAGAR',
  'wallet.batchSettle': 'Acertar com a galera',
  'wallet.batchPerson': 'pessoa',
  'wallet.batchPeople': 'pessoas',
  'wallet.batchSubtitle': 'tudo das suas resenhas em um só lugar',
  // "Pendentes" e não "Tudo": este filtro mostra `nonSettled`, então "Tudo"
  // prometia conter os outros três pills e deixava os acertados de fora. É o
  // mesmo recorte que o saldo e os cards do cabeçalho resumem.
  'wallet.filterAll': 'Pendentes',
  'wallet.filterReceivable': 'A receber',
  'wallet.filterPayable': 'A pagar',
  // "Acertados" e não "Resolvidos": o que este filtro mostra são as linhas de
  // `payments`, o MESMO registro que a aba 'settle.settledTab' do sheet de
  // acertar contas. Dois nomes pro mesmo fato, e o slot do registro de
  // quitação já é "acerto" em todo o resto do app.
  'wallet.filterSettled': 'Acertados',
  'wallet.movementsHeader': 'MOVIMENTAÇÕES',
  'wallet.byPersonHeader': 'POR PESSOA',
  'wallet.loadErrorTitle': 'Não deu pra carregar sua carteira.',
  'wallet.emptyTitle': 'Tá tudo tranquilo por aqui',
  'wallet.emptySubtitle': 'Quando tiver algo pra pagar ou receber, aparece aqui.',
  'wallet.waitingConfirmation': 'Esperando confirmação',
  'wallet.today': 'hoje',
  'wallet.yesterday': 'ontem',
  'wallet.multiGroupSummary': '{groups} resenhas · {items} movimentações',
  'wallet.movementSingular': 'movimentação',
  'wallet.movementPlural': 'movimentações',
  'wallet.pending': 'pendente',
  'wallet.settled': 'tudo acertado',

  'groups.balanceGeneral': 'Seu saldo',
  'groups.balanceCaption': 'somando o que você tem pra pagar e receber',
  'groups.active': 'Ativas',
  'groups.archived': 'Arquivadas',
  'groups.searchPlaceholder': 'Buscar resenha ou pessoa',
  'groups.loadErrorTitle': 'Não deu pra carregar suas resenhas.',
  'groups.retry': 'Tenta de novo',
  'groups.emptyActiveTitle': 'Bora criar a primeira?',
  'groups.emptyArchivedTitle': 'Nenhuma resenha arquivada',
  'groups.emptyActiveSubtitle': 'Cria uma resenha nova ou entra na resenha da galera pelo QR Code.',
  'groups.emptyArchivedSubtitle': 'As resenhas encerradas aparecem aqui.',
  'groups.emptySearchTitle': 'Nenhuma resenha encontrada',
  'groups.emptySearchSubtitle': 'Tenta outro nome ou pessoa.',
  'groups.createCta': 'Nova resenha',
  'groups.createCtaSubtitle': 'Viagem, casa, churras ou qualquer rolê',
  'groups.notFoundTitle': 'Resenha não encontrada',
  'groups.notFoundBody': 'Esse QR code não é de nenhuma resenha. Confere com quem te chamou.',
  'groups.joinFailedTitle': 'Não deu pra entrar na resenha',

  'common.cancel': 'Cancelar',
  'common.done': 'Pronto',
  'common.more': 'Mais',
  'common.total': 'Total',
  'common.save': 'Salvar',
  'common.saving': 'Salvando...',
  'common.confirm': 'Confirmar',
  'common.confirming': 'Confirmando...',
  'common.swap': 'Trocar',
  // Rótulo do botão de WhatsApp em todo lugar que ele aparece: diz a AÇÃO, não
  // o canal — o ícone verde ao lado já diz por onde vai. Comum porque as três
  // telas que abrem o WhatsApp (saldo, acertar contas, lote) usam os mesmos.
  //
  // "Dar um toque"/"Avisar" e não "Cobrar"/"Pagar": entre amigos ninguém cobra,
  // dá um toque. E "Pagar" ficava a uma letra de "Paguei" no botão vizinho —
  // dois rótulos quase iguais pra ações que não têm nada a ver (um abre o zap,
  // o outro mexe no saldo).
  'common.nudge': 'Dar um toque',
  'common.notify': 'Avisar',
  'common.optional': '(opcional)',
  'common.openSettings': 'Abrir ajustes',
  'common.addPhoto': 'adicionar foto',
  'common.changePhoto': 'Trocar foto',
  'common.profilePhotoTitle': 'Foto de perfil',
  'common.groupPhotoTitle': 'Foto da resenha',
  'common.takePhoto': 'Tirar foto',
  'common.chooseFromGallery': 'Pegar da galeria',
  'common.cameraPermissionBody': 'Libera o acesso à câmera pra tirar uma foto.',
  'common.galleryErrorTitle': 'Não deu pra abrir a galeria',
  'common.whatsappOpenFailed': 'Não deu pra abrir o WhatsApp',
  'common.you': 'você',
  'common.today': 'Hoje',
  'common.yesterday': 'Ontem',

  'groupSheet.nameLabel': 'Nome da resenha',

  'editGroup.title': 'Editar resenha',
  'editGroup.saveFailedTitle': 'Não deu pra salvar',
  'editGroup.submit': 'Salvar alterações',

  'createRole.title': 'Bora criar uma resenha?',
  'createRole.createdTitle': 'Resenha criada!',
  'createRole.namePlaceholder': 'Ex: Floripa 2026, Churras de sábado',
  'createRole.creating': 'Criando...',
  'createRole.submit': 'Criar resenha',
  'createRole.createFailedTitle': 'Não deu pra criar a resenha',
  'createRole.createdButPhotoFailedTitle': 'Resenha criada',
  'createRole.createdButPhotoFailedBody': 'Não deu pra salvar a foto: {error}',
  'createRole.aloneCaption': 'só você por enquanto',

  'category.alimentacao': 'Alimentação',
  'category.alimentacaoDesc': 'Mercado, restaurante, iFood, lanche',
  'category.bebidas': 'Bebidas',
  'category.bebidasDesc': 'Bar, cerveja, suco, café, refri',
  'category.transporte': 'Transporte',
  'category.transporteDesc': 'Uber, gasolina, passagem, estacionamento',
  'category.hospedagem': 'Hospedagem',
  'category.hospedagemDesc': 'Hotel, Airbnb, pousada',
  'category.lazer': 'Lazer',
  'category.lazerDesc': 'Show, cinema, festa, passeio, streaming',
  'category.compras': 'Compras',
  'category.comprasDesc': 'Roupas, presentes, farmácia, itens',
  'category.contas': 'Contas',
  'category.contasDesc': 'Aluguel, luz, água, internet, condomínio',
  'category.outros': 'Outros',
  'category.outrosDesc': 'O que não se encaixa acima',

  'invite.codeLabel': 'Código pra entrar',
  'invite.shareMessage': 'Bora rachar as contas de "{name}" comigo? Entra no Resenha com o código {code}.',

  'groupOptions.title': 'Mais da resenha',
  'groupOptions.members': 'Participantes',
  'groupOptions.insights': 'Insights',
  'groupOptions.insightsHint': 'despesas por categoria',
  'groupOptions.unarchive': 'Desarquivar resenha',
  'groupOptions.archive': 'Arquivar resenha',
  'groupOptions.archiveHint': 'só pra você',

  'leaveGroup.action': 'Sair da resenha',
  'leaveGroup.leaving': 'Saindo...',
  'leaveGroup.blockedTitle': 'Falta acertar as contas',
  'leaveGroup.blockedReceivable': 'Você ainda tem {amount} pra receber nessa resenha. Pede pra galera acertar antes de sair.',
  'leaveGroup.blockedOwe': 'Você ainda deve {amount} pra galera. Vai em "Saldos" e acerta antes de sair.',
  'leaveGroup.ownerOthersOpenPre': 'Ainda tem gente com saldo aberto nessa resenha. Se você sair agora, o admin passa pra',
  'leaveGroup.ownerOthersOpenPost': '— ele fica responsável por cobrar e acertar com a galera.',
  'leaveGroup.ownerOthersOpenHasAdmin': 'Ainda tem gente com saldo aberto nessa resenha. Se você sair agora, quem já é admin fica responsável por cobrar e acertar com a galera.',
  'leaveGroup.leaveAndTransfer': 'Sair e passar admin pra {name}',
  'leaveGroup.chooseOtherAdmin': 'Prefiro escolher outro admin',
  'leaveGroup.aloneBefore': 'Você é o único na resenha. Ao sair, a resenha é',
  'leaveGroup.aloneBold': 'apagada de vez',
  'leaveGroup.aloneAfter': '— o histórico some pra sempre.',
  'leaveGroup.leaveAndDelete': 'Sair e apagar a resenha',
  'leaveGroup.ownerAllQuietPre': 'Todo mundo tá quite. Ao sair, o admin passa pra',
  'leaveGroup.ownerAllQuietPost': 'e a resenha continua ativa pra galera.',
  'leaveGroup.ownerAllQuietHasAdmin': 'Todo mundo tá quite. Ao sair, a resenha continua ativa pra galera e quem já é admin cuida dela.',
  'leaveGroup.memberOkExplain': 'Você tá quite com a galera. Ao sair, essa resenha some da sua lista, mas continua ativa pros outros participantes.',
  'leaveGroup.leaveFailedTitle': 'Não deu pra sair da resenha',
  'leaveGroup.nextParticipantFallback': 'o próximo participante',
  'leaveGroup.nextPersonFallback': 'a próxima pessoa',

  'member.roleAdmin': 'admin da resenha',
  'member.roleMember': 'participante',
  'member.makeAdmin': 'Virar admin da resenha',
  'member.removeAdmin': 'Remover admin',
  'member.removeFromGroup': 'Remover da resenha',
  'member.removeBlockedHint': 'Não dá pra remover com saldo pendente. Acertem antes.',
  'member.confirmMakeAdminTitle': 'Tornar {name} admin da resenha',
  // Sem "Ele(a)": o título do sheet já tem o nome da pessoa, e a barra é
  // linguagem de formulário.
  'member.confirmMakeAdminBody': 'Vai poder editar a resenha, convidar e remover participantes.',
  'member.confirmMakeAdminAction': 'Virar admin',
  'member.makingAdmin': 'Tornando admin...',
  'member.removingAdmin': 'Removendo...',
  'member.removing': 'Removendo...',
  'member.makeAdminFailedTitle': 'Não deu pra tornar admin',
  'member.confirmRemoveAdminTitle': 'Tirar {name} dos admins',
  'member.confirmRemoveAdminBody': '{name} continua na resenha, só deixa de ser admin.',
  'member.removeAdminFailedTitle': 'Não deu pra remover admin',
  'member.confirmRemoveTitle': 'Remover {name} da resenha',
  'member.confirmRemoveBody': 'As despesas passadas continuam contando, mas a pessoa sai da lista.',
  'member.confirmRemoveAction': 'Remover',
  'member.removeFailedTitle': 'Não deu pra remover',

  'qrScanner.cameraPermissionBody': 'Libera o acesso à câmera pra ler o QR Code.',
  'qrScanner.hint': 'Aponta a câmera pro QR Code da resenha',

  'inviteQr.title': 'Chama a galera',
  'inviteQr.regenFailedTitle': 'Não deu pra gerar um novo código',
  'inviteQr.regenSuccess': 'Novo código gerado. O anterior não vale mais.',
  'inviteQr.regenConfirmBody': 'Isso invalida o código atual. Quem ainda não entrou vai precisar do novo.',
  'inviteQr.regenerating': 'Gerando...',
  'inviteQr.regenerateConfirm': 'Gerar novo',
  'inviteQr.regenerateLink': 'Gerar novo código',

  'joinRole.title': 'Entrar na resenha da galera',
  'joinRole.codeTitle': 'Código de convite',
  'joinRole.scanHint': 'Aponta a câmera pro QR Code e entra na resenha na hora.',
  'joinRole.openCamera': 'Abrir câmera',
  'joinRole.haveCode': 'Tenho um código',
  'joinRole.enterCodeHint': 'Digita o código que te mandaram.',
  'joinRole.codePlaceholder': 'K3M9X2P',
  'joinRole.submit': 'Entrar na resenha',
  'joinRole.backToQr': 'Voltar pro QR code',
  'joinRole.notFoundBody': 'Esse código não é de nenhuma resenha. Confere e tenta de novo.',
  'joinRole.joinFailedBody': 'Confere o código e tenta de novo.',

  'batch.explain': 'A gente junta o que você deve e tem pra receber de cada pessoa em todas as resenhas. Aí é só tocar no WhatsApp.',
  'batch.receiveTab': 'Receber ({count})',
  'batch.payTab': 'Pagar ({count})',
  'batch.remaining': 'RESTAM {amount}',
  'batch.groupsSubtitle': '{count} resenhas · {names}',
  'batch.groupsSubtitleSingular': '{count} resenha · {name}',
  'batch.resolveFailedTitle': 'Não deu pra concluir',
  'batch.resolveFailedBody': 'Algumas resenhas podem não ter sido atualizadas. Tenta de novo.',
  // O card da Carteira não mostra resenha nenhum — este texto é o único lugar
  // onde dá pra ver o que a marcação some.
  'batch.undoTitle': 'Desfazer a marcação',
  'batch.undoBodySingular': 'Isso apaga a marcação de pagamento da resenha "{names}" — o que você deve pro {name} volta como estava.',
  'batch.undoBody': 'Isso apaga a marcação de pagamento de {count} resenhas ({names}) — o que você deve pro {name} volta como estava.',
  'batch.undoProofSuffix': ' O comprovante que você anexou vai junto.',
  'batch.undoing': 'Desfazendo...',
  'batch.receberMessage': 'Oi, {name}! Fechando nossas resenhas:\n{bullets}\nTotal: {total}\n\nQuando pagar, me manda o comprovante 🙏',
  'batch.pagarMessage': 'Oi, {name}! Fechando nossas resenhas:\n{bullets}\nTotal: {total}\n\nTe aviso assim que pagar!',

  'settle.title': 'Acertar com a galera',
  'settle.confirmTitle': 'Confirmar pagamento',
  'settle.proofTitle': 'Comprovante',
  'settle.progress': '{done} de {total} acertos concluídos',
  'settle.allSettled': 'Fechou! Tá tudo acertado.',
  'settle.pendingTab': 'Falta acertar ({n})',
  'settle.settledTab': 'Acertados ({n})',
  'settle.noSettledYet': 'Nenhum acerto concluído ainda.',
  'settle.nothingToSettleYet': 'Tá tudo certo por aqui.',
  'settle.settledTotalLabel': 'Total acertado',
  'settle.yourShareBoth': 'Você recebeu {received} · pagou {paid}',
  'settle.yourShareReceived': 'Você recebeu {amount}',
  'settle.yourSharePaid': 'Você pagou {amount}',
  'settle.noExpensesNotice': 'Essa resenha não tem nenhuma despesa lançada — esses valores vêm de um pagamento já confirmado, provavelmente de uma despesa que foi apagada depois.',
  'settle.noExpensesTag': 'Sem despesa na resenha — vem de um pagamento anterior',
  'settle.footerHint': 'Combina o pagamento no WhatsApp e depois volta aqui pra registrar.',
  'settle.recordReceiptTitle': 'Confirmar que recebi',
  'settle.recordReceiptBody': 'Confirma que {name} já te pagou {amount}? O saldo de vocês dois é acertado na hora.',
  'settle.confirmFailedTitle': 'Não deu pra confirmar',
  'settle.proofUploadFailedBody': 'Não deu pra enviar o comprovante. Tenta de novo.',
  'settle.confirmFailedInline': 'Não deu pra confirmar. Tenta de novo.',
  'settle.undoFailedInline': 'Não deu pra desfazer. Tenta de novo.',
  'settle.msgDebtorMarkedPaid': 'Oi, {name}! Acabei de te mandar {amount} da resenha. Quando cair, confirma pra mim? 🙌',
  'settle.msgDebtorPending': 'Oi, {name}! Tenho {amount} pra te pagar da resenha "{group}" 💸 Combinamos por aqui?',
  'settle.msgCreditorMarkedPaid': 'Oi, {name}! Vi que você marcou {amount} como pago. Vou conferir e já confirmo por aqui.',
  'settle.msgCreditorPending': 'Oi, {name}! Ainda ficaram {amount} da resenha "{group}". Te passo por aqui como acertar 😄',
  // Vai no fim da cobrança, e só dela: é a mensagem que promete "vou te passar
  // como acertar" logo acima. Quebra de linha dupla pro WhatsApp separar do
  // corpo — a chave precisa ficar isolada pra dar pra copiar de um toque só.
  'settle.msgPixSuffix': '\n\nMinha chave Pix ({type}): {key}',

  'confirmPaid.photoPermissionBody': 'Libera o acesso às fotos pra anexar o comprovante.',
  'confirmPaid.fileTooBigTitle': 'Foto grande demais',
  'confirmPaid.fileTooBigBody': 'O comprovante tem que ser menor que {mb} MB.',
  'confirmPaid.summaryLabel': 'Você vai marcar como pago',
  'confirmPaid.forPerson': 'pra {name}',
  'confirmPaid.proofLabel': 'Comprovante',
  'confirmPaid.proofExplain': 'Dá mais segurança pro {name} confirmar sem ficar em dúvida. Só vocês dois veem.',
  'confirmPaid.attachProof': 'Anexar comprovante',

  'transfer.confirmed': 'Confirmado',
  'transfer.markedPaidBy': '{name} marcou como pago',
  'transfer.waitingConfirm': 'Esperando {name} confirmar',
  'transfer.paysTo': 'paga pra',
  'transfer.paidTo': 'pagou pra',
  'transfer.viewProof': 'Ver comprovante',
  'transfer.payWithPix': 'PAGAR VIA PIX ({type})',
  'transfer.pixCopied': 'Chave copiada',
  // Cada lado diz o que FEZ, na primeira pessoa: quem deve, "Já paguei"; quem
  // recebe, "Já recebi". O credor usa o mesmo rótulo tenha ou não o devedor
  // marcado antes — pra ele o gesto é o mesmo, muda só o caminho por baixo.
  // O "Já" separa do botão de WhatsApp ao lado, que é combinar, não registrar.
  'transfer.marking': 'Registrando...',
  'transfer.markAsPaid': 'Já paguei',
  'transfer.undoMarkedPaid': 'Marquei sem querer',
  'transfer.confirmReceipt': 'Já recebi',

  'whatsappSheet.explain': 'A gente usa esse número pra abrir o WhatsApp quando alguém da resenha for falar com você sobre um acerto. Ele não aparece na lista de participantes.',
  'whatsappSheet.numberLabel': 'Número de telefone',
  'whatsappSheet.saveFailedTitle': 'Não deu pra salvar o WhatsApp',
  'whatsappSheet.removeFailedTitle': 'Não deu pra remover o número',
  'whatsappSheet.removeNumber': 'Remover número',

  'nameSheet.explain': 'É assim que a galera vê você nas resenhas — nos participantes, nas despesas e nos acertos.',
  'nameSheet.nameLabel': 'Seu nome',
  'nameSheet.placeholder': 'Como te chamam',
  'nameSheet.saveFailedTitle': 'Não deu pra salvar o nome',

  'pixSheet.explain': 'Essa chave aparece só pra quem tem acerto com você e pode ir junto nas mensagens do WhatsApp.',
  'pixSheet.typeLabel': 'Tipo',
  'pixSheet.keyLabel': 'Chave',
  'pixSheet.save': 'Salvar Pix',
  'pixSheet.removeKey': 'Remover chave',
  'pixSheet.saveFailedTitle': 'Não deu pra salvar a chave',
  'pixSheet.removeFailedTitle': 'Não deu pra remover a chave',
  'pixSheet.type.cpf': 'CPF',
  'pixSheet.type.email': 'E-mail',
  'pixSheet.type.phone': 'Celular',
  'pixSheet.type.random': 'Chave aleatória',
  'pixSheet.placeholder.cpf': '000.000.000-00',
  'pixSheet.placeholder.email': 'voce@email.com',
  'pixSheet.placeholder.phone': '(11) 98765-4321',
  'pixSheet.placeholder.random': 'Cole a chave do seu banco',

  'changePassword.subtitle': 'Pra sua segurança, confirma a senha atual e escolhe uma nova.',
  'changePassword.currentLabel': 'Senha atual',
  'changePassword.newLabel': 'Nova senha',
  'changePassword.confirmLabel': 'Confirmar nova senha',
  'changePassword.currentWrong': 'Senha atual incorreta.',
  'changePassword.sameAsCurrent': 'A nova senha precisa ser diferente da atual.',
  'changePassword.matches': 'As senhas batem.',
  'changePassword.noMatch': 'As senhas não batem ainda.',
  'changePassword.failedTitle': 'Não deu pra alterar a senha',

  'voice.emptyAudio': 'Não deu pra ouvir nada. Tenta falar mais perto do microfone.',
  'voice.emptyTranscript': 'Não deu pra entender. Tenta falar o valor, o que foi e com quem dividiu.',
  'voice.groupNotFound': 'Não deu pra confirmar a resenha.',
  'voice.understandFailed': 'Não deu pra entender o áudio.',

  'lancar.title': 'O que rolou?',
  'lancar.dictateAgain': 'Ditar de novo',
  'lancar.dictate': 'Falar despesa',
  'lancar.aiHint': 'Fala do seu jeito que a IA preenche pra você',
  'lancar.submitFailedTitle': 'Não deu pra lançar a despesa',
  'lancar.submit': 'Salvar despesa',

  'categoryPicker.title': 'Categoria da despesa',
  'categoryPicker.usageCountSingular': '{count} despesa',
  'categoryPicker.usageCountPlural': '{count} despesas',

  'falar.instructionsIdle': 'Conta o que rolou, quanto deu e com quem dividiu. Se quiser, fala também quem bancou, a data e se a despesa se repete. A IA preenche tudo pra você conferir.',
  'falar.instructionsRecording': 'Gravando… conta o que rolou. Toca em parar quando terminar.',
  'falar.instructionsProcessing': 'Transcrevendo e entendendo o que você falou…',
  'falar.micPermissionBody': 'Libera o acesso ao microfone pra lançar despesa por voz.',
  'falar.startRecording': 'Iniciar gravação',
  'falar.stopRecording': 'Parar gravação',
  'falar.processingA11y': 'Processando',
  'falar.exampleHint': 'Ex: "Churrasco 180 reais, o Léo bancou, dividido comigo e com a Ju"',
  'falar.premiumTitle': 'Recurso premium',
  'falar.premiumBody': 'Lançar despesa por voz é um recurso premium. A assinatura ainda não está disponível no app.',
  'falar.title': 'Falar despesa',
  'falar.understandFailedTitle': 'Não deu pra entender o áudio',

  'limitPaywall.rolesEyebrow': 'Tá rendendo, hein?',
  'limitPaywall.genericEyebrow': 'Só no Premium',
  'limitPaywall.titleSuffix': 'com Premium',
  'limitPaywall.rolesTitle': 'Resenhas ilimitadas',
  'limitPaywall.rolesSubtitle': 'Já tem 5 resenhas rolando. No Premium, pode criar quantas quiser.',
  'limitPaywall.voiceTitle': 'Lança falando',
  'limitPaywall.voiceSubtitle': 'Fala o gasto do seu jeito e a IA preenche a despesa pra você conferir.',
  'limitPaywall.batchSettleTitle': 'Tudo pra acertar num só lugar',
  'limitPaywall.batchSettleSubtitle': 'Vê quem você deve e quem te deve sem precisar abrir cada resenha.',
  'limitPaywall.exportTitle': 'Exportar insights',
  'limitPaywall.exportSubtitle': 'Leva sua resenha pra PDF ou CSV quando quiser.',
  'limitPaywall.recurringTitle': 'Despesas que repetem',
  'limitPaywall.recurringSubtitle': 'Lança uma vez e a gente repete pra você.',
  'limitPaywall.generalTitle': 'Libera tudo',
  'limitPaywall.generalSubtitle': 'Assina o Premium e deixa todos os recursos liberados.',
  // Estas oito chaves alimentam DUAS telas: o paywall pós-tour
  // (app/(pre-auth)/paywall.tsx) e o sheet de limite dentro do app
  // (components/LimitPaywallSheet.tsx). Mexer aqui muda as duas — que é o
  // objetivo, é a mesma oferta.
  //
  // O imperativo aqui é FORMAL ("Crie", "Veja", "Baixe", "Configure"),
  // diferente do resto do app, que usa "Toca no +", "Digita o código".
  'limitPaywall.benefit1': 'Resenhas ilimitadas',
  'limitPaywall.benefit1Desc': 'Cria e participa de quantas resenhas quiser.',
  // Esta chave era "Categorias inteligentes por IA" e virou insights — o
  // recurso de categoria por IA continua existindo (edge function
  // `categorize-expense`), só saiu da lista de venda.
  // Havia um `benefit2` aqui — "Entenda pra onde foi o dinheiro" — que vendia
  // a tela de insights. Ela é LIVRE: `isPremium` só aparece no botão de
  // download (app/(app)/grupo/insight.tsx), então quem assinasse por esse item
  // descobriria depois de pagar que já tinha. O que é pago ali é exportar, e
  // isso já era o `benefit5` — os dois viraram um só.
  'limitPaywall.benefit3': 'Lançar despesas com IA',
  'limitPaywall.benefit3Desc': 'Só fala a despesa e a gente registra tudo pra você.',
  'limitPaywall.benefit4': 'Todos os acertos num só lugar',
  'limitPaywall.benefit4Desc': 'Vê quem você deve e quem te deve em todas as resenhas, sem abrir uma por uma.',
  // Absorveu o antigo benefit2: por isso a descrição cita categoria e período,
  // que era o recorte que ele prometia.
  'limitPaywall.benefit5': 'Leva sua resenha com você',
  'limitPaywall.benefit5Desc': 'Exporta em PDF ou CSV o que a galera gastou, por categoria e período.',
  'limitPaywall.benefit6': 'Tudo que rolou, sem perder nada',
  'limitPaywall.benefit6Desc': 'Acompanha despesas, edições, entradas, saídas e acertos em ordem.',
  'limitPaywall.benefit7': 'Novidades do Premium',
  'limitPaywall.benefit7Desc': 'Novos recursos entram no seu plano assim que forem lançados.',
  'limitPaywall.benefit8': 'Despesas recorrentes',
  'limitPaywall.benefit8Desc': 'Configura uma vez e a gente repete no dia, semana, mês ou ano.',
  'limitPaywall.cta': 'Assinar Premium',
  'limitPaywall.dismiss': 'Agora não',
  'paywall.notAvailableYet': 'A assinatura ainda não está disponível no app.',
  'paywall.title': 'Deixa a resenha no [Premium]',
  'paywall.subtitle': 'Menos trabalho pra lançar, acompanhar e acertar tudo com a galera.',
  'paywall.planMonthly': 'Mensal',
  'paywall.planMonthlyNote': 'Cobrado mensalmente',
  'paywall.planAnnual': 'Anual',
  'paywall.planAnnualNote': '7 dias grátis',
  'paywall.planLifetime': 'Vitalício',
  'paywall.planLifetimeNote': 'Pague uma vez, é seu',
  'paywall.mostChosen': 'Mais escolhido',
  'paywall.trialHeading': 'Seus 7 dias grátis',
  'paywall.trialDay0': 'Hoje',
  'paywall.trialDay0Desc': 'Tudo liberado na hora.',
  'paywall.trialDay5': 'Dia 5',
  'paywall.trialDay5Desc': 'A gente te lembra antes da cobrança.',
  'paywall.trialDay7': 'Dia 7',
  'paywall.trialDay7Desc': 'A assinatura começa se você não cancelar.',
  'paywall.restore': 'Restaurar compras',
  // Sem "/ano" aqui: o preço do plano anual já vem com ele (ver PLANS em
  // paywall.tsx), senão sairia "R$ 89,90/ano/ano". O mensal continua com
  // "/mês" na frase porque o preço dele é só o número.
  'paywall.footerAnnual': '7 dias grátis · depois {price} · cancele quando quiser',
  'paywall.footerMonthly': '{price}/mês · cancele quando quiser',
  'paywall.footerLifetime': 'Pagamento único · sem renovação',
  'paywall.ctaTrial': 'Experimentar Premium grátis',
  'paywall.ctaLifetime': 'Comprar vitalício',

  'common.retry': 'Tenta de novo',
  'common.youCapitalized': 'Você',
  // "Sem categoria" e não "Outros": este rótulo aparece quando category_id é
  // NULO, e "Outros" é uma das 8 categorias de verdade — dizer "Outros" afirma
  // uma escolha que ninguém fez, e no Insight criava duas linhas com o mesmo
  // nome (a categoria Outros e o balde dos sem categoria).
  'common.categoryFallback': 'Sem categoria',

  'groupDetail.fallbackName': 'Resenha',
  'groupDetail.loadErrorTitle': 'Não deu pra carregar essa resenha.',
  'groupDetail.summaryErrorTitle': 'Não deu pra carregar o resumo.',
  'groupDetail.expensesErrorTitle': 'Não deu pra carregar as despesas.',
  'groupDetail.archiveFailedTitle': 'Não deu pra atualizar a resenha',
  'groupDetail.archiveNotSettledTitle': 'Falta acertar as contas',
  'groupDetail.archiveNotSettledBody': 'Ainda tem saldo pendente ou acerto esperando confirmação nessa resenha. Resolve isso antes de arquivar.',
  // Sem "?": neste sheet o título NOMEIA a ação, o corpo explica e o botão
  // confirma — igual a "Sair da resenha". A pergunta era herança do Alert, onde o
  // título tinha que carregar a decisão sozinho.
  'groupDetail.archiveConfirmTitle': 'Arquivar resenha',
  'groupDetail.archiveConfirmBody': 'Ela some da sua lista de ativas, mas continua disponível em Arquivadas.',
  'groupDetail.archiveConfirmAction': 'Arquivar',
  'groupDetail.memberSingular': 'participante',
  'groupDetail.memberPlural': 'participantes',
  'groupDetail.lastActivity': '{members} · última atividade {time}',
  'groupDetail.netReceivable': 'Pra você receber',
  'groupDetail.netOwed': 'Pra você pagar',
  'groupDetail.netEven': 'Tá tudo certo por aqui',
  'groupDetail.netReceivableShort': 'a receber',
  'groupDetail.netOwedShort': 'você deve',
  'groupDetail.netEvenShort': 'quites',
  // "Bancou" e não "pagou": esse stat é o que saiu do seu bolso pro
  // estabelecimento, e o vizinho 'statPayable' é o que você deve pra galera.
  // Com os dois dizendo "pagar" na mesma linha, o mesmo verbo apontava pra
  // dinheiros que não conversam. Quem quita com uma pessoa segue sendo
  // "acerto" (ver 'history.titleSettlement' e a aba 'settle.settledTab').
  'groupDetail.statPaid': 'Você bancou',
  'groupDetail.statTotal': 'Total da resenha',
  'groupDetail.statReceivable': 'A receber',
  'groupDetail.statPayable': 'A pagar',
  'groupDetail.expenseCountSingular': '{count} despesa registrada nessa resenha.',
  'groupDetail.expenseCountPlural': '{count} despesas registradas nessa resenha.',
  // Curtos porque são os DOIS botões lado a lado no topo da resenha — rótulo
  // longo aqui quebra em duas linhas ou aperta o vizinho. O escopo já é dado
  // pela tela: dentro da resenha, "Acertar" só pode ser dessa resenha. Quem
  // precisa dizer o escopo é a Carteira, que atravessa várias
  // (`wallet.batchSettle`).
  'groupDetail.settleUp': 'Acertar',
  'groupDetail.viewBalances': 'Ver saldos',
  'groupDetail.tabResumo': 'Resumo',
  'groupDetail.tabDespesas': 'Despesas',
  'groupDetail.tabSaldos': 'Saldos',
  'groupDetail.tabHistorico': 'Atividade',
  'groupDetail.searchPlaceholder': 'Buscar por título, valor ou quem bancou',
  'groupDetail.expensesEmptyTitle': 'Nada lançado ainda',
  'groupDetail.expensesEmptyDefaultSubtitle': 'Toca no + e lança o que rolou.',
  'groupDetail.searchEmptyTitle': 'Nenhuma despesa encontrada',
  'groupDetail.searchEmptySubtitle': 'Tenta outro título, valor ou nome.',
  'offline.title': 'Sem internet',
  'offline.needsInternet': 'Esse recurso precisa de internet. Quando a conexão voltar, tenta de novo.',
  'offline.gateBody': 'O Resenha precisa de internet pra carregar seus dados. Quando a conexão voltar, você continua de onde parou.',

  // "Bancou" e não "pagou": aqui a linha narra DOIS dinheiros ao mesmo tempo —
  // o que saiu pro estabelecimento e o que se deve pra galera — e o mesmo verbo
  // pros dois é o que confundia. Ver a regra de vocabulário no CLAUDE.md.
  'groupDetail.paidByMeSubtitle': 'Você bancou · dividido entre {count}',
  'groupDetail.paidByOtherSubtitle': '{name} bancou · você deve {amount}',
  'groupDetail.paidByOtherNotInSubtitle': '{name} bancou · você tá fora',
  'groupDetail.balanceEven': 'tudo certo',
  'groupDetail.balanceLegend': 'Positivo é pra receber. Negativo é o que você tá devendo.',

  'history.emptyTitle': 'Ainda não rolou nada por aqui',
  'history.emptySubtitle': 'Despesas, acertos e entradas na resenha aparecem aqui.',
  'history.upgradeCta': 'Ver histórico completo com Premium',
  'history.titleExpenseCreated': '{actor} lançou {title}',
  'history.titleExpenseEdited': '{actor} editou {title}',
  'history.titleExpenseDeleted': '{actor} apagou {title}',
  'history.detailExpenseDeleted': '{amount} estornado dos saldos',
  'history.detailAmountChanged': 'Valor: {from} → {to}',
  'history.detailPaidByChanged': 'Quem bancou: {from} → {to}',
  'history.detailParticipantsChanged': 'Divisão alterada',
  'history.detailSplitChanged': 'Tipo de divisão alterado',
  'history.detailTitleChanged': 'Renomeada de "{from}"',
  'history.detailDateChanged': 'Data alterada',
  'history.detailSplitValuesChanged': 'Valores da divisão alterados',
  'history.detailSplitChangedFromTo': 'Divisão: {from} → {to}',
  'history.detailCategoryChanged': 'Categoria: {from} → {to}',
  'history.detailReceiptAdded': 'Anexou comprovante',
  'history.detailReceiptRemoved': 'Removeu o comprovante',
  'history.detailReceiptChanged': 'Trocou o comprovante',
  'history.detailRecurringOn': 'Passou a repetir',
  'history.detailRecurringOff': 'Parou de repetir',
  'history.detailSplitEqual': 'Dividido igualmente entre {n}',
  'history.detailSplitShares': 'Por partes — {list}',
  'history.detailSplitExact': 'Por consumo — {list}',
  'history.titleSettlement': '{from} acertou com {to}',
  'history.detailSettlementProof': 'Comprovante anexado',
  'history.detailSettlementConfirmed': 'Confirmado',
  'history.titleMemberJoined': '{actor} entrou na resenha',
  'history.detailMemberJoined': 'Pelo link de convite',
  'history.titleMemberLeftSelf': '{member} saiu da resenha',
  'history.detailMemberLeftSelf': 'Saiu por conta própria',
  'history.titleMemberLeftRemoved': '{member} foi removido da resenha',
  'history.detailMemberLeftRemoved': 'Removido por {actor}',
  'history.titleAdminGranted': '{member} virou admin',
  'history.detailAdminGranted': 'Promovido por {actor}',
  'history.titleAdminRevoked': '{member} deixou de ser admin',
  'history.detailAdminRevoked': 'Rebaixado por {actor}',
  'history.titleGroupEdited': '{actor} editou a resenha',
  'history.detailGroupNameAndAvatar': 'Nome e foto atualizados',
  'history.detailGroupName': 'Nome atualizado para {name}',
  'history.detailGroupAvatar': 'Foto atualizada',
  'history.detailGroupCurrency': 'Moeda atualizada para {currency}',
  'history.titleGroupCreated': '{actor} criou a resenha',
  'history.titleRecurrencePaused': '{actor} pausou a repetição de {title}',
  'history.titleRecurrenceResumed': '{actor} retomou a repetição de {title}',
  'history.titleRecurrenceEdited': '{actor} alterou a repetição de {title}',
  'history.detailRecurrencePaused': 'Não lança mais nada até alguém retomar',
  'history.detailRecurrenceRhythm': 'Agora: {rhythm}',
  'history.detailRecurrenceEndDate': 'Data de término alterada',

  'expenseDetail.title': 'Detalhe da despesa',
  'expenseDetail.couponLabel': 'CUPOM',
  'expenseDetail.loadErrorTitle': 'Não deu pra carregar essa despesa.',
  'expenseDetail.date': 'Data',
  'expenseDetail.paidBy': 'Quem bancou',
  'expenseDetail.splitType': 'Divisão',
  'expenseDetail.recurrenceHeader': 'REPETIÇÃO',
  'expenseDetail.recurrenceStartedOn': 'Começou em {date}',
  'expenseDetail.recurrenceNoEnd': 'sem término',
  'expenseDetail.recurrencePaused': 'Repetição pausada',
  // Título é afirmação, não pergunta: quem apertou "Salvar alterações" não
  // pediu esse sheet, então a primeira coisa a dizer é o FATO que o justifica.
  // O de apagar abre com pergunta porque lá o que se confirma é o ato.
  'expenseDetail.editScopeTitle': 'Essa despesa se repete',
  'expenseDetail.editScopeOnlyThis': 'Salvar só nesta',
  'expenseDetail.editScopeOnlyThisHint': 'As próximas continuam como estão',
  'expenseDetail.editScopeFuture': 'Salvar nesta e nas próximas',
  'expenseDetail.editScopeFutureHint': 'As próximas passam a ser lançadas assim',
  'expenseDetail.recurrenceUntil': 'até {date}',
  'expenseDetail.nextOccurrenceLabel': 'Próxima',
  // Rótulo da linha que diz onde ESTA despesa cai na série ("3ª de 12"). Era
  // "Ocorrência", que é a palavra mais de software do bloco inteiro.
  'expenseDetail.occurrenceLabel': 'Essa aqui',
  'expenseDetail.occurrenceOfTotal': '{ordinal} de {total}',
  'expenseDetail.recurrenceTotalLabel': 'Total',
  'expenseDetail.recurrenceFinished': 'Parou de repetir em {date}.',
  // As MESMAS três palavras do segmented de "Forma de divisão" no formulário
  // (expenseForm.modeEqual/Shares/Exact): é a mesma despesa em duas telas, tem
  // que ser o mesmo nome. Antes aqui era "Por partes"/"Valores exatos". O
  // onboarding é que diverge de propósito no modo exato — ver a nota lá.
  'expenseDetail.splitEqual': 'Igual',
  'expenseDetail.splitByShares': 'Partes',
  'expenseDetail.splitExact': 'Por consumo',
  'expenseDetail.peopleCountLabel': '{count} pessoas',
  'expenseDetail.partsSingular': '{n} parte',
  'expenseDetail.partsPlural': '{n} partes',
  'expenseDetail.splitWithHeader': 'DIVIDIDO COM',
  'expenseDetail.receiptHeader': 'COMPROVANTE',
  'common.paidTag': 'Bancou',
  'expenseDetail.viewReceipt': 'Ver',
  'expenseDetail.noReceipt': 'Sem comprovante anexado.',
  'expenseDetail.totalizerReceivable': 'Você tem a receber',
  'expenseDetail.totalizerOwed': 'Você deve',
  'expenseDetail.totalizerNotIncluded': 'Você ficou fora dessa divisão',
  'expenseDetail.edit': 'Editar',
  'expenseDetail.delete': 'Apagar',
  'lancar.categoryLabel': 'Categoria',
  'expenseDetail.editTitle': 'Editar despesa',
  'expenseDetail.saveChanges': 'Salvar alterações',
  'expenseDetail.deleteConfirmTitle': 'Apagar despesa',
  'expenseDetail.deleteConfirmBody': '"{title}" ({amount}) vai sumir pra todo mundo da resenha. Não dá pra desfazer.',
  'expenseDetail.deleteLastExpenseWarningTitle': 'Essa é a última despesa da resenha — depois de apagar, ela fica sem nenhuma. Mas:',
  'expenseDetail.deleteLastExpenseWarningLine': '{name} continua com {amount} pendente, de um pagamento já confirmado.',
  'expenseDetail.deleteAction': 'Apagar',
  'expenseDetail.deleteEndsSeries': 'Esta é a última despesa desta repetição, então ela acaba junto — nenhuma nova vai ser lançada.',
  'expenseDetail.deleteSeriesContinues': 'Esta despesa faz parte de uma repetição, e ela continua: a próxima vai ser lançada normalmente. Só quem criou a repetição ou um admin da resenha pode pará-la.',
  'expenseDetail.deleteScopeOnlyThis': 'Apagar só esta',
  'expenseDetail.deleteScopeOnlyThisHint': 'A repetição continua, e a próxima despesa é lançada normalmente',
  'expenseDetail.deleteScopeFuture': 'Apagar e parar de repetir',
  'expenseDetail.deleteScopeFutureHint': 'Pausa a repetição. As despesas anteriores ficam, e dá pra retomar depois',
  'expenseDetail.saveFailedTitle': 'Não deu pra salvar',
  'expenseDetail.deleteFailedTitle': 'Não deu pra apagar',

  'insight.eyebrow': 'Insights',
  'insight.loadErrorTitle': 'Não deu pra carregar os dados desta resenha.',
  // "Minha parte" e não "Só eu": o recorte mostra a SUA PARTE das despesas, não
  // as despesas que são suas. "Só eu" fazia ler como se o número tivesse que
  // bater com o total de tudo que você participa.
  'insight.scopeMe': 'Só eu',
  'insight.scopeGroup': 'Toda a resenha',
  'insight.periodMonth': 'Mês',
  'insight.periodYear': 'Ano',
  'insight.periodAll': 'Tudo',
  'insight.spentByMe': 'Sua parte',
  'insight.spentByGroup': 'Total da resenha',
  'insight.sinceBeginning': 'desde o começo',
  'insight.noPrevData': 'Sem dados do {period} anterior pra comparar.',
  'insight.periodWordYear': 'ano',
  'insight.periodWordMonth': 'mês',
  'insight.deltaEqual': 'igual ao {period} anterior',
  'insight.deltaMore': '{pct}% a mais que o {period} anterior',
  'insight.deltaLess': '{pct}% a menos que o {period} anterior',
  'insight.byCategory': 'Pra onde foi o dinheiro',
  'insight.categorySheetTotal': 'Total na categoria',
  'insight.categorySheetMyTotal': 'Sua parte na categoria',
  'insight.categorySheetRowSubtitle': '{name} bancou · {amount} no total',
  'insight.categorySheetCount': '{count} despesas',
  'insight.categorySheetCountSingular': '{count} despesa',
  // ÚNICO vazio com texto: tem despesa, só não no mês/ano escolhido. Aqui
  // existe saída — trocar o período —, e a pessoa não adivinha sozinha.
  //
  // Resenha sem despesa nenhuma não mostra texto: o R$ 0,00 do topo já diz, e
  // repetir em prosa é a mesma informação duas vezes. Havia um par
  // `emptyTitle`/`emptySubtitle` pra esse caso; saiu junto.
  'insight.emptyPeriodTitle': 'Nada nesse período',
  'insight.emptyPeriodSubtitle': 'Troca o mês ou o ano pra ver as outras despesas.',
  'insight.percentOfTotal': '{pct}% do total',
  'insight.groupFallback': 'Resenha',
  'insight.exportButtonLabel': 'Exportar',
  'insight.exportTitle': 'Levar esses dados com você',
  'insight.exportSubtitleCount': '{count} despesas · {period}',
  'insight.exportEmptyMessage': 'Sem despesas no período — nada pra exportar.',
  'insight.exportCsvTitle': 'CSV (planilha)',
  'insight.exportCsvDesc': 'Abre no Excel ou Google Sheets. Inclui todos os dados da resenha.',
  'insight.exportPdfTitle': 'PDF (resumo visual)',
  'insight.exportPdfDesc': 'Bom pra mandar no WhatsApp ou guardar o fechamento da resenha.',
  'insight.exportErrorTitle': 'Não deu pra exportar agora',
  'insight.exportErrorBody': 'Tenta de novo.',
  'insight.csvHeaderDate': 'Data',
  'insight.csvHeaderDescription': 'Descrição',
  'insight.csvHeaderCategory': 'Categoria',
  'insight.csvHeaderPaidBy': 'Quem pagou',
  'insight.csvHeaderAmount': 'Valor',
  'insight.csvHeaderParticipants': 'Participantes',
  'insight.csvHeaderMyShare': 'Minha parte',
  'insight.pdfExpensesTitle': 'Despesas',

  'saldoDetail.loadErrorTitle': 'Não deu pra carregar esse participante.',
  'saldoDetail.meSuffix': '{name} (você)',
  'saldoDetail.balanceLabel': 'Saldo na resenha',
  'saldoDetail.twoNames': '{a} e {b}',
  'saldoDetail.moreNames': '{a}, {b} e outras pessoas',
  'saldoDetail.meBothLabel': 'Você tem a receber e a pagar',
  'saldoDetail.meReceiveLabel': 'Você tem a receber de {names}',
  'saldoDetail.meOweLabel': 'Você deve pra {names}',
  'saldoDetail.noneLabel': 'Sem pendências',
  'saldoDetail.otherBothLabel': '{name} tem a receber e a pagar',
  'saldoDetail.otherReceiveLabel': '{name} tem a receber de {names}',
  'saldoDetail.otherOweLabel': '{name} deve pra {names}',
  'saldoDetail.chargeMessage': 'Oi, {name}! Ficou *{amount}* pra você nessa resenha 🙏',
  'saldoDetail.payMessage': 'Oi, {name}! Vou te mandar *{amount}* dessa resenha 🙏',
  // Mesmo título e mesma pergunta do sheet equivalente no Acertar contas.
  'saldoDetail.confirmReceiveTitle': 'Registrar recebimento',
  'saldoDetail.confirmReceiveBody': 'Confirma que {name} já te pagou {amount}? O saldo de vocês dois é acertado na hora.',
  'saldoDetail.recordFailedTitle': 'Não deu pra registrar',
  'saldoDetail.removeConfirmTitle': 'Remover participante',
  'saldoDetail.removeConfirmBody': 'Remover {name} da resenha?',
  'saldoDetail.removeAction': 'Remover',
  'saldoDetail.removeFailedTitle': 'Não deu pra remover',
  'saldoDetail.relatedPeopleHeader': 'Pessoas relacionadas',
  'saldoDetail.owesYou': 'Deve pra você',
  'saldoDetail.owesOther': 'Deve pra {name}',
  'saldoDetail.meOwesTo': 'Você deve pra {name}',
  'saldoDetail.otherOwesTo': '{payer} deve pro {payee}',
  // Mesmos rótulos do card de transferência: quem recebe diz "Já recebi", e o
  // progresso é "Registrando...". Antes esta tela dizia "Marcar como recebido"
  // pro mesmo gesto.
  'saldoDetail.marking': 'Registrando...',
  'saldoDetail.markReceived': 'Já recebi',
  'saldoDetail.removing': 'Removendo...',
  'saldoDetail.removeFromGroup': 'Remover da resenha',

  'groupDetail.archiving': 'Arquivando...',
  'groupDetail.archiveBlockedReceivable': 'Ainda faltam {amount} pra você receber. Pede pra galera acertar antes de arquivar.',
  'groupDetail.archiveRecurrenceWarnTitle': 'AINDA TÁ REPETINDO',
  'groupDetail.archiveRecurrenceWarnSingular': 'Esta resenha tem 1 despesa que se repete e inclui você. Ela continua sendo lançada depois de a resenha ser arquivada, e seu saldo vai voltar a mudar.',
  'groupDetail.archiveRecurrenceWarnPlural': 'Esta resenha tem {count} despesas que se repetem e incluem você. Elas continuam sendo lançadas depois de a resenha ser arquivada, e seu saldo vai voltar a mudar.',
  'groupDetail.archiveBlockedOwe': 'Você ainda deve {amount} pra galera. Vai em "Saldos" e acerta antes de arquivar.',
  'groupDetail.recurringSingular': '1 despesa se repetindo',
  'groupDetail.recurringPlural': '{count} despesas se repetindo',
  'groupDetail.recurringNext': 'próximo lançamento em {date}',
  // "entra" e não "participa": é a mesma palavra do rateio no detalhe da
  // despesa ("Você não entrou no rateio"). Quem banca também "entra" — os dois
  // papéis mexem no saldo, e é isso que a linha responde.
  'groupDetail.recurringYouIn': 'Você entra em {count} de {total}',
  'groupDetail.recurringYouInOne': 'Você entra nessa',
  'groupDetail.recurringYouOut': 'Você não entra em nenhuma',
  'groupDetail.recurringYouOutOne': 'Você não entra nessa',

  'groupDetail.recurringSheetTitle': 'Despesas se repetindo',
  // Presente, não passado: a lista da resenha narra uma despesa que JÁ aconteceu
  // ("Bruno bancou"), aqui é um hábito que ainda vai acontecer. Mesmo verbo,
  // mesma estrutura — só o tempo muda.
  'groupDetail.recurringRowPaidByMe': 'Você banca · dividido entre {count}',
  'groupDetail.recurringRowPaidByOther': '{name} banca · você deve {amount}',
  'groupDetail.recurringRowNotIn': '{name} banca · você tá fora',
  'groupDetail.recurringRowRhythm': '{rhythm} · próxima em {date}',

  // Sobrevivente da tela de Recorrências que foi removida: o detalhe da despesa
  // usa esta frase pra explicar por que uma repetição pausada não anuncia
  // próximo lançamento.
  'recurrences.pausedHint': 'Não lança nada até alguém retomar',

  'participants.loadErrorTitle': 'Não deu pra carregar os participantes.',
  'participants.title': 'Participantes',
  'participants.countSingular': '{count} PARTICIPANTE',
  'participants.countPlural': '{count} PARTICIPANTES',
  'participants.adminTag': 'Admin',
  'participants.statusEven': 'tudo certo por aqui',
  'participants.statusReceivable': 'tem a receber {amount}',
  'participants.statusOwing': 'tá devendo {amount}',
  'participants.leaveGroup': 'Sair da resenha',
  'participants.leaveLegendOwner': 'Pra sair, seu saldo precisa estar zerado. Se você for o único admin, quem entrou primeiro assume no seu lugar. A resenha só é apagada se só tiver você nela.',
  'participants.leaveLegendMember': 'Pra sair, seu saldo precisa estar zerado.',

  'expenseForm.modeEqual': 'Igual',
  'expenseForm.modeShares': 'Partes',
  'expenseForm.modeExact': 'Por consumo',
  'expenseForm.sectionEqual': 'Dividir com',
  'expenseForm.sectionShares': 'Quantas partes cada um paga',
  'expenseForm.sectionExact': 'Quanto cada um deve',
  'expenseForm.today': 'Hoje',
  'expenseForm.yesterday': 'Ontem',
  'expenseForm.description': 'Descrição',
  'expenseForm.descriptionPlaceholder': 'Ex: Hambúrguer',
  'expenseForm.dateSheetTitle': 'Data da despesa',
  'expenseForm.paidBy': 'Quem bancou',
  'expenseForm.paidBySheetTitle': 'Quem bancou?',
  // Rótulo da CHAVE, não de uma ação a executar: vale igual pra despesa que
  // ainda não repete (ligar cria) e pra que já repete (desligar pausa). O
  // "Tornar recorrente" de antes dizia "vire isso" pra algo que já era.
  'expenseForm.makeRecurring': 'Fazer repetir',
  'expenseForm.recurringSummaryDaily': 'Repete todo dia',
  'expenseForm.recurringSummaryWeekly': 'Repete toda semana',
  'expenseForm.recurringSummaryMonthly': 'Repete todo mês',
  'expenseForm.recurringSummaryYearly': 'Repete todo ano',
  'expenseForm.recurringSummaryCustom': 'Repete a cada {days} dias',
  'expenseForm.tapToEdit': 'toca pra editar',
  'expenseForm.recurringCancelPending': 'Vai pausar ao salvar · toca pra desfazer',
  'expenseForm.recurrenceTitle': 'Essa despesa se repete?',
  'expenseForm.recurrenceConfirm': 'Pronto',
  // As opções são as MESMAS palavras do resumo que aparece na linha fechada
  // ("Repete todo mês"), então escolher e conferir usam o mesmo vocabulário.
  // Antes a opção dizia "Mensalmente" e a linha logo acima, "Repete todo mês".
  'expenseForm.recurrenceFrequencyLabel': 'FREQUÊNCIA',
  'expenseForm.recurrenceDaily': 'Todo dia',
  'expenseForm.recurrenceWeekly': 'Toda semana',
  'expenseForm.recurrenceMonthly': 'Todo mês',
  'expenseForm.recurrenceYearly': 'Todo ano',
  'expenseForm.recurrenceCustom': 'Personalizado',
  'expenseForm.recurrenceStart': 'Início',
  'expenseForm.recurrenceSetEndDate': 'Escolher quando termina',
  'expenseForm.recurrenceIntervalLabel': 'A cada quantos dias?',
  'expenseForm.recurrenceHintDaily': 'Ex: café da manhã, estacionamento diário',
  'expenseForm.recurrenceHintWeekly': 'Ex: faxina, feira da semana, aula',
  'expenseForm.recurrenceHintMonthly': 'Ex: aluguel, internet, mensalidade',
  'expenseForm.recurrenceHintYearly': 'Ex: seguro do apê, IPVA, assinatura anual',
  'expenseForm.recurrenceHintCustom': 'Ex: quinzenal, a cada 3 meses',
  'expenseForm.upcomingTitle': 'Próximos lançamentos',
  'expenseForm.upcomingNone': 'Sem próximos lançamentos — a data de término já passou.',
  'expenseForm.upcomingNext': 'Próx',
  'expenseForm.upcomingLast': 'Última',
  'expenseForm.splitMethod': 'Forma de divisão',
  'expenseForm.dividedAmong': 'Dividido entre {count}',
  'expenseForm.eachShare': '{amount} cada',
  'expenseForm.sharesFooter': '{people} pessoas · {parts} partes no total',
  'expenseForm.exactProgress': '{distributed} de {total}',
  'expenseForm.exactOnPoint': 'no ponto ✨',
  'expenseForm.exactAutoPair': 'Muda o valor de uma pessoa e o outro se ajeita sozinho.',
  'expenseForm.exactOver': 'sobrou {amount}',
  'expenseForm.exactMissing': 'faltam {amount}',
  // Rótulo da seção. Substantivo como os vizinhos ("Descrição", "Categoria",
  // "Comprovante"); a chave logo abaixo é que diz o verbo, "Repetir".
  'expenseForm.recurrence': 'Repetição',
  // "Não foi possível carregar", e não "sem conexão": a URL do comprovante é
  // assinada na hora, e essa chamada pode falhar com o app perfeitamente online
  // (rede instável, assinatura expirada). Dizer "sem internet" aqui apontaria
  // pro culpado errado — e sem internet a pessoa nem chega nesta tela, porque a
  // parede sobe antes (components/OfflineGate.tsx).
  'expenseForm.receiptUnavailable': 'Não deu pra carregar o comprovante',
  'expenseForm.receipt': 'Comprovante',
  'expenseForm.attachReceipt': 'Anexar comprovante',
  'expenseForm.receiptGalleryPermissionBody': 'Libera o acesso às fotos pra escolher o comprovante.',

  'common.continue': 'Continuar',

  'auth.emailLabel': 'E-mail',
  'auth.emailPlaceholder': 'voce@email.com',
  'auth.passwordLabel': 'Senha',
  'auth.orContinueWith': 'ou continue com',
  'auth.googleButton': 'Continuar com Google',
  'auth.appleButton': 'Continuar com Apple',

  // A palavra entre colchetes sai destacada em amarelo — cada idioma escolhe
  // qual palavra marcar (ver app/(pre-auth)/onboarding.tsx).
  'onboarding.welcomeEyebrow': 'Tour rapidinho',
  'onboarding.welcomeTitle': 'Bora montar sua primeira [resenha]?',
  'onboarding.welcomeSubtitle': 'Em dois passos, você escolhe a resenha, define a divisão e já vê como tudo funciona.',
  'onboarding.welcomeItem1': 'Escolhe o tipo da resenha',
  'onboarding.welcomeItem2': 'Define como a galera divide',
  'onboarding.welcomeItem3': 'Vê a divisão acontecer na hora',
  'onboarding.welcomeCta': 'Começar',
  'onboarding.skip': 'Pular',
  'onboarding.stepBadge': '{current} de {total}',
  // Pergunta como alguém perguntaria de verdade, no mesmo registro do passo
  // seguinte ("Como costumam dividir?"). Uma versão anterior era "Que tipo de
  // resenha é o seu?", herdada de quando o grupo tinha outro nome, masculino.
  //
  // O subtítulo diz EXATAMENTE o que a resposta controla: `demoName` (o nome
  // sugerido) e `buildDemo` (as despesas de exemplo). Nada além disso muda.
  //
  'onboarding.typeTitle': 'Qual vai ser a resenha?',
  'onboarding.typeSubtitle': 'Escolhe o tipo e a gente deixa tudo no jeito pra você.',
  'onboarding.typeViagem': 'Viagem',
  'onboarding.typeViagemDesc': 'Praia, mochilão, road trip',
  'onboarding.typeRepublica': 'Casa',
  'onboarding.typeRepublicaDesc': 'Aluguel, mercado, contas',
  // ÚNICO lugar do app onde "rolê" sobrevive, e de propósito. Os quatro rótulos
  // deste passo nomeiam a OCASIÃO, não a entidade: viagem, casa, rolê, outro.
  // Nesse sentido "rolê" não disputa com "resenha" — quem responde "Rolê com a
  // galera" ganha uma resenha chamada "Resenha da galera", e as duas palavras
  // convivem porque significam coisas diferentes.
  //
  // O que continua proibido é "rolê" como nome do GRUPO ("seu rolê", "criar um
  // rolê"), que foi o que a renomeação de 277 lugares desfez. O guard em
  // tests/guards/invariants.test.ts abre exceção só pra esta chave — se a
  // palavra aparecer em qualquer outra, ele falha.
  //
  // "Resenha com a galera" ficou fora por outro motivo: repetia o título.
  'onboarding.typeGalera': 'Rolê com a galera',
  'onboarding.typeGaleraDesc': 'Bar, churras, aniversário',
  'onboarding.typeOutro': 'Outro',
  'onboarding.typeOutroDesc': 'Qualquer despesa pra dividir',
  // As duas promessas do subtítulo são verdade: a resposta vira
  // `default_split_type` da resenha (useOnboardingGroup passa em
  // `create_group_with_owner`) e o formulário deixa trocar por lançamento.
  'onboarding.splitTitle': 'E a conta, como vai ser?',
  'onboarding.splitSubtitle': 'Escolhe o jeito mais comum dessa resenha. Dá pra mudar em cada despesa depois.',
  // Estes três nomes DIVERGEM do segmented do formulário, que usa
  // "Igual/Partes/Exato". Aqui o card tem largura e descrição pra bancar a
  // palavra concreta; lá o mesmo modo também serve pra rachar aluguel 700/300,
  // que não é consumo de nada.
  'onboarding.splitEqual': 'Igual',
  'onboarding.splitEqualDesc': 'Todo mundo paga a mesma parte',
  'onboarding.splitExact': 'Por consumo',
  'onboarding.splitExactDesc': 'Cada um paga o que consumiu',
  'onboarding.splitShares': 'Por partes',
  'onboarding.splitSharesDesc': 'Uns entram com mais, outros com menos',
  // "Tudo certo!", e não "Pronto!": o passo 5 já usa "Pronto" no badge, e dois
  // marcos iguais no mesmo tour tiram o peso do segundo.
  'onboarding.previewBadge': 'Tudo certo!',
  'onboarding.previewTitle': 'Sua resenha tá pronta',
  // ATENÇÃO: esta tela é o passo 3 de 6 — ainda vêm a demo de voz e o
  // resultado. E a resenha só nasce DEPOIS do cadastro (useOnboardingGroup);
  // o convite logo abaixo está travado com "Após criar conta".
  'onboarding.previewSubtitle': 'Agora chama a galera e começa a lançar as despesas de verdade.',
  'onboarding.previewNewGroup': 'Nova resenha',
  'onboarding.previewSolo': 'Só você por enquanto · você é admin',
  // "Chame" (e não "Chama") é o único imperativo formal do app — o resto usa
  // "Toca no +", "Digita o código", "Combina o pagamento".
  'onboarding.previewInviteTitle': 'Chama a galera por:',
  'onboarding.previewInviteLocked': 'Após criar conta',
  'onboarding.previewInviteCode': 'Código',
  // ATENÇÃO: este botão NÃO conclui o tour — ele avança pro passo 4 (demo de
  // voz). O rótulo anterior, "Lançar primeira despesa", descrevia esse
  // destino.
  'onboarding.previewCta': 'Começar minha resenha',
  'onboarding.nameViagem': 'Resenha da praia',
  'onboarding.nameRepublica': 'Nossa casa',
  'onboarding.nameGalera': 'Resenha da galera',
  'onboarding.nameOutro': 'Minha primeira resenha',
  'onboarding.voiceBadge': 'Premium',
  'onboarding.voiceTitle': 'Só fala. A gente lança.',
  // ATENÇÃO, duas divergências conhecidas, mantidas a pedido:
  // 1. "Segura o botão" — a tela de voz real é toca-pra-gravar/toca-pra-parar
  //    (`falar.instructionsRecording`: "Toca em parar quando terminar").
  // 2. "a Resenha" — o CLAUDE.md diz que o app não se autodenomina.
  'onboarding.voiceSubtitle': 'Segura o botão, fala o que rolou e a gente preenche a despesa pra você.',
  'onboarding.voiceRecording': 'Gravando despesa…',
  'onboarding.voiceExampleLabel': 'Exemplo',
  'onboarding.demoViagem': 'Almoço na praia',
  'onboarding.demoRepublica': 'Mercado do mês',
  'onboarding.demoGalera': 'Conta do bar',
  'onboarding.demoOutro': 'Pedido do delivery',
  // Com a contração embutida ("na"/"no"), porque a frase agora é
  // "Paguei {amount} {title}" e cada título pede a sua: só "a conta do bar" é
  // feminino. Sem isso sairia "na o almoço na praia".
  'onboarding.demoViagemSpoken': 'no almoço na praia',
  'onboarding.demoRepublicaSpoken': 'no mercado do mês',
  'onboarding.demoGaleraSpoken': 'na conta do bar',
  'onboarding.demoOutroSpoken': 'no pedido do delivery',
  'onboarding.voiceMe': 'eu',
  'onboarding.voicePhraseEqual': 'Paguei {amount} {title}. Divide entre {people}',
  'onboarding.voicePhraseExact': 'Paguei {amount} {title}. Eu consumi {mine}, {others}',
  'onboarding.voiceAnd': 'e',
  'onboarding.voicePhraseShares': 'Paguei {amount} {title}. Eu entro com 2 partes e {others} com 1 cada',
  // Aparece DEPOIS da gravação simulada (ao entrar no passo o microfone grava
  // sozinho e o texto é `voiceRecording`), e o microfone daqui não responde a
  // toque — o convite a falar é figurado.
  'onboarding.voiceHint': 'Pode falar do seu jeito.',
  'onboarding.voiceCta': 'Ver a divisão',
  'onboarding.resultBadge': 'Pronto',
  // Fecha o arco de "conta" que atravessa o tour: "Bora rachar essa conta?" na
  // capa, "E a conta, como vai ser?" no passo 2, e aqui o resultado.
  'onboarding.resultTitle': 'Pronto. A conta tá rachada.',
  // Um subtítulo só, igual nos três modos — antes ele variava pra explicar os
  // números ("Você entrou com o dobro" em partes, onde a sua linha vale 2x a
  // dos outros). Essa explicação agora depende só da linha do card.
  //
  // "A Resenha" contraria a regra de não se autodenominar do CLAUDE.md;
  // mantido a pedido.
  'onboarding.resultSubtitle': 'Você lança a despesa e a gente calcula na hora quanto fica pra cada um.',
  'onboarding.resultSplitEqual': 'Dividido igualmente · {n} pessoas',
  'onboarding.resultSplitExact': 'Dividido por consumo · {n} pessoas',
  'onboarding.resultSplitShares': 'Dividido por partes · {n} pessoas',
  'onboarding.resultYou': 'Você',
  'onboarding.resultYourShare': 'sua parte {amount}',
  'onboarding.resultOwes': 'deve {amount}',
  'onboarding.resultYouReceive': 'Você vai receber',
  // Verdade conferida: o acerto em lote abre o WhatsApp com a mensagem pronta
  // (ver `batch.explain`).
  'onboarding.resultFootnote': 'Depois, você acerta com a galera pelo WhatsApp.',
  'onboarding.resultCta': 'Continuar',

  // Texto ÚNICO da intro: o título que ficava sobre a foto foi absorvido aqui.
  // Sem texto por cima, a imagem respira e o logo fica como âncora — e some o
  // problema de contraste de escrever sobre foto.
  //
  // As duas linhas da intro se COMPLEMENTAM, não se repetem: o título diz a
  // promessa (o quê, com quem) e o card diz a mecânica (como). Por isso "a
  // galera" aparece só no título — quando estava nos dois, a legenda era
  // paráfrase do título e a linha se perdia.
  'login.headline': 'RACHA A CONTA\nCOM A GALERA!',
  // Três tempos, no mesmo ritmo do "Bora rachar" logo abaixo. "O que rolou" é
  // a língua da resenha e amarra a palavra ao evento; "a gente faz a conta"
  // põe o app como parceiro, na voz que ele usa em todo lugar — nunca se
  // autodenomina, sempre "a gente".
  //
  // Sem enumerar caso de uso. Uma versão dizia "churras, viagem, casa", e três
  // exemplos com ponto final leem como limite — parecia que o app servia só
  // pra aquilo. Quem abre o leque é a mecânica, não a lista.
  //
  // Afirmativa até o fim. Outra tentativa fechava com "e ninguém sai devendo
  // sem saber": negativa no meio de afirmações, e o "sem saber" ficava sem
  // complemento — saber o quê?
  'login.cardCopy': 'Cria a resenha, lança o que rolou\ne a gente faz as contas.',
  'login.cta': 'Criar minha resenha',
  'login.haveAccount': 'Já tenho conta',

  'signup.title': 'Bora criar sua conta?',
  'signup.subtitle': 'É rapidinho. Depois você já entra na sua resenha.',
  'signup.nameLabel': 'Nome',
  'signup.namePlaceholder': 'Como a galera te chama',
  'signup.whatsappHelper': 'Usamos pra facilitar os acertos pelo WhatsApp. Seu número não aparece pra galera no app.',
  'signup.submitting': 'Enviando código...',
  'signup.submit': 'Criar conta e continuar',
  'signup.disclaimer': 'Ao continuar, você concorda com os termos de uso.',
  'signup.footerText': 'Já tem conta? ',
  'signup.footerLink': 'Entrar',
  'signup.errorAlreadyRegistered': 'Este e-mail já está cadastrado.',
  'signup.errorRateLimit': 'Você já pediu um código pra esse e-mail há pouco. Espera um pouquinho e tenta de novo.',
  'signup.errorGeneric': 'Não deu pra criar a conta. Tenta de novo.',
  // Falha no ENVIO do e-mail, não no cadastro. Não manda tentar de novo: o
  // gesto não tem como dar certo enquanto o envio estiver quebrado, e repetir
  // ainda esbarra no limite de e-mails do servidor.
  'signup.errorEmailSend': 'Não deu pra enviar o e-mail de confirmação. Já estamos vendo isso — tenta daqui a pouco.',

  'entrar.title': 'Entrar',
  'entrar.subtitle': 'Bom te ver de novo por aqui.',
  'entrar.submitting': 'Entrando...',
  'entrar.submit': 'Entrar',
  'entrar.forgotPassword': 'Esqueci minha senha',
  'entrar.errorEmptyFields': 'Preenche e-mail e senha.',
  'entrar.errorInvalidCredentials': 'E-mail ou senha incorretos.',
  'entrar.footerText': 'Novo por aqui? ',
  'entrar.footerLink': 'Criar conta',

  'recuperarSenha.title': 'Esqueceu a senha?',
  'recuperarSenha.subtitle': 'Sem estresse. Manda seu e-mail que a gente\nenvia um código.',
  'recuperarSenha.submitting': 'Enviando...',
  'recuperarSenha.submit': 'Enviar código',
  'recuperarSenha.errorGeneric': 'Não deu pra enviar o código. Tenta de novo.',
  'recuperarSenha.footerText': 'Lembrou? ',
  'recuperarSenha.footerLink': 'Voltar pro login',

  'novaSenha.title': 'Nova senha',
  'novaSenha.subtitle': 'Agora salva num lugar seguro pra não esquecer.',
  'novaSenha.newPasswordLabel': 'Nova senha',
  'novaSenha.confirmPasswordLabel': 'Confirmar senha',
  'novaSenha.matchValid': 'As senhas batem.',
  'novaSenha.matchInvalid': 'As senhas não batem ainda.',
  'novaSenha.submitting': 'Salvando...',
  'novaSenha.submit': 'Salvar nova senha',
  'novaSenha.errorDifferent': 'A nova senha precisa ser diferente da anterior.',
  'novaSenha.errorGeneric': 'Não deu pra salvar a senha. Tenta de novo.',

  'verificarCodigo.title': 'Confere seu e-mail',
  'verificarCodigo.subtitle': 'Enviamos um código de 6 dígitos para',
  'verificarCodigo.submitting': 'Conferindo...',
  'verificarCodigo.submit': 'Confirmar código',
  'verificarCodigo.resendIn': 'Reenviar em {seconds}s',
  'verificarCodigo.resend': 'Reenviar código',
  'verificarCodigo.changeEmail': 'Trocar e-mail',
  // Uma mensagem só: o servidor devolve o MESMO erro pra código errado e pra
  // código vencido (ver verificar-codigo.tsx). Ordem das ações pela chance:
  // errar um dígito é muito mais comum que deixar o código vencer.
  'verificarCodigo.errorInvalidOrExpired': 'Código inválido ou expirado. Confere os dígitos ou pede um novo.',
  'verificarCodigo.errorResendFailed': 'Não deu pra reenviar o código. Tenta de novo.',

  'senhaAlterada.title': 'Senha atualizada!',
  'senhaAlterada.subtitle': 'Tá tudo certo por aqui. Bora voltar pro app.',

  'avatar.title': 'Escolhe seu avatar',
  'avatar.subtitle': 'É assim que você vai aparecer por aqui.',
  'avatar.continuing': 'Continuando...',

  'bemVindo.title': 'Tudo pronto, {name}!',
  'bemVindo.subtitle': 'Sua conta tá confirmada. Agora é só rachar contas sem drama.',
  'bemVindo.cta': 'Ver minhas resenhas',
  'bemVindo.fallbackName': 'você',

  'passwordRules.length': '8+ caracteres',
  'passwordRules.upper': '1 maiúscula',
  'passwordRules.lower': '1 minúscula',
  'passwordRules.digit': '1 número',
  'errors.sessionInvalid': 'Sessão inválida',
  'errors.loadGroupsFailed': 'Não deu pra carregar as resenhas',
  'errors.loadGroupFailed': 'Não deu pra carregar a resenha',
  'errors.loadExpensesFailed': 'Não deu pra carregar as despesas',
  'errors.loadHistoryFailed': 'Não deu pra carregar o histórico',
  'errors.loadWalletFailed': 'Não deu pra carregar a carteira',
  'errors.loadExpenseFailed': 'Não deu pra carregar a despesa',
  'errors.loadBalancesFailed': 'Não deu pra calcular os saldos',
  'errors.loadProfileFailed': 'Não deu pra carregar o perfil',
  'errors.loadRecurrencesFailed': 'Não deu pra carregar as repetições',

  'groups.alreadyInGroup': 'Você já está nessa resenha.',
  'groups.invalidCodeInput': 'Digita um código de resenha válido.',
  'groups.codeNotFound': 'Esse código não corresponde a nenhuma resenha.',

  'expense.paymentFallbackTitle': 'Pagamento',

  'relativeTime.now': 'agora',
  'relativeTime.minutesAgo': 'há {n}min',
  'relativeTime.hoursAgo': 'há {n}h',
  'relativeTime.yesterday': 'ontem',
  'relativeTime.daysAgo': 'há {n} dias',
  'relativeTime.monthAgo': 'há {n} mês',
  'relativeTime.monthsAgo': 'há {n} meses',
  'relativeTime.yearAgo': 'há {n} ano',
  'relativeTime.yearsAgo': 'há {n} anos',

  'groups.archivedBadge': 'arquivada',
} as const;

export type TranslationKey = keyof typeof pt;

export function translate(_language: Language, key: TranslationKey, params?: Record<string, string | number>): string {
  let text: string = pt[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}
