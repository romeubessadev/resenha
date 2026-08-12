import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowRight, ArrowLeft, Mic, MessageCircle, Copy, QrCode, Wallet, Lock } from 'lucide-react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button } from '@/components';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/currencies';
import {
  EMPTY_ANSWERS,
  markOnboardingDone,
  saveOnboardingAnswers,
  type OnboardingAnswers,
  type OnboardingGroupType,
  type OnboardingSplit,
} from '@/lib/onboarding';
import type { TranslationKey } from '@/lib/i18n';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

// Emoji, e não lucide, no tour e nos dois paywalls — decisão explícita pra
// bater com os mockups. No app pós-login a regra continua sendo lucide.
//
// A troca por lucide chegou a ser feita e foi DESFEITA: o argumento técnico
// (o tour já usa Mic, Wallet, QrCode em traço, então o mesmo microfone
// aparecia de dois jeitos) perdeu pro que essas telas existem pra fazer —
// encantar e converter. Cor e volume valem mais aqui do que coerência de
// traço. Quem quiser reabrir, reabra por CONVERSÃO, não por consistência.
const WELCOME_ITEMS = [
  { emoji: '📋', key: 'onboarding.welcomeItem1' },
  { emoji: '🎙️', key: 'onboarding.welcomeItem2' },
  { emoji: '⚡', key: 'onboarding.welcomeItem3' },
] as const satisfies readonly { emoji: string; key: TranslationKey }[];

const GROUP_TYPES = [
  { value: 'viagem', emoji: '🏖️', title: 'onboarding.typeViagem', desc: 'onboarding.typeViagemDesc', demoName: 'onboarding.nameViagem' },
  { value: 'republica', emoji: '🏠', title: 'onboarding.typeRepublica', desc: 'onboarding.typeRepublicaDesc', demoName: 'onboarding.nameRepublica' },
  { value: 'galera', emoji: '🍻', title: 'onboarding.typeGalera', desc: 'onboarding.typeGaleraDesc', demoName: 'onboarding.nameGalera' },
  { value: 'outro', emoji: '✨', title: 'onboarding.typeOutro', desc: 'onboarding.typeOutroDesc', demoName: 'onboarding.nameOutro' },
] as const satisfies readonly {
  value: OnboardingGroupType; emoji: string; title: TranslationKey; desc: TranslationKey; demoName: TranslationKey;
}[];

// Elenco fixo da demonstração. Nomes de verdade em vez de "Amigo 1" — o app já
// usa Léo e Ju no exemplo da tela de voz (falar.exampleHint), então é o mesmo
// vocabulário. Não são chaves de i18n: nome próprio não se traduz.
const DEMO_FRIENDS = ['Léo', 'Ju', 'Rafa'] as const;
const DEMO_PEOPLE = DEMO_FRIENDS.length + 1;

const SPLIT_OPTIONS = [
  { value: 'equal', title: 'onboarding.splitEqual', desc: 'onboarding.splitEqualDesc' },
  { value: 'exact', title: 'onboarding.splitExact', desc: 'onboarding.splitExactDesc' },
  { value: 'shares', title: 'onboarding.splitShares', desc: 'onboarding.splitSharesDesc' },
] as const satisfies readonly { value: OnboardingSplit; title: TranslationKey; desc: TranslationKey }[];

/** Passos com barra de progresso: as 2 perguntas mais prévia, voz e
 *  resultado. O boas-vindas fica de fora — lá ainda não começou o tour. */
const PROGRESS_STEPS = 5;
/** Só as perguntas mostram o selo "N de 2". */
const QUESTION_STEPS = 2;
/** Tempo pro estado selecionado aparecer antes de avançar — sem isso o card
 *  escolhido nunca chega a ser visto. */
const ADVANCE_DELAY_MS = 180;
/** Último passo do tour; daí sai pro paywall. */
const LAST_STEP = 5;
/** Passo da prévia da resenha. */
const PREVIEW_STEP = 3;
/** Passo da vitrine de voz e quanto tempo a "gravação" encenada dura. */
const VOICE_STEP = 4;
const VOICE_DEMO_MS = 1800;

// A demonstração sai das respostas: o TIPO escolhe qual despesa aparece e a
// DIVISÃO define a conta. Sem isso o tour vira telas soltas — a pessoa escolhe
// "Casa" e vê um Uber, ou escolhe "por partes" e vê tudo dividido igual.
//
// Valor por pessoa, e não total fixo: mantém o número redondo em qualquer
// combinação de tipo e divisão.
const DEMO_UNIT: Record<OnboardingGroupType, number> = {
  viagem: 50,
  republica: 80,
  galera: 40,
  outro: 45,
};

// Despesa de consumo em todos os tipos, de propósito: jantar, mercado, bar e
// delivery se dividem igual, por consumo OU por partes sem soar forçado. Isso
// evita ter um exemplo por combinação de tipo × divisão (seriam 12).
const DEMO_TITLE: Record<OnboardingGroupType, TranslationKey> = {
  viagem: 'onboarding.demoViagem',
  republica: 'onboarding.demoRepublica',
  galera: 'onboarding.demoGalera',
  outro: 'onboarding.demoOutro',
};

// Título com artigo, pra caber numa frase falada ("Eu paguei **a conta do
// bar**"). O título "de tela" não serve: no card de resultado ele aparece
// sozinho, capitalizado e sem artigo.
const DEMO_TITLE_SPOKEN: Record<OnboardingGroupType, TranslationKey> = {
  viagem: 'onboarding.demoViagemSpoken',
  republica: 'onboarding.demoRepublicaSpoken',
  galera: 'onboarding.demoGaleraSpoken',
  outro: 'onboarding.demoOutroSpoken',
};

const RESULT_SPLIT_LINE: Record<OnboardingSplit, TranslationKey> = {
  equal: 'onboarding.resultSplitEqual',
  exact: 'onboarding.resultSplitExact',
  shares: 'onboarding.resultSplitShares',
};


// Diferença de consumo por pessoa, somada ao valor unitário do tipo. Escolhidos
// pra dar número redondo em qualquer um dos quatro valores unitários — é o
// único ponto da demonstração em que os valores são inventados em vez de
// calculados (nos outros dois a conta é divisão pura).
const EXACT_OFFSETS = [40, 10, -20, -30, 0, -10];

type Demo = { total: number; mine: number; friends: number[] };

function buildDemo(type: OnboardingGroupType, split: OnboardingSplit, people: number): Demo {
  const unit = DEMO_UNIT[type];

  if (split === 'exact') {
    const shares = Array.from({ length: people }, (_, i) => unit + (EXACT_OFFSETS[i] ?? 0));
    return { total: shares.reduce((s, v) => s + v, 0), mine: shares[0], friends: shares.slice(1) };
  }

  // "Eu pago o dobro": você vale 2 partes, cada amigo vale 1, então o total é
  // de (n+1) partes em vez de n.
  if (split === 'shares') {
    return { total: unit * (people + 1), mine: unit * 2, friends: Array(people - 1).fill(unit) };
  }

  return { total: unit * people, mine: unit, friends: Array(people - 1).fill(unit) };
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);

  const peopleCount = DEMO_PEOPLE;
  const selectedType = GROUP_TYPES.find(g => g.value === answers.groupType) ?? GROUP_TYPES[0];
  const selectedSplit = answers.split ?? 'equal';
  const demo = buildDemo(selectedType.value, selectedSplit, peopleCount);
  const demoTitle = t(DEMO_TITLE[selectedType.value]);

  // Frase em primeira pessoa, como alguém realmente dita — e não por estilo: é
  // assim que a parse-voice-expense foi construída pra ouvir. "Eu paguei" vira
  // `paidById`, citar os nomes vira `participantIds`, e "2 partes pra mim" é o
  // gatilho documentado de `shares` no prompt dela.
  //
  // "Por consumo" precisa DITAR os valores: sem eles a IA não teria como saber
  // quanto cada um consumiu, e os números da tela seguinte viriam do nada.
  const voicePhrase = useMemo(() => {
    const join = (items: string[]) => (items.length > 1
      ? `${items.slice(0, -1).join(', ')} ${t('onboarding.voiceAnd')} ${items[items.length - 1]}`
      : items[0] ?? '');

    const title = t(DEMO_TITLE_SPOKEN[selectedType.value]);
    const amount = formatMoney(demo.total);
    const friends = DEMO_FRIENDS.slice(0, demo.friends.length);

    if (selectedSplit === 'exact') {
      const others = join(demo.friends.map((v, i) => `${friends[i]} ${v}`));
      return t('onboarding.voicePhraseExact', { title, amount, mine: demo.mine, others });
    }
    if (selectedSplit === 'shares') {
      return t('onboarding.voicePhraseShares', { title, amount, others: join([...friends]) });
    }
    return t('onboarding.voicePhraseEqual', {
      title, amount, people: join([t('onboarding.voiceMe'), ...friends]),
    });
  }, [selectedSplit, selectedType.value, demo, t]);
  // Nome da resenha: o que ela digitou, ou a sugestão do tipo enquanto não mexeu.
  const groupName = answers.name ?? t(selectedType.demoName);

  // Grava a sugestão assim que a prévia aparece. Sem isto, quem não editava o
  // campo terminava o tour com `name` nulo — a tela mostrava "Resenha da praia",
  // nada era salvo, e a resenha não nascia depois do cadastro.
  useEffect(() => {
    if (step !== PREVIEW_STEP || answers.name !== null) return;
    setAnswers(prev => {
      const next = { ...prev, name: groupName };
      saveOnboardingAnswers(next);
      return next;
    });
  }, [step, answers.name, groupName]);

  // O microfone NÃO é tocável de propósito. Sem sessão autenticada não há como
  // transcrever nada, e um botão que responde ao toque faria a pessoa falar e
  // acreditar que o app ouviu — pior do que não ter interação. Aqui é uma
  // animação que roda sozinha ao entrar no passo: grava, mostra a frase de
  // exemplo, segue. Fica claro que é demonstração, não captação.
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState(false);
  const pulse = useSharedValue(0);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value,
    transform: [{ scale: 1 + pulse.value * 0.6 }],
  }));

  useEffect(() => {
    if (step !== VOICE_STEP) return;

    setHeard(false);
    setRecording(true);
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) }), -1, false);

    const timer = setTimeout(() => {
      cancelAnimation(pulse);
      pulse.value = 0;
      setRecording(false);
      setHeard(true);
    }, VOICE_DEMO_MS);

    return () => {
      clearTimeout(timer);
      cancelAnimation(pulse);
      pulse.value = 0;
    };
  }, [step, pulse]);

  // Terminar e pular levam ao paywall — a ordem "Onboarding → Paywall → Auth"
  // do CLAUDE.md vale também pra quem pulou: pular dispensa a demonstração, não
  // a oferta. Marca como visto pra não repetir o tour na próxima vez.
  function finishTour() {
    markOnboardingDone();
    router.replace('/(pre-auth)/paywall');
  }

  // Grava a cada resposta em vez de só no fim: quem abandona no meio do tour
  // não perde o que já respondeu.
  function answer(patch: Partial<OnboardingAnswers>) {
    const next = { ...answers, ...patch };
    setAnswers(next);
    saveOnboardingAnswers(next);
    setTimeout(() => setStep(s => s + 1), ADVANCE_DELAY_MS);
  }

  if (step === 0) {
    const [titleStart, titleAccent = '', titleEnd = ''] = t('onboarding.welcomeTitle').split(/[[\]]/);

    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
        {/* Voltar pra capa, e não "já tenho conta": a capa fica logo atrás e já
            oferece o login. Sair por aqui NÃO marca o tour como visto — quem
            volta e toca em "Bora rachar" de novo merece vê-lo. */}
        <View style={styles.topRow}>
          <TouchableOpacity style={[styles.backBtn, styles.welcomeBackBtn]} onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.textPrimary} strokeWidth={2.2} />
          </TouchableOpacity>
          <Image source={require('@/assets/logo-resenha.png')} style={styles.wordmark} resizeMode="contain" />
        </View>

        <View style={styles.welcomeBody}>
          <View style={styles.eyebrowPill}>
            <Text style={styles.eyebrowLabel}>{t('onboarding.welcomeEyebrow')}</Text>
          </View>

          <Text style={styles.welcomeTitle}>
            {titleStart}
            <Text style={styles.titleAccent}>{titleAccent}</Text>
            {titleEnd}
          </Text>

          <Text style={styles.welcomeSubtitle}>{t('onboarding.welcomeSubtitle')}</Text>

          <View style={styles.itemList}>
            {WELCOME_ITEMS.map(item => (
              <View key={item.key} style={styles.itemCard}>
                <View style={styles.itemEmojiCircle}>
                  <Text style={styles.itemEmoji}>{item.emoji}</Text>
                </View>
                <Text style={styles.itemLabel}>{t(item.key)}</Text>
              </View>
            ))}
          </View>
        </View>

        <Button
          label={t('onboarding.welcomeCta')}
          onPress={() => setStep(1)}
          variant="dark"
          raised
          iconRight={<ArrowRight size={20} color={colors.white} strokeWidth={2.4} />}
          style={styles.cta}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.stepHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)} hitSlop={8} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.textPrimary} strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / PROGRESS_STEPS) * 100}%` }]} />
        </View>

        <TouchableOpacity onPress={finishTour} hitSlop={8} activeOpacity={0.7}>
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeLabel}>
          {step <= QUESTION_STEPS
            ? t('onboarding.stepBadge', { current: step, total: QUESTION_STEPS })
            : step === 3 ? t('onboarding.previewBadge')
              : step === 4 ? t('onboarding.voiceBadge')
                : t('onboarding.resultBadge')}
        </Text>
      </View>

      <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepScrollContent} showsVerticalScrollIndicator={false}>

      {step === 1 && (
        <>
          <Text style={styles.stepTitle}>{t('onboarding.typeTitle')}</Text>
          <Text style={styles.stepSubtitle}>{t('onboarding.typeSubtitle')}</Text>

          <View style={styles.typeGrid}>
            {GROUP_TYPES.map(type => {
              const selected = answers.groupType === type.value;
              return (
                <View key={type.value} style={styles.typeCardWrap}>
                  {selected && <View style={styles.typeCardRaise} />}
                  <TouchableOpacity
                    style={[styles.typeCard, selected && styles.typeCardSelected]}
                    onPress={() => answer({ groupType: type.value })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.typeEmoji}>{type.emoji}</Text>
                    <Text style={styles.typeTitle}>{t(type.title)}</Text>
                    <Text style={styles.typeDesc}>{t(type.desc)}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.stepTitle}>{t('onboarding.splitTitle')}</Text>
          <Text style={styles.stepSubtitle}>{t('onboarding.splitSubtitle')}</Text>

          <View style={styles.splitList}>
            {SPLIT_OPTIONS.map(option => {
              const selected = answers.split === option.value;
              return (
                <View key={option.value} style={styles.splitCardWrap}>
                  {selected && <View style={styles.splitCardRaise} />}
                  <TouchableOpacity
                    style={[styles.splitCard, selected && styles.splitCardSelected]}
                    onPress={() => answer({ split: option.value })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.splitTitle}>{t(option.title)}</Text>
                    <Text style={styles.splitDesc}>{t(option.desc)}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </>
      )}

      {step === 3 && (
        <>
          <Text style={styles.stepTitle}>{t('onboarding.previewTitle')}</Text>
          <Text style={styles.stepSubtitle}>{t('onboarding.previewSubtitle')}</Text>

          <View style={styles.previewWrap}>
            <View style={styles.previewRaise} />
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                {/* Iniciais, e não o emoji do tipo: é assim que o app desenha
                    resenha sem foto (ver CreateRoleSheet). Como o nome é editável,
                    as iniciais acompanham o que a pessoa digita — a prévia
                    mostra o avatar que a resenha vai ter de verdade. */}
                <Avatar name={groupName} id="onboarding-preview" variant="warm" size={56} />
                <View style={styles.previewHeaderText}>
                  <Text style={styles.previewEyebrow}>{t('onboarding.previewNewGroup')}</Text>
                  {/* Editável: é este nome que vira a resenha de verdade depois do
                      cadastro, então a tela 5 mostra exatamente o que vai existir. */}
                  <TextInput
                    style={styles.previewNameInput}
                    value={groupName}
                    onChangeText={text => setAnswers(prev => {
                      const next = { ...prev, name: text };
                      saveOnboardingAnswers(next);
                      return next;
                    })}
                    maxLength={60}
                    returnKeyType="done"
                  />
                  {/* A resenha nasce só com você — quem entra é quem aceitar o
                      convite. Anunciar "4 pessoas" aqui prometeria membros que
                      não existem na resenha criada. */}
                  <Text style={styles.previewMembers}>{t('onboarding.previewSolo')}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.inviteBox}>
            <View style={styles.inviteHeader}>
              <Text style={styles.inviteTitle}>{t('onboarding.previewInviteTitle')}</Text>
              <View style={styles.invitePill}>
                <Lock size={11} color={colors.textSecondary} strokeWidth={2.2} />
                <Text style={styles.invitePillLabel}>{t('onboarding.previewInviteLocked')}</Text>
              </View>
            </View>

            <View style={styles.inviteRow}>
              <View style={styles.inviteChannel}>
                <MessageCircle size={18} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.inviteChannelLabel}>WhatsApp</Text>
              </View>
              {/* Código, e não link: o convite real é por código (ver
                  InviteQrSheet) — o QR carrega o código puro e a mensagem do
                  WhatsApp manda usá-lo. Não existe URL de convite no app. */}
              <View style={styles.inviteChannel}>
                <Copy size={18} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.inviteChannelLabel}>{t('onboarding.previewInviteCode')}</Text>
              </View>
              <View style={styles.inviteChannel}>
                <QrCode size={18} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.inviteChannelLabel}>QR Code</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {step === 4 && (
        <>
          <Text style={styles.stepTitle}>{t('onboarding.voiceTitle')}</Text>
          <Text style={styles.stepSubtitle}>{t('onboarding.voiceSubtitle')}</Text>

          {heard && (
            <View style={styles.heardCard}>
              <Text style={styles.heardEyebrow}>{t('onboarding.voiceExampleLabel')}</Text>
              <Text style={styles.heardText}>{voicePhrase}</Text>
            </View>
          )}

          <View style={styles.micArea}>
            <View style={styles.micCircleBox}>
              {recording && <Animated.View style={[styles.micPulse, pulseStyle]} />}
              <View style={[styles.micCircle, recording && styles.micCircleActive]}>
                <Mic size={40} color={recording ? colors.white : colors.textSecondary} strokeWidth={2} />
              </View>
            </View>

            <Text style={styles.voiceHint}>
              {recording ? t('onboarding.voiceRecording') : t('onboarding.voiceHint')}
            </Text>
          </View>
        </>
      )}

      {step === 5 && (
        <>
          <Text style={styles.stepTitle}>{t('onboarding.resultTitle')}</Text>
          <Text style={styles.stepSubtitle}>{t('onboarding.resultSubtitle')}</Text>

          <View style={styles.resultWrap}>
            <View style={styles.resultRaise} />
            <View style={styles.resultCard}>
              <View style={styles.resultTop}>
                <Text style={styles.resultExpenseTitle}>{demoTitle}</Text>
                <Text style={styles.resultAmount}>{formatMoney(demo.total)}</Text>
                <Text style={styles.resultSplitLine}>
                  {t(RESULT_SPLIT_LINE[selectedSplit], { n: peopleCount })}
                </Text>
              </View>

              <View style={styles.resultDivider} />

              {/* A sua parte primeiro: sem ela a conta não fecha na tela. Em
                  "por partes" e "por consumo" o seu valor é diferente do dos
                  outros, e era justamente ele que não aparecia. */}
              <View style={styles.resultRow}>
                <Avatar name={t('onboarding.resultYou')} id="onboarding-me" size="md" variant="warm" />
                <Text style={styles.resultRowName}>{t('onboarding.resultYou')}</Text>
                <Text style={styles.resultRowMine}>
                  {t('onboarding.resultYourShare', { amount: formatMoney(demo.mine) })}
                </Text>
              </View>

              {demo.friends.map((owed, i) => {
                const name = DEMO_FRIENDS[i];
                return (
                  <View key={i} style={styles.resultRow}>
                    <Avatar name={name} id={`onboarding-friend-${i}`} size="md" variant="warm" />
                    <Text style={styles.resultRowName}>{name}</Text>
                    <Text style={styles.resultRowOwes}>
                      {t('onboarding.resultOwes', { amount: formatMoney(owed) })}
                    </Text>
                  </View>
                );
              })}

              <View style={styles.resultFooter}>
                <Wallet size={20} color={colors.primaryDark} strokeWidth={2} />
                <View style={styles.resultFooterText}>
                  <Text style={styles.resultFooterLabel}>{t('onboarding.resultYouReceive')}</Text>
                  <Text style={styles.resultFooterValue}>
                    {formatMoney(demo.total - demo.mine)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.resultFootnote}>{t('onboarding.resultFootnote')}</Text>
        </>
      )}

      </ScrollView>

      {step >= 3 && (
        <Button
          label={t(step === 3 ? 'onboarding.previewCta' : step === 4 ? 'onboarding.voiceCta' : 'onboarding.resultCta')}
          onPress={() => (step >= LAST_STEP ? finishTour() : setStep(s => s + 1))}
          // Travado enquanto a "gravação" roda: avançar antes do card aparecer
          // pularia justamente o que a tela existe pra mostrar. O "Pular" segue
          // livre — quem quer sair do tour não pode ficar preso 1,8s.
          disabled={step === VOICE_STEP && recording}
          variant="dark"
          raised
          iconRight={<ArrowRight size={20} color={colors.white} strokeWidth={2.4} />}
          style={styles.cta}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.pagePadding,
  },

  // ── Boas-vindas ─────────────────────────────────────────────────────────────
  // Logo ao centro com a seta ancorada à esquerda — mesma posição de voltar
  // que os outros passos usam.
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A mesma bolinha de voltar dos passos, mas ancorada à esquerda pra deixar a
  // logo centralizada de verdade.
  welcomeBackBtn: {
    position: 'absolute',
    left: 0,
  },
  // Mesmo tamanho do logo no header de (tabs)/grupos: os dois são marca de
  // CABEÇALHO, não abertura. A 64x32 ele ficava menor que o botão de voltar
  // ao lado (40px), o que lia como logo encolhido em vez de discreto.
  //
  // Não vai a 112 nem 128 (os tamanhos de login/signup) de propósito: ali o
  // logo é a âncora da tela; aqui ele acompanha o título da capa, que é o que
  // precisa ser lido primeiro.
  wordmark: {
    width: 88,
    height: 44,
  },
  welcomeBody: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  eyebrowLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  welcomeTitle: {
    fontSize: fontSizes.heroLg,
    lineHeight: fontSizes.heroLg + 6,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  titleAccent: {
    color: colors.primary,
  },
  welcomeSubtitle: {
    marginTop: spacing.md,
    fontSize: fontSizes.h2,
    lineHeight: 22,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  itemList: {
    marginTop: spacing.xl,
    gap: spacing.sm + 2,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.background,
    borderRadius: radius['2xl'],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  itemEmojiCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  itemEmoji: {
    fontSize: fontSizes.h2,
  },
  itemLabel: {
    flex: 1,
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  cta: {
    marginTop: spacing.lg,
  },

  // ── Moldura dos passos ──────────────────────────────────────────────────────
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  skip: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  stepBadgeLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stepTitle: {
    fontSize: fontSizes.display,
    lineHeight: fontSizes.display + 6,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    marginTop: spacing.sm,
    fontSize: fontSizes.h2,
    lineHeight: 22,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Tipo de resenha ────────────────────────────────────────────────────────────
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
  },
  typeCardWrap: {
    width: '48%',
    flexGrow: 1,
  },
  // Mesma linguagem do botão "chunky" do app: barra da cor da marca aparecendo
  // por baixo do card escolhido.
  typeCardRaise: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    bottom: -3,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
  },
  typeCard: {
    minHeight: 148,
    justifyContent: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.md,
  },
  typeCardSelected: {
    borderColor: colors.textPrimary,
  },
  typeEmoji: {
    fontSize: 30,
    marginBottom: spacing.md,
  },
  typeTitle: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  typeDesc: {
    marginTop: 2,
    fontSize: fontSizes.bodySm,
    lineHeight: 18,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Quantidade de pessoas ───────────────────────────────────────────────────

  // ── Forma de dividir ────────────────────────────────────────────────────────
  splitList: {
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
  },
  splitCardWrap: {
    width: '100%',
  },
  splitCardRaise: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    bottom: -3,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
  },
  splitCard: {
    backgroundColor: colors.background,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.md,
  },
  splitCardSelected: {
    borderColor: colors.textPrimary,
  },
  splitTitle: {
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  splitDesc: {
    marginTop: 2,
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Prévia da resenha ──────────────────────────────────────────────────────────
  stepScroll: {
    flex: 1,
  },
  stepScrollContent: {
    paddingBottom: spacing.md,
  },
  previewWrap: {
    marginTop: spacing.lg,
  },
  previewRaise: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    bottom: -4,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
  },
  previewCard: {
    backgroundColor: colors.background,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    gap: spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  previewHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  previewEyebrow: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewNameInput: {
    marginTop: 2,
    paddingVertical: 0,
    fontSize: fontSizes.h1,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
  },
  previewMembers: {
    marginTop: 2,
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  inviteBox: {
    marginTop: spacing.lg,
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inviteTitle: {
    flex: 1,
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  invitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  invitePillLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // Sem `TouchableOpacity`: o convite só existe depois da conta, então isto é
  // demonstração do que vem a seguir, não um botão que finge funcionar.
  inviteChannel: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
  },
  inviteChannelLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },

  // ── Lança falando ───────────────────────────────────────────────────────────
  heardCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius['2xl'],
    padding: spacing.md,
  },
  heardEyebrow: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heardText: {
    marginTop: spacing.sm,
    fontSize: fontSizes.h1Sm,
    lineHeight: 24,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  micArea: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  micCircleBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micPulse: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  micCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  micCircleActive: {
    backgroundColor: colors.coral,
  },
  voiceHint: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  // ── Resultado ───────────────────────────────────────────────────────────────
  resultWrap: {
    marginTop: spacing.lg,
  },
  resultRaise: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    bottom: -4,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
  },
  resultCard: {
    backgroundColor: colors.background,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  resultTop: {
    padding: spacing.md,
  },
  resultEyebrow: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  resultExpenseTitle: {
    marginTop: spacing.xs,
    fontSize: fontSizes.h1,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  resultAmount: {
    marginTop: spacing.sm,
    fontSize: fontSizes.hero,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  resultSplitLine: {
    marginTop: 2,
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  resultDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  resultRowName: {
    flex: 1,
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  resultRowOwes: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.coralDeep,
    fontVariant: ['tabular-nums'],
  },
  // Neutro, e não coral: a sua parte não é uma dívida com você mesmo.
  resultRowMine: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  resultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  resultFooterText: {
    flex: 1,
  },
  resultFooterLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  resultFooterValue: {
    marginTop: 2,
    fontSize: fontSizes.h1Sm,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  resultFootnote: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: fontSizes.body,
    lineHeight: 19,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
});
