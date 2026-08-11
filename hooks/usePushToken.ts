import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from './useAuth';

/** Preferência de push DESTE aparelho, escrita pelo switch de Ajustes. Mora
 *  aqui, e não na tela, porque quem tem que obedecer a ela é o registro do
 *  token logo abaixo — antes a chave era local de ajustes.tsx e ninguém além
 *  do próprio switch a lia, então desligar não desligava nada. */
export const NOTIF_PREF_KEY = 'bros:notif';

/** Ausente = nunca mexeu no switch: vale a permissão do SO. Só um 'false'
 *  explícito bloqueia. */
async function pushDisabledHere(): Promise<boolean> {
  return (await AsyncStorage.getItem(NOTIF_PREF_KEY)) === 'false';
}

/** Token de push deste aparelho, ou null se o ambiente não suporta (Expo Go,
 *  build sem projectId) ou a chamada falhou. */
async function getDeviceToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token || null;
  } catch {
    return null;
  }
}

// Mostra o push mesmo com o app em primeiro plano; canal Android (obrigatório
// Android 8+, no-op no iOS) — chamado uma vez, no carregamento do módulo.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Bros',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Registra (upsert) o token de push do aparelho — só se a permissão já foi
 *  concedida E o switch de Ajustes não estiver desligado neste aparelho.
 *  Chamado no mount/volta ao primeiro plano (abaixo) e também direto pelo
 *  switch de Ajustes, logo depois de conceder a permissão (não espera a
 *  próxima volta ao app pra registrar). Silencioso no Expo Go —
 *  getExpoPushTokenAsync não funciona lá desde o SDK 53 (só em build de
 *  desenvolvimento), então falha é esperado até o build sair.
 *
 *  A checagem da preferência é o que dá efeito ao OFF: sem ela, este mesmo
 *  registro rodava a cada volta ao primeiro plano e ressuscitava o token
 *  apagado por unregisterPushToken. */
export async function registerPushToken(userId: string): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  if (await pushDisabledHere()) return;

  const token = await getDeviceToken();
  if (!token) return;

  // Falha de rede não faz nada: a próxima volta ao primeiro plano tenta de novo.
  await supabase.from('push_tokens')
    .upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });
}

/** Apaga o token DESTE aparelho — os outros aparelhos da pessoa seguem
 *  recebendo. É o par do registro acima: `push_tokens` é por aparelho de
 *  propósito, e o send-push dispara pra todo token que achar, então
 *  sumir da tabela é a única forma de parar de receber. */
export async function unregisterPushToken(userId: string): Promise<void> {
  const token = await getDeviceToken();
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
}

type PushRouteData = { route: string; params?: Record<string, string> };

// Controller único (montado em app/_layout.tsx, mesmo molde de
// useSyncTimezone) — registra o token, invalida o cache quando um push CHEGA e
// escuta o TOQUE nele pra navegar pra rota certa (data.route/data.params,
// montado pela Edge Function send-push).
export function usePushToken(): void {
  const { session } = useAuth();
  const userId = session?.user.id;
  const qc = useQueryClient();

  // O push é o ÚNICO sinal que este aparelho recebe de mudança feita por outra
  // pessoa do rolê — não há realtime, e `invalidateQueries` só alcança quem fez
  // a mudança. Sem isto o aviso chegava na barra de notificação e a tela atrás
  // dele continuava com o número velho até expirar o SHARED_STALE_TIME.
  //
  // Recebido, não tocado: `useLastNotificationResponse` (abaixo) é o toque, que
  // navega. Este dispara com o app ABERTO, que é justamente quando a pessoa
  // está olhando pro dado errado.
  //
  // Invalida grosso (não dá pra saber o tipo do evento pelo payload, que só
  // carrega rota) e sai barato mesmo assim: invalidateQueries só refaz o fetch
  // de query ATIVA, então o custo se limita ao que está na tela.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as PushRouteData | undefined;
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.myGroups });

      // A rota do push carrega o rolê em `id` (tela do rolê) ou `groupId`
      // (participantes) — ver buildRoute na Edge Function send-push. Lembrete de
      // saldo aberto aponta pra Carteira e não traz nenhum dos dois.
      const groupId = data?.params?.id || data?.params?.groupId;
      if (groupId) {
        qc.invalidateQueries({ queryKey: queryKeys.group(groupId) });
        qc.invalidateQueries({ queryKey: queryKeys.groupBalances(groupId) });
        qc.invalidateQueries({ queryKey: queryKeys.expenses(groupId) });
        qc.invalidateQueries({ queryKey: queryKeys.groupHistory(groupId) });
        qc.invalidateQueries({ queryKey: queryKeys.settlements(groupId) });
        // Prefixo: pega o detalhe de QUALQUER despesa aberta. O push não diz
        // qual despesa mudou, e detalhe é tela onde a pessoa fica parada.
        qc.invalidateQueries({ queryKey: queryKeys.allExpenseDetails });
      }
    });
    return () => subscription.remove();
  }, [qc]);

  useEffect(() => {
    if (!userId) return;
    registerPushToken(userId);
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') registerPushToken(userId);
    });
    return () => subscription.remove();
  }, [userId]);

  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const data = lastResponse?.notification.request.content.data as PushRouteData | undefined;
    if (data?.route) {
      router.push({ pathname: data.route, params: data.params } as never);
    }
  }, [lastResponse]);
}
