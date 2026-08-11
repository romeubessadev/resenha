import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { clearOnboardingAnswers, getOnboardingAnswers, isReadyToCreateGroup } from '@/lib/onboarding';
import { useAuth } from './useAuth';

/**
 * Materializa o rolê que a pessoa configurou no tour, uma vez, logo que ela
 * entra no app com sessão. É o que faz a tela 5 do tour ("Seu rolê tá montado")
 * ser verdade: as respostas ficam no AsyncStorage antes do cadastro e viram
 * rolê de verdade aqui — o caminho que o CLAUDE.md define.
 *
 * Mora no layout de (app), e não na tela de boas-vindas, pra se auto-corrigir:
 * se o app for fechado no meio do cadastro, a próxima abertura tenta de novo.
 *
 * Três guardas, todas necessárias:
 *  · só cria pra quem terminou as perguntas e nomeou o rolê (viu a tela 5);
 *  · só cria se a conta não tiver NENHUM rolê — quem fez o tour e no fim entrou
 *    numa conta que já existia não recebe um "Rolê da praia" perdido no meio
 *    dos rolês de verdade dela;
 *  · só limpa as respostas depois do rolê existir, então falha de rede não
 *    perde o que ela configurou e não cria dois rolês.
 */
export function useOnboardingGroup() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const userId = session?.user.id;
  // Uma tentativa por montagem: sem isso, o re-render que o próprio insert
  // provoca reentraria aqui antes de as respostas terem sido limpas.
  const attempted = useRef(false);

  useEffect(() => {
    if (!userId || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const answers = await getOnboardingAnswers();
        if (!isReadyToCreateGroup(answers)) {
          if (__DEV__) console.warn('[onboarding] sem respostas completas:', answers);
          return;
        }

        const { count, error: countError } = await supabase
          .from('group_members')
          .select('group_id', { count: 'exact', head: true })
          .eq('user_id', userId);
        if (countError || (count ?? 0) > 0) {
          if (__DEV__) console.warn('[onboarding] não criou — rolês existentes:', count, countError);
          return;
        }

        const { error } = await supabase.rpc('create_group_with_owner', {
          p_name: answers.name!.trim(),
          p_avatar_key: null as unknown as string,
          p_default_split_type: answers.split!,
        });
        if (error) {
          if (__DEV__) console.warn('[onboarding] create_group_with_owner falhou:', error);
          return;
        }

        await clearOnboardingAnswers();
        qc.invalidateQueries({ queryKey: queryKeys.myGroups });
      } catch {
        // Silencioso de propósito: é um bônus do tour, não uma operação que a
        // pessoa pediu agora. Falhou, as respostas continuam guardadas e a
        // próxima abertura tenta de novo.
        attempted.current = false;
      }
    })();
  }, [userId, qc]);
}
