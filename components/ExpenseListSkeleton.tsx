import { View, StyleSheet } from 'react-native';
import { SkeletonBone as Bone } from './SkeletonBone';
import { radius, spacing } from '@/theme';

type Props = { count?: number };

// Placeholder no formato da linha de despesa (ícone + título + subtítulo +
// valor), reaproveitado no skeleton da tela cheia e no primeiro carregamento
// da aba Despesas.
export function ExpenseListSkeleton({ count = 3 }: Props) {
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    width: '60%',
    height: 15,
    borderRadius: radius.full,
  },
  subtitle: {
    width: '40%',
    height: 12,
    borderRadius: radius.full,
  },
  amount: {
    width: 60,
    height: 15,
    borderRadius: radius.full,
  },
});
