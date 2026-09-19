import { SarhChip, SarhButton } from '@/design-system/components';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image } from '@/components/ui/AppImage';
import { butcherMarket } from '@/constants/butcherMarket';
import { butcherTypography } from '@/constants/butcherTypography';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { computeProductLineTotal, resolveLineWeightKg } from '@/lib/butcherOrderPricing';
import {
  getProductQuantityMode,
  resolveLineQuantity,
  showsProductStepper,
} from '@/lib/butcherProductQuantity';
import { resolveMediaUrl } from '@/services/media';
import {
  cutLabelAr,
  type ButcherProduct,
  type CutType,
} from '@/services/butcherData';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80';

type ButcherProductOptionsModalProps = {
  visible: boolean;
  product: ButcherProduct | null;
  currencySymbol: string;
  onClose: () => void;
  onAddToCart: (input: {
    product: ButcherProduct;
    cutType: CutType;
    weightRaw: string;
  }) => void;
};

export function ButcherProductOptionsModal({
  visible,
  product,
  currencySymbol,
  onClose,
  onAddToCart,
}: ButcherProductOptionsModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [selectedCut, setSelectedCut] = useState<CutType>('whole');
  const [weight, setWeight] = useState('1');

  const quantityMode = product ? getProductQuantityMode(product) : 'none';

  useEffect(() => {
    if (!product) return;
    setSelectedCut(product.availableCuts[0] ?? 'whole');
    if (quantityMode === 'daftra_quantity') {
      setWeight('1');
    } else {
      setWeight(String(product.weightRange?.min ?? 1));
    }
  }, [product?.id, quantityMode]);

  const lineAmount = product ? resolveLineWeightKg(weight, product) : 0;
  const lineTotal = product ? computeProductLineTotal(product, lineAmount) : 0;

  const priceLabel = useMemo(() => {
    if (!product) return '';
    if (showsProductStepper(quantityMode)) {
      return `${lineTotal.toLocaleString('en-US')} ${currencySymbol}`;
    }
    return `${(product.priceFixed ?? 0).toLocaleString('en-US')} ${currencySymbol}`;
  }, [product, lineTotal, currencySymbol, quantityMode]);

  if (!product) return null;

  const handleAdd = () => {
    onAddToCart({ product, cutType: selectedCut, weightRaw: weight });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroText}>
              <View style={{ width: '100%' }}>
                <AppText style={styles.title}>{product.nameAr}</AppText>
              </View>
              {product.descriptionAr ? (
                <View style={{ width: '100%' }}>
                  <AppText style={styles.subtitle}>{product.descriptionAr}</AppText>
                </View>
              ) : null}
            </View>
            <Image
              source={{ uri: resolveMediaUrl(product.images[0]) ?? PLACEHOLDER }}
              style={styles.image}
              contentFit="cover"
            />
          </View>

          {/* طريقة التقطيع تُعرض في مرحلة تأكيد الطلب وليس هنا */}

          {quantityMode === 'sarh_weight' || quantityMode === 'daftra_weight' ? (
            <View style={styles.section}>
              <Text style={styles.weightTitle}>الوزن (كغ)</Text>
              <View style={styles.weightRow}>
                <Pressable
                  style={styles.weightBtn}
                  onPress={() => setWeight(String(Math.max(0.5, lineAmount - 0.5)))}
                >
                  <AppIcon name="remove" size={20} color={styles.iconColor.color} />
                </Pressable>
                <TextInput
                  style={styles.weightInput}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                <Pressable
                  style={styles.weightBtn}
                  onPress={() => setWeight(String(lineAmount + 0.5))}
                >
                  <AppIcon name="add" size={20} color={styles.iconColor.color} />
                </Pressable>
              </View>
              {product.weightRange ? (
                <Text style={styles.hint}>
                  من {product.weightRange.min} إلى {product.weightRange.max} كغ
                </Text>
              ) : null}
            </View>
          ) : null}

          {quantityMode === 'daftra_quantity' ? (
            <View style={styles.section}>
              <Text style={styles.weightTitle}>الكمية</Text>
              <View style={styles.weightRow}>
                <Pressable
                  style={styles.weightBtn}
                  onPress={() =>
                    setWeight(String(Math.max(1, resolveLineQuantity(weight) - 1)))
                  }
                >
                  <AppIcon name="remove" size={20} color={styles.iconColor.color} />
                </Pressable>
                <TextInput
                  style={styles.weightInput}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
                <Pressable
                  style={styles.weightBtn}
                  onPress={() =>
                    setWeight(String(Math.min(999, resolveLineQuantity(weight) + 1)))
                  }
                >
                  <AppIcon name="add" size={20} color={styles.iconColor.color} />
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{priceLabel}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={styles.totalLabel}>الإجمالي</AppText>
            </View>
          </View>
        </ScrollView>

        <SarhButton
          title="إضافة للسلة"
          fullWidth
          disabled={lineTotal <= 0}
          leftIcon="cart-outline"
          onPress={handleAdd}
          style={{
            backgroundColor: butcherMarket.action,
            borderColor: butcherMarket.action,
          }}
        />
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      maxHeight: '82%',
      backgroundColor: colors.bgDeep,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderSoft,
      marginBottom: spacing.md,
    },
    hero: {
      flexDirection: 'row',
            justifyContent: 'flex-end',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    image: {
      width: 72,
      height: 72,
      borderRadius: radius.md,
      flexShrink: 0,
    },
    heroText: { flex: 1, minWidth: 0, gap: 4 },
    title: {
      ...butcherTypography.title,
      color: colors.textPrimary,
    },
    subtitle: {
      ...butcherTypography.secondary,
      color: colors.textMuted,
    },
    section: { marginBottom: spacing.lg, gap: spacing.sm },
    sectionTitle: {
      ...butcherTypography.primary,
      color: colors.textPrimary,
    },
    chips: {
      flexDirection: 'row',
            justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 10,
    },
    weightTitle: {
      ...butcherTypography.primary,
      color: colors.textPrimary,
      width: '100%',
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    weightRow: {
      flexDirection: 'row',
            alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: colors.bgSurface,
      borderRadius: radius.lg,
      padding: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    weightBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgElevated,
    },
    weightInput: {
      minWidth: 72,
      ...butcherTypography.title,
      color: colors.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
      paddingVertical: 4,
    },
    hint: {
      ...butcherTypography.meta,
      color: colors.textMuted,
      width: '100%',
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    iconColor: { color: colors.textPrimary },
    totalRow: {
      flexDirection: 'row',
            justifyContent: 'flex-end',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    totalLabel: {
      ...butcherTypography.primary,
      color: colors.textSecondary,
    },
    totalValue: {
      ...butcherTypography.title,
      color: colors.textPrimary,
    },
    cta: {
      flexDirection: 'row',
            alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: butcherMarket.action,
      borderRadius: radius.pill,
      paddingVertical: 11,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
      alignSelf: 'center',
      minWidth: '55%',
    },
    ctaDisabled: { opacity: 0.5 },
    ctaText: {
      ...butcherTypography.emphasis,
      color: '#fff',
      writingDirection: 'rtl',
    },
  });
}
