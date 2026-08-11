import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadReceipt, deleteReceipt } from '@/lib/receipt';
import type { TranslationKey } from '@/lib/i18n';
import type { ExpenseParticipantInput, SplitType } from './useExpenses';
import type { GroupMember } from './useGroup';
import type { ExpenseDetail } from './useExpense';

export type DividirTipo = 'igualmente' | 'por_valores' | 'valores_exatos';

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export type RecurrenceConfig = {
  freq: RecurrenceFreq;
  /** Só quando freq === 'custom' — "a cada N dias". */
  intervalDays?: number;
  /** Data da 2ª cobrança recorrente. Editável — por padrão é a própria data
   *  da despesa (deixa a materialização preencher cada ocorrência entre ela
   *  e hoje), mas o usuário pode adiantar pra pular ocorrências passadas. */
  nextRunDate: Date;
  endDate?: Date;
  /** Dia do mês que ancora a série (1-31), só pra monthly/yearly. Numa
   *  recorrência nova é o dia do próprio `nextRunDate`; editando uma já ativa
   *  vem do servidor (`anchor_day`), que pode diferir do `nextRunDate` atual
   *  quando a próxima cobrança caiu num mês curto (âncora 31, cobrança 28/02). */
  anchorDay?: number;
};

/** Soma meses posicionando no dia `anchorDay`, GRAMPEADO no último dia do mês
 *  destino — espelha `add_months_clamped`. A âncora é o dia
 *  original da série, não o dia de `from`: sem isso, uma vez que a cobrança
 *  fosse grampeada (29/01 → 28/02) o 29 se perdia e a série toda seguia em 28.
 *  O `setDate(1)` antes de trocar o mês evita o transbordo do `setMonth` no
 *  meio do caminho (31/01 + 1 mês daria 03/03). */
function addMonthsClamped(from: Date, months: number, anchorDay: number): Date {
  const next = new Date(from);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(anchorDay, lastDayOfMonth));
  return next;
}

/** Data da ocorrência seguinte à `from`, dado o ritmo da recorrência.
 *  `anchorDay` só importa em monthly/yearly; sem ele, ancora no dia de `from`
 *  (correto quando `from` é o início da série). */
export function nextOccurrenceAfter(from: Date, freq: RecurrenceFreq, intervalDays?: number, anchorDay?: number): Date {
  if (freq === 'monthly') return addMonthsClamped(from, 1, anchorDay ?? from.getDate());
  // 12 meses, não setFullYear — 29/02 é o mesmo caso: sem grampeamento o JS
  // transbordaria pra 01/03, e sem âncora nunca voltaria ao 29 nos bissextos.
  if (freq === 'yearly') return addMonthsClamped(from, 12, anchorDay ?? from.getDate());
  const next = new Date(from);
  if (freq === 'daily') next.setDate(next.getDate() + 1);
  else if (freq === 'weekly') next.setDate(next.getDate() + 7);
  else next.setDate(next.getDate() + Math.max(1, intervalDays ?? 1));
  return next;
}

const RECURRENCE_SUMMARY_KEYS: Record<Exclude<RecurrenceFreq, 'custom'>, TranslationKey> = {
  daily: 'expenseForm.recurringSummaryDaily',
  weekly: 'expenseForm.recurringSummaryWeekly',
  monthly: 'expenseForm.recurringSummaryMonthly',
  yearly: 'expenseForm.recurringSummaryYearly',
};

// Resumo mostrado sob o toggle "Tornar recorrente" quando já configurado (ex.:
// "Repete todo mês") — mesma config usada em lancar.tsx e despesa.tsx,
// centralizado aqui pra não duplicar. Sem o hint de toque — quem chama decide
// se é "toque pra remover" (config nova, ainda não salva) ou "toque pra
// editar" (recorrência já ativa), já que o toque faz coisas diferentes.
// Só freq e intervalo, e não o `RecurrenceConfig` inteiro: a tela de
// Recorrências precisa da mesma frase a partir da linha do banco, que não tem
// os `Date` do form. Chamadas com um RecurrenceConfig continuam valendo.
export function describeRecurrenceSummary(
  recurrence: { freq: RecurrenceFreq; intervalDays?: number | null },
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  if (recurrence.freq === 'custom') {
    return t('expenseForm.recurringSummaryCustom', { days: recurrence.intervalDays ?? 1 });
  }
  return t(RECURRENCE_SUMMARY_KEYS[recurrence.freq]);
}

const MAX_RECEIPT_MB = 5;

export const SPLIT_TYPE_MAP: Record<DividirTipo, SplitType> = {
  igualmente:     'equal',
  por_valores:    'shares',
  valores_exatos: 'exact',
};

export const DIVIDIR_TIPO_FROM_SPLIT: Record<SplitType, DividirTipo> = {
  equal:  'igualmente',
  shares: 'por_valores',
  exact:  'valores_exatos',
};

export function parseBRL(v: string): number {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}

export function formatAmountForInput(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Como o campo interpreta o que se digita.
 *
 *  `dinheiro` — entrada pelos centavos: cada tecla empurra um dígito pela
 *  direita e a máscara inteira é redesenhada (`0,05 → 0,50 → 5,00 → 50,00`).
 *  É o que permite a máscara ficar visível DURANTE a digitação: o cursor está
 *  sempre no fim, então nada é inserido no meio do número e nenhuma tecla se
 *  perde. Também elimina o separador da digitação — vírgula e ponto de milhar
 *  são desenhados pelo campo, nunca teclados.
 *
 *  `fator` — o multiplicador de `×` e `÷`, que não é dinheiro: "R$ 20,00 × 20"
 *  são vinte vezes, não vinte reais. Aqui não há máscara nem centavos
 *  implícitos ("2" é dois), e a vírgula é digitada à mão porque fator quebrado
 *  existe (`100 × 1,5`). Sem milhar neste modo, então o ponto pode voltar a
 *  valer como vírgula — útil em aparelho cujo teclado só oferece ponto. */
export type AmountEntryMode = 'dinheiro' | 'fator';

export function sanitizeAmountInput(text: string, modo: AmountEntryMode = 'dinheiro'): string {
  if (modo === 'fator') {
    const cleaned = text.replace(/[^\d.,]/g, '').replace(/\./g, ',');
    const [inteiro, ...resto] = cleaned.split(',');
    if (resto.length === 0) return inteiro;
    return `${inteiro},${resto.join('').slice(0, 2)}`;
  }
  const centavos = parseInt(text.replace(/\D/g, ''), 10);
  // Vazio pra zero, e não "0,00": assim há uma só representação de "nada" e o
  // placeholder reaparece em vez de um valor que parece preenchido.
  return centavos > 0 ? formatAmountForInput(centavos / 100) : '';
}

/** 'YYYY-MM-DD' do dia ESCOLHIDO, lido do relógio local — sem o
 *  `.toISOString()` nativo, que converte pro instante UTC e num fuso negativo
 *  (Brasil, EUA) faz o dia escolhido à noite virar o dia seguinte no banco. */
export function toDateOnlyString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Ano/mês/dia direto da string, sem passar por `new Date(iso)` (que trata o
 *  timestamp como instante UTC — uma despesa materializada nasce à meia-noite
 *  UTC, que em fuso negativo já vira o dia anterior no relógio local). */
function parseDateOnly(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

type UseExpenseFormParams = {
  members: GroupMember[];
  meId: string;
  groupId: string | undefined;
  /** Pré-seleção do tipo de divisão — só o estado inicial, o usuário sempre pode trocar. */
  initialSplitType?: SplitType;
  /** Despesa NOVA: os três modos de rateio nascem já divididos igualmente entre
   *  todo mundo (todos marcados / todos em 1x / todos com total÷N). Fica off na
   *  edição, onde o rateio vem do que foi salvo. */
  seedDefaults?: boolean;
};

/** Divide `total` igualmente entre os membros, em centavos, e joga a sobra em
 *  quem pagou.
 *
 *  O centavo precisa cair em ALGUÉM: R$ 100 entre 3 dá 33,33 três vezes = 99,99,
 *  e o form bloqueia o envio enquanto `restante` não é zero — um estado que não
 *  fecha nasceria inválido. Vai pra quem pagou porque é quem tem menos motivo
 *  pra reclamar do centavo a mais. */
function splitExactly(total: number, members: GroupMember[], paidById: string): Record<string, string> {
  const totalCents = Math.round(total * 100);
  // Sem valor ainda: campos vazios, pra o placeholder "0,00" aparecer em vez de
  // um zero que parece preenchido.
  if (members.length === 0 || totalCents <= 0) return {};

  const base = Math.floor(totalCents / members.length);
  const sobra = totalCents - base * members.length;
  const absorveId = members.some(m => m.id === paidById) ? paidById : members[0].id;
  return Object.fromEntries(members.map(m => [
    m.id,
    formatAmountForInput((base + (m.id === absorveId ? sobra : 0)) / 100),
  ]));
}

export function useExpenseForm({ members, meId, groupId, initialSplitType, seedDefaults }: UseExpenseFormParams) {
  const [valor,         setValor]         = useState('');
  const [descricao,     setDescricao]     = useState('');
  const [date,          setDate]          = useState(() => new Date());
  const [paidById,      setPaidById]      = useState(meId);
  const [dividirTipo,   setDividirTipo]   = useState<DividirTipo>(
    initialSplitType ? DIVIDIR_TIPO_FROM_SPLIT[initialSplitType] : 'igualmente',
  );
  const [selecionados,  setSelecionados]  = useState<string[]>([]);
  const [valoresExatos, setValoresExatos] = useState<Record<string, string>>({});
  const [focusedExatoId, setFocusedExatoId] = useState<string | null>(null);
  const [partes,        setPartes]        = useState<Record<string, number>>({});
  const [receiptPath,   setReceiptPath]   = useState<string | null>(null);
  const [receiptUri,    setReceiptUri]    = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [recurrence,    setRecurrence]    = useState<RecurrenceConfig | null>(null);

  useEffect(() => {
    if (!paidById && meId) setPaidById(meId);
  }, [meId, paidById]);

  // Os três modos de rateio nascem significando a MESMA coisa: dividido igual
  // entre todo mundo. Antes cada um partia de um lugar diferente (só o pagador
  // marcado / todos em zero / todos vazios), então trocar de modo mudava a
  // resposta e caía num form em branco — e o "por partes" nascia inválido, com
  // o envio bloqueado até tocar em cada pessoa uma vez.
  //
  // `members` chega pela query do rolê, então no primeiro render a lista está
  // vazia e não há o que semear — daí o efeito, e não um valor inicial.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seedDefaults || seeded.current || members.length === 0) return;
    seeded.current = true;
    // Não sobrescreve o que já existe: um rascunho de voz pode ter definido os
    // participantes antes dos membros chegarem.
    if (selecionados.length === 0) setSelecionados(members.map(m => m.id));
    setPartes(prev => (Object.keys(prev).length > 0
      ? prev
      : Object.fromEntries(members.map(m => [m.id, 1]))));
  }, [seedDefaults, members, selecionados.length]);

  // Mudou o TOTAL: o rateio exato recomeça dividido igual, por cima do que
  // estiver lá. Sobrescrever o que foi digitado à mão é deliberado — aqueles
  // valores foram escolhidos em cima de um total que já não vale.
  //
  // Foi uma versão anterior desta linha que guardava quais campos a pessoa
  // tinha tocado, pra preservá-los. Preservava, mas ao custo de um estado que
  // não aparece em lugar nenhum da tela: nada dizia quem estava travado e quem
  // não. Previsível ganhou de esperto.
  //
  // Marcar/desmarcar alguém tem o mesmo efeito do total: a divisão recomeça
  // entre quem sobrou. É a mesma troca de sempre — previsível em vez de esperto.
  //
  // Deps pelos IDS, e não pelos arrays: `members` sai de um useMemo sobre o
  // objeto do react-query, que troca de identidade a cada refetch
  // (useRefreshOnFocus) — com o array aqui, voltar pro app no meio do
  // preenchimento apagaria tudo. `paidById` fica de fora porque trocar quem
  // pagou não é mudar o total; só moveria o centavo da sobra, e não vale zerar
  // um rateio por causa disso.
  // Quem está de fato na despesa. A seleção vale pros três modos: no "Igual"
  // ela sempre valeu, e no "Exato" ela passou a mandar também — sem isso, tirar
  // alguém do rateio exato só dava apagando o campo, que ninguém descobre.
  const participantes = members.filter(m => selecionados.includes(m.id));
  const memberIdsKey = members.map(m => m.id).join(',');
  const selecionadosKey = [...selecionados].sort().join(',');
  useEffect(() => {
    if (!seedDefaults || members.length === 0) return;
    setValoresExatos(splitExactly(parseBRL(valor), participantes, paidById));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedDefaults, memberIdsKey, selecionadosKey, valor]);

  function loadFromExpense(expense: ExpenseDetail) {
    // Sempre o valor na moeda do rolê, mesmo em despesa antiga que guardou
    // `original_currency`/`original_amount`: o formulário não converte mais, e
    // carregar o valor original faria a edição gravar o número da moeda antiga
    // como se fosse da moeda do rolê.
    setValor(formatAmountForInput(expense.amount));
    setDescricao(expense.title);
    // Extrai ano/mês/dia direto da string, sem passar por new Date(iso) —
    // esse parse trata o timestamp como instante UTC; uma despesa
    // materializada nasce à meia-noite UTC, que em fuso negativo (Brasil,
    // EUA) já vira o dia anterior no relógio local.
    setDate(parseDateOnly(expense.date));
    setPaidById(expense.paidById);
    setDividirTipo(DIVIDIR_TIPO_FROM_SPLIT[expense.splitType]);
    setSelecionados(expense.participants.map(p => p.userId));
    setPartes(Object.fromEntries(
      expense.participants.filter(p => p.shares != null).map(p => [p.userId, p.shares as number]),
    ));
    setValoresExatos(Object.fromEntries(
      expense.participants.filter(p => p.exactAmount != null).map(p => [p.userId, formatAmountForInput(p.exactAmount as number)]),
    ));
    setReceiptPath(expense.receiptPath);
  }

  // A máscara é aplicada a cada tecla, então o campo mostra a mesma coisa
  // focado ou não — não há mais reformatação em foco/blur pra fazer.
  // O modo só varia no campo do total, que vira entrada de fator durante um
  // `×` ou `÷`; o rateio por valor exato é sempre dinheiro.
  function handleValorChange(text: string, modo: AmountEntryMode = 'dinheiro') {
    setValor(sanitizeAmountInput(text, modo));
  }

  function handleValorExato(id: string, text: string) {
    const digitado = sanitizeAmountInput(text);
    setValoresExatos(prev => {
      const next = { ...prev, [id]: digitado };
      // DOIS NA DESPESA: o outro é sempre o resto — único caso em que dá pra
      // recalcular sem chutar, e por isso o único que recalcula. Com 3+ nada se
      // move: "qual dos outros absorve" não tem resposta, e os números pulariam
      // debaixo do dedo de quem digita. Lá o "Restante" do rodapé assume.
      //
      // Conta os PARTICIPANTES, não o tamanho do rolê: um rolê de 4 rachando um
      // Uber entre 2 é exatamente onde o ajuste ajuda, e a versão anterior desta
      // linha olhava pro `members` e deixava esse caso de fora.
      const outro = participantes.length === 2 && selecionados.includes(id)
        ? participantes.find(m => m.id !== id)
        : undefined;
      if (outro) {
        const resto = Math.round((parseBRL(valor) - parseBRL(digitado)) * 100) / 100;
        next[outro.id] = resto > 0 ? formatAmountForInput(resto) : '';
      }
      return next;
    });
  }

  function toggleParticipant(id: string) {
    setSelecionados(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    // Quem entra na despesa entra valendo uma parte. Sem isto, marcar alguém no
    // "Partes" o deixaria em 0x — marcado e fora da conta ao mesmo tempo. Vale
    // pros três modos porque `partes` só é lido no Partes: os outros ignoram.
    setPartes(prev => (prev[id] ?? 0) >= 1 ? prev : { ...prev, [id]: 1 });
  }

  function incrementPartes(id: string) {
    setPartes(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  // Piso em 1, e não em 0: sair da despesa agora é desmarcar o check. Deixar o
  // stepper chegar a 0x daria dois jeitos de dizer a mesma coisa, e um deles
  // (0x marcado) mostraria a pessoa dentro da lista e fora da conta.
  function decrementPartes(id: string) {
    setPartes(prev => {
      const cur = prev[id] ?? 0;
      if (cur <= 1) return prev;
      return { ...prev, [id]: cur - 1 };
    });
  }

  // ── Derivado ─────────────────────────────────────────────────────────────────
  // `valor` é digitado NA MOEDA DO ROLÊ — não há mais seletor de moeda no
  // lançamento, então não há conversão: o que se digita é o total.
  //
  // Antes isto convertia a partir de uma `entryCurrency` que nascia da moeda do
  // PERFIL. Com o seletor fora e o símbolo exibido sendo o do rolê, um perfil
  // em outra moeda digitava 100, via "R$ 100" e gravava o valor convertido —
  // errado e silencioso.
  const totalNum          = parseBRL(valor);
  const countSel          = selecionados.length || 1;
  const shareValue        = totalNum > 0 ? totalNum / countSel : 0;
  // Só quem está marcado conta. Importa na EDIÇÃO, onde o rateio vem do que foi
  // salvo e nada recalcula sozinho: sem isto, desmarcar alguém deixava o valor
  // dele somando, o rodapé dizia "no ponto" e ele saía da despesa mesmo assim.
  const totalDistribuido  = participantes.reduce((sum, m) => sum + parseBRL(valoresExatos[m.id] ?? ''), 0);
  // Mesma razão do totalDistribuido: partes de gente desmarcada não entram no
  // divisor, senão o valor por parte encolheria por causa de quem está fora.
  const totalPartes       = participantes.reduce((sum, m) => sum + (partes[m.id] ?? 0), 0);
  const sharePerPart      = totalPartes > 0 ? totalNum / totalPartes : 0;
  const restante          = Math.round((totalNum - totalDistribuido) * 100) / 100;
  const progressPct       = totalNum > 0 ? Math.min(100, (totalDistribuido / totalNum) * 100) : 0;

  const descricaoOk     = descricao.trim().length >= 2;
  const participantesOk = dividirTipo === 'igualmente' ? selecionados.length > 0
    : dividirTipo === 'por_valores' ? totalPartes > 0
    : totalDistribuido > 0;
  const exatoOk    = dividirTipo !== 'valores_exatos' || restante === 0;
  const canSubmit  = descricaoOk && totalNum > 0 && participantesOk && exatoOk;

  function buildParticipants(): ExpenseParticipantInput[] {
    if (dividirTipo === 'valores_exatos') {
      // A marcação manda, e não só o valor: desmarcado não entra nem que tenha
      // sobrado número no campo (caso da edição, onde nada é recalculado).
      return participantes
        .map(m => ({ userId: m.id, exactAmount: parseBRL(valoresExatos[m.id] ?? '') }))
        .filter(p => p.exactAmount > 0);
    }
    if (dividirTipo === 'por_valores') {
      // Igual ao exato: quem está desmarcado não entra nem que tenha sobrado
      // contagem de partes no estado (caso da edição).
      return participantes
        .map(m => ({ userId: m.id, shares: partes[m.id] ?? 0 }))
        .filter(p => p.shares > 0);
    }
    return selecionados.map(userId => ({ userId }));
  }

  // ── Comprovante ──────────────────────────────────────────────────────────────
  // A escolha da fonte (câmera/galeria) mora em ExpenseFormFields.tsx, que tem
  // acesso ao `t()` — este hook só recebe o asset já escolhido e cuida do upload.
  async function handleComprovanteAsset(asset: ImagePicker.ImagePickerAsset) {
    if (!groupId) return;
    if (asset.fileSize && asset.fileSize > MAX_RECEIPT_MB * 1024 * 1024) {
      Alert.alert('Foto grande demais', `O comprovante tem que ser menor que ${MAX_RECEIPT_MB} MB.`);
      return;
    }

    try {
      setReceiptUri(asset.uri);
      setUploadingReceipt(true);
      const path = await uploadReceipt(groupId, asset.uri, asset.mimeType ?? 'image/jpeg', receiptPath);
      setReceiptPath(path);
    } catch (err) {
      setReceiptUri(null);
      Alert.alert('Não foi possível salvar o comprovante', err instanceof Error ? err.message : 'Tente de novo em instantes.');
    } finally {
      setUploadingReceipt(false);
    }
  }

  function handleRemoveComprovante() {
    const path = receiptPath;
    setReceiptPath(null);
    setReceiptUri(null);
    if (path) {
      deleteReceipt(path).catch(() => {});
    }
  }

  return {
    // estado
    valor, descricao, date, paidById, dividirTipo, selecionados, valoresExatos,
    focusedExatoId, partes, receiptPath, receiptUri, uploadingReceipt, recurrence,
    // setters
    // `setPaidById` é cru de novo: com todo mundo já marcado na divisão, trocar
    // de pagador não precisa mexer na seleção — e mexer seria pior, porque
    // desfaria quem a pessoa tirou de propósito.
    setValor, setDescricao, setDate, setDividirTipo, setPaidById,
    setSelecionados,
    setValoresExatos, setFocusedExatoId, setPartes, setReceiptUri, setRecurrence,
    // handlers
    handleValorChange, handleValorExato,
    toggleParticipant, incrementPartes, decrementPartes,
    handleComprovanteAsset, handleRemoveComprovante,
    loadFromExpense, buildParticipants,
    // derivado
    totalNum, shareValue, sharePerPart, totalPartes, totalDistribuido, restante, progressPct, canSubmit,
    splitType: SPLIT_TYPE_MAP[dividirTipo],
  };
}

export type ExpenseForm = ReturnType<typeof useExpenseForm>;
