import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBone as Bone } from './SkeletonBone';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, type ColorPalette } from '@/theme';

// Contorno da lista de quem divide a despesa, enquanto os membros do rolê
// carregam. O resto do formulário já está na tela — só este bloco espera.
export function SplitMembersSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.list}>
      {[0, 1, 2].map(i => (
        <View key={i} style={styles.row}>
          <Bone style={styles.check} />
          <Bone style={styles.avatar} />
          <Bone style={styles.nameBar} />
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  list: {
    marginTop: spacing.lg,
  },
  // Espelha o capsuleRow, com o mesmo fundo `surface`: a cápsula é moldura e já
  // existe antes dos nomes chegarem — só o conteúdo dela é osso.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
  },
  nameBar: {
    width: '45%',
    height: 14,
    borderRadius: radius.full,
  },
});
