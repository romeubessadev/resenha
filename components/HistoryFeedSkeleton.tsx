import { View, StyleSheet } from 'react-native';
import { SkeletonBone as Bone } from './SkeletonBone';
import { radius, spacing } from '@/theme';

type Props = { count?: number };

// Placeholder no formato do feed de histórico: cabeçalho do dia + linhas de
// evento (círculo do ícone à esquerda, texto e hora à direita).
//
// Sem o conector vertical que liga os ícones no feed real — ele existe pra
// mostrar que os eventos de um dia são uma sequência, e traçar essa linha
// entre ossos sugeriria uma relação entre placeholders.
export function HistoryFeedSkeleton({ count = 4 }: Props) {
  return (
    <View>
      <Bone style={styles.dayHeader} />
      <View style={styles.list}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={styles.row}>
            <Bone style={styles.icon} />
            <View style={styles.body}>
              <Bone style={[styles.line, i % 2 === 0 ? styles.lineWide : styles.lineNarrow]} />
              <Bone style={styles.time} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayHeader: {
    width: 90,
    height: 11,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
    paddingTop: 4,
  },
  line: {
    height: 14,
    borderRadius: radius.full,
  },
  // Larguras alternadas: eventos reais têm frases de tamanhos diferentes, e um
  // bloco de barras idênticas lê como tabela, não como feed.
  lineWide: {
    width: '85%',
  },
  lineNarrow: {
    width: '60%',
  },
  time: {
    width: 44,
    height: 10,
    borderRadius: radius.full,
  },
});
