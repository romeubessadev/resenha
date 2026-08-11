import { useMemo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle, X } from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { hexToRgba } from '@/lib/categoryColors';
import { fontFamilies, fontSizes, radius, spacing, type ColorPalette } from '@/theme';

/** Uma das saídas quando a confirmação não é sim/não — "Apagar só esta" vs
 *  "Apagar e parar de repetir". Substitui o botão único. */
type ConfirmOption = {
  label: string;
  hint?: string;
  /** Pinta o rótulo de vermelho. Nas duas opções de apagar, as DUAS são
   *  destrutivas: o que muda entre elas é o alcance, não a gravidade. */
  danger?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  title: string;
  /** Opcional: um sheet que só oferece opções não precisa de parágrafo — as
   *  dicas de cada uma já explicam. */
  description?: string;
  /** Conteúdo extra entre a mensagem e a ação — avisos que só aquela tela
   *  conhece (saldo que vai ficar órfão, recorrência que continua). */
  children?: ReactNode;
  /** Substitui o botão único quando a escolha tem mais de uma saída. */
  options?: ConfirmOption[];
  /** Empilha DENTRO de um Modal que já está aberto (ver BottomSheetModal). */
  nested?: boolean;
  confirmLabel?: string;
  /** Rótulo enquanto a ação roda — "Tornando admin...", "Removendo...". É como
   *  o app inteiro mostra progresso em botão ("Salvando...", "Criando...",
   *  "Saindo..."), em vez de um indicador girando. Sem ele, o rótulo não muda. */
  confirmLoadingLabel?: string;
  onConfirm?: () => void;
  /** `danger` pinta o botão de vermelho — destruir, não só confirmar. */
  variant?: 'default' | 'danger';
  loading?: boolean;
  /** A ação não pode acontecer agora, e o motivo é uma REGRA (saldo pendente,
   *  por exemplo), não um erro. Preenchido, o sheet troca a mensagem e os
   *  botões por um card de aviso — a pessoa lê e fecha, sem apertar num botão
   *  que ia falhar. Mesmo tratamento que o "Sair da resenha" já dá ao caso. */
  blocked?: { title: string; message: string } | null;
};

/**
 * Confirmação no formato do app: sheet ancorado embaixo, ação sólida em largura
 * cheia e "Cancelar" como texto puro embaixo dela.
 *
 * A anatomia é a do "Sair da resenha" (LeaveGroupSheet), que é a confirmação mais
 * elaborada que o app tem — inclusive o estado bloqueado. Botões lado a lado
 * (como o sheet de apagar despesa ainda faz) dão o mesmo peso visual pra sair e
 * pra confirmar; empilhado, a ação é o que se vê primeiro e o cancelar não
 * disputa espaço com ela.
 */
export function ConfirmSheet({
  visible, onClose, onClosed, title, description, children, options, nested, confirmLabel,
  confirmLoadingLabel, onConfirm, variant = 'default', loading = false, blocked = null,
}: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const danger = variant === 'danger';
  const labelColor = danger ? colors.white : colors.ink;

  return (
    <BottomSheetModal visible={visible} onClose={onClose} onClosed={onClosed} nested={nested}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7} disabled={loading}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {blocked ? (
        // Sem botão de ação nem cancelar: não há o que confirmar. Fechar no X é
        // a única saída, igual ao estado bloqueado do "Sair da resenha".
        <View style={styles.warnCard}>
          <View style={styles.warnIconCircle}>
            <AlertCircle size={16} color={colors.coral} strokeWidth={2} />
          </View>
          <View style={styles.warnTextCol}>
            <Text style={styles.warnTitle}>{blocked.title}</Text>
            <Text style={styles.warnMessage}>{blocked.message}</Text>
          </View>
        </View>
      ) : (
        <>
          {!!description && <Text style={styles.message}>{description}</Text>}

          {children}

          {options ? (
            <View style={styles.optionList}>
              {options.map(option => (
                <TouchableOpacity
                  key={option.label}
                  style={styles.option}
                  onPress={option.onPress}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={[styles.optionLabel, option.danger && styles.optionLabelDanger]}>{option.label}</Text>
                  {!!option.hint && <Text style={styles.optionHint}>{option.hint}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.solidBtn, danger ? styles.solidBtnDanger : styles.solidBtnDefault, loading && styles.solidBtnLoading]}
              onPress={onConfirm}
              activeOpacity={0.85}
              disabled={loading}
            >
              {/* Texto puro: o botão primário do app não usa ícone, e aqui ele
                  seria a terceira vez que a mesma ação é dita — título, rótulo
                  e glifo. A cor já carrega a gravidade. */}
              <Text style={[styles.solidBtnLabel, { color: labelColor }]}>
                {loading ? (confirmLoadingLabel ?? confirmLabel) : confirmLabel}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7} disabled={loading}>
            <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </>
      )}
    </BottomSheetModal>
  );
}

// Medidas do LeaveGroupSheet: botão de 52 em pílula, cancelar em texto puro.
const createStyles = (colors: ColorPalette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.h2,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  message: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  solidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 52,
    borderRadius: radius.full,
  },
  solidBtnDefault: {
    backgroundColor: colors.primary,
  },
  solidBtnDanger: {
    backgroundColor: colors.danger,
  },
  solidBtnLoading: {
    opacity: 0.6,
  },
  solidBtnLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
  },
  optionList: {
    gap: spacing.xs,
  },
  option: {
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  optionLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  optionLabelDanger: {
    color: colors.danger,
  },
  optionHint: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  cancelBtn: {
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  // Mesmas medidas e cores do card de bloqueio do LeaveGroupSheet — os dois
  // dizem a mesma coisa ("acerte antes") e não podem parecer avisos diferentes.
  warnCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: hexToRgba(colors.coral, 0.1),
  },
  warnIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(colors.coral, 0.15),
  },
  warnTextCol: {
    flex: 1,
    gap: 2,
  },
  warnTitle: {
    fontSize: fontSizes.body,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  warnMessage: {
    fontSize: fontSizes.caption,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
