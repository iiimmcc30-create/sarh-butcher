// SAFAT — Butcher Order Screen (صفحة الطلب + الدفع)
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image } from '@/components/ui/AppImage';
import { AppText, SarhButton, SarhChip } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { DeliveryMapAddressField } from '@/components/butchers/DeliveryMapAddressField';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { butcherMarket } from '@/constants/butcherMarket';
import { butcherTypography } from '@/constants/butcherTypography';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlInputText } from '@/lib/rtl';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { startButcherCheckout } from '@/services/butcherOrders';
import { resolveMediaUrl } from '@/services/media';
import {
  CATEGORY_LABELS,
  ButcherProduct,
  CutType,
  DeliveryType,
  MeatCategory,
  cutLabelAr,
  gccCurrencies,
  mapButcherFromApi,
  mapButcherProductFromApi,
  routeParam,
  type ButcherProfile,
} from '@/services/butcherData';
import { PAYMENT_METHODS, NIPaymentMethod } from '@/services/network_international';
import { formatDeliveryAddressLine, loadDeliveryLocation } from '@/services/butcherDeliveryLocation';
import { computeProductLineTotal, resolveLineWeightKg } from '@/lib/butcherOrderPricing';
import {
  formatOrderQuantityLabel,
  getProductQuantityMode,
  resolveLineQuantity,
  showsProductStepper,
} from '@/lib/butcherProductQuantity';

const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80';

export default function ButcherOrderScreen() {
  const params = useLocalSearchParams<{ productId?: string; butcherId?: string }>();
  const butcherId = routeParam(params.butcherId);
  const initialProductId = routeParam(params.productId);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors: c }) => createStyles(c));

  const [butcher, setButcher] = useState<ButcherProfile | null>(null);
  const [products, setProducts] = useState<ButcherProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCut, setSelectedCut] = useState<CutType>('whole');
  const [weight, setWeight] = useState('1');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<NIPaymentMethod>('mada');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!butcherId) {
      setLoadError('معرّف الملحمة غير صالح');
      setLoading(false);
      return;
    }

    let active = true;
    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const headers: HeadersInit = accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {};

        const [resButcher, savedLoc] = await Promise.all([
          fetch(`${API_BASE}/api/butchers/${butcherId}`, { headers }),
          loadDeliveryLocation(),
        ]);

        if (!active) return;

        if (savedLoc) {
          setAddress(formatDeliveryAddressLine(savedLoc));
        }

        let butcherJson: { success?: boolean; data?: Record<string, unknown> } | null = null;

        if (resButcher.ok) {
          butcherJson = await resButcher.json();
          if (butcherJson?.success && butcherJson.data) {
            setButcher(mapButcherFromApi(butcherJson.data));
          }
        }

        let mapped: ButcherProduct[] = [];
        if (Array.isArray(butcherJson?.data?.products)) {
          mapped = (butcherJson!.data!.products as Record<string, unknown>[]).map((p) =>
            mapButcherProductFromApi(p),
          );
        }

        if (mapped.length === 0) {
          const resProducts = await fetch(
            `${API_BASE}/api/butchers/products?butcherId=${butcherId}`,
            { headers },
          );
          if (!active) return;
          if (resProducts.ok) {
            const json = await resProducts.json();
            const rows = Array.isArray(json.data) ? json.data : json.data?.products;
            if (json.success && Array.isArray(rows)) {
              mapped = rows.map((p: Record<string, unknown>) => mapButcherProductFromApi(p));
            }
          }
        }

        setProducts(mapped.filter((p) => p.inStock));

        if (mapped.length > 0) {
          const preferred =
            mapped.find((p) => p.id === initialProductId && p.inStock) ??
            mapped.find((p) => p.inStock) ??
            mapped[0];
          setSelectedProductId(preferred.id);
          setSelectedCut(preferred.availableCuts[0] ?? 'whole');
          if (preferred.weightRange?.min) {
            setWeight(String(preferred.weightRange.min));
          }
        }

        if (!resButcher.ok) {
          setLoadError('تعذّر تحميل بيانات الملحمة');
        }
      } catch (err) {
        console.warn('[ButcherOrder] Fetch failed:', err);
        if (active) setLoadError('تعذّر الاتصال بالخادم');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();
    return () => {
      active = false;
    };
  }, [butcherId, accessToken, initialProductId]);

  const currency = gccCurrencies[butcher?.country ?? 'SA'] ?? gccCurrencies.SA;
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? products[0],
    [products, selectedProductId],
  );
  const availableCuts = selectedProduct?.availableCuts ?? [];

  const weightKg = selectedProduct
    ? resolveLineWeightKg(weight, selectedProduct)
    : 0;
  const quantityMode = selectedProduct
    ? getProductQuantityMode(selectedProduct)
    : 'none';

  const computedTotal = useMemo(() => {
    if (!selectedProduct) return 0;
    return computeProductLineTotal(selectedProduct, weightKg);
  }, [selectedProduct, weightKg]);

  const handleSubmit = async () => {
    if (!selectedProduct) {
      Alert.alert('لا منتجات', 'لا توجد منتجات متاحة للطلب من هذه الملحمة حالياً');
      return;
    }
    if (!accessToken) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول لإتمام الطلب والدفع');
      return;
    }
    if (deliveryType === 'delivery' && !address.trim()) {
      Alert.alert('العنوان مطلوب', 'حدّد موقع التوصيل على الخريطة قبل إتمام الدفع');
      return;
    }
    if (computedTotal <= 0 || !Number.isFinite(computedTotal)) {
      Alert.alert('خطأ', 'مبلغ الطلب غير صالح');
      return;
    }

    setLoadingSubmit(true);
    try {
      const payload = {
        butcherId,
        productId: selectedProduct.id,
        cutType: selectedCut,
        weightKg,
        deliveryType,
        deliveryAddress: deliveryType === 'delivery' ? address.trim() : null,
        notes: notes.trim() || null,
        currency: currency.code,
        method: selectedMethod,
      };

      const payOutcome = await startButcherCheckout({
        accessToken,
        payload,
        butcherId,
      });

      if (payOutcome === 'paid' || payOutcome === 'opened') {
        setSubmitted(true);
        return;
      }

      if (payOutcome === 'cancelled' || payOutcome === 'failed') {
        Alert.alert(
          'لم يكتمل الدفع',
          'لم يُرسل طلب للملحمة. يمكنك إعادة المحاولة من هذه الصفحة.',
        );
      }
    } catch (err) {
      console.error(err);
      Alert.alert(
        'خطأ',
        err instanceof Error ? err.message : 'تعذر الاتصال بالخادم. يرجى التحقق من الشبكة.',
      );
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loading || submitted) {
    return (
      <Screen edges={['top']} pattern={false} style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <ScreenBody scroll={false} gutter={false} width="full">
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.electricBright} />
            <AppText variant="body" color="textMuted" align="center">
              {submitted ? 'جاري التحويل...' : 'جاري تحميل الطلب...'}
            </AppText>
          </View>
        </ScreenBody>
      </Screen>
    );
  }

  if (!butcher || loadError) {
    return (
      <Screen edges={['top']} pattern={false} style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <ScreenBody scroll={false} gutter={false} width="full">
          <View style={styles.centered}>
            <AppIcon name="alert-circle-outline" size={48} color={colors.textMuted} />
            <AppText variant="body" color="textMuted" align="center">
              {loadError ?? 'الملحمة غير موجودة'}
            </AppText>
            <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
              <AppText variant="body" style={styles.secondaryBtnText}>رجوع</AppText>
            </Pressable>
          </View>
        </ScreenBody>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} pattern={false} style={styles.screen}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <ScreenHeader
        variant="screen"
        title="طلب جديد"
        arabic={butcher.nameAr}
        showBack
      />

      <ScreenBody
        gutter={false}
        width="full"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 130 }]}
      >
        <Row align="center" gap="md" style={styles.butcherHero}>
          <Image
            source={{ uri: resolveMediaUrl(butcher.logo) }}
            style={styles.butcherLogo}
            contentFit="cover"
          />
          <View style={{ flex: 1 }}>
            <AppText variant="cardTitle">{butcher.nameAr}</AppText>
            <AppText variant="caption" color="textMuted" style={styles.butcherMeta}>
              {butcher.cityAr} · {currency.symbol}
            </AppText>
          </View>
          {butcher.subscriptionActive ? (
            <Row align="center" gap="xs" style={styles.verifiedBadge}>
              <AppIcon name="shield-checkmark" size={13} color={colors.gold} />
              <AppText variant="label" style={styles.verifiedText}>موثّق</AppText>
            </Row>
          ) : null}
        </Row>

        <Section title="اختر المنتج" styles={styles}>
          {products.length === 0 ? (
            <View style={styles.emptyBox}>
              <AppText variant="heading2" align="center">🥩</AppText>
              <AppText variant="body">لا منتجات متاحة</AppText>
              <AppText variant="caption" color="textMuted">تواصل مع الملحمة أو عد لاحقاً</AppText>
            </View>
          ) : (
            products.map((p) => {
              const active = selectedProductId === p.id;
              const cat = CATEGORY_LABELS[p.category as MeatCategory];
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setSelectedProductId(p.id);
                    setSelectedCut(p.availableCuts[0] ?? 'whole');
                    if (p.weightRange?.min) setWeight(String(p.weightRange.min));
                  }}
                  style={[styles.productCard, active && styles.productCardActive]}
                >
                  <Image
                    source={{ uri: resolveMediaUrl(p.images[0]) ?? PLACEHOLDER_IMG }}
                    style={styles.productImg}
                    contentFit="cover"
                  />
                  <View style={styles.productBody}>
                    <Row align="center" justify="between" gap="sm" style={styles.productTopRow}>
                      <AppText variant="body" numberOfLines={1} style={styles.productName}>
                        {p.nameAr}
                      </AppText>
                      {active ? (
                        <View style={styles.selectedDot}>
                          <AppIcon name="checkmark" size={12} color="#fff" />
                        </View>
                      ) : null}
                    </Row>
                    <AppText variant="micro" color="textMuted">
                      {cat?.icon} {cat?.ar ?? p.category}
                    </AppText>
                    <AppText variant="label" style={styles.productPrice}>
                      {getProductQuantityMode(p) === 'sarh_weight'
                        ? `${p.pricePerKg} ${currency.symbol}/كغ`
                        : getProductQuantityMode(p) === 'daftra_weight'
                          ? `${(p.priceFixed ?? 0).toLocaleString('en-US')} ${currency.symbol}/كغ`
                          : `${(p.priceFixed ?? p.pricePerKg ?? 0).toLocaleString('en-US')} ${currency.symbol}`}
                    </AppText>
                  </View>
                </Pressable>
              );
            })
          )}
        </Section>

        {availableCuts.length > 0 ? (
          <Section title="طريقة التقطيع" styles={styles}>
            <Row wrap gap="sm" style={styles.chipsWrap}>
              {availableCuts.map((cut) => (
                <SarhChip appearance="filter"
                  key={cut}
                  label={cutLabelAr(cut)}
                  selected={selectedCut === cut}
                  onPress={() => setSelectedCut(cut as CutType)}
                />
              ))}
            </Row>
          </Section>
        ) : null}

        {showsProductStepper(quantityMode) && quantityMode !== 'daftra_quantity' ? (
          <Section title="الوزن (كغ)" styles={styles}>
            <Row align="center" gap="none" style={styles.weightCard}>
              <Pressable
                style={styles.weightBtn}
                onPress={() =>
                  setWeight(String(Math.max(0.5, weightKg - 0.5)))
                }
              >
                <AppIcon name="remove" size={20} color={colors.textPrimary} />
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
                onPress={() => setWeight(String(weightKg + 0.5))}
              >
                <AppIcon name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </Row>
            {selectedProduct.weightRange ? (
              <AppText variant="micro" color="textMuted" align="center" style={styles.hint}>
                من {selectedProduct.weightRange.min} إلى {selectedProduct.weightRange.max} كغ
              </AppText>
            ) : null}
          </Section>
        ) : null}

        {quantityMode === 'daftra_quantity' ? (
          <Section title="الكمية" styles={styles}>
            <Row align="center" gap="none" style={styles.weightCard}>
              <Pressable
                style={styles.weightBtn}
                onPress={() =>
                  setWeight(String(Math.max(1, resolveLineQuantity(weight) - 1)))
                }
              >
                <AppIcon name="remove" size={20} color={colors.textPrimary} />
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
                <AppIcon name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </Row>
          </Section>
        ) : null}

        <Section title="طريقة الاستلام" styles={styles}>
          <Row gap="sm" style={styles.deliveryRow}>
            {(['pickup', 'delivery'] as DeliveryType[]).map((type) => {
              const active = deliveryType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setDeliveryType(type)}
                  style={[styles.deliveryCard, active && styles.deliveryCardActive]}
                >
                  <AppIcon
                    name={type === 'pickup' ? 'shop' : 'box'}
                    size={22}
                    color={active ? butcherMarket.action : colors.textMuted}
                  />
                  <AppText
                    variant="caption"
                    color={active ? undefined : 'textMuted'}
                    style={active ? { color: butcherMarket.action } : undefined}
                  >
                    {type === 'pickup' ? 'استلام' : 'توصيل'}
                  </AppText>
                  <AppText variant="micro" color="textMuted" align="center">
                    {type === 'pickup' ? 'من الملحمة مباشرة' : 'إلى عنوانك'}
                  </AppText>
                </Pressable>
              );
            })}
          </Row>
          {deliveryType === 'delivery' ? (
            <DeliveryMapAddressField onAddressChange={setAddress} />
          ) : null}
        </Section>

        <Section title="ملاحظات (اختياري)" styles={styles}>
          <TextInput
            style={[styles.textArea, rtlInputText]}
            placeholder="مثال: افصل الكبد والرقبة..."
            placeholderTextColor={colors.textSubtle}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </Section>

        <Section title="طريقة الدفع" styles={styles}>
          <Row wrap gap="sm">
            {PAYMENT_METHODS.map((method) => {
              const active = selectedMethod === method.id;
              return (
                <Pressable
                  key={method.id}
                  onPress={() => setSelectedMethod(method.id)}
                  style={[styles.payPill, active && styles.payPillActive]}
                >
                  <AppText
                    variant="label"
                    color={active ? 'primary' : 'textMuted'}
                  >
                    {method.arabic}
                  </AppText>
                </Pressable>
              );
            })}
          </Row>
        </Section>

        <View style={styles.summaryCard}>
          <AppText variant="body" style={styles.summaryTitle}>ملخص الطلب</AppText>
          <SummaryRow label="المنتج" value={selectedProduct?.nameAr ?? '—'} styles={styles} />
          <SummaryRow label="التقطيع" value={cutLabelAr(selectedCut)} styles={styles} />
          {showsProductStepper(quantityMode) ? (
            <SummaryRow
              label={quantityMode === 'daftra_quantity' ? 'الكمية' : 'الوزن'}
              value={formatOrderQuantityLabel(weightKg, selectedProduct)}
              styles={styles}
            />
          ) : null}
          <SummaryRow
            label="الاستلام"
            value={deliveryType === 'pickup' ? 'استلام من الملحمة' : 'توصيل'}
            styles={styles}
          />
          <View style={styles.summaryDivider} />
          <Row justify="between" align="center">
            <AppText variant="body">المبلغ</AppText>
            <AppText variant="cardTitle" style={styles.totalValue}>
              {computedTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
              {currency.symbol}
            </AppText>
          </Row>
        </View>
      </ScreenBody>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <LinearGradient
          colors={['transparent', colors.bgDeep]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Row align="center" justify="between" gap="md" style={styles.footerInner}>
          <Stack gap="none">
            <AppText variant="micro" color="textMuted">الإجمالي</AppText>
            <AppText variant="price" style={styles.footerTotal}>
              {computedTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
              {currency.symbol}
            </AppText>
          </Stack>
          <SarhButton
            title="ادفع وأرسل الطلب"
            disabled={products.length === 0}
            loading={loadingSubmit}
            leftIcon="card-outline"
            onPress={() => void handleSubmit()}
            style={[
              styles.submitCta,
              {
                backgroundColor: butcherMarket.action,
                borderColor: butcherMarket.action,
              },
            ]}
          />
        </Row>
      </View>
    </Screen>
  );
}

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.section}>
      <AppText variant="sectionTitle" style={styles.sectionTitle}>{title}</AppText>
      {children}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Row justify="between" align="center" gap="md" style={styles.summaryRow}>
      <AppText variant="caption" color="textMuted">{label}</AppText>
      <AppText variant="label" color="textSecondary" numberOfLines={1} style={styles.summaryValue}>
        {value}
      </AppText>
    </Row>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenRoot },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    secondaryBtn: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    secondaryBtnText: { color: colors.textBrandStrong },

    scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },

    butcherHero: {
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderRadius: radius.xxl,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    butcherLogo: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.bgElevated,
    },
    butcherMeta: { marginTop: 2 },
    verifiedBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.gold + '18',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.gold + '44',
    },
    verifiedText: { color: colors.gold },

    section: { marginBottom: spacing.lg },
    sectionTitle: {
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    hint: {
      marginTop: spacing.xs,
    },

    emptyBox: {
      alignItems: 'center',
      padding: spacing.xl,
      borderRadius: radius.xxl,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      gap: spacing.xs,
    },

    productCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
      borderRadius: radius.xl,
      backgroundColor: colors.bgSurface,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
    },
    productCardActive: {
      borderColor: colors.electric,
      backgroundColor: colors.electric + '0D',
    },
    productImg: {
      width: 72,
      height: 72,
      borderRadius: radius.lg,
      backgroundColor: colors.bgElevated,
    },
    productBody: { flex: 1, gap: 2 },
    productTopRow: {
      width: '100%',
    },
    productName: {
      flex: 1,
    },
    productPrice: {
      color: colors.gold,
      marginTop: 2,
    },
    selectedDot: {
      width: 22,
      height: 22,
      borderRadius: 12,
      backgroundColor: colors.electric,
      alignItems: 'center',
      justifyContent: 'center',
    },

    chipsWrap: {},

    weightCard: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    weightBtn: {
      width: 52,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgElevated,
    },
    weightInput: {
      flex: 1,
      ...butcherTypography.titleLarge,
      textAlign: 'center',
      color: colors.textPrimary,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    },

    deliveryRow: {},
    deliveryCard: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.xl,
      backgroundColor: colors.bgSurface,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
    },
    deliveryCardActive: {
      borderColor: butcherMarket.action,
      backgroundColor: butcherMarket.action + '10',
    },

    textArea: {
      marginTop: spacing.sm,
      minHeight: 88,
      borderRadius: radius.xl,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      padding: spacing.md,
      color: colors.textPrimary,
      ...butcherTypography.body,
      textAlignVertical: 'top',
    },

    payPill: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.bgSurface,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
    },
    payPillActive: {
      borderColor: butcherMarket.action,
      backgroundColor: butcherMarket.action + '14',
    },

    summaryCard: {
      borderRadius: radius.xxl,
      padding: spacing.lg,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.electric + '33',
      marginBottom: spacing.md,
    },
    summaryTitle: {
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    summaryRow: {
      marginBottom: 6,
    },
    summaryValue: {
      flex: 1,
    },
    summaryDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderSoft,
      marginVertical: spacing.sm,
    },
    totalValue: { color: colors.gold },

    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    footerInner: {
      backgroundColor: colors.bgDeep + 'EE',
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      padding: spacing.md,
    },
    footerTotal: { color: colors.gold },
    submitCta: { flex: 1, maxWidth: 220 },
  });
}
