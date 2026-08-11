import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import { CalendarDays, X } from 'lucide-react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BottomSheetModal } from './BottomSheetModal';
import { Switch } from './Switch';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { nextOccurrenceAfter, type RecurrenceConfig, type RecurrenceFreq } from '@/hooks/useExpenseForm';
import type { Language, TranslationKey } from '@/lib/i18n';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

const FREQ_OPTIONS: { key: RecurrenceFreq; labelKey: TranslationKey; hintKey: TranslationKey }[] = [
  { key: 'daily', labelKey: 'expenseForm.recurrenceDaily', hintKey: 'expenseForm.recurrenceHintDaily' },
  { key: 'weekly', labelKey: 'expenseForm.recurrenceWeekly', hintKey: 'expenseForm.recurrenceHintWeekly' },
  { key: 'monthly', labelKey: 'expenseForm.recurrenceMonthly', hintKey: 'expenseForm.recurrenceHintMonthly' },
  { key: 'yearly', labelKey: 'expenseForm.recurrenceYearly', hintKey: 'expenseForm.recurrenceHintYearly' },
  { key: 'custom', labelKey: 'expenseForm.recurrenceCustom', hintKey: 'expenseForm.recurrenceHintCustom' },
];

const UPCOMING_COUNT = 4;

// Teto da varredura que acha a última ocorrência — cobre diário por ~27 anos.
// Se estourar (término absurdamente longe), a prévia volta a mostrar só os
// primeiros chips, em vez de arriscar uma "última" errada.
const MAX_SCAN_STEPS = 10000;

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Só dia/mês/ano — comparar o instante cortava a última ocorrência, a que cai
// EXATAMENTE na data de término: as ocorrências herdam a hora da despesa
// (`new Date()`, com segundos) e o término escolhido no seletor vem com os
// segundos zerados, então a última ficava alguns segundos "depois" do término.
// O servidor compara em `date`, onde hora não existe — a
// prévia tem que casar com isso.
function isAfterDay(a: Date, b: Date): boolean {
  if (a.getFullYear() !== b.getFullYear()) return a.getFullYear() > b.getFullYear();
  if (a.getMonth() !== b.getMonth()) return a.getMonth() > b.getMonth();
  return a.getDate() > b.getDate();
}

type Upcoming = {
  /** Primeiras `count` ocorrências. */
  dates: Date[];
  /** Última ocorrência da série — só quando há término e ela não cabe em `dates`. */
  last: Date | null;
  /** Há ocorrência escondida entre o fim de `dates` e `last` — vale mostrar "…". */
  hasGap: boolean;
};

// Próximas `count` datas a partir de `start` (inclusive), respeitando o
// término quando houver — corta assim que uma data passaria do fim. Pula
// a data que coincidir com `seedDate` (a despesa sendo lançada agora, que já
// cobre esse dia) — espelha o mesmo pulo que o cron faz,
// senão a prévia mostraria "hoje" como se fosse uma cobrança nova.
//
// Quando há término, varre até o fim mesmo depois de encher os `count` chips,
// só pra saber onde a série acaba (`last`) — numa parcelada de 12x a pessoa
// precisa ver a data da última parcela, não só das 4 primeiras. Sem término a
// série é infinita: não há o que varrer além dos chips.
function computeUpcoming(start: Date, freq: RecurrenceFreq, intervalDays: number | undefined, endDate: Date | undefined, count: number, seedDate: Date, anchorDay: number): Upcoming {
  const dates: Date[] = [];
  let last: Date | null = null;
  let beyond = 0;
  let cur = new Date(start);
  let steps = 0;
  for (;;) {
    if (endDate && isAfterDay(cur, endDate)) break;
    if (!isSameDay(cur, seedDate)) {
      if (dates.length < count) dates.push(new Date(cur));
      else { last = new Date(cur); beyond++; }
    }
    if (!endDate && dates.length >= count) break;
    if (steps++ >= MAX_SCAN_STEPS) return { dates, last: null, hasGap: false };
    cur = nextOccurrenceAfter(cur, freq, intervalDays, anchorDay);
  }
  // `beyond === 1` significa que `last` é a única ocorrência além dos chips —
  // ela vai aparecer, então não há nada elidido pra justificar o "…".
  return { dates, last, hasGap: beyond > 1 };
}

// Com ano — sem isso, "Anualmente" (e "Personalizado" com intervalo grande)
// mostrava os 4 pills com o mesmo dia/mês, indistinguíveis entre si.
function shortDate(d: Date, language: Language): string {
  return d.toLocaleDateString(language, { day: '2-digit', month: 'short', year: '2-digit' });
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Data da despesa sendo lançada/editada — a 1ª ocorrência. Baliza o mínimo
   *  do campo "Início" (a 2ª ocorrência não pode ser antes dela). */
  expenseDate: Date;
  initial: RecurrenceConfig | null;
  onConfirm: (config: RecurrenceConfig) => void;
  /** false quando a recorrência já está ativa (editando depois de criada) —
   *  o "Início" vira só leitura, já que mudar o ritmo não deve reagendar a
   *  próxima cobrança já marcada (decisão do produto). */
  startEditable?: boolean;
};

// Sheet "Repetir" — empilha por cima do form de despesa já aberto (nested,
// ver BottomSheetModal.tsx) em vez de abrir um <Modal> novo.
export function RecurrenceSheet({ visible, onClose, expenseDate, initial, onConfirm, startEditable = true }: Props) {
  const { language, t } = useLanguage();
  const { colors, resolvedScheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [freq, setFreq] = useState<RecurrenceFreq>(initial?.freq ?? 'daily');
  const [intervalDays, setIntervalDays] = useState(initial?.intervalDays ? String(initial.intervalDays) : '');
  const intervalDaysNum = parseInt(intervalDays, 10) || 1;
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(!!initial?.endDate);

  // "Início"/"Término" nunca ficam guardados como estado corrigido depois por
  // efeito (isso deixava uma janela de atraso entre mudar frequência/data da
  // despesa e o valor de verdade se atualizar — dava pra abrir o seletor
  // nesse meio-tempo e ele nascer com a rodinha na posição antiga). Em vez
  // disso, tudo é SEMPRE recalculado direto no render; só existe estado pra
  // guardar a escolha manual, quando houver.
  const [manualStart, setManualStart] = useState<Date | null>(initial?.nextRunDate ?? null);
  const [manualEndDate, setManualEndDate] = useState<Date | null>(initial?.endDate ?? null);

  // O sheet nunca desmonta (só o conteúdo anima — ver BottomSheetModal), então
  // os useState acima só pegam o `initial` do primeiro mount. Se `initial`
  // mudar por fora enquanto o sheet está fechado (ex.: o Ditar despesa
  // preenche a recorrência depois que a tela já montou), o estado local fica
  // preso no valor antigo. Resincroniza toda vez que o sheet abre.
  useEffect(() => {
    if (!visible) return;
    setFreq(initial?.freq ?? 'daily');
    setIntervalDays(initial?.intervalDays ? String(initial.intervalDays) : '');
    setManualStart(initial?.nextRunDate ?? null);
    setManualEndDate(initial?.endDate ?? null);
    setHasEndDate(!!initial?.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // "Início" nunca pode ser antes da própria despesa — ela É a 1ª ocorrência,
  // não faz sentido a 2ª vir antes dela. Fora isso, pode ser qualquer data
  // (inclusive no passado): deixar em branco (= a data da despesa) faz a
  // materialização preencher cada dia entre a despesa e hoje; escolher uma
  // data mais adiante pula os dias intermediários — a pessoa decide.
  const startMinimum = useMemo(() => {
    const d = new Date(expenseDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [expenseDate]);

  const nextRunDate = manualStart ?? expenseDate;

  // Dia âncora da série. Escolha manual de "Início" manda:
  // é ela que define o dia das cobranças. Sem escolha manual, numa recorrência
  // já ativa vale a âncora que o servidor guarda — o `nextRunDate` de lá pode
  // estar grampeado num mês curto (âncora 31, próxima cobrança 28/02), e usar
  // o dia dele faria a prévia mostrar 28 onde o cron vai lançar 31.
  const anchorDay = manualStart?.getDate() ?? initial?.anchorDay ?? expenseDate.getDate();

  // Término não pode ser antes da 2ª cobrança — senão a "recorrência" só
  // dispararia uma vez, virando uma despesa normal disfarçada. Se a escolha
  // manual ficou inválida (ex.: trocou a frequência depois), volta pro
  // mínimo em vez de deixar uma data que não faz mais sentido.
  const endDateMinimum = nextOccurrenceAfter(nextRunDate, freq, intervalDaysNum, anchorDay);
  const endDate = manualEndDate && manualEndDate >= endDateMinimum ? manualEndDate : endDateMinimum;

  const upcoming = useMemo(
    () => computeUpcoming(nextRunDate, freq, intervalDaysNum, hasEndDate ? endDate : undefined, UPCOMING_COUNT, expenseDate, anchorDay),
    [nextRunDate, freq, intervalDaysNum, hasEndDate, endDate, expenseDate, anchorDay],
  );

  function formatDate(d: Date): string {
    return d.toLocaleDateString(language, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function handleConfirm() {
    onConfirm({
      freq,
      intervalDays: freq === 'custom' ? Math.max(1, intervalDaysNum) : undefined,
      nextRunDate,
      endDate: hasEndDate ? endDate : undefined,
      anchorDay,
    });
    onClose();
  }

  // O sheet nunca desmonta ao fechar (só o conteúdo interno do
  // BottomSheetModal anima pra fora — ver mounted/finishClose lá), então o
  // estado local sobreviveria de uma abertura pra outra se não for
  // resetado aqui. Cobre toda forma de fechar sem confirmar (X, toque no
  // fundo, botão voltar do Android), já que todas passam por `onClose`.
  function handleClose() {
    setFreq(initial?.freq ?? 'daily');
    setIntervalDays(initial?.intervalDays ? String(initial.intervalDays) : '');
    setManualStart(initial?.nextRunDate ?? null);
    setManualEndDate(initial?.endDate ?? null);
    setHasEndDate(!!initial?.endDate);
    setShowStartPicker(false);
    setShowEndPicker(false);
    onClose();
  }

  function handleStartChange(event: DateTimePickerEvent, date?: Date) {
    if (event.type === 'set' && date) setManualStart(date);
  }

  function handleEndChange(event: DateTimePickerEvent, date?: Date) {
    if (event.type === 'set' && date) setManualEndDate(date);
  }

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} nested>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('expenseForm.recurrenceTitle')}</Text>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
          <Text style={styles.confirmLabel}>{t('expenseForm.recurrenceConfirm')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>{t('expenseForm.recurrenceFrequencyLabel')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.freqRow}>
          {FREQ_OPTIONS.map(opt => {
            const active = freq === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.freqChip, active && styles.freqChipActive]}
                onPress={() => setFreq(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.freqChipLabel, active && styles.freqChipLabelActive]}>{t(opt.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={styles.freqHint}>{t(FREQ_OPTIONS.find(o => o.key === freq)!.hintKey)}</Text>

        {freq === 'custom' && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.rowLabel}>{t('expenseForm.recurrenceIntervalLabel')}</Text>
              <TextInput
                style={styles.intervalInput}
                keyboardType="number-pad"
                value={intervalDays}
                onChangeText={setIntervalDays}
                placeholder="7"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        )}

        <View style={styles.card}>
          {startEditable ? (
            <TouchableOpacity onPress={() => setShowStartPicker(v => !v)} activeOpacity={0.7}>
              <View style={styles.rowBetween}>
                <Text style={styles.rowLabel}>{t('expenseForm.recurrenceStart')}</Text>
                <Text style={styles.rowValue}>{formatDate(nextRunDate)}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.rowBetween}>
              <Text style={styles.rowLabel}>{t('expenseForm.recurrenceStart')}</Text>
              <Text style={styles.rowValue}>{formatDate(nextRunDate)}</Text>
            </View>
          )}
          {startEditable && showStartPicker && (
            <View style={styles.pickerCard}>
              <DateTimePicker
                value={nextRunDate}
                mode="date"
                display="spinner"
                minimumDate={startMinimum}
                onChange={handleStartChange}
                locale={language}
                themeVariant={resolvedScheme}
                textColor={colors.textPrimary}
              />
              <TouchableOpacity style={styles.pickerConfirmBtn} onPress={() => setShowStartPicker(false)} activeOpacity={0.7}>
                <Text style={styles.pickerConfirmLabel}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>{t('expenseForm.recurrenceSetEndDate')}</Text>
            <Switch value={hasEndDate} onValueChange={setHasEndDate} />
          </View>
          {hasEndDate && (
            <>
              <TouchableOpacity style={styles.endDatePill} onPress={() => setShowEndPicker(v => !v)} activeOpacity={0.7}>
                <Text style={styles.rowValue}>{formatDate(endDate)}</Text>
              </TouchableOpacity>
              {showEndPicker && (
                <View style={styles.pickerCard}>
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="spinner"
                    minimumDate={endDateMinimum}
                    onChange={handleEndChange}
                    locale={language}
                    themeVariant={resolvedScheme}
                    textColor={colors.textPrimary}
                  />
                  <TouchableOpacity style={styles.pickerConfirmBtn} onPress={() => setShowEndPicker(false)} activeOpacity={0.7}>
                    <Text style={styles.pickerConfirmLabel}>{t('common.confirm')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.upcomingCard}>
          <View style={styles.upcomingHeader}>
            <CalendarDays size={14} color={colors.primaryDark} strokeWidth={2.2} />
            <Text style={styles.upcomingHeaderLabel}>{t('expenseForm.upcomingTitle')}</Text>
          </View>
          {upcoming.dates.length === 0 ? (
            <Text style={styles.upcomingSentence}>{t('expenseForm.upcomingNone')}</Text>
          ) : (
            <View style={styles.upcomingChipsRow}>
              {upcoming.dates.map((d, idx) => (
                <View key={idx} style={[styles.upcomingChip, idx === 0 && styles.upcomingChipActive]}>
                  <Text style={[styles.upcomingChipLabel, idx === 0 && styles.upcomingChipLabelActive]}>
                    {idx === 0 ? `${t('expenseForm.upcomingNext')} · ${shortDate(d, language)}` : shortDate(d, language)}
                  </Text>
                </View>
              ))}
              {upcoming.hasGap && (
                <View style={styles.upcomingEllipsis}>
                  <Text style={styles.upcomingEllipsisLabel}>…</Text>
                </View>
              )}
              {upcoming.last && (
                <View style={styles.upcomingChip}>
                  <Text style={styles.upcomingChipLabel}>
                    {`${t('expenseForm.upcomingLast')} · ${shortDate(upcoming.last, language)}`}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  confirmBtn: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  confirmLabel: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  freqRow: {
    gap: spacing.sm,
  },
  freqChip: {
    paddingHorizontal: spacing.md,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  freqChipActive: {
    backgroundColor: colors.primary,
  },
  freqChipLabel: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  freqChipLabelActive: {
    color: colors.ink,
  },
  freqHint: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowLabel: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  rowValue: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  endDatePill: {
    alignSelf: 'flex-start',
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  pickerConfirmBtn: {
    alignSelf: 'stretch',
    height: 40,
    marginHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  pickerConfirmLabel: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.semibold,
    color: colors.ink,
  },
  intervalInput: {
    minWidth: 60,
    textAlign: 'right',
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.bold,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },

  // ── Próximos lançamentos ──────────────────────────────────────────────────────
  upcomingCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    gap: spacing.sm,
  },
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  upcomingHeaderLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upcomingSentence: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.regular,
    color: colors.textPrimary,
    lineHeight: fontSizes.bodySm * 1.4,
  },
  upcomingChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  upcomingChip: {
    paddingHorizontal: spacing.sm + 2,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  upcomingChipActive: {
    backgroundColor: colors.primary,
  },
  upcomingChipLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  upcomingChipLabelActive: {
    color: colors.ink,
  },
  // Sem pílula — o "…" marca as ocorrências omitidas, não é uma data.
  upcomingEllipsis: {
    height: 32,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingEllipsisLabel: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
});
