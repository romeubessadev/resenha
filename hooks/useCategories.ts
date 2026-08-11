import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import type { LucideIcon } from 'lucide-react-native';
import { FIXED_CATEGORIES } from '@/lib/categories';
import { useLanguage } from './useLanguage';
import { useTheme } from './useTheme';

export type GroupCategory = {
  id: string;
  name: string;
  description: string;
  color: string;
  /** Junto com a cor, é o rosto da despesa em toda tela que a mostra — não há
   *  mais emoji por despesa (ver components/CategoryIcon). */
  icon: LucideIcon;
};

/** Lista fixa e global de categorias, traduzida — igual em toda resenha, sem
 *  busca no banco (não existe mais tabela de categoria por grupo). A cor vem
 *  de um token do tema (light/dark), não de um hex fixo. O parâmetro
 *  `groupId` fica só por compatibilidade de assinatura com quem já chama
 *  `useCategories(groupId)`. */
export function useCategories(_groupId?: string) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const data = useMemo<GroupCategory[]>(
    () => FIXED_CATEGORIES.map(c => ({
      id: c.key, name: t(c.nameKey), description: t(c.descriptionKey), color: colors[c.colorToken], icon: c.icon,
    })),
    [t, colors],
  );

  return {
    data,
    loading: false,
    error: null as string | null,
    refetch: () => {},
  };
}

export function findCategory(categories: GroupCategory[], categoryId: string | null | undefined): GroupCategory | null {
  if (!categoryId) return null;
  return categories.find(c => c.id === categoryId) ?? null;
}

async function fetchCategoryUsage(groupId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('expenses')
    .select('category_id')
    .eq('group_id', groupId)
    .not('category_id', 'is', null);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data) {
    if (row.category_id) counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
  }
  return counts;
}

/** Quantas despesas da resenha já usam cada categoria — só informativo (mostrado
 *  no picker), já que as 7 categorias são fixas e nunca podem ser apagadas. */
export function useCategoryUsage(groupId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.categoryUsage(groupId ?? ''),
    queryFn: () => fetchCategoryUsage(groupId!),
    enabled: !!groupId,
  });

  return { data: query.data ?? {}, loading: query.isFetching };
}
