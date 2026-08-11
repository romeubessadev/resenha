import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X, type LucideIcon } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { CategoryIcon } from './CategoryIcon';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import type { LancamentoItem } from '@/hooks/useExpenses';
import type { Language } from '@/lib/i18n';
import { getCategoryChipColor } from '@/lib/categoryColors';
import { formatMoney } from '@/lib/currencies';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

// Despesas de UMA categoria, abertas a partir da linha do Insight.
//
// O total do topo é o mesmo valor da linha que abriu o sheet, e a LISTA segue o
// mesmo escopo: em "Minha parte" cada linha mostra a sua parte, e o valor cheio
// da despesa vai pro subtítulo ("Bruno bancou · R$ 240 no total"). A lista
// mostrando valor cheio embaixo de um card que soma só a sua parte era um card
// que nunca batia com o que estava logo abaixo — e, pior, a sua parte sumia de
// vez nas despesas que VOCÊ bancou, que são as que mais pesam nesse total.

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Dia e mês da despesa, no lugar onde a lista da resenha põe o ícone: aqui todas
// as despesas são da mesma categoria, então repetir o ícone dela em cada linha
// não diria nada — e Receipt, o outro candidato, já significa "despesa SEM
// categoria" (ver components/CategoryIcon.tsx), o oposto do que este sheet é.
//
// A data sai da string, não de `new Date(iso)`: esse parse trata 'YYYY-MM-DD'
// como instante UTC e joga a despesa pro dia anterior em fuso negativo.
function dateStamp(iso: string, language: Language): { day: string; month: string } {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  return {
    day: String(day).padStart(2, '0'),
    month: capitalize(new Date(year, month - 1, day).toLocaleDateString(language, { month: 'short' })),
  };
}

export type SheetCategory = {
  label: string;
  color: string;
  icon?: LucideIcon | null;
  /** Total da categoria no escopo/período selecionados. */
  amount: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  category: SheetCategory | null;
  /** Despesas da categoria, já filtradas pelo período e pelo escopo da tela. */
  expenses: LancamentoItem[];
  /** Escopo da tela: 'eu' mostra a sua parte, 'grupo' mostra o valor cheio. */
  scope: 'eu' | 'grupo';
};

// O <BottomSheetModal> fica montado mesmo sem categoria — é ele quem toca a
// animação de saída, e desmontá-lo junto com o `visible` cortaria o slide pela
// metade. Só o conteúdo é que some, igual ao MemberActionsSheet.
export function CategoryExpensesSheet({ visible, onClose, category, ...rest }: Props) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      {category && <SheetBody category={category} onClose={onClose} {...rest} />}
    </BottomSheetModal>
  );
}

type BodyProps = Omit<Props, 'visible' | 'category'> & { category: SheetCategory };

function SheetBody({
  onClose, category, expenses, scope,
}: BodyProps) {
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const totalLabel = formatMoney(category.amount);
  const countLabel = t(
    expenses.length === 1 ? 'insight.categorySheetCountSingular' : 'insight.categorySheetCount',
    { count: expenses.length },
  );

  return (
    <>
      <View style={styles.header}>
        <View style={[styles.headerIconCircle, { backgroundColor: getCategoryChipColor(category.color) }]}>
          <CategoryIcon icon={category.icon} size={22} color={category.color} />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>{category.label}</Text>
          <Text style={styles.headerSubtitle}>{countLabel}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>
          {scope === 'eu' ? t('insight.categorySheetMyTotal') : t('insight.categorySheetTotal')}
        </Text>
        <View style={styles.totalValueRow}>
          <Text style={styles.totalValue}>{totalLabel}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {expenses.map(l => {
          // No escopo 'eu' o valor da linha já é a sua parte, então "você deve
          // {amount}" viraria eco do número ao lado: o subtítulo passa a contar
          // quem bancou e de quanto era a despesa inteira.
          const subtitle = scope === 'eu'
            ? t('insight.categorySheetRowSubtitle', {
                name: l.paidByMe ? t('common.youCapitalized') : l.paidByName,
                amount: formatMoney(Math.abs(l.amount)),
              })
            : l.paidByMe
              ? t('groupDetail.paidByMeSubtitle', { count: l.splitCount ?? 0 })
              : l.myShare !== undefined
                ? t('groupDetail.paidByOtherSubtitle', {
                    name: l.paidByName,
                    amount: formatMoney(Math.abs(l.myShare)),
                  })
                : t('groupDetail.paidByOtherNotInSubtitle', { name: l.paidByName });
          const valueLabel = formatMoney(Math.abs(scope === 'eu' ? l.myShare ?? 0 : l.amount));
          const stamp = dateStamp(l.date, language);

          return (
            <View key={l.id} style={styles.row}>
              <View style={styles.dateStamp}>
                <Text style={styles.dateDay}>{stamp.day}</Text>
                <Text style={styles.dateMonth}>{stamp.month}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{l.title}</Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
              </View>
              <View style={styles.rowValueCol}>
                <Text style={styles.rowValue}>{valueLabel}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  // 44/22/18 e gap 8: mesma medida do cabeçalho do MemberActionsSheet, que é
  // o outro sheet do app que se abre identificando uma entidade (círculo +
  // nome + subtítulo + fechar).
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
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
  totalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  totalLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  totalValue: {
    fontSize: fontSizes.h1,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  totalValueSecondary: {
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
  // Mesma largura do círculo de ícone que a lista da resenha usa nesse lugar, pra
  // que o título comece na mesma coluna nas duas telas.
  //
  // `gray200` e não `surface`: o painel do sheet é `background` (branco puro no
  // light), e `surface` em cima dele é 3% de diferença — some. É a mesma
  // armadilha do SkeletonBone. O fundo aqui não é pra destacar a data: é pra
  // ela virar carimbo e parar de disputar peso com o título ao lado.
  dateStamp: {
    width: 40,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.gray200,
    alignItems: 'center',
  },
  dateDay: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  dateMonth: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  rowValueCol: {
    alignItems: 'flex-end',
  },
  rowValue: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  rowValueSecondary: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
});
