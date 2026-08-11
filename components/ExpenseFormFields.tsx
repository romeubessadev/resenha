import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Check, ChevronDown, Plus, Minus, Image as ImageIcon, X, CloudOff } from 'lucide-react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { SplitMembersSkeleton } from '@/components/SplitMembersSkeleton';
import { Input } from '@/components/Input';
import { BottomSheetModal } from '@/components/BottomSheetModal';
import { CalculatorToolbar, type CalcOp } from '@/components/CalculatorToolbar';
import type { GroupMember } from '@/hooks/useGroup';
import { parseBRL, formatAmountForInput } from '@/hooks/useExpenseForm';
import type { ExpenseForm, DividirTipo } from '@/hooks/useExpenseForm';
import { useLanguage } from '@/hooks/useLanguage';
import type { Language, TranslationKey } from '@/lib/i18n';
import { formatMoney, CURRENCY_SYMBOL } from '@/lib/currencies';
import { buildPickImageTexts, pickImage } from '@/lib/imagePicker';
import { fontFamilies, fontSizes, spacing, radius, shadows, type ColorPalette } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

const MODE_LABEL_KEYS: Record<DividirTipo, TranslationKey> = {
  igualmente:     'expenseForm.modeEqual',
  por_valores:    'expenseForm.modeShares',
  valores_exatos: 'expenseForm.modeExact',
};

const SECTION_LABEL_KEYS: Record<DividirTipo, TranslationKey> = {
  igualmente:     'expenseForm.sectionEqual',
  por_valores:    'expenseForm.sectionShares',
  valores_exatos: 'expenseForm.sectionExact',
};

// Símbolo de conta, não o do teclado: "×" e "÷", não "*" e "/".
const OP_SYMBOL: Record<CalcOp, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

function applyOp(a: number, op: CalcOp, b: number): number {
  switch (op) {
    case '+': return a + b;
    // Despesa negativa não existe: subtrair demais para em zero, em vez de
    // deixar no campo um valor que o formulário recusaria em seguida.
    case '-': return Math.max(0, a - b);
    case '*': return a * b;
    // Dividir por zero devolveria Infinity e quebraria o campo — no-op.
    case '/': return b === 0 ? a : a / b;
  }
}

type Props = {
  members: GroupMember[];
  membersLoading?: boolean;
  form: ExpenseForm;
  /** Bloco de categoria — só o "Editar despesa" injeta, entre Descrição e
   *  Forma de divisão. Fica do lado de fora porque o "Nova despesa" não
   *  pergunta categoria (quem resolve é a IA, na fila). */
  categorySlot?: ReactNode;
  /** Linha "Tornar recorrente" — injetada aqui, e não depois do componente
   *  inteiro, pra o comprovante ficar por ÚLTIMO: anexar foto é a ação mais
   *  acessória do formulário e não deve separar dois campos da despesa.
   *  Mora nas telas porque cada uma trata a recorrência de um jeito (criar do
   *  zero no lançar; criar, cancelar ou alterar no editar). */
  recurrenceSlot?: ReactNode;
  /** false quando a despesa JÁ pertence a uma série: aí a seção não é uma
   *  escolha a fazer, é um estado que existe — e o "(opcional)" ao lado do
   *  título passaria a mentir. */
  recurrenceOptional?: boolean;
  /** A despesa TEM comprovante, mas ele está no Storage e não dá pra buscar
   *  agora (sem rede). Sem isto o formulário cairia no estado de anexar e diria
   *  que não há comprovante — mentira que convida a pessoa a substituir uma
   *  foto que ela nem consegue ver. Só o "Editar despesa" usa: no lançamento a
   *  foto acabou de ser escolhida e está sempre no aparelho. */
  receiptUnavailable?: boolean;
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Rótulo compacto do chip de data ("Hoje" / "Ontem" / "21 jul") — diferente
// do formato longo usado no seletor e na dica de câmbio.
function dateChipLabel(date: Date, language: Language, t: (key: TranslationKey) => string): string {
  const now = new Date();
  if (isSameDay(date, now)) return t('expenseForm.today');
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return t('expenseForm.yesterday');
  return date.toLocaleDateString(language, { day: '2-digit', month: 'short' });
}

export function ExpenseFormFields({ members, membersLoading, form, categorySlot, recurrenceSlot, recurrenceOptional = true, receiptUnavailable }: Props) {
  const {
    valor, descricao, date, paidById, dividirTipo, selecionados, valoresExatos,
    focusedExatoId, partes, receiptUri, uploadingReceipt,
    setDescricao, setDate, setDividirTipo, setValor,
    handleValorChange, handleValorExato,
    setPaidById, toggleParticipant, incrementPartes, decrementPartes,
    handleComprovanteAsset, handleRemoveComprovante, setFocusedExatoId,
    totalNum, shareValue, sharePerPart, totalPartes, totalDistribuido, restante, progressPct,
  } = form;

  const { language, t } = useLanguage();
  const { colors, resolvedScheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPayerPicker, setShowPayerPicker] = useState(false);

  // ── Calculadora do campo de valor ───────────────────────────────────────────
  // O estado da conta mora aqui, e não num hook próprio, porque só este
  // componente usa: é a mesma tela que desenha o valor, o preview e a barra.
  const [valorFocado, setValorFocado] = useState(false);
  const [calcBuffer, setCalcBuffer] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<CalcOp | null>(null);

  function handleCalcOperator(op: CalcOp) {
    // Operador com o campo vazio só troca a operação pendente — sem isso,
    // corrigir um "+" para "×" aplicaria a soma com zero antes.
    if (valor === '') {
      if (calcBuffer != null) setCalcOp(op);
      return;
    }
    const current = parseBRL(valor);
    setCalcBuffer(calcOp != null && calcBuffer != null ? applyOp(calcBuffer, calcOp, current) : current);
    setCalcOp(op);
    // Campo limpo pro segundo número; quem mostra o primeiro é o preview.
    setValor('');
  }

  function resolveCalc() {
    if (calcOp == null || calcBuffer == null) return;
    // "=" sem o segundo número devolve o que já estava no buffer (50 + = → 50).
    const result = valor === '' ? calcBuffer : applyOp(calcBuffer, calcOp, parseBRL(valor));
    // Arredonda no centavo antes de voltar pro campo: `0,1 + 0,2` em float não
    // é `0,3`, e daqui em diante isto é dinheiro, não resultado de conta.
    const cents = Math.round(result * 100);
    setValor(cents > 0 ? formatAmountForInput(cents / 100) : '');
    setCalcBuffer(null);
    setCalcOp(null);
  }

  // Sair do campo no meio da conta resolve o que estava pendente. Sem isso o
  // campo ficaria com o SEGUNDO número sozinho — "50 + 30" viraria "30,00" e o
  // 50 sumiria sem aviso.
  function handleValorBlurComCalc() {
    resolveCalc();
    setValorFocado(false);
  }

  // Conta em andamento, ou null quando não há nenhuma. Calculado uma vez porque
  // decide DUAS coisas: se a linha de preview aparece e de que lado fica o
  // símbolo da moeda — com conta pendente ele sobe pro preview, já que o número
  // grande de baixo passa a ser um operando solto, não um dinheiro.
  // Máscara cheia no buffer ("20,00") contra o operando cru ("20") logo abaixo:
  // o buffer é um valor ASSENTADO, e o de baixo está em digitação. Em × e ÷ o
  // segundo número nem é dinheiro, é fator — "20,00 × 20,00" não quer dizer
  // nada. Em + e − ele é dinheiro, e aí a assimetria é meia-verdade; vale pela
  // consistência com o R$, que também só aparece deste lado.
  const calcPreviewText = calcOp != null && calcBuffer != null
    ? `${formatAmountForInput(calcBuffer)} ${OP_SYMBOL[calcOp]}`
    : null;

  // Em × e ÷ o que se digita é quantas vezes, não quanto: o campo larga a
  // máscara e os centavos implícitos e passa a aceitar um número solto.
  const modoFator = calcOp === '*' || calcOp === '/';

  // Foco engorda o valor em 5%. Escala a LINHA inteira, e não só o número: com
  // `alignItems: 'baseline'` crescer só o input moveria a baseline e o símbolo
  // da moeda daria um pulo lateral junto.
  const valorScale = useSharedValue(1);
  useEffect(() => {
    valorScale.value = withTiming(valorFocado ? 1.05 : 1, { duration: 160 });
  }, [valorFocado, valorScale]);
  const valorScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: valorScale.value }] }));

  const payer = members.find(m => m.id === paidById);
  const payerLabel = payer ? (payer.isMe ? t('common.youCapitalized') : payer.name.split(' ')[0]) : t('expenseForm.paidBy');

  // O campo "quem pagou" fica no topo e sai da tela quando a lista de gente é
  // longa — justo quando a conta fica confusa. A etiqueta repete a informação
  // onde o olho está, e escancara o caso de quem pagou não estar marcado como
  // participante, que hoje passa batido e faz a divisão sair errada.
  const payerTag = <Text style={styles.payerTag}>{t('common.paidTag')}</Text>;

  // Só o dia importa — a despesa grava 'YYYY-MM-DD' e a ordenação dentro do
  // mesmo dia é por created_at. A hora que o picker nativo devolver (alguns
  // Android zeram pra 00:00:00 no modo "date") é descartada na serialização.
  function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type !== 'set' || !selectedDate) return;
    setDate(selectedDate);
  }

  async function handlePickComprovante() {
    const asset = await pickImage(buildPickImageTexts(t, {
      sourceTitle: t('expenseForm.receipt'),
      galleryPermissionBody: t('expenseForm.receiptGalleryPermissionBody'),
    }));
    if (asset) await handleComprovanteAsset(asset);
  }

  return (
    <>
      {/* Chips: data · quem pagou. Sem seletor de moeda — a despesa é sempre
          lançada na moeda do rolê, então não havia escolha a fazer aqui. */}
      <View style={styles.topChipsRow}>
        <TouchableOpacity style={styles.topChip} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Text style={styles.topChipLabel}>{dateChipLabel(date, language, t)}</Text>
          <ChevronDown size={13} color={colors.textSecondary} strokeWidth={2.2} />
        </TouchableOpacity>

        {members.length > 0 && (
          <TouchableOpacity style={[styles.topChip, styles.payerTopChip]} onPress={() => setShowPayerPicker(true)} activeOpacity={0.7}>
            <Text style={styles.topChipLabel} numberOfLines={1}>{payerLabel}</Text>
            <ChevronDown size={13} color={colors.textSecondary} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Valor */}
      <View style={styles.valorBlock}>
        {calcPreviewText != null && (
          <Animated.View
            // -4px, e não os -25 do padrão: é o "slide-in-from-top-1" do
            // handoff, um deslocamento de sugestão, não de entrada de tela.
            entering={FadeInUp.duration(160).withInitialValues({ transform: [{ translateY: -4 }] })}
            style={styles.calcPreviewRow}
          >
            <Text style={styles.valorPrefix}>{CURRENCY_SYMBOL}</Text>
            <Text style={styles.calcPreview}>{calcPreviewText}</Text>
          </Animated.View>
        )}
        <Animated.View style={[styles.valorRow, valorScaleStyle]}>
          {calcPreviewText == null && <Text style={styles.valorPrefix}>{CURRENCY_SYMBOL}</Text>}
          <TextInput
            style={[
              styles.valorInput,
              totalNum <= 0 && styles.valorInputVazio,
              // A largura mínima só existe pro placeholder (ver o estilo), e
              // por isso é dimensionada pelo placeholder que está em cena.
              valor === '' && (modoFator
                ? styles.valorPlaceholderFator
                : styles.valorPlaceholderDinheiro),
            ]}
            // Dinheiro nunca precisa de separador (a máscara é desenhada), mas
            // fator quebrado precisa — "100 × 1,5". decimal-pad cobre os dois.
            keyboardType="decimal-pad"
            value={valor}
            // "0,00" ao lado de um "×" sugere multiplicar por outro valor em
            // reais, quando o que se espera ali é um "2".
            placeholder={modoFator ? '0' : '0,00'}
            placeholderTextColor={colors.textSecondary}
            onChangeText={text => handleValorChange(text, modoFator ? 'fator' : 'dinheiro')}
            onFocus={() => setValorFocado(true)}
            onBlur={handleValorBlurComCalc}
          />
        </Animated.View>

      </View>

      {/* Fora do bloco do valor, que é centralizado: a barra ocupa a largura toda. */}
      {valorFocado && (
        <CalculatorToolbar
          activeOp={calcOp}
          onOperator={handleCalcOperator}
          onEquals={resolveCalc}
        />
      )}

      <BottomSheetModal visible={showDatePicker} onClose={() => setShowDatePicker(false)}>
        <View style={styles.dateSheetHeader}>
          <Text style={styles.dateSheetTitle}>{t('expenseForm.dateSheetTitle')}</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={8} activeOpacity={0.7}>
            <X size={22} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <DateTimePicker
          value={date}
          mode="date"
          display="spinner"
          onChange={handleDateChange}
          locale={language}
          style={styles.dateSpinner}
          themeVariant={resolvedScheme}
          textColor={colors.textPrimary}
        />
        <Button label={t('common.confirm')} onPress={() => setShowDatePicker(false)} />
      </BottomSheetModal>

      <BottomSheetModal visible={showPayerPicker} onClose={() => setShowPayerPicker(false)}>
        <View style={styles.dateSheetHeader}>
          {/* Chave própria, separada da do chip: aqui é pergunta ("Quem pagou?"),
              lá é rótulo do campo ("Quem pagou"). Mesma frase, pontuação
              diferente — juntar as duas coloca interrogação no chip. */}
          <Text style={styles.dateSheetTitle}>{t('expenseForm.paidBySheetTitle')}</Text>
          <TouchableOpacity onPress={() => setShowPayerPicker(false)} hitSlop={8} activeOpacity={0.7}>
            <X size={22} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.payerPickList}>
          {members.map(m => {
            const active = paidById === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.payerPickRow, active && styles.payerPickRowActive]}
                onPress={() => { setPaidById(m.id); setShowPayerPicker(false); }}
                activeOpacity={0.7}
              >
                <Avatar name={m.name} id={m.id} photoUrl={m.photoUrl ?? undefined} size={32} variant="colorful" />
                <Text style={styles.payerPickName}>{m.isMe ? t('common.youCapitalized') : m.name}</Text>
                {active && <Check size={18} color={colors.primaryDark} strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      {/* Descrição */}
      <Text style={styles.fieldLabel}>{t('expenseForm.description')}</Text>
      <Input
        placeholder={t('expenseForm.descriptionPlaceholder')}
        value={descricao}
        onChangeText={setDescricao}
        maxLength={40}
      />

      {categorySlot}

      {members.length > 0 ? (
        <>
          {/* Forma de divisão */}
          <Text style={styles.fieldLabel}>{t('expenseForm.splitMethod')}</Text>
          <View style={styles.segmented}>
            {(Object.keys(MODE_LABEL_KEYS) as DividirTipo[]).map(tipo => {
              const active = dividirTipo === tipo;
              return (
                <TouchableOpacity
                  key={tipo}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  onPress={() => setDividirTipo(tipo)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                    {t(MODE_LABEL_KEYS[tipo])}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Lista de rateio */}
          <Text style={styles.fieldLabel}>{t(SECTION_LABEL_KEYS[dividirTipo])}</Text>

          {dividirTipo === 'igualmente' && members.map(m => {
            const selected = selecionados.includes(m.id);
            const isPayer = m.id === paidById;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.capsuleRow, selected && styles.capsuleRowActive]}
                onPress={() => toggleParticipant(m.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkCircle, selected && styles.checkCircleActive]}>
                  {selected && <Check size={14} color={colors.ink} strokeWidth={2.5} />}
                </View>
                <Avatar name={m.name} id={m.id} photoUrl={m.photoUrl ?? undefined} size={28} variant="colorful" />
                <Text style={styles.capsuleName}>{m.isMe ? t('common.youCapitalized') : m.name}</Text>
                {isPayer && payerTag}
                {selected && totalNum > 0 && (
                  <Text style={styles.capsuleValue}>{formatMoney(shareValue)}</Text>
                )}
              </TouchableOpacity>
            );
          })}

          {dividirTipo === 'por_valores' && members.map(m => {
            const selected = selecionados.includes(m.id);
            const count = selected ? (partes[m.id] ?? 0) : 0;
            // Piso em 1x: quem sai da despesa sai pelo check, não zerando o
            // stepper (ver decrementPartes).
            const atFloor = count <= 1;
            return (
              <View key={m.id} style={[styles.capsuleRow, selected && styles.capsuleRowActive]}>
                <TouchableOpacity
                  style={styles.rowToggle}
                  onPress={() => toggleParticipant(m.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkCircle, selected && styles.checkCircleActive]}>
                    {selected && <Check size={14} color={colors.ink} strokeWidth={2.5} />}
                  </View>
                  <Avatar name={m.name} id={m.id} photoUrl={m.photoUrl ?? undefined} size={28} variant="colorful" />
                  <View style={styles.capsuleNameCol}>
                    <View style={styles.capsuleNameRow}>
                      <Text style={styles.capsuleName}>{m.isMe ? t('common.youCapitalized') : m.name}</Text>
                      {m.id === paidById && payerTag}
                    </View>
                    {selected && <Text style={styles.capsuleSub}>{formatMoney(count * sharePerPart)}</Text>}
                  </View>
                </TouchableOpacity>
                <View style={[styles.stepper, !selected && styles.stepperOff]}>
                  <TouchableOpacity
                    onPress={() => decrementPartes(m.id)}
                    hitSlop={8}
                    activeOpacity={0.7}
                    disabled={!selected || atFloor}
                    style={[styles.stepperBtnMinus, (!selected || atFloor) && styles.stepperBtnDisabled]}
                  >
                    <Minus size={14} color={!selected || atFloor ? colors.border : colors.textPrimary} strokeWidth={2.5} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{count}x</Text>
                  <TouchableOpacity
                    onPress={() => incrementPartes(m.id)}
                    hitSlop={8}
                    activeOpacity={0.7}
                    disabled={!selected}
                    style={styles.stepperBtnPlus}
                  >
                    <Plus size={14} color={colors.ink} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {dividirTipo === 'valores_exatos' && members.map(m => {
            const selected = selecionados.includes(m.id);
            // Desmarcado mostra vazio mesmo se sobrou valor no estado — é o caso
            // da edição, onde nada é redividido ao desmarcar.
            const raw = selected ? (valoresExatos[m.id] ?? '') : '';
            const focused = focusedExatoId === m.id;
            return (
              <View key={m.id} style={[styles.capsuleRow, selected && styles.capsuleRowActive]}>
                {/* Só a metade da esquerda alterna a participação — a linha
                    inteira não pode ser o botão como no "Igual", porque a
                    direita é um campo de texto e o toque nele é pra digitar. */}
                <TouchableOpacity
                  style={styles.rowToggle}
                  onPress={() => toggleParticipant(m.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkCircle, selected && styles.checkCircleActive]}>
                    {selected && <Check size={14} color={colors.ink} strokeWidth={2.5} />}
                  </View>
                  <Avatar name={m.name} id={m.id} photoUrl={m.photoUrl ?? undefined} size={28} variant="colorful" />
                  <View style={styles.capsuleNameRow}>
                    <Text style={styles.capsuleName}>{m.isMe ? t('common.youCapitalized') : m.name}</Text>
                    {m.id === paidById && payerTag}
                  </View>
                </TouchableOpacity>
                <Text style={styles.exatoPrefix}>{CURRENCY_SYMBOL}</Text>
                <TextInput
                  style={[styles.exatoInput, focused && styles.exatoInputFocused, !selected && styles.exatoInputOff]}
                  keyboardType="decimal-pad"
                  value={raw}
                  editable={selected}
                  placeholder="0,00"
                  placeholderTextColor={colors.textSecondary}
                  onChangeText={t => handleValorExato(m.id, t)}
                  onFocus={() => setFocusedExatoId(m.id)}
                  onBlur={() => setFocusedExatoId(prev => (prev === m.id ? null : prev))}
                />
              </View>
            );
          })}

          {/* Rodapé do modo */}
          {dividirTipo === 'igualmente' && (
            <Text style={styles.modeFooter}>
              {t('expenseForm.dividedAmong', { count: selecionados.length })}{totalNum > 0 ? ` · ${t('expenseForm.eachShare', { amount: formatMoney(shareValue) })}` : ''}
            </Text>
          )}
          {dividirTipo === 'por_valores' && (
            <Text style={styles.modeFooter}>{t('expenseForm.sharesFooter', { people: selecionados.length, parts: totalPartes })}</Text>
          )}
          {dividirTipo === 'valores_exatos' && (
            <>
              <View style={styles.exatoFooterRow}>
                <Text style={styles.modeFooter}>{t('expenseForm.exactProgress', { distributed: formatMoney(totalDistribuido), total: formatMoney(totalNum) })}</Text>
                <Text style={[
                  styles.exatoStatus,
                  restante === 0 && totalNum > 0 ? styles.exatoStatusOk : restante < 0 ? styles.exatoStatusOver : null,
                ]}>
                  {restante === 0 && totalNum > 0
                    ? t('expenseForm.exactOnPoint')
                    : restante < 0
                      ? t('expenseForm.exactOver', { amount: formatMoney(Math.abs(restante)) })
                      : t('expenseForm.exactMissing', { amount: formatMoney(restante) })}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[
                  styles.progressFill,
                  { width: `${progressPct}%` },
                  restante < 0 && styles.progressFillOver,
                ]} />
              </View>
              {/* Anuncia o recálculo automático em vez de deixar descobrirem.
                  Só existe no rolê de 2, que é o único tamanho onde ele roda —
                  sem esta linha, o mesmo modo se comportaria diferente conforme
                  o tamanho do rolê e nada na tela explicaria. */}
              {selecionados.length === 2 && (
                <Text style={styles.modeFooter}>{t('expenseForm.exactAutoPair')}</Text>
              )}
            </>
          )}
        </>
      ) : membersLoading ? (
        <SplitMembersSkeleton />
      ) : null}

      {/* O label mora aqui, e não no slot, porque as duas telas que passam
          recorrência passam a MESMA coisa — no slot ele viraria texto duplicado
          em lancar.tsx e despesa.tsx, livre pra divergir. O de categoria é o
          caso oposto e por isso fica na tela: só o "Editar despesa" tem. */}
      <Text style={styles.fieldLabel}>
        {t('expenseForm.recurrence')}
        {recurrenceOptional && <> <Text style={styles.optionalTag}>{t('common.optional')}</Text></>}
      </Text>

      {recurrenceSlot}

      {/* Comprovante — último de propósito: é a ação mais acessória do
          formulário, e anexar foto abre a galeria/câmera, tirando a pessoa do
          fluxo de preenchimento. */}
      <Text style={styles.fieldLabel}>
        {t('expenseForm.receipt')} <Text style={styles.optionalTag}>{t('common.optional')}</Text>
      </Text>

      {receiptUnavailable && !receiptUri ? (
        <View style={styles.receiptUnavailablePill}>
          <CloudOff size={16} color={colors.textSecondary} strokeWidth={1.8} />
          <Text style={styles.uploaderLabel}>{t('expenseForm.receiptUnavailable')}</Text>
        </View>
      ) : !receiptUri ? (
        <TouchableOpacity
          style={styles.uploaderPill}
          onPress={handlePickComprovante}
          activeOpacity={0.7}
          disabled={uploadingReceipt}
        >
          <ImageIcon size={20} color={colors.textSecondary} strokeWidth={1.8} />
          <Text style={styles.uploaderLabel}>{t('expenseForm.attachReceipt')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.receiptPreviewCard}>
          <Image source={{ uri: receiptUri }} style={styles.receiptPreviewImg} resizeMode="cover" />
          {uploadingReceipt && (
            <View style={styles.receiptPreviewOverlay}>
              <Spinner size={20} color={colors.white} />
            </View>
          )}
          <TouchableOpacity style={styles.receiptRemoveBtn} onPress={handleRemoveComprovante} hitSlop={8} activeOpacity={0.7}>
            <X size={16} color={colors.ink} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.receiptSwapBtn} onPress={handlePickComprovante} activeOpacity={0.7}>
            <ImageIcon size={14} color={colors.ink} strokeWidth={2} />
            <Text style={styles.receiptSwapLabel}>{t('common.swap')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  // ── Chips do topo ─────────────────────────────────────────────────────────────
  topChipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  topChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  payerTopChip: {
    flexShrink: 1,
    maxWidth: '45%',
  },
  topChipFlag: {
    fontSize: fontSizes.caption,
  },
  topChipLabel: {
    flexShrink: 1,
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },

  // ── Valor ─────────────────────────────────────────────────────────────────────
  valorBlock: {
    alignItems: 'center',
  },
  valorRow: {
    flexDirection: 'row',
    // Base, não centro: o símbolo tem metade da altura do número, e centrado
    // ele flutua no meio do corpo do algarismo em vez de assentar na linha.
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  // A conta em andamento ("R$ 50 +") acima do valor. Discreta de propósito: o
  // número grande continua sendo o segundo operando, que é o que se digita.
  calcPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  calcPreview: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  valorPrefix: {
    fontSize: fontSizes.h1Lg,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  valorInput: {
    fontSize: fontSizes.heroXl,
    fontFamily: fontFamilies.bold,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    padding: 0,
    // Sem minWidth aqui de propósito: com um piso maior que o texto, a caixa
    // sobra e o número — que o TextInput alinha à esquerda dentro dela — sai
    // do centro da linha. Com o "R$" ao lado isso mal aparecia; numa conta,
    // onde o símbolo sobe pro buffer e o número fica sozinho, ficava torto.
    // Quem precisa de piso é só o placeholder, nos dois estilos abaixo.
  },
  // Campo vazio: o que se vê é só o placeholder, e ele entra a 40% pra não
  // competir com um valor de verdade. Opacidade em vez de uma cor nova porque
  // `placeholderTextColor` não aceita o token com alfa.
  valorInputVazio: {
    opacity: 0.4,
  },
  // Um TextInput vazio tem largura intrínseca ~0 e engoliria o placeholder
  // inteiro, então ele precisa de um piso — dimensionado pelo texto que vai
  // mostrar, pra não sobrar caixa e desalinhar.
  valorPlaceholderDinheiro: {
    minWidth: 140, // "0,00" em heroXl
  },
  valorPlaceholderFator: {
    minWidth: 56, // "0"
    // Aqui o número está sozinho na linha (o "R$" subiu pro buffer), então o
    // resto da caixa é folga dos dois lados em vez de espaço depois do símbolo.
    textAlign: 'center',
  },
  conversionLine: {
    marginTop: spacing.xs,
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  conversionLineStrong: {
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },

  // ── Data ──────────────────────────────────────────────────────────────────────
  dateSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateSheetTitle: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  dateSpinner: {
    // O widget nativo (Android/iOS) não estica as colunas de dia/mês/ano pra
    // preencher a largura do container — com `width: 100%` ele fica esticado
    // mas o conteúdo continua grudado à esquerda. `alignSelf: 'center'` deixa
    // o picker na largura natural dele, centralizado no sheet.
    alignSelf: 'center',
  },

  // ── Fields ────────────────────────────────────────────────────────────────────
  fieldLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  optionalTag: {
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Quem pagou (picker) ───────────────────────────────────────────────────────
  payerPickList: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  payerPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payerPickRowActive: {
    backgroundColor: 'rgba(245,197,24,0.15)',
    borderColor: 'rgba(217,168,0,0.4)',
  },
  payerPickName: {
    flex: 1,
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },

  // ── Forma de divisão ──────────────────────────────────────────────────────────
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  segmentBtnActive: {
    backgroundColor: colors.background,
    ...shadows.card,
  },
  segmentLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: colors.textPrimary,
  },

  // ── Cápsulas de rateio ────────────────────────────────────────────────────────
  capsuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  capsuleRowActive: {
    backgroundColor: 'rgba(245,197,24,0.15)',
    borderColor: 'rgba(217,168,0,0.4)',
  },
  capsuleName: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  capsuleNameFlex: {
    flex: 1,
  },
  capsuleNameCol: {
    flex: 1,
  },
  capsuleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  // Mesmo rótulo do detalhe da despesa (grupo/despesa.tsx): texto puro em
  // verde, sem pílula. Um conceito, uma aparência — e sem fundo ele não
  // disputa atenção com o valor na mesma linha.
  payerTag: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  capsuleSub: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  capsuleValue: {
    marginLeft: 'auto',
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  // ── Partes: stepper ───────────────────────────────────────────────────────────
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Fora da despesa: o stepper continua na linha (pra ela não mudar de forma ao
  // marcar/desmarcar) mas apagado, e os dois botões vão desabilitados.
  stepperOff: {
    opacity: 0.35,
  },
  stepperBtnMinus: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnPlus: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.5,
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },

  // ── Exato: input por membro ───────────────────────────────────────────────────
  // Metade esquerda clicável das linhas de "Partes" e "Exato": mesmas medidas da
  // capsuleRow, pra ficar indistinguível de uma linha do modo "Igual" — a
  // diferença é só onde o toque termina, porque a direita tem controle próprio
  // (stepper ou campo de valor).
  rowToggle: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exatoPrefix: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  exatoInput: {
    minWidth: 60,
    textAlign: 'right',
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.bold,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  exatoInputFocused: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  // Fora da despesa: o campo continua ali (pra a linha não mudar de forma ao
  // marcar/desmarcar) mas apagado, e o `editable={false}` impede o toque.
  exatoInputOff: {
    opacity: 0.35,
  },

  // ── Rodapé do modo ────────────────────────────────────────────────────────────
  modeFooter: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  exatoFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  exatoStatus: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  exatoStatusOk: {
    color: colors.forest,
  },
  exatoStatusOver: {
    color: colors.coral,
  },
  progressTrack: {
    height: 1.5,
    borderRadius: radius.none,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressFillOver: {
    backgroundColor: colors.coral,
  },

  // ── Comprovante ───────────────────────────────────────────────────────────────
  // Mesma caixa do "anexar", mas sem borda tracejada e sem toque: tracejado
  // é convite pra ação, e aqui não há ação possível — a foto existe, só não
  // está alcançável agora.
  receiptUnavailablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  uploaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  uploaderLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  receiptPreviewCard: {
    height: 224,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surface,
  },
  receiptPreviewImg: {
    width: '100%',
    height: '100%',
  },
  receiptPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptRemoveBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptSwapBtn: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  receiptSwapLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
});
