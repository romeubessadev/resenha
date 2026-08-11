import { View, StyleSheet } from 'react-native';
import { SkeletonBone as Bone } from './SkeletonBone';
import { radius } from '@/theme';

// Placeholder no formato do GroupCard, mostrado enquanto a lista de
// rolês ainda não tem dado em cache (primeira entrada no app).
export function GroupListSkeleton() {
  return (
    <View>
      {[0, 1, 2].map(i => (
        <View key={i} style={styles.row}>
          <Bone style={styles.avatar} />
          <View style={styles.content}>
            <Bone style={styles.nameBar} />
            <Bone style={styles.metaBar} />
          </View>
          <Bone style={styles.valueBar} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  nameBar: {
    width: '55%',
    height: 15,
    borderRadius: radius.full,
  },
  metaBar: {
    width: '35%',
    height: 11,
    borderRadius: radius.full,
  },
  valueBar: {
    width: 64,
    height: 14,
    borderRadius: radius.full,
  },
});
