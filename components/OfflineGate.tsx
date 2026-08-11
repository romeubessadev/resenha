import { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { CloudOff } from 'lucide-react-native';
import { Button } from './Button';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, lineHeights, spacing, radius, type ColorPalette } from '@/theme';

/**
 * Quanto tempo sem rede antes da parede subir. Só a SUBIDA espera — voltar a
 * ter internet derruba a parede na hora.
 *
 * Existe por dois motivos, e os dois são de abertura/transição, não de uso:
 * o `isInternetReachable` do NetInfo nasce indefinido e leva um instante pra
 * resolver (ver app/_layout.tsx), e queda de rede no dia a dia é piscada —
 * elevador, troca de wifi pra 4G, túnel. Sem a espera, um blip de meio segundo
 * jogaria uma tela cheia na cara de quem está no meio de um lançamento.
 */
const GRACE_MS = 1000;

/**
 * Parede de "sem internet". O app é 100% online: sem conexão não há o que
 * mostrar nem o que gravar, então em vez de deixar cada tela falhar do seu
 * jeito, a barreira é uma só e fica aqui.
 *
 * É <Modal>, e não uma View sobreposta, porque os sheets do app são Modal
 * nativo: uma View na árvore ficaria POR BAIXO de um sheet aberto, e a pessoa
 * seguiria tocando em "Já recebi" atrás da parede. `animationType="none"` pelo
 * mesmo motivo documentado no PhotoViewerModal — transição de Modal disputando
 * com outra pode ser descartada, e a parede aparece por evento de rede, que
 * pode cair bem no meio da animação de um sheet.
 *
 * A navegação por baixo continua montada de propósito: quando a rede volta, a
 * parede some e a pessoa está exatamente onde estava. As queries também não se
 * perdem — sem rede o React Query PAUSA o fetch em vez de falhar, e o
 * `refetchOnReconnect` (padrão) refaz sozinho na volta.
 */
export function OfflineGate() {
  const isOnline = useIsOnline();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setBlocked(false);
      return;
    }
    const timer = setTimeout(() => setBlocked(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, [isOnline]);

  // Reconsulta a rede na marra. Não é decorativo: o NetInfo só reavalia sozinho
  // quando o sistema avisa que algo mudou, e wifi que voltou a ter saída (o
  // portal de hotel que finalmente autenticou) não gera esse aviso.
  async function handleRetry() {
    setChecking(true);
    try {
      await NetInfo.refresh();
    } finally {
      setChecking(false);
    }
  }

  if (!blocked) return null;

  return (
    // onRequestClose vazio: o botão de voltar do Android não fecha a parede —
    // não há para onde voltar que funcione sem internet.
    <Modal visible transparent={false} animationType="none" onRequestClose={() => {}}>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <CloudOff size={36} color={colors.textSecondary} strokeWidth={1.8} />
        </View>

        <Text style={styles.title}>{t('offline.title')}</Text>
        <Text style={styles.body}>{t('offline.gateBody')}</Text>

        <Button
          label={t('common.retry')}
          onPress={handleRetry}
          loading={checking}
          fullWidth={false}
          style={styles.retry}
        />
      </View>
    </Modal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.pagePadding,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes.h1,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retry: {
    marginTop: spacing.xl,
    minWidth: 200,
  },
});
