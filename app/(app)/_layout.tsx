import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useOnboardingGroup } from '@/hooks/useOnboardingGroup';

export default function AppLayout() {
  const { session, loading } = useAuth();
  // Cria a resenha que a pessoa configurou no tour, se houver algum pendente.
  useOnboardingGroup();

  if (loading) return null;
  if (!session) return <Redirect href="/(pre-auth)/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="grupo" />
    </Stack>
  );
}
