import { Platform } from 'react-native';

const shadow = (
  elevation: number,
  opacity: number,
  radius: number,
  offsetY: number,
) =>
  Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: { elevation },
    default: {},
  });

export const shadows = {
  card: shadow(2, 0.06, 6, 2),
  balance: shadow(8, 0.15, 20, 6),
  tabBar: shadow(4, 0.08, 12, -2),
  logoOnPhoto: shadow(8, 0.45, 12, 4),
} as const;
