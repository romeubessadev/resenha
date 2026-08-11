import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Mic, Square, Loader2, X, Sparkles } from 'lucide-react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVoiceRecorder, useParseVoiceExpense, PremiumRequiredError } from '@/hooks/useVoiceExpense';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import type { TranslationKey } from '@/lib/i18n';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Phase = 'idle' | 'recording' | 'processing';

const ANIM_DURATION = 250;
const PANEL_CLOSED_OFFSET = 600;
const MAX_SECONDS = 30;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const INSTRUCTION_KEYS: Record<Phase, TranslationKey> = {
  idle: 'falar.instructionsIdle',
  recording: 'falar.instructionsRecording',
  processing: 'falar.instructionsProcessing',
};

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// Metering vem em dB (silêncio ~ -60, fala alta ~ 0) — normaliza pra 0..1 pro pulso.
function normalizeMetering(db: number | undefined): number {
  if (db === undefined) return 0;
  return Math.min(1, Math.max(0, (db + 60) / 60));
}

export default function FalarScreen() {
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const recorder = useVoiceRecorder();
  const { parseVoiceExpense } = useParseVoiceExpense();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>('idle');

  // Fundo escurecido e painel animam juntos (fade + slide), igual ao sheet "Nova despesa".
  const overlayOpacity = useSharedValue(0);
  const panelTranslateY = useSharedValue(PANEL_CLOSED_OFFSET);
  const pulseLevel = useSharedValue(0);
  const spinRotation = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: ANIM_DURATION, easing: Easing.out(Easing.ease) });
    panelTranslateY.value = withTiming(0, { duration: ANIM_DURATION, easing: Easing.out(Easing.ease) });
  }, [overlayOpacity, panelTranslateY]);

  useEffect(() => {
    if (phase !== 'recording') return;
    pulseLevel.value = withTiming(normalizeMetering(recorder.metering), { duration: 100 });
  }, [recorder.metering, phase, pulseLevel]);

  useEffect(() => {
    if (phase === 'processing') {
      spinRotation.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1);
    } else {
      cancelAnimation(spinRotation);
      spinRotation.value = 0;
    }
  }, [phase, spinRotation]);

  useEffect(() => {
    if (phase === 'recording' && recorder.durationMillis >= MAX_SECONDS * 1000) {
      handleStop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, recorder.durationMillis]);

  function closeSheet(navigate: () => void = () => router.back()) {
    overlayOpacity.value = withTiming(0, { duration: ANIM_DURATION, easing: Easing.in(Easing.ease) });
    panelTranslateY.value = withTiming(
      PANEL_CLOSED_OFFSET,
      { duration: ANIM_DURATION, easing: Easing.in(Easing.ease) },
      finished => {
        if (finished) runOnJS(navigate)();
      },
    );
  }

  function handleClose() {
    if (phase === 'processing') return;
    if (phase === 'recording') recorder.stop().catch(() => {});
    closeSheet();
  }

  async function handleStart() {
    const started = await recorder.start();
    if (!started) {
      Alert.alert(t('common.permissionNeeded'), t('falar.micPermissionBody'));
      return;
    }
    pulseLevel.value = 0;
    setPhase('recording');
  }

  async function handleStop() {
    if (!groupId) return;
    const uri = await recorder.stop();
    if (!uri) {
      setPhase('idle');
      return;
    }
    setPhase('processing');
    try {
      const parsed = await parseVoiceExpense(groupId, uri);
      closeSheet(() =>
        router.dismissTo({
          pathname: '/(app)/grupo/lancar' as never,
          params: {
            groupId,
            aiTitle: parsed.title,
            aiAmount: String(parsed.amount),
            ...(parsed.date ? { aiDate: parsed.date } : {}),
            // Sem categoria: quem decide é a fila de sincronização, DEPOIS do
            // lançamento, igual ao formulário manual (ver o onSuccess da
            // criação em hooks/useExpenses.ts). A voz chegou a mandar a sua,
            // decidida com a frase inteira em mãos, mas fazia a despesa ditada
            // nascer categorizada enquanto a digitada só ganhava a categoria
            // alguns segundos depois — dois comportamentos pra mesma ação.
            aiPaidById: parsed.paidById,
            aiParticipantIds: parsed.participantIds.join(','),
            aiSplitType: parsed.splitType,
            aiShares: Object.entries(parsed.shares).map(([id, n]) => `${id}:${n}`).join(','),
            aiExactAmounts: Object.entries(parsed.exactAmounts).map(([id, v]) => `${id}:${v}`).join(','),
            ...(parsed.recurrence ? {
              aiRecurrenceFreq: parsed.recurrence.freq,
              ...(parsed.recurrence.intervalDays != null ? { aiRecurrenceIntervalDays: String(parsed.recurrence.intervalDays) } : {}),
              ...(parsed.recurrence.startDate ? { aiRecurrenceStart: parsed.recurrence.startDate } : {}),
              ...(parsed.recurrence.endDate ? { aiRecurrenceEnd: parsed.recurrence.endDate } : {}),
            } : {}),
          },
        }),
      );
    } catch (err) {
      const isPremium = err instanceof PremiumRequiredError;
      Alert.alert(
        isPremium ? t('falar.premiumTitle') : t('falar.understandFailedTitle'),
        isPremium
          ? t('falar.premiumBody')
          : err instanceof Error ? err.message : t('common.tryAgain'),
      );
      setPhase('idle');
    }
  }

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: panelTranslateY.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulseLevel.value * 0.35 }] }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinRotation.value}deg` }] }));

  return (
    <View style={styles.modalRoot}>
      <AnimatedPressable style={[styles.overlay, overlayStyle]} onPress={handleClose}>
      <AnimatedPressable
        style={[styles.sheetPanel, panelStyle, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}
        onPress={() => {}}
      >

        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t('falar.title')}</Text>
          <TouchableOpacity
            style={[styles.closeBtn, phase === 'processing' && styles.closeBtnDisabled]}
            onPress={handleClose}
            disabled={phase === 'processing'}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <X size={22} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.instructions}>{t(INSTRUCTION_KEYS[phase])}</Text>

          <View style={styles.micWrap}>
            {phase === 'recording' && <Animated.View style={[styles.pulse, pulseStyle]} />}
            <TouchableOpacity
              style={[
                styles.micBtn,
                phase === 'recording' && styles.micBtnRecording,
                phase === 'processing' && styles.micBtnProcessing,
              ]}
              onPress={phase === 'idle' ? handleStart : phase === 'recording' ? handleStop : undefined}
              disabled={phase === 'processing'}
              activeOpacity={0.85}
              accessibilityLabel={
                phase === 'idle' ? t('falar.startRecording') : phase === 'recording' ? t('falar.stopRecording') : t('falar.processingA11y')
              }
            >
              {phase === 'processing' ? (
                <Animated.View style={spinStyle}>
                  <Loader2 size={40} color={colors.ink} strokeWidth={2.2} />
                </Animated.View>
              ) : phase === 'recording' ? (
                <Square size={40} color={colors.white} strokeWidth={0} fill={colors.white} />
              ) : (
                <Mic size={40} color={colors.ink} strokeWidth={2.2} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.statusLine}>
            {phase === 'idle' && (
              <View style={styles.hintRow}>
                <Sparkles size={14} color={colors.primaryDark} strokeWidth={2} />
                <Text style={styles.hintText}>{t('falar.exampleHint')}</Text>
              </View>
            )}
            {phase === 'recording' && (
              <Text style={styles.timer}>
                {formatDuration(recorder.durationMillis)} / {formatDuration(MAX_SECONDS * 1000)}
              </Text>
            )}
          </View>
        </View>

      </AnimatedPressable>
      </AnimatedPressable>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(21,27,36,0.4)',
  },
  sheetPanel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnDisabled: {
    opacity: 0.3,
  },
  headerTitle: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },

  // ── Body ──────────────────────────────────────────────────────────────────────
  body: {
    alignItems: 'center',
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.lg,
  },
  instructions: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },

  // ── Mic button ────────────────────────────────────────────────────────────────
  micWrap: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  pulse: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245,197,24,0.4)',
  },
  micBtn: {
    width: 112,
    height: 112,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  micBtnRecording: {
    backgroundColor: colors.coral,
  },
  micBtnProcessing: {
    opacity: 0.7,
  },

  // ── Status line (altura fixa pra não pular o layout) ─────────────────────────
  statusLine: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hintText: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  timer: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
});
