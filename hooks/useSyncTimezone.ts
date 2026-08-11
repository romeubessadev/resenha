import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// Mantém profiles.timezone atualizado com o fuso real do celular — só o
// cron de recorrências usa isso (materialize_recurring_expenses), pra
// saber quando um dia virou de verdade pra quem criou a
// recorrência, em vez de UTC cru do servidor. Roda toda vez que o app volta
// ativo (não só no login), pra pegar quem viajou de fuso sem precisar
// fechar e abrir o app de novo.
export function useSyncTimezone() {
  const { session } = useAuth();
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    function sync() {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz || tz === lastSynced.current) return;
      lastSynced.current = tz;
      supabase.from('profiles').update({ timezone: tz }).eq('id', userId!).then(({ error }) => {
        if (error) lastSynced.current = null;
      });
    }

    sync();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [session?.user.id]);
}
