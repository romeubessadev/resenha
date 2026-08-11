import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { useFonts } from '@expo-google-fonts/fredoka/useFonts';
import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import { OfflineGate } from '@/components';
import { registerExpenseMutationDefaults } from '@/hooks/useExpenses';
import { AuthProvider } from '@/hooks/useAuth';
import { LanguageProvider } from '@/hooks/useLanguage';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { useSyncTimezone } from '@/hooks/useSyncTimezone';
import { usePushToken } from '@/hooks/usePushToken';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      // Dados ficam "frescos" por 5min — nesse intervalo, reabrir a tela usa
      // o cache em memória direto (sem refetch), mesmo que ela já tenha ficado
      // montada em foco antes. O cache NÃO sobrevive a fechar o app: o app é
      // 100% online e a parede (components/OfflineGate.tsx) garante que só se
      // navega com rede, então guardar estado velho em disco só criaria a
      // chance de mostrar número errado.
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      // Por padrão o React Query PAUSA mutação quando não há rede, esperando a
      // conexão voltar. Pausar é o pior comportamento possível aqui: a promessa
      // nunca resolve, o botão fica girando pra sempre e o `catch` que mostraria
      // o erro nunca roda. Com 'always' a chamada sai, falha na hora, e cada
      // tela mostra o erro que já sabe mostrar.
      //
      // Vale pra TODA mutação, inclusive as de despesa — elas já foram fila
      // offline e não são mais (ver registerExpenseMutationDefaults).
      networkMode: 'always',
    },
  },
});

// Liga o estado de rede do React Query ao NetInfo. É daqui que sai o
// `useIsOnline`, e é ele que levanta a parede de "sem internet" — sem esta
// linha o app assumiria que SEMPRE há rede e a parede nunca subiria.
//
// `isInternetReachable` distingue "tem wifi" de "a internet responde" (portal
// de hotel, wifi sem saída). Só é considerado offline quando ele é
// explicitamente false — enquanto está `null` (ainda checando) vale o
// isConnected, senão o app nasceria offline por um instante a cada abertura.
onlineManager.setEventListener(setOnline => NetInfo.addEventListener(state => {
  setOnline(!!state.isConnected && state.isInternetReachable !== false);
}));

// No escopo do módulo, e não dentro de um componente: as defaults precisam
// existir antes de qualquer tela montar, senão um `useMutation` que só passa a
// mutationKey (ver useCreateExpense) monta sem saber o que executar.
registerExpenseMutationDefaults(queryClient);

function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active');
}

// Só roda o hook dentro da árvore do AuthProvider (precisa da sessão).
function TimezoneSync() {
  useSyncTimezone();
  return null;
}

// Idem — registra o token de push e escuta toque em notificação.
function PushTokenSync() {
  usePushToken();
  return null;
}

function AppShell() {
  const { resolvedScheme } = useTheme();

  return (
    <AuthProvider>
      <TimezoneSync />
      <PushTokenSync />
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(pre-auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      {/* Depois do Stack e dentro do AuthProvider: a parede cobre o app TODO,
          inclusive login e cadastro, que também não funcionam sem rede. */}
      <OfflineGate />
    </AuthProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <LanguageProvider>
              <AppShell />
            </LanguageProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
