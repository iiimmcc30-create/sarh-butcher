import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { motion } from '@/design-system';
import { AppText } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { space } from '@/design-system/tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { radius, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { PAYMENT_STATUS_LABELS } from '@/services/butcherData';
import {
  ButcherOrderRecord,
  fetchMyButcherOrders,
  formatCurrency,
  formatOrderDate,
  isInvoiceOrder,
} from '@/services/butcherOrders';
import { formatOrderQuantityLabel } from '@/lib/butcherProductQuantity';

export default function ButcherInvoicesScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [invoices, setInvoices] = useState<ButcherOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    try {
      const orders = await fetchMyButcherOrders(accessToken);
      setInvoices(orders.filter(isInvoiceOrder));
    } catch {
      /* keep current invoices */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen edges={['top']}>
      <ScreenHeader variant="screen" title="الفواتير" showBack />

      {loading && invoices.length === 0 ? (
        <ScreenBody scroll={false} gutter={false}>
          <ActivityIndicator size="large" color={colors.electricBright} style={styles.loader} />
        </ScreenBody>
      ) : (
        <ScreenBody
          gutter={false}
          padBottom="lg"
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.electricBright}
            />
          }
        >
          {invoices.length === 0 ? (
            <Stack gap="sm" align="center" style={styles.empty}>
              <AppText variant="display">🧾</AppText>
              <AppText variant="heading3">لا توجد فواتير بعد</AppText>
              <AppText variant="caption" color="textMuted" align="center" style={styles.emptySub}>
                تظهر هنا الفواتير الخاصة بالطلبات المكتملة والمدفوعة
              </AppText>
            </Stack>
          ) : (
            invoices.map((invoice) => (
              <Pressable
                key={invoice.id}
                style={({ pressed }) => [styles.card, pressed && { opacity: motion.press.opacityCard }]}
                onPress={() =>
                  router.push({ pathname: '/butchers/invoice/[id]', params: { id: invoice.id } })
                }
              >
                <Row align="start" gap="md">
                  <View style={{ flex: 1 }}>
                    <AppText variant="label" style={{ color: colors.electricBright }}>
                      فاتورة #{invoice.orderNumber}
                    </AppText>
                    <AppText variant="heading3">{invoice.butcher?.nameAr ?? 'ملحمة'}</AppText>
                    <AppText variant="caption" color="textMuted">
                      {formatOrderDate(invoice.createdAt)}
                    </AppText>
                  </View>
                  <View style={styles.paidBadge}>
                    <AppText variant="label" color="success">
                      {PAYMENT_STATUS_LABELS.paid}
                    </AppText>
                  </View>
                </Row>
                <View style={styles.divider} />
                <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                  {invoice.product?.nameAr ?? 'منتج'} · {formatOrderQuantityLabel(invoice.weightKg, invoice.product)}
                </AppText>
                <Row justify="between" gap="sm">
                  <AppText variant="caption" color="textMuted">
                    المبلغ المدفوع
                  </AppText>
                  <AppText variant="heading3">
                    {formatCurrency(invoice.totalPrice, invoice.currency)}
                  </AppText>
                </Row>
              </Pressable>
            ))
          )}
        </ScreenBody>
      )}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loader: { marginTop: 60 },
    scroll: { padding: space[16], paddingBottom: space[40], gap: space[12] },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: space[16],
      gap: space[8],
    },
    paidBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.success + '22',
      borderWidth: 1,
      borderColor: colors.success + '55',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderHairline,
    },
    empty: {
      paddingVertical: 80,
    },
    emptySub: {
      paddingHorizontal: space[20],
    },
  });
}
