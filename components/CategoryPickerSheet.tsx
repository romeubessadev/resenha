import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { CategoryIcon } from './CategoryIcon';
import { getCategoryChipColor } from '@/lib/categoryColors';
import { useCategories, useCategoryUsage, type GroupCategory } from '@/hooks/useCategories';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type BodyProps = {
  groupId: string | undefined;
  selectedCategoryId: string | null;
  onSelect: (category: GroupCategory) => void;
  /** Fecha o picker inteiro (toque no X) — quem chama decide o que isso significa
   *  (fechar um BottomSheetModal, ou voltar pro conteúdo anterior de outro sheet). */
  onRequestClose: () => void;
};

// Lista fixa das 8 categorias, sem Modal — quem usa embrulha no
// BottomSheetModal que fizer sentido. Hoje só o "Editar despesa", que é onde a
// categoria se corrige: o "Nova despesa" não pergunta mais.
//
// Sem o "deixa a IA escolher" que morava aqui: a IA já resolve a categoria
// sozinha na fila de sincronização, com o mesmo título e o mesmo prompt. O
// botão devolveria justamente a resposta que a pessoa abriu esta lista pra
// corrigir.
//
// Roda 100% local (ver hooks/useCategories.ts) — corrigir categoria nunca toca
// a rede, e funciona offline como o resto do formulário.
export function CategoryPickerBody({
  groupId, selectedCategoryId, onSelect, onRequestClose,
}: BodyProps) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: categories } = useCategories(groupId);
  const { data: usage } = useCategoryUsage(groupId);

  function handlePick(category: GroupCategory) {
    onSelect(category);
    onRequestClose();
  }

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{t('categoryPicker.title')}</Text>
        <TouchableOpacity onPress={onRequestClose} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {categories.map(category => {
          const selected = category.id === selectedCategoryId;
          const usageCount = usage[category.id] ?? 0;
          return (
            <TouchableOpacity
              key={category.id}
              style={[styles.row, selected && styles.rowActive]}
              onPress={() => handlePick(category)}
              activeOpacity={0.7}
            >
              {/* Ícone na bolinha da cor — o MESMO par que a despesa mostra na
                  lista e no detalhe depois de escolhida, e que o Insight repete
                  no gráfico. Escolher aqui é ver o resultado. */}
              <View style={[styles.rowIconCircle, { backgroundColor: getCategoryChipColor(category.color) }]}>
                <CategoryIcon icon={category.icon} size={20} color={category.color} />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowName}>{category.name}</Text>
                <Text style={styles.rowDescription} numberOfLines={1}>{category.description}</Text>
              </View>
              <View style={styles.rowEndCol}>
                {usageCount > 0 && (
                  <Text style={styles.rowUsage}>
                    {t(usageCount === 1 ? 'categoryPicker.usageCountSingular' : 'categoryPicker.usageCountPlural', { count: usageCount })}
                  </Text>
                )}
                {selected && <Check size={18} color={colors.primaryDark} strokeWidth={2.5} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  list: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  rowActive: {
    backgroundColor: 'rgba(245,197,24,0.15)',
    borderColor: 'rgba(217,168,0,0.4)',
  },
  // Mesmo cartão do "Ditar despesa" (grupo/lancar.tsx): os dois são atalho de
  // IA dentro de um formulário, então usam a mesma casca — fundo da marca,
  // bolinha sólida com o ícone da função e o brilho à direita marcando que é IA.
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(245,197,24,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217,168,0,0.3)',
  },
  suggestRowDisabled: {
    opacity: 0.5,
  },
  suggestIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestTextCol: {
    flex: 1,
  },
  suggestTitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  suggestSubtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  // Mesmos 10px da bolinha do Insight, pelo mesmo motivo documentado lá:
  // abaixo disso os dois verdes da paleta deixam de se distinguir.
  rowIconCircle: {
    // 40/20/16, a medida de lista do app — o mesmo par que a despesa mostra
    // depois de escolhida (ver a regra em components/CategoryIcon.tsx). Era
    // 36 com glifo de 16, que quebrava a proporção `size` = metade do círculo.
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowName: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  rowDescription: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  rowEndCol: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  rowUsage: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
});
