import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { queryKeys } from '@/lib/queryKeys';
import { queryErrorMessage } from '@/lib/queryError';
import { uploadProfileAvatar } from '@/lib/profileAvatar';
import type { PixKeyType } from '@/lib/pix';
import { useAuth } from './useAuth';
import { useLanguage } from './useLanguage';
import { useRefreshOnFocus } from './useRefreshOnFocus';

async function fetchMyProfile(userId: string): Promise<Tables<'profiles'>> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

/** Perfil do usuário logado — nome, avatar, WhatsApp, moeda principal. */
export function useMyProfile() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const userId = session?.user.id;
  const query = useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: () => fetchMyProfile(userId!),
    enabled: !!userId,
  });
  useRefreshOnFocus(query);

  return {
    data: query.data ?? null,
    loading: query.isFetching,
    error: queryErrorMessage(query, t('errors.loadProfileFailed')),
    refetch: query.refetch,
  };
}

/** Chave e tipo andam SEMPRE juntos — um campo só em vez de duas colunas
 *  soltas, espelhando o `profiles_pix_key_pair_check` do banco: chave sem tipo
 *  não sabe se formatar, tipo sem chave não mostra nada. `null` remove as duas. */
type PixChange = { key: string; type: PixKeyType } | null;

type ProfileChanges = { name?: string; whatsapp?: string | null; pix?: PixChange };

export function useUpdateMyProfile() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ userId, changes }: { userId: string; changes: ProfileChanges }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.whatsapp !== undefined ? { whatsapp: changes.whatsapp } : {}),
          ...(changes.pix !== undefined
            ? { pix_key: changes.pix?.key ?? null, pix_key_type: changes.pix?.type ?? null }
            : {}),
        })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myProfile });
      // main_currency afeta as telas de agregação (convertem por resenha a partir dela).
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      // O nome tem o mesmo alcance da foto — aparece na lista de membros de
      // cada resenha e nos participantes de cada despesa.
      qc.invalidateQueries({ queryKey: queryKeys.allGroupDetails });
      qc.invalidateQueries({ queryKey: queryKeys.allExpenseDetails });
    },
  });

  return {
    updateMyProfile: (userId: string, changes: ProfileChanges) =>
      mutation.mutateAsync({ userId, changes }),
    loading: mutation.isPending,
  };
}

export function useUpdateMyAvatar() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ userId, uri, mimeType, previousPath }: {
      userId: string; uri: string; mimeType: string; previousPath?: string | null;
    }): Promise<string> => {
      const path = await uploadProfileAvatar(userId, uri, mimeType, previousPath);
      const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
      if (error) throw error;
      return path;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myProfile });
      // A foto é embutida em toda tela que lista gente: cards de resenha, membros
      // da resenha, pessoas da Carteira e participantes de uma despesa. Sem isto,
      // a nova foto só aparecia no perfil até o app reabrir.
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.allGroupDetails });
      qc.invalidateQueries({ queryKey: queryKeys.allExpenseDetails });
    },
  });

  return {
    updateMyAvatar: (userId: string, uri: string, mimeType: string, previousPath?: string | null) =>
      mutation.mutateAsync({ userId, uri, mimeType, previousPath }),
    loading: mutation.isPending,
  };
}
