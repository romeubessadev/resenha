// ═══════════════════════════════════════════════════════════════════════════
// text
//
// Monta título/corpo do push no idioma do destinatário. Deno é um runtime
// separado do bundle RN — não dá pra importar lib/i18n.ts direto (mesma
// razão pela qual format_brl foi duplicado em SQL em vez de compartilhado).
// Cobre os 11 eventos combinados com o usuário; cada `kind` sem builder
// correspondente devolve null (a function decide não enviar nada).
// ═══════════════════════════════════════════════════════════════════════════

export type Language = 'pt-BR' | 'en' | 'es';

export type PushMeta = {
  share?: number;
  prevShare?: number;
  isEdit?: boolean;
  amount?: number;
  role?: 'creditor' | 'debtor' | 'owner' | 'admin';
  balance?: number;
  creditorName?: string | null;
  nameChanged?: boolean;
  avatarChanged?: boolean;
  newName?: string;
  actorName?: string | null;
  groupName?: string | null;
  payerName?: string | null;
  groupCurrency?: string;
};

const FALLBACK_ACTOR: Record<Language, string> = { 'pt-BR': 'Alguém', en: 'Someone', es: 'Alguien' };
const LOCALE_BY_LANGUAGE: Record<Language, string> = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-ES' };

function money(amount: number | undefined, language: Language, currency: string): string {
  try {
    return new Intl.NumberFormat(LOCALE_BY_LANGUAGE[language], { style: 'currency', currency }).format(amount ?? 0);
  } catch {
    return `${currency} ${(amount ?? 0).toFixed(2)}`;
  }
}

export function buildPushText(kind: string, language: Language, meta: PushMeta): { title: string; body: string } | null {
  const actor = meta.actorName ?? FALLBACK_ACTOR[language];
  const payer = meta.payerName ?? FALLBACK_ACTOR[language];
  const group = meta.groupName ?? '';
  const currency = meta.groupCurrency ?? 'BRL';
  const amt = (v?: number) => money(v, language, currency);

  switch (kind) {
    case 'expense_you_owe':
      if (meta.isEdit) {
        return {
          'pt-BR': { title: `${actor} editou uma despesa no ${group}`, body: `Agora você deve ${amt(meta.share)} (era ${amt(meta.prevShare)})` },
          en: { title: `${actor} edited an expense in ${group}`, body: `Now you owe ${amt(meta.share)} (was ${amt(meta.prevShare)})` },
          es: { title: `${actor} editó un gasto en ${group}`, body: `Ahora debes ${amt(meta.share)} (antes ${amt(meta.prevShare)})` },
        }[language];
      }
      return {
        'pt-BR': { title: `Nova despesa em ${group}`, body: `Você deve ${amt(meta.share)} pra ${payer}` },
        en: { title: `New expense in ${group}`, body: `You owe ${amt(meta.share)} to ${payer}` },
        es: { title: `Nuevo gasto en ${group}`, body: `Debes ${amt(meta.share)} a ${payer}` },
      }[language];

    case 'expense_you_receive':
      if (meta.isEdit) {
        return {
          'pt-BR': { title: `${actor} editou uma despesa no ${group}`, body: `Agora você recebe ${amt(meta.share)} (era ${amt(meta.prevShare)})` },
          en: { title: `${actor} edited an expense in ${group}`, body: `Now you receive ${amt(meta.share)} (was ${amt(meta.prevShare)})` },
          es: { title: `${actor} editó un gasto en ${group}`, body: `Ahora recibes ${amt(meta.share)} (antes ${amt(meta.prevShare)})` },
        }[language];
      }
      return {
        'pt-BR': { title: `${actor} adicionou uma despesa`, body: `Você recebe ${amt(meta.share)} no ${group}` },
        en: { title: `${actor} added an expense`, body: `You receive ${amt(meta.share)} in ${group}` },
        es: { title: `${actor} agregó un gasto`, body: `Recibes ${amt(meta.share)} en ${group}` },
      }[language];

    case 'settle_paid_wait_confirm':
      return {
        'pt-BR': { title: `${actor} marcou que te pagou ${amt(meta.amount)}`, body: `${group} · aguardando sua confirmação` },
        en: { title: `${actor} marked they paid you ${amt(meta.amount)}`, body: `${group} · waiting for your confirmation` },
        es: { title: `${actor} marcó que te pagó ${amt(meta.amount)}`, body: `${group} · esperando tu confirmación` },
      }[language];

    case 'proof_attached':
      return {
        'pt-BR': { title: `${actor} anexou um comprovante`, body: `${group} · ${amt(meta.amount)}` },
        en: { title: `${actor} attached a receipt`, body: `${group} · ${amt(meta.amount)}` },
        es: { title: `${actor} adjuntó un comprobante`, body: `${group} · ${amt(meta.amount)}` },
      }[language];

    case 'settle_confirmed':
      return {
        'pt-BR': { title: `${actor} confirmou que recebeu`, body: `${group} · ${amt(meta.amount)}` },
        en: { title: `${actor} confirmed they received it`, body: `${group} · ${amt(meta.amount)}` },
        es: { title: `${actor} confirmó que recibió`, body: `${group} · ${amt(meta.amount)}` },
      }[language];

    case 'reminder_open_balance':
      if (meta.role === 'creditor') {
        return {
          'pt-BR': { title: `Você tem ${amt(meta.balance)} em aberto há 7 dias`, body: 'Que tal dar um toque?' },
          en: { title: `You have ${amt(meta.balance)} open for 7 days`, body: 'How about a nudge?' },
          es: { title: `Tienes ${amt(meta.balance)} pendiente hace 7 días`, body: '¿Le avisamos?' },
        }[language];
      }
      return {
        'pt-BR': {
          title: meta.creditorName ? `Você deve ${amt(meta.balance)} pra ${meta.creditorName} há 7 dias` : `Você deve ${amt(meta.balance)} há 7 dias`,
          body: 'Bora acertar?',
        },
        en: {
          title: meta.creditorName ? `You owe ${amt(meta.balance)} to ${meta.creditorName} for 7 days` : `You owe ${amt(meta.balance)} for 7 days`,
          body: 'Time to settle up?',
        },
        es: {
          title: meta.creditorName ? `Debes ${amt(meta.balance)} a ${meta.creditorName} hace 7 días` : `Debes ${amt(meta.balance)} hace 7 días`,
          body: '¿Arreglamos cuentas?',
        },
      }[language];

    case 'member_joined':
      return {
        'pt-BR': { title: `${actor} entrou no rolê`, body: group },
        en: { title: `${actor} joined the group`, body: group },
        es: { title: `${actor} se unió al grupo`, body: group },
      }[language];

    case 'member_left':
      return {
        'pt-BR': { title: `${actor} saiu do rolê`, body: group },
        en: { title: `${actor} left the group`, body: group },
        es: { title: `${actor} salió del grupo`, body: group },
      }[language];

    case 'admin_granted':
      return {
        'pt-BR': { title: `Você virou admin do ${group}`, body: '' },
        en: { title: `You're now an admin of ${group}`, body: '' },
        es: { title: `Ahora eres admin de ${group}`, body: '' },
      }[language];

    case 'admin_revoked':
      return {
        'pt-BR': { title: `Você não é mais admin do ${group}`, body: '' },
        en: { title: `You're no longer an admin of ${group}`, body: '' },
        es: { title: `Ya no eres admin de ${group}`, body: '' },
      }[language];

    case 'group_edited': {
      const both = meta.nameChanged && meta.avatarChanged;
      const bodyMap: Record<Language, string> = both
        ? { 'pt-BR': 'Nome e foto atualizados', en: 'Name and photo updated', es: 'Nombre y foto actualizados' }
        : meta.nameChanged
          ? { 'pt-BR': `Nome atualizado para ${meta.newName}`, en: `Name updated to ${meta.newName}`, es: `Nombre actualizado a ${meta.newName}` }
          : { 'pt-BR': 'Foto atualizada', en: 'Photo updated', es: 'Foto actualizada' };
      return {
        'pt-BR': { title: `${actor} editou o rolê ${group}`, body: bodyMap['pt-BR'] },
        en: { title: `${actor} edited the group ${group}`, body: bodyMap.en },
        es: { title: `${actor} editó el grupo ${group}`, body: bodyMap.es },
      }[language];
    }

    default:
      return null;
  }
}
