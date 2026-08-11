import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { TranslationKey } from './i18n';

export type PickImageTexts = {
  sourceTitle: string;
  takePhoto: string;
  chooseFromGallery: string;
  cancel: string;
  permissionNeededTitle: string;
  cameraPermissionBody: string;
  galleryPermissionBody: string;
  openSettings: string;
};

type PickImageOptions = {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
};

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

// Monta os textos padrão do menu a partir do i18n. Dois variam por tela e vêm
// de fora: `sourceTitle` diz de que foto se trata (é o único texto do alert —
// ver pickImage abaixo) e `galleryPermissionBody` explica o motivo do acesso à
// galeria. Objeto em vez de dois parâmetros posicionais: são duas string
// seguidas, e trocadas de posição o `tsc` não acusaria nada.
export function buildPickImageTexts(
  t: TFunction,
  { sourceTitle, galleryPermissionBody }: { sourceTitle: string; galleryPermissionBody: string },
): PickImageTexts {
  return {
    sourceTitle,
    takePhoto: t('common.takePhoto'),
    chooseFromGallery: t('common.chooseFromGallery'),
    cancel: t('common.cancel'),
    permissionNeededTitle: t('common.permissionNeeded'),
    cameraPermissionBody: t('common.cameraPermissionBody'),
    galleryPermissionBody,
    openSettings: t('common.openSettings'),
  };
}

function alertPermissionDenied(texts: PickImageTexts, body: string) {
  Alert.alert(texts.permissionNeededTitle, body, [
    { text: texts.cancel, style: 'cancel' },
    { text: texts.openSettings, onPress: () => Linking.openSettings() },
  ]);
}

async function launchCamera(texts: PickImageTexts, opts: PickImageOptions): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    alertPermissionDenied(texts, texts.cameraPermissionBody);
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: opts.quality ?? 0.8, allowsEditing: opts.allowsEditing, aspect: opts.aspect });
  return result.canceled || !result.assets[0] ? null : result.assets[0];
}

async function launchGallery(texts: PickImageTexts, opts: PickImageOptions): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    alertPermissionDenied(texts, texts.galleryPermissionBody);
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: opts.quality ?? 0.8, allowsEditing: opts.allowsEditing, aspect: opts.aspect });
  return result.canceled || !result.assets[0] ? null : result.assets[0];
}

// Menu "Tirar foto / Escolher da galeria" reusado em todo fluxo que anexa uma
// imagem (perfil, foto da resenha, comprovante) — os textos vêm de fora porque o
// hook de i18n só existe dentro de componentes, não aqui.
export function pickImage(texts: PickImageTexts, opts: PickImageOptions = {}): Promise<ImagePicker.ImagePickerAsset | null> {
  return new Promise(resolve => {
    Alert.alert(
      texts.sourceTitle,
      undefined,
      [
        { text: texts.cancel, style: 'cancel', onPress: () => resolve(null) },
        { text: texts.takePhoto, onPress: () => { launchCamera(texts, opts).then(resolve); } },
        { text: texts.chooseFromGallery, onPress: () => { launchGallery(texts, opts).then(resolve); } },
      ],
      { onDismiss: () => resolve(null) },
    );
  });
}
