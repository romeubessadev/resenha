import { View, StyleSheet } from 'react-native';
import { SkeletonBone as Bone } from './SkeletonBone';
import { radius, spacing } from '@/theme';

type Props = { count?: number };

// Placeholder no formato da linha da Carteira (círculo do ícone + título +
// subtítulo + valor à direita). Mostrado só na primeira carga, quando não há
// nada em cache — atualizar puxando mantém o conteúdo real na tela e usa o
// indicador do PullToRefresh.
export function WalletListSkeleton({ count = 4 }: Props) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Bone style={styles.icon} />
          <View style={styles.body}>
            <Bone style={styles.title} />
            <Bone style={styles.subtitle} />
          </View>
          <Bone style={styles.amount} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  // Espelha o txRow: mesmo gap e mesma altura de linha, pra o conteúdo real
  // entrar sem deslocar nada.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    width: '55%',
    height: 15,
    borderRadius: radius.full,
  },
  subtitle: {
    width: '35%',
    height: 12,
    borderRadius: radius.full,
  },
  amount: {
    width: 64,
    height: 15,
    borderRadius: radius.full,
  },
});
