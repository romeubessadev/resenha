import { useState } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { RecurrenceFreq } from '@/hooks/useExpenseForm';
import { useLanguage } from '@/hooks/useLanguage';
import type { TranslationKey } from '@/lib/i18n';

export function useVoiceRecorder() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);

  async function start(): Promise<boolean> {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  }

  async function stop(): Promise<string | null> {
    await recorder.stop();
    return recorder.uri;
  }

  return {
    start,
    stop,
    isRecording: state.isRecording,
    durationMillis: state.durationMillis,
    metering: state.metering,
  };
}

export type VoiceExpenseRecurrence = {
  freq: RecurrenceFreq;
  intervalDays: number | null;
  startDate: string | null;
  endDate: string | null;
};

export type VoiceExpenseResult = {
  transcript: string;
  title: string;
  amount: number;
  date: string | null;
  // A função ainda devolve `category` — app já publicado depende dela —, mas
  // este tipo a ignora de propósito: a categoria da despesa ditada é resolvida
  // pela fila depois de salvar, igual à digitada (ver grupo/falar.tsx).
  paidById: string;
  participantIds: string[];
  splitType: 'equal' | 'shares' | 'exact';
  shares: Record<string, number>;
  exactAmounts: Record<string, number>;
  recurrence: VoiceExpenseRecurrence | null;
};

export class PremiumRequiredError extends Error {}

const ERROR_MESSAGE_KEYS: Record<string, TranslationKey> = {
  empty_audio: 'voice.emptyAudio',
  empty_transcript: 'voice.emptyTranscript',
  group_not_found: 'voice.groupNotFound',
};

export function useParseVoiceExpense() {
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  async function parseVoiceExpense(groupId: string, audioUri: string): Promise<VoiceExpenseResult> {
    setLoading(true);
    try {
      const audioBuffer = await fetch(audioUri).then(res => res.arrayBuffer());
      const { data, error } = await supabase.functions.invoke('parse-voice-expense', {
        body: audioBuffer,
        headers: { 'x-group-id': groupId, 'Content-Type': 'audio/m4a' },
      });

      if (error) {
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => null);
          if (body?.error === 'premium_required') throw new PremiumRequiredError();
          const key = ERROR_MESSAGE_KEYS[body?.error];
          throw new Error(key ? t(key) : t('voice.understandFailed'));
        }
        throw new Error(t('voice.understandFailed'));
      }

      return data as VoiceExpenseResult;
    } finally {
      setLoading(false);
    }
  }

  return { parseVoiceExpense, loading };
}
