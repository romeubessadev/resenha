import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useLanguage } from './useLanguage';

export class WrongPasswordError extends Error {}

/** Troca a senha da conta logada. Reautentica com a senha atual antes de
 *  aplicar a nova — é a forma de validar a atual, já que o Supabase não
 *  expõe um endpoint de "verificar senha" isolado. */
export function useChangePassword() {
  const { session } = useAuth();
  const { t } = useLanguage();

  const mutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const email = session?.user.email;
      if (!email) throw new Error(t('errors.sessionInvalid'));

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signInError) throw new WrongPasswordError();

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    },
  });

  return {
    changePassword: (currentPassword: string, newPassword: string) =>
      mutation.mutateAsync({ currentPassword, newPassword }),
    loading: mutation.isPending,
  };
}
