// Powered by OnSpace.AI
// SAFAT — Butcher Order Success Screen
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { motion } from '@/design-system';
import { AppText, SarhButton } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, type ThemeColors } from '@/constants/theme';
import { space } from '@/design-system/tokens';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

export default function OrderSuccessScreen() {
  const { colors, gradients } = useTheme();
  const s = useThemedStyles(({ colors }) => createScreenStyles(colors));
  const router = useRouter();
  const { orderId, orderNumber, butcherId, paymentStatus } = useLocalSearchParams<{
    orderId?: string;
    orderNumber?: string;
    butcherId?: string;
    paymentStatus?: string;
  }>();
  const displayOrderId = orderNumber || (orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : '—');
  const isPaid = paymentStatus === 'paid';
  const hasFinalOrder = Boolean(orderId);

  return (
    <Screen edges={['top']} pattern={false}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <ScreenBody scroll={false} padTop="lg" padBottom="lg">
        <Stack gap="lg" align="center" fill style={s.wrap}>
          {/* Animated circle */}
          <View style={s.circle}>
            <LinearGradient colors={[colors.success + '44', colors.success + '11']} style={StyleSheet.absoluteFill} />
            <AppText variant="display">{isPaid ? '✅' : '💳'}</AppText>
          </View>

          <AppText variant="heading2" align="center">
            {isPaid ? 'تم الدفع وإرسال الطلب!' : 'لم يكتمل الدفع'}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            {isPaid
              ? 'وصل طلبك المدفوع وسيواصل معك الجزار قريبًا لتأكيد التفاصيل'
              : hasFinalOrder
                ? 'لم يكتمل الدفع. أكمل الدفع من صفحة الطلب حتى يصل للملحمة.'
                : 'لم يُرسل طلب للملحمة. يمكنك إعادة المحاولة من السلة.'}
          </AppText>

          {/* Order summary */}
          <View style={s.summaryCard}>
            <LinearGradient colors={[colors.electric + '22', colors.bgElevated]} style={StyleSheet.absoluteFill} />
            <Row align="center" gap="sm">
              <AppIcon name="receipt-outline" size={16} color={colors.glow} />
              <AppText variant="caption" color="textMuted" style={s.summaryLabel}>
                رقم الطلب
              </AppText>
              <AppText variant="label">{displayOrderId}</AppText>
            </Row>
            <Row align="center" gap="sm">
              <AppIcon name="card-outline" size={16} color={colors.glow} />
              <AppText variant="caption" color="textMuted" style={s.summaryLabel}>
                الدفع
              </AppText>
              <View style={[s.pendingBadge, isPaid && s.paidBadge]}>
                <AppText variant="label" style={[s.pendingText, isPaid && s.paidText]}>
                  {isPaid ? 'مدفوع' : 'بانتظار الدفع'}
                </AppText>
              </View>
            </Row>
            <Row align="center" gap="sm">
              <AppIcon name="time-outline" size={16} color={colors.glow} />
              <AppText variant="caption" color="textMuted" style={s.summaryLabel}>
                الحالة
              </AppText>
              <View style={s.pendingBadge}>
                <AppText variant="label" style={s.pendingText}>
                  {isPaid ? 'قيد المراجعة' : 'غير مؤكد'}
                </AppText>
              </View>
            </Row>
          </View>

          {/* Steps */}
          <View style={s.stepsWrap}>
            {[
              { step: '١', label: 'إنشاء الطلب', done: true },
              { step: '٢', label: 'الدفع عبر بوابة المنصة', done: isPaid },
              { step: '٣', label: 'مراجعة وتأكيد الجزار', done: false },
              { step: '٤', label: 'الاستلام أو التوصيل', done: false },
            ].map((item, i) => (
              <Row key={i} align="center" gap="md">
                <View style={[s.stepCircle, item.done && s.stepCircleDone]}>
                  {item.done
                    ? <AppIcon name="checkmark" size={14} color="#fff" />
                    : <AppText variant="micro" color="textMuted">{item.step}</AppText>
                  }
                </View>
                {i < 3 && <View style={[s.stepLine, item.done && s.stepLineDone]} />}
                <AppText variant="caption" color="textMuted" style={[s.stepLabel, item.done && s.stepLabelDone]}>
                  {item.label}
                </AppText>
              </Row>
            ))}
          </View>

          {/* Actions */}
          <Pressable
            style={({ pressed }) => [s.chatBtn, pressed && { opacity: motion.press.opacity }]}
            onPress={() => {
              if (!isPaid && !hasFinalOrder) {
                router.replace('/butchers');
                return;
              }
              router.push({
                pathname: '/butchers/order/[id]',
                params: { id: orderId ?? '' },
              });
            }}
          >
            <LinearGradient
              colors={[colors.electricBright, colors.cyan]}
              style={s.chatBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Row align="center" justify="center" gap="sm">
                <AppIcon name="receipt-outline" size={20} color="#fff" />
                <AppText variant="label" numberOfLines={1} style={s.chatBtnText}>
                  {isPaid ? 'تتبع الطلب' : hasFinalOrder ? 'إكمال الدفع' : 'العودة للملاحم'}
                </AppText>
              </Row>
            </LinearGradient>
          </Pressable>

          <SarhButton
            title="العودة لقسم الملاحم"
            variant="secondary"
            fullWidth
            onPress={() => router.replace('/butchers')}
          />
        </Stack>
      </ScreenBody>
    </Screen>
  );
}

function createScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      justifyContent: 'center',
    },
    circle: {
      width: 120, height: 120, borderRadius: 60,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: colors.success + '44',
      overflow: 'hidden',
    },
    summaryCard: {
      width: '100%',
      borderRadius: radius.xxl,
      borderWidth: 1, borderColor: colors.electric + '44',
      overflow: 'hidden',
      padding: space[16],
      gap: space[12],
      position: 'relative',
    },
    summaryLabel: { flex: 1 },
    pendingBadge: {
      paddingHorizontal: 10, paddingVertical: space[4],
      borderRadius: radius.pill,
      backgroundColor: colors.amber + '33',
      borderWidth: 1, borderColor: colors.amber + '66',
    },
    pendingText: { color: colors.amber },
    paidBadge: {
      backgroundColor: colors.success + '33',
      borderColor: colors.success + '66',
    },
    paidText: { color: colors.success },
    stepsWrap: {
      width: '100%',
      backgroundColor: colors.bgSurface,
      borderRadius: radius.xxl,
      borderWidth: 1, borderColor: colors.borderSoft,
      padding: space[16],
      gap: space[12],
    },
    stepCircle: {
      width: 28, height: 28, borderRadius: 16,
      backgroundColor: colors.bgElevated,
      borderWidth: 1.5, borderColor: colors.borderSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    stepCircleDone: { backgroundColor: colors.success, borderColor: colors.success },
    stepLine: { display: 'none' },
    stepLineDone: {},
    stepLabel: { flex: 1 },
    stepLabelDone: { color: colors.textBrandSuccess },
    chatBtn: { width: '100%', borderRadius: radius.xl, overflow: 'hidden' },
    chatBtnGrad: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: space[16],
    },
    chatBtnText: { color: colors.textPrimary },
  });
}
