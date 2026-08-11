import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { ArrowLeft, QrCode, X } from 'lucide-react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { GroupNotFoundError, RoleLimitError, useJoinGroup } from '@/hooks/useGroups';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, type ColorPalette } from '@/theme';

const CODE_RULE = /[^A-Z0-9]/g;

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenScanner: () => void;
  onJoined: (groupId: string) => void;
  onLimitReached: () => void;
};

export function JoinRoleSheet({ visible, onClose, onOpenScanner, onJoined, onLimitReached }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mode, setMode] = useState<'scan' | 'code'>('scan');
  const [code, setCode] = useState('');
  const { joinGroup, loading } = useJoinGroup();
  const float = useSharedValue(0);
  const afterCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!visible) return;
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [visible, float]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * float.value }],
  }));

  function handleClose() {
    setMode('scan');
    setCode('');
    onClose();
  }

  // Só chama onOpenScanner depois que o BottomSheetModal terminou de desmontar
  // de verdade — abrir um segundo Modal nativo antes disso pode travar a
  // apresentação (dois Modals disputando a transição ao mesmo tempo).
  function handleClosed() {
    const action = afterCloseRef.current;
    afterCloseRef.current = null;
    action?.();
  }

  function handleOpenScanner() {
    afterCloseRef.current = onOpenScanner;
    handleClose();
  }

  const canJoin = code.length >= 5 && !loading;

  async function handleJoinWithCode() {
    if (!canJoin) return;
    try {
      const group = await joinGroup(code);
      afterCloseRef.current = () => onJoined(group.id);
      handleClose();
    } catch (err) {
      if (err instanceof RoleLimitError) {
        afterCloseRef.current = onLimitReached;
        handleClose();
      } else if (err instanceof GroupNotFoundError) {
        Alert.alert(t('groups.notFoundTitle'), t('joinRole.notFoundBody'));
      } else {
        Alert.alert(t('groups.joinFailedTitle'), err instanceof Error ? err.message : t('joinRole.joinFailedBody'));
      }
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} onClosed={handleClosed}>
      {mode === 'scan' ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{t('joinRole.title')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8} activeOpacity={0.7}>
              <X size={22} color={colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Animated.View style={[styles.qrPlaceholder, floatStyle]}>
            <QrCode size={96} color={colors.ink} strokeWidth={1} />
          </Animated.View>

          <Text style={styles.copy}>
            {t('joinRole.scanHint')}
          </Text>

          <Button label={t('joinRole.openCamera')} onPress={handleOpenScanner} />

          <TouchableOpacity activeOpacity={0.7} onPress={() => setMode('code')}>
            <Text style={styles.link}>{t('joinRole.haveCode')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setMode('scan')} hitSlop={8} activeOpacity={0.7}>
              <ArrowLeft size={22} color={colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('joinRole.codeTitle')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8} activeOpacity={0.7}>
              <X size={22} color={colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={styles.copyLeft}>{t('joinRole.enterCodeHint')}</Text>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={v => setCode(v.toUpperCase().replace(CODE_RULE, ''))}
            placeholder={t('joinRole.codePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Button label={t('joinRole.submit')} onPress={handleJoinWithCode} disabled={!canJoin} loading={loading} />

          <TouchableOpacity activeOpacity={0.7} onPress={() => setMode('scan')}>
            <Text style={styles.link}>{t('joinRole.backToQr')}</Text>
          </TouchableOpacity>
        </>
      )}
    </BottomSheetModal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  qrPlaceholder: {
    alignSelf: 'center',
    width: 224,
    height: 224,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  copyLeft: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  codeInput: {
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  link: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
