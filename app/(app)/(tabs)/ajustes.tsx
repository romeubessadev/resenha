import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import {
  Camera, Check, ChevronRight, Lock, Zap,
  Sun, Moon, Monitor, Bell, HelpCircle, FileText, ShieldCheck,
  LogOut,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, ChangePasswordSheet, ConfirmSheet, LimitPaywallSheet, NameSheet, PhotoViewerModal, PixKeySheet, SwipeTabs, WhatsAppSheet, Spinner } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useIsPremium } from '@/hooks/usePlan';
import { NOTIF_PREF_KEY, registerPushToken, unregisterPushToken } from '@/hooks/usePushToken';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';
import { useMyProfile, useUpdateMyAvatar } from '@/hooks/useProfile';
import { hexToRgba } from '@/lib/categoryColors';
import { buildPickImageTexts, pickImage } from '@/lib/imagePicker';
import { getProfileAvatarUrl } from '@/lib/profileAvatar';
import { countryFromPhone } from '@/lib/countries';
import { WHATSAPP_COUNTRY, formatNationalPhone, formatWhatsappDisplay, fromWhatsappNumber } from '@/lib/whatsapp';
import { formatPixKey, type PixKeyType } from '@/lib/pix';
import { supabase } from '@/lib/supabase';
import type { TranslationKey } from '@/lib/i18n';
import { fontFamilies, fontSizes, radius, shadows, spacing, type ColorPalette } from '@/theme';

const THEME_OPTIONS: { key: ThemeMode; labelKey: TranslationKey; icon: typeof Sun }[] = [
  { key: 'light', labelKey: 'profile.theme.light', icon: Sun },
  { key: 'dark', labelKey: 'profile.theme.dark', icon: Moon },
  { key: 'system', labelKey: 'profile.theme.system', icon: Monitor },
];

export default function AjustesScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: myProfile } = useMyProfile();
  const isPremium = useIsPremium();
  const { updateMyAvatar, loading: avatarUploading } = useUpdateMyAvatar();
  const { t } = useLanguage();
  const { mode: themeOption, setMode: setThemeOption, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const avatarUrl = getProfileAvatarUrl(myProfile?.avatar_path);

  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  const [whatsappSheetOpen, setWhatsappSheetOpen] = useState(false);
  const [pixSheetOpen, setPixSheetOpen] = useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  const [notifEnabled, setNotifEnabled] = useState(false);
  const notifThumbX = useSharedValue(2);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      const storedNotif = await AsyncStorage.getItem(NOTIF_PREF_KEY);
      const enabled = storedNotif === null ? status === 'granted' : storedNotif === 'true' && status === 'granted';
      setNotifEnabled(enabled);
      notifThumbX.value = enabled ? 22 : 2;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notifThumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: notifThumbX.value }] }));

  async function handleToggleNotif() {
    const next = !notifEnabled;

    if (next) {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let granted = existing === 'granted';
      if (!granted) {
        const { status } = await Notifications.requestPermissionsAsync();
        granted = status === 'granted';
      }
      if (!granted) {
        Alert.alert(t('common.permissionNeeded'), t('profile.notifPermissionBody'));
        return;
      }
    }

    setNotifEnabled(next);
    notifThumbX.value = withTiming(next ? 22 : 2, { duration: 150 });

    // Grava a preferência ANTES de mexer no token: registerPushToken lê essa
    // mesma chave e desiste se achar 'false', então registrar primeiro viraria
    // um no-op silencioso.
    await AsyncStorage.setItem(NOTIF_PREF_KEY, next ? 'true' : 'false');
    if (!userId) return;

    // Ligando, registra na hora em vez de esperar a próxima volta ao primeiro
    // plano. Desligando, tira o token da tabela — é o que de fato para o push,
    // já que o send-push dispara pra todo token que encontrar.
    if (next) registerPushToken(userId);
    else unregisterPushToken(userId);
  }

  async function handlePickAvatar() {
    if (avatarUploading || !userId) return;
    const asset = await pickImage(buildPickImageTexts(t, {
      sourceTitle: t('common.profilePhotoTitle'),
      galleryPermissionBody: t('profile.photoPermissionBody'),
    }), { allowsEditing: true, aspect: [1, 1] });
    if (!asset) return;
    try {
      await updateMyAvatar(userId, asset.uri, asset.mimeType ?? 'image/jpeg', myProfile?.avatar_path ?? null);
    } catch {
      Alert.alert(t('profile.photoUpdateFailedTitle'), t('common.tryAgain'));
    }
  }

  function handleSubscribe() {
    setPaywallOpen(false);
    Alert.alert(t('limitPaywall.cta'), t('paywall.notAvailableYet'));
  }

  async function handleLogout() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      setSigningOut(false);
      Alert.alert(t('profile.logoutFailedTitle'), t('common.tryAgain'));
    }
  }

  // Mesma string que o campo do sheet abre — sem DDI e sem bandeira, porque o
  // número é sempre brasileiro desde que o seletor de país saiu (ver
  // WHATSAPP_COUNTRY). Esta linha era a última que ainda mostrava "+55 …" com a
  // bandeira ao lado, resto do tempo em que dava pra escolher o país.
  //
  // Número salvo de OUTRO país, daquela época, continua em formato
  // internacional: remascarar dígitos estrangeiros no padrão brasileiro
  // mostraria um número diferente do salvo — mesma razão do campo do sheet
  // abrir vazio nesse caso.
  const whatsappSubtitle = myProfile?.whatsapp
    ? (countryFromPhone(myProfile.whatsapp) === WHATSAPP_COUNTRY
      ? formatNationalPhone(fromWhatsappNumber(myProfile.whatsapp), WHATSAPP_COUNTRY)
      : formatWhatsappDisplay(myProfile.whatsapp))
    : t('profile.addNumber');

  // O tipo vem do banco como texto solto (o check da tabela é que garante os 4
  // valores), então a linha só mostra a chave quando o par está completo — que
  // é o mesmo par que o profiles_pix_key_pair_check exige.
  const pixType = myProfile?.pix_key_type as PixKeyType | null | undefined;
  const pixSubtitle = myProfile?.pix_key && pixType
    ? `${t(`pixSheet.type.${pixType}`)} · ${formatPixKey(myProfile.pix_key, pixType)}`
    : t('profile.addPixKey');

  const sheetsOpen = nameSheetOpen || whatsappSheetOpen || pixSheetOpen || passwordSheetOpen || paywallOpen || logoutDialogOpen;

  return (
    <View style={styles.container}>
      <SwipeTabs onSwipeRight={() => { if (!sheetsOpen) router.replace('/carteira'); }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>{t('profile.title')}</Text>
          <Text style={styles.pageSubtitle}>{t('profile.subtitle')}</Text>
        </View>

        {/* Avatar + nome */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            {/* Só o Avatar entra no toque de expandir — o badge da câmera fica
                de fora, como irmão, pra continuar abrindo o seletor de foto. */}
            <TouchableOpacity
              activeOpacity={avatarUrl ? 0.85 : 1}
              disabled={!avatarUrl}
              onPress={() => setPhotoViewerOpen(true)}
            >
              <Avatar
                name={myProfile?.name ?? t('profile.you')}
                id={userId}
                photoUrl={avatarUrl ?? undefined}
                size={112}
                variant="colorful"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              disabled={avatarUploading}
            >
              {avatarUploading
                ? <Spinner size={20} color={colors.ink} />
                : <Camera size={16} color={colors.ink} strokeWidth={2.2} />}
            </TouchableOpacity>
          </View>

          {/* Só exibição — editar o nome mora na linha "Nome" de Dados
              pessoais, junto com WhatsApp e Chave Pix. */}
          <Text style={styles.userName}>{myProfile?.name || t('profile.you')}</Text>

          {session?.user.email && (
            <Text style={styles.userEmail}>{session.user.email}</Text>
          )}
        </View>

        {/* Dados pessoais */}
        <Text style={styles.sectionTitle}>{t('profile.section.personalInfo')}</Text>
        <View style={styles.group}>
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => setNameSheetOpen(true)}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t('profile.name')}</Text>
              <Text style={styles.rowHelper}>{myProfile?.name || t('profile.addName')}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => setWhatsappSheetOpen(true)}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t('profile.whatsapp')}</Text>
              <Text style={styles.rowHelper}>{whatsappSubtitle}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]} onPress={() => setPixSheetOpen(true)}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t('profile.pixKey')}</Text>
              <Text style={styles.rowHelper}>{pixSubtitle}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Segurança */}
        <Text style={styles.sectionTitle}>{t('profile.section.security')}</Text>
        <View style={styles.group}>
          <Pressable style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]} onPress={() => setPasswordSheetOpen(true)}>
            <Lock size={16} color={colors.textSecondary} strokeWidth={2} />
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t('profile.changePassword')}</Text>
              <Text style={styles.rowHelper}>{t('profile.changePasswordHelper')}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Assinatura */}
        <Text style={styles.sectionTitle}>{t('profile.section.subscription')}</Text>
        {isPremium ? (
          <View style={styles.planCard}>
            <View style={styles.planIconCircle}>
              <Zap size={20} color={colors.ink} fill={colors.ink} strokeWidth={0} />
            </View>
            <View style={styles.planTextCol}>
              <Text style={styles.planTitle}>{t('profile.brosPlusPlan')}</Text>
              <Text style={styles.planSubtitle}>{t('profile.activeHelper')}</Text>
            </View>
            <Check size={20} color={colors.ink} strokeWidth={2.4} />
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.planCard, pressed && styles.planCardPressed]}
            onPress={() => setPaywallOpen(true)}
          >
            <View style={styles.planIconCircle}>
              <Zap size={20} color={colors.ink} fill={colors.ink} strokeWidth={0} />
            </View>
            <View style={styles.planTextCol}>
              <Text style={styles.planTitle}>{t('profile.freePlan')}</Text>
              <Text style={styles.planSubtitle}>{t('profile.upgradeHelper')}</Text>
            </View>
            <View style={styles.planCta}>
              <Text style={styles.planCtaLabel}>{t('profile.plan.cta')}</Text>
              <ChevronRight size={12} color={colors.primary} strokeWidth={2.5} />
            </View>
          </Pressable>
        )}

        {/* Aparência */}
        <Text style={styles.sectionTitle}>{t('profile.section.appearance')}</Text>
        <View style={styles.segmented}>
          {THEME_OPTIONS.map(opt => {
            const active = themeOption === opt.key;
            const Icon = opt.icon;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.segmentChip, active && styles.segmentChipActive]}
                onPress={() => setThemeOption(opt.key)}
                activeOpacity={0.7}
              >
                <Icon size={16} color={active ? colors.ink : colors.textSecondary} strokeWidth={2.2} />
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{t(opt.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notificações */}
        <Text style={styles.sectionTitle}>{t('profile.section.notifications')}</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Bell size={16} color={colors.textSecondary} strokeWidth={2} />
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t('profile.pushTitle')}</Text>
              <Text style={styles.rowHelper}>{t('profile.pushHelper')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggleTrack, notifEnabled && styles.toggleTrackActive]}
              onPress={handleToggleNotif}
              activeOpacity={0.8}
            >
              <Animated.View style={[styles.toggleThumb, notifThumbStyle]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Suporte */}
        <Text style={styles.sectionTitle}>{t('profile.section.support')}</Text>
        <View style={styles.group}>
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => {}}>
            <HelpCircle size={16} color={colors.textSecondary} strokeWidth={2} />
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t('profile.help')}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => {}}>
            <FileText size={16} color={colors.textSecondary} strokeWidth={2} />
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t('profile.terms')}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]} onPress={() => {}}>
            <ShieldCheck size={16} color={colors.textSecondary} strokeWidth={2} />
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t('profile.privacy')}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Conta */}
        <Text style={styles.sectionTitle}>{t('profile.section.account')}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutDialogOpen(true)} activeOpacity={0.7}>
          <LogOut size={16} color={colors.textPrimary} strokeWidth={2} />
          <Text style={styles.logoutLabel}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Bros · v0.1</Text>
      </ScrollView>
      </SwipeTabs>

      <NameSheet
        visible={nameSheetOpen}
        onClose={() => setNameSheetOpen(false)}
        initialName={myProfile?.name ?? ''}
      />

      <WhatsAppSheet
        visible={whatsappSheetOpen}
        onClose={() => setWhatsappSheetOpen(false)}
        initialWhatsapp={myProfile?.whatsapp ?? null}
      />

      <PixKeySheet
        visible={pixSheetOpen}
        onClose={() => setPixSheetOpen(false)}
        initialKey={myProfile?.pix_key ?? null}
        initialType={pixType ?? null}
      />

      {avatarUrl && (
        <PhotoViewerModal
          visible={photoViewerOpen}
          onClose={() => setPhotoViewerOpen(false)}
          photoUrl={avatarUrl}
        />
      )}

      <ChangePasswordSheet
        visible={passwordSheetOpen}
        onClose={() => setPasswordSheetOpen(false)}
      />

      <LimitPaywallSheet
        visible={paywallOpen}
        reason="general"
        onClose={() => setPaywallOpen(false)}
        onUpgrade={handleSubscribe}
      />

      <ConfirmSheet
        visible={logoutDialogOpen}
        onClose={() => { if (!signingOut) setLogoutDialogOpen(false); }}
        title={t('profile.logoutConfirmTitle')}
        description={t('profile.logoutConfirmBody')}
        confirmLabel={t('profile.signOut')}
        confirmLoadingLabel={t('profile.signingOut')}
        onConfirm={handleLogout}
        loading={signingOut}
      />
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.pagePadding,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    gap: 2,
  },
  pageTitle: {
    fontSize: fontSizes.h1Lg,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Avatar + nome ─────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  avatarWrap: {
    width: 112,
    height: 112,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  userName: {
    fontSize: fontSizes.h1,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    marginTop: -spacing.xs / 2,
  },

  // ── Section title ─────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },

  // ── Group card (rows) ─────────────────────────────────────────────────────
  group: {
    borderRadius: radius['2xl'],
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },

  // ── Card de assinatura ───────────────────────────────────────────────────
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    padding: spacing.md,
    ...shadows.card,
  },
  planCardPressed: {
    opacity: 0.92,
  },
  planIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: hexToRgba(colors.ink, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  planTitle: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.bold,
    color: colors.ink,
  },
  planSubtitle: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.regular,
    color: hexToRgba(colors.ink, 0.8),
  },
  planCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
  },
  planCtaLabel: {
    fontSize: fontSizes.captionXs,
    fontFamily: fontFamilies.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  rowHelper: {
    fontSize: fontSizes.bodySm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },

  // ── Segmented Aparência ───────────────────────────────────────────────────
  segmented: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: 6,
  },
  segmentChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  segmentChipActive: {
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  segmentLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: colors.ink,
  },

  // ── Toggle ────────────────────────────────────────────────────────────────
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    ...shadows.card,
  },

  // ── Conta ─────────────────────────────────────────────────────────────────
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 48,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surface,
  },
  logoutLabel: {
    fontSize: fontSizes.h2Sm,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },

  // ── Rodapé ────────────────────────────────────────────────────────────────
  footer: {
    fontSize: fontSizes.captionSm,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
