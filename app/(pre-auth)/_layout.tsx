import { Stack } from 'expo-router';

export default function PreAuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="paywall" />
      <Stack.Screen name="login" />
      <Stack.Screen name="entrar" />
      <Stack.Screen name="recuperar-senha" />
      <Stack.Screen name="verificar-codigo" />
      <Stack.Screen name="nova-senha" />
      <Stack.Screen name="senha-alterada" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="bem-vindo" />
      <Stack.Screen name="avatar" />
    </Stack>
  );
}
