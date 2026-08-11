import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet } from 'react-native';
import { ChevronRight, Repeat, X } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { CategoryIcon } from './CategoryIcon';
import { useCategories, findCategory } from '@/hooks/useCategories';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import type { GroupMember } from '@/hooks/useGroup';
import type { GroupRecurrence } from '@/hooks/useGroupRecurrences';
import { getCategoryChipColor } from '@/lib/categoryColors';
import { formatMoney } from '@/lib/currencies';
import { parseDateOnly, rhythmLabel } from '@/lib/recurrence';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

// As séries que estão lançando sozinhas neste rolê, abertas pelo card do Resumo.
//
// O card diz que EXISTE algo se repetindo; este sheet diz o QUÊ, e principalmente
// se aquilo mexe no bolso de quem está olhando — sem ele a pessoa precisa caçar o
// ícone de repetição na lista de despesas pra descobrir em quais ela entra.
//
// Cada linha responde quatro perguntas na ordem em que elas doem: qual despesa é,
// quanto disso é meu, com que ritmo, e quando cai a próxima.

type Props = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  /** Só as séries ATIVAS — é o mesmo conjunto que o card do Resumo conta, e o
   *  que o título promete. Pausada e finalizada não estão se repetindo. */
  recurrences: GroupRecurrence[];
  members: GroupMember[];
  /** Abre a ocorrência mais recente da série. Nunca chamado pra série sem
   *  nenhuma ocorrência viva — não existe despesa pra abrir. */
  onSelectExpense: (expenseId: string) => void;
};

export function RecurringExpensesSheet({ visible, onClose, onClosed, ...rest }: Props) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose} onClosed={onClosed}>
      <SheetBody onClose={onClose} {...rest} />
    </BottomSheetModal>
  );
}

type BodyProps = Omit<Props, 'visible' | 'onClosed'>;

function SheetBody({ onClose, recurrences, members, onSelectExpense }: BodyProps) {
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: categories } = useCategories();

  const myUserId = members.find(m => m.isMe)?.id;
  // Pagador ou participante dá no mesmo, igual ao aviso de arquivar: os dois
  // papéis mexem no saldo de quem está olhando, e é isso que "entrar" quer dizer.
  const mineCount = recurrences.filter(r =>
    !!myUserId && (r.paidBy === myUserId || r.participantIds.includes(myUserId))).length;
  const total = recurrences.length;
  const headerSubtitle = mineCount === 0
    ? t(total === 1 ? 'groupDetail.recurringYouOutOne' : 'groupDetail.recurringYouOut')
    : t(total === 1 ? 'groupDetail.recurringYouInOne' : 'groupDetail.recurringYouIn',
      { count: mineCount, total });

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerIconCircle}>
          <Repeat size={22} color={colors.textPrimary} strokeWidth={2} />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>{t('groupDetail.recurringSheetTitle')}</Text>
          <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {recurrences.map(r => {
          const cat = findCategory(categories, r.categoryId);
          const payerName = members.find(m => m.id === r.paidBy)?.name ?? '';
          // A parte de cada cobrança, não da série inteira: é o valor que vai
          // mexer no saldo toda vez que ela lançar.
          const myShare = myUserId ? r.participantShares[myUserId] : undefined;
          const subtitle = !!myUserId && r.paidBy === myUserId
            ? t('groupDetail.recurringRowPaidByMe', { count: r.participantCount })
            : myShare !== undefined
              ? t('groupDetail.recurringRowPaidByOther', { name: payerName, amount: formatMoney(myShare) })
              : t('groupDetail.recurringRowNotIn', { name: payerName });
          const meta = t('groupDetail.recurringRowRhythm', {
            rhythm: rhythmLabel(r.freq, r.intervalDays, t),
            date: parseDateOnly(r.nextRunDate).toLocaleDateString(language, { day: 'numeric', month: 'long' }),
          });
          const expenseId = r.latestExpenseId;

          const body = (
            <>
              <View style={[styles.catCircle, { backgroundColor: getCategoryChipColor(cat?.color) }]}>
                <CategoryIcon icon={cat?.icon} size={20} color={cat?.color ?? colors.textSecondary} />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTitleLine}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.rowValue}>{formatMoney(r.amount)}</Text>
                </View>
                <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text>
              </View>
              {!!expenseId && <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />}
            </>
          );

          // Série viva cujas ocorrências foram todas apagadas: ela continua
          // cobrando — é justamente por isso que aparece aqui, já que nenhuma
          // lista feita de despesas a alcança — mas não há despesa pra abrir.
          // A linha fica sem chevron e sem toque; a ausência do chevron é o
          // que diz que ela não leva a lugar nenhum.
          return expenseId ? (
            <Pressable
              key={r.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onSelectExpense(expenseId)}
            >
              {body}
            </Pressable>
          ) : (
            <View key={r.id} style={styles.row}>{body}</View>
          );
        })}
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  // 44/22/18 e gap 8: a mesma medida de cabeçalho do CategoryExpensesSheet e do
  // MemberActionsSheet, que também se abrem identificando o que estão listando.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // `gray200` e não `surface`: o painel do sheet é `background`, e `surface` em
  // cima dele é 3% de diferença — some (mesma armadilha do SkeletonBone).
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerTitle: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowPressed: {
    opacity: 0.6,
  },
  // Mesma bolinha da lista de despesas do rolê — aqui cada linha é de uma
  // categoria diferente, então o ícone volta a ser o rosto da despesa.
  catCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  // Valor na linha do título, e não numa coluna própria: as duas linhas de
  // baixo são frases inteiras e precisam da largura toda.
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  rowTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  rowValue: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  rowMeta: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
});
