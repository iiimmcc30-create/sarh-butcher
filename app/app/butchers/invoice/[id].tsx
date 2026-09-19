import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { AppText } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { space } from '@/design-system/tokens';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { radius, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import {
  CUT_LABELS,
  CutType,
  PAYMENT_STATUS_LABELS,
} from '@/services/butcherData';
import { ButcherOrderRecord, formatCurrency, formatOrderDate } from '@/services/butcherOrders';
import { formatOrderQuantityLabel } from '@/lib/butcherProductQuantity';

function InvoiceRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Row justify="between" gap="md" align="center">
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText
        variant="label"
        color={highlight ? 'success' : 'textPrimary'}
        style={{ flex: 1 }}
      >
        {value}
      </AppText>
    </Row>
  );
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [invoice, setInvoice] = useState<ButcherOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/butchers/orders/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setInvoice(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader variant="screen" title="تفاصيل الفاتورة" showBack />
        <ScreenBody scroll={false} gutter={false}>
          <ActivityIndicator size="large" color={colors.electricBright} style={styles.loader} />
        </ScreenBody>
      </Screen>
    );
  }

  if (!invoice) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader variant="screen" title="تفاصيل الفاتورة" showBack />
        <ScreenBody gutter={false} padBottom="lg">
          <AppText variant="body" color="textMuted" align="center" style={styles.error}>
            تعذر تحميل الفاتورة
          </AppText>
        </ScreenBody>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader variant="screen" title="تفاصيل الفاتورة" showBack />

      <ScreenBody gutter={false} padBottom="lg" contentContainerStyle={styles.scroll}>
        <View style={styles.paper}>
          <Stack gap="xs" align="center">
            <View style={styles.logoMark}>
              <AppIcon name="storefront-outline" size={28} color={colors.electricBright} />
            </View>
            <AppText variant="caption" color="textMuted" align="center">
              سرح · سوق الملاحم
            </AppText>
            <AppText variant="heading3" align="center">
              فاتورة ضريبية مبسطة
            </AppText>
            <AppText variant="label" style={{ color: colors.electricBright }}>
              #{invoice.orderNumber}
            </AppText>
          </Stack>

          <View style={styles.section}>
            <AppText variant="label" style={styles.sectionTitle}>
              بيانات الفاتورة
            </AppText>
            <InvoiceRow label="رقم الطلب" value={invoice.orderNumber} />
            <InvoiceRow
              label="اسم الملحمة"
              value={invoice.butcher?.nameAr ?? '—'}
            />
            <InvoiceRow
              label="تاريخ الشراء"
              value={formatOrderDate(invoice.createdAt)}
            />
            <InvoiceRow
              label="حالة الدفع"
              value={PAYMENT_STATUS_LABELS[invoice.paymentStatus]}
              highlight={invoice.paymentStatus === 'paid'}
            />
          </View>

          <View style={styles.section}>
            <AppText variant="label" style={styles.sectionTitle}>
              تفاصيل المنتجات
            </AppText>
            <InvoiceRow
              label="المنتج"
              value={invoice.product?.nameAr ?? '—'}
            />
            <InvoiceRow
              label="التقطيع"
              value={CUT_LABELS[invoice.cutType as CutType]?.ar ?? invoice.cutType}
            />
            <InvoiceRow
              label="الكمية"
              value={formatOrderQuantityLabel(invoice.weightKg, invoice.product) || '—'}
            />
            <InvoiceRow
              label="سعر المنتج"
              value={formatCurrency(invoice.totalPrice, invoice.currency)}
            />
          </View>

          <View style={styles.section}>
            <AppText variant="label" style={styles.sectionTitle}>
              الملخص المالي
            </AppText>
            <InvoiceRow label="رسوم التوصيل" value="—" />
            <InvoiceRow label="الضريبة" value="—" />
            <InvoiceRow label="الخصومات" value="—" />
            <Stack gap="xs" align="center" style={styles.grandTotal}>
              <AppText variant="caption" color="textMuted">
                المبلغ المدفوع
              </AppText>
              <AppText variant="heading2" style={{ color: colors.electricBright }}>
                {formatCurrency(invoice.totalPrice, invoice.currency)}
              </AppText>
            </Stack>
          </View>

          <AppText variant="caption" color="textMuted" align="center" style={styles.footerNote}>
            شكراً لتسوقك من سوق الملاحم في سرح
          </AppText>
        </View>
      </ScreenBody>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loader: { marginTop: 60 },
    scroll: { padding: space[16], paddingBottom: space[40] },
    paper: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.xxl,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: space[20],
      gap: space[16],
    },
    logoMark: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.electric + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space[8],
    },
    section: { gap: space[8] },
    sectionTitle: {
      marginBottom: space[4],
      paddingBottom: space[4],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    grandTotal: {
      marginTop: space[8],
      paddingTop: space[12],
      borderTopWidth: 1,
      borderTopColor: colors.borderMid,
    },
    footerNote: {
      marginTop: space[8],
    },
    error: {
      marginTop: 80,
    },
  });
}
