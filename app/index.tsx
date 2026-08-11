import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { Spinner } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { type ColorPalette } from '@/theme';

// Ponto de entrada: com sessão salva vai direto pro app; sem sessão, a capa.
// Quem decide entre tour e cadastro é o "Bora rachar" da capa, não aqui — o
// tour é escolha, não pedágio de abertura.
export default function Index() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <Spinner size={28} />
      </View>
    );
  }

  return <Redirect href={session ? '/grupos' : '/(pre-auth)/login'} />;
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
