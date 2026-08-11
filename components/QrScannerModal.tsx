import { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { X } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
};

export function QrScannerModal({ visible, onClose, onScan }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scannedRef = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();

  async function handleShow() {
    scannedRef.current = false;
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(t('common.permissionNeeded'), t('qrScanner.cameraPermissionBody'));
        onClose();
      }
    }
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    onScan(data);
  }

  return (
    <Modal visible={visible} animationType="slide" onShow={handleShow} onRequestClose={onClose}>
      <View style={styles.container}>
        {visible && permission?.granted && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        )}

        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <X size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.frame} />

          <Text style={styles.hint}>{t('qrScanner.hint')}</Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.pagePadding,
  },
  closeBtn: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginTop: spacing.sm,
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: radius.xl,
    borderWidth: 3,
    borderColor: colors.white,
    marginTop: spacing.xxl,
  },
  hint: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
