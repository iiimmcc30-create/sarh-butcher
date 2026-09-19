import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { motion } from '@/design-system';
import { AppText } from '@/design-system/components';
import { Row, Screen, ScreenBody } from '@/design-system/layout';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useOrderSocket } from '@/hooks/useOrderSocket';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
  CUSTOMER_FLOW_LABELS,
  CUSTOMER_ORDER_FLOW,
  customerOrderHeadline,
  flowReached,
  formatOrderStamp,
  isPayableButcherOrder,
  orderLineItems,
  orderMoneySummary,
  timelineStamp,
} from '@/lib/customerOrders';
import { safePush } from '@/lib/safeNavigate';
import { showToast } from '@/lib/toast';
import { API_BASE } from '@/services/api';
import { PAYMENT_STATUS_LABELS } from '@/services/butcherData';
import {
  completeButcherOrderPayment,
  formatCurrency,
  isInvoiceOrder,
  type ButcherOrderRecord,
} from '@/services/butcherOrders';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

export default function OrderDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; fresh?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const fresh = Array.isArray(params.fresh) ? params.fresh[0] : params.fresh;
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const s = useThemedStyles(({ colors }) => createStyles(colors));
  const [order, setOrder] = useState<ButcherOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);

  const loadOrder = useCallback(async () => {
    if (!id || !accessToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/butchers/orders/${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: ButcherOrderRecord;
      };
      if (res.ok && json.success && json.data) setOrder(json.data);
    } catch (err) {
      console.warn('[OrderDetails] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => {
    setOrder(null);
    setLoading(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadOrder();
    }, [loadOrder, fresh]),
  );

  useOrderSocket(accessToken, id, () => {
    loadOrder();
  });

  if (loading) {
    return (
      <Screen edges={['top']} style={s.screen}>
        <ScreenBody scroll={false} gutter={false} width="full">
          <ActivityIndicator size="large" color={colors.electricBright} style={{ marginTop: 80 }} />
        </ScreenBody>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen edges={['top']} style={s.screen}>
        <ScreenHeader variant="screen" title="تفاصيل الطلب" showBack />
        <ScreenBody>
          <AppText variant="body" color="textMuted" align="center" style={s.errorText}>
            تعذر تحميل تفاصيل الطلب
          </AppText>
        </ScreenBody>
      </Screen>
    );
  }

  const headline = customerOrderHeadline(order);
  const statusText = headline.label;
  const canPay = isPayableButcherOrder(order) && Boolean(accessToken);
  const isPickup = order.deliveryType !== 'delivery';
  const customerPhone = order.customer?.phone as string | undefined;
  const butcherPhone = order.butcher?.phone as string | undefined;
  const locationValue = isPickup
    ? [order.butcher?.addressAr, order.butcher?.cityAr]
        .map((p: unknown) => (typeof p === 'string' ? p.trim() : ''))
        .filter(Boolean)
        .join('، ')
    : order.deliveryAddress;
  const lines = orderLineItems(order);
  const money = orderMoneySummary(order);
  const reached = flowReached(order);
  const delivered = order.status === 'delivered';
  const summaryCount =
    lines.length === 1 ? 'صنف واحد' : lines.length === 2 ? 'صنفين' : `${lines.length} أصناف`;

  const handleCompletePayment = async () => {
    if (!accessToken || paying) return;
    setPaying(true);
    try {
      const outcome = await completeButcherOrderPayment({ accessToken, order });
      if (outcome === 'blocked' || outcome === 'cancelled' || outcome === 'failed') {
        await loadOrder();
      }
    } finally {
      setPaying(false);
    }
  };

  const pageTitle = delivered
    ? order.deliveryType === 'pickup'
      ? 'تم استلام طلبك'
      : 'تم توصيل طلبك'
    : headline.awaitingPayment
      ? 'بانتظار الدفع'
      : headline.expired
        ? 'انتهت صلاحية الطلب'
        : order.status === 'cancelled'
          ? 'تم إلغاء طلبك'
          : 'تفاصيل الطلب';

  const copyOrderNumber = () => {
    showToast(`رقم الطلب ${order.orderNumber}`, 'info');
  };

  return (
    <Screen edges={['top']} style={s.screen}>
      <ScreenHeader variant="screen" title={pageTitle} showBack />

      <ScreenBody contentContainerStyle={s.scroll}>
        {!delivered ? (
          <Row gap="md" align="center" style={s.statusRow}>
            <View style={s.statusBadge}>
              <AppText variant="micro" color="primary">
                {statusText}
              </AppText>
            </View>
            <View style={s.statusCopy}>
              <AppText variant="label">{order.orderNumber}</AppText>
              <AppText variant="caption" color="textMuted">
                {formatOrderStamp(order.createdAt)}
              </AppText>
            </View>
          </Row>
        ) : null}

        {headline.awaitingPayment ? (
          <View style={s.notice}>
            <AppText variant="label">لم يكتمل الدفع</AppText>
            <AppText variant="bodySmall" color="textMuted">
              يمكنك إكمال الدفع لهذا الطلب دون إنشاء طلب جديد. الملحمة لا تقبل الطلب قبل السداد.
            </AppText>
            <Pressable
              style={({ pressed }) => [s.payBtn, (pressed || paying) && { opacity: motion.press.opacity }]}
              onPress={() => void handleCompletePayment()}
              disabled={paying || !canPay}
            >
              {paying ? (
                <ActivityIndicator color={colors.bgDeep} />
              ) : (
                <AppText variant="label" numberOfLines={1} style={s.payBtnText}>
                  إكمال الدفع
                </AppText>
              )}
            </Pressable>
          </View>
        ) : null}

        {headline.expired ? (
          <View style={s.notice}>
            <AppText variant="label">انتهت صلاحية الطلب</AppText>
            <AppText variant="bodySmall" color="textMuted">
              انتهت مهلة الدفع وتم تحرير الكمية. يمكنك إنشاء طلب جديد من الملحمة.
            </AppText>
          </View>
        ) : null}

        {!delivered && order.status !== 'cancelled' && !headline.expired ? (
          <View style={s.block}>
            <AppText variant="label">متابعة الطلب</AppText>
            <View style={s.trackRow}>
              {CUSTOMER_ORDER_FLOW.map((step, index) => {
                const done = reached.has(step);
                const time = timelineStamp(order.timeline, step, order.createdAt);
                return (
                  <View key={step} style={s.trackStep}>
                    {index > 0 ? (
                      <View
                        style={[
                          s.trackLine,
                          { backgroundColor: done ? colors.success : colors.borderSoft },
                        ]}
                      />
                    ) : null}
                    <View
                      style={[
                        s.trackDot,
                        {
                          backgroundColor: done ? colors.success : colors.bgElevated,
                          borderColor: done ? colors.success : colors.borderMid,
                        },
                      ]}
                    >
                      {done ? <AppIcon name="checkmark" size={11} color={colors.bgElevated} /> : null}
                    </View>
                    <AppText
                      variant="micro"
                      color={done ? 'textPrimary' : 'textMuted'}
                      align="center"
                    >
                      {CUSTOMER_FLOW_LABELS[step]}
                    </AppText>
                    <AppText variant="micro" color="textMuted" align="center">
                      {time || ' '}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {order.status === 'cancelled' ? (
          <AppText variant="bodySmall" color="danger">
            {order.cancellationReason ? `ملغي · ${order.cancellationReason}` : 'تم إلغاء هذا الطلب'}
          </AppText>
        ) : null}

        <View style={s.block}>
          <Pressable
            onPress={() => setDetailsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel="تفاصيل الطلب"
          >
            <Row justify="between" align="center" style={s.collapseHead}>
              <AppText variant="label">تفاصيل الطلب</AppText>
              <AppIcon
                name={detailsOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </Row>
          </Pressable>
          {detailsOpen ? (
            <>
              {locationValue ? (
                <Row gap="md" align="start" style={s.detailRow}>
                  <View style={s.iconCircle}>
                    <AppIcon name="location-outline" size={16} color={colors.textPrimary} />
                  </View>
                  <View style={s.detailCopy}>
                    <AppText variant="label">{isPickup ? 'استلام' : 'منزل'}</AppText>
                    <AppText variant="caption" color="textMuted">
                      {locationValue}
                    </AppText>
                  </View>
                </Row>
              ) : null}
              {customerPhone ? (
                <Pressable
                  onPress={() => void Linking.openURL(`tel:${customerPhone}`)}
                >
                  <Row gap="md" align="start" style={s.detailRow}>
                    <View style={s.iconCircle}>
                      <AppIcon name="call-outline" size={16} color={colors.textPrimary} />
                    </View>
                    <View style={s.detailCopy}>
                      <AppText variant="caption" color="textMuted">
                        رقم الجوال
                      </AppText>
                      <AppText variant="bodySmall">{customerPhone}</AppText>
                    </View>
                  </Row>
                </Pressable>
              ) : null}
              <Row gap="md" align="start" style={[s.detailRow, s.detailRowLast]}>
                <View style={s.iconCircle}>
                  <AppIcon name="card-outline" size={16} color={colors.textPrimary} />
                </View>
                <View style={s.detailCopy}>
                  <AppText variant="caption" color="textMuted">
                    طريقة الدفع
                  </AppText>
                  <AppText variant="bodySmall">
                    {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? (isPickup ? 'استلام' : 'توصيل')}
                  </AppText>
                </View>
              </Row>
            </>
          ) : null}
        </View>

        <Row gap="md" align="center" style={s.merchantRow}>
          <View style={s.merchantLogo}>
            {uriSource(order.butcher?.logo || order.butcher?.cover) ? (
              <Image
                source={uriSource(order.butcher?.logo || order.butcher?.cover)}
                style={s.logoImg}
                contentFit="cover"
              />
            ) : (
              <AppIcon name="storefront-outline" size={18} color={colors.textMuted} />
            )}
          </View>
          <View style={s.merchantCopy}>
            <AppText variant="label" numberOfLines={1}>
              {order.butcher?.nameAr?.trim() || 'ملحمة'}
            </AppText>
            <Pressable onPress={copyOrderNumber}>
              <Row gap="xs" align="center" style={s.orderIdRow}>
                <AppText variant="caption" color="textMuted">
                  #{order.orderNumber}
                </AppText>
                <AppIcon name="copy-outline" size={14} color={colors.textMuted} />
              </Row>
            </Pressable>
          </View>
          {isInvoiceOrder(order) ? (
            <Pressable
              onPress={() =>
                safePush({ pathname: '/butchers/invoice/[id]', params: { id: order.id } }, undefined, router)
              }
              accessibilityLabel="تحميل الفاتورة"
            >
              <Row gap="xs" align="center" style={s.downloadBtn}>
                <AppIcon name="download-outline" size={16} color={colors.textPrimary} />
                <AppText variant="caption">تحميل</AppText>
              </Row>
            </Pressable>
          ) : null}
        </Row>

        <View style={s.block}>
          <AppText variant="label">ملخص الطلب | {summaryCount}</AppText>
          {lines.map((item) => (
            <Row key={item.id} justify="between" align="center" gap="md" style={s.summaryLine}>
              <AppText variant="bodySmall" numberOfLines={2} style={s.itemName}>
                {item.quantityLabel} {item.name}
              </AppText>
              <AppText variant="bodySmall">{formatCurrency(item.linePrice, order.currency)}</AppText>
            </Row>
          ))}
          <View style={s.totalsDivider} />
          <Row justify="between" align="center" gap="md" style={s.summaryLine}>
            <AppText variant="bodySmall" color="textMuted">
              مجموع الطلب
            </AppText>
            <AppText variant="bodySmall">{formatCurrency(money.subtotal, order.currency)}</AppText>
          </Row>
          <Row justify="between" align="center" gap="md" style={s.summaryLine}>
            <AppText variant="bodySmall" color="textMuted">
              رسوم التوصيل
            </AppText>
            <AppText variant="bodySmall">
              {money.deliveryFee == null ? '—' : formatCurrency(money.deliveryFee, order.currency)}
            </AppText>
          </Row>
          <Row justify="between" align="center" gap="md" style={s.summaryLine}>
            <AppText variant="label">الإجمالي</AppText>
            <AppText variant="label">{formatCurrency(money.total, order.currency)}</AppText>
          </Row>
          {order.notes ? (
            <AppText variant="caption" color="textMuted">
              ملاحظات: {order.notes}
            </AppText>
          ) : null}
        </View>

        {delivered && order.butcherId ? (
          <Pressable
            onPress={() =>
              safePush({ pathname: '/butchers/[id]', params: { id: order.butcherId } }, undefined, router)
            }
            style={s.reorderBtn}
            accessibilityLabel="إعادة الطلب"
          >
            <AppText variant="label" numberOfLines={1} style={s.reorderText}>
              إعادة الطلب
            </AppText>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() =>
            router.push(
              {
                pathname: '/support/help',
                params: order.paymentStatus === 'paid' ? { orderId: order.id } : {},
              } as never,
            )
          }
        >
          <Row gap="sm" align="center" style={s.helpRow}>
            <AppIcon name="headset" size={18} color={colors.electricBright} />
            <AppText variant="bodySmall" color="primary">
              المساعدة
            </AppText>
          </Row>
        </Pressable>
        <Pressable
          onPress={() => {
            if (butcherPhone) void Linking.openURL(`tel:${butcherPhone}`);
          }}
        >
          <Row gap="sm" align="center" style={s.helpRow}>
            <AppIcon name="call-outline" size={18} color={colors.electricBright} />
            <AppText variant="bodySmall" color="primary">
              {butcherPhone ? 'اتصل بالملحمة' : 'رقم الملحمة غير متوفر'}
            </AppText>
          </Row>
        </Pressable>
      </ScreenBody>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenRoot },
    scroll: { gap: 0, paddingBottom: 40 },
    statusRow: {
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.electric + '18',
    },
    statusCopy: { flex: 1, minWidth: 0 },
    notice: {
      paddingVertical: spacing.md,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    payBtn: {
      marginTop: spacing.xs,
      backgroundColor: colors.electric,
      borderRadius: 14,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      flexWrap: 'nowrap',
    },
    payBtnText: {
      color: colors.bgDeep,
    },
    block: {
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
      gap: spacing.sm,
    },
    collapseHead: {
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    detailRow: {
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderHairline,
    },
    detailRowLast: {},
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgSurface,
      flexShrink: 0,
    },
    detailCopy: { flex: 1, minWidth: 0, gap: 2 },
    merchantRow: {
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    merchantLogo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: colors.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImg: { width: '100%', height: '100%' },
    merchantCopy: { flex: 1, minWidth: 0, gap: 4 },
    orderIdRow: { alignItems: 'center', gap: 6 },
    downloadBtn: {
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.bgSurface,
    },
    summaryLine: {
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: 8,
    },
    itemName: { flex: 1, minWidth: 0 },
    totalsDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderHairline,
      marginVertical: spacing.xs,
    },
    reorderBtn: {
      marginTop: spacing.md,
      backgroundColor: colors.gold,
      borderRadius: 12,
      minHeight: 40,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      flexWrap: 'nowrap',
    },
    reorderText: {
      color: colors.textPrimary,
    },
    helpRow: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    trackRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingTop: spacing.sm,
    },
    trackStep: {
      flex: 1,
      alignItems: 'center',
      position: 'relative',
      minWidth: 0,
    },
    trackLine: {
      position: 'absolute',
      top: 10,
      left: '50%',
      width: '100%',
      height: 2,
    },
    trackDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    errorText: {
      marginTop: 80,
    },
  });
}
