import { AppIcon } from '@/components/ui/FlaticonIcon';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { AppLogo } from '@/components/ui/AppLogo';
import { butcherTypography } from '@/constants/butcherTypography';
import { colors, gradients, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function JoinSuccessScreen() {
  const s = useThemedStyles(({ colors }) => createScreenStyles(colors));
  const router = useRouter();
  const { n, name } = useLocalSearchParams<{ n?: string; name?: string }>();
  const numberLabel = n ? `#${n}` : '—';

  return (
    <SafeAreaView style={s.screen}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <View style={s.wrap}>
        <AppLogo size={64} />
        <View style={s.circle}>
          <AppIcon name="checkmark" size={36} color="#fff" />
        </View>
        <Text style={s.title}>تم استلام طلب الانضمام</Text>
        <Text style={s.sub}>
          تم إرسال طلبك إلى فريق سرح للمراجعة. سيتم التواصل معك بعد مراجعة الطلب.
        </Text>
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>رقم الطلب</Text>
            <Text style={s.summaryValue}>{numberLabel}</Text>
          </View>
          {name ? (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>الملحمة</Text>
              <Text style={s.summaryValue}>{name}</Text>
            </View>
          ) : null}
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>الحالة</Text>
            <Text style={s.pendingText}>قيد المراجعة</Text>
          </View>
        </View>
        <View style={s.stepsWrap}>
          {[
            { label: 'إرسال الطلب', done: true },
            { label: 'مراجعة فريق سرح', done: false },
            { label: 'تجهيز حساب دفترة', done: false },
          ].map((item) => (
            <View key={item.label} style={s.stepRow}>
              <View style={[s.stepCircle, item.done && s.stepCircleDone]}>
                {item.done ? (
                  <AppIcon name="checkmark" size={14} color="#fff" />
                ) : (
                  <View style={s.dot} />
                )}
              </View>
              <Text style={[s.stepLabel, item.done && s.stepLabelDone]}>{item.label}</Text>
            </View>
          ))}
        </View>
        <Pressable style={s.backBtn} onPress={() => router.replace('/join')}>
          <Text style={s.backBtnText}>العودة لصفحة الانضمام</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenRoot },
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  circle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  title: { ...butcherTypography.titleLarge, color: colors.textPrimary, textAlign: 'center' },
  sub: {
    ...butcherTypography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  summaryCard: {
    width: '100%',
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.electric + '44',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { ...butcherTypography.secondary, color: colors.textMuted },
  summaryValue: { ...butcherTypography.emphasis, color: colors.textPrimary },
  pendingText: { ...butcherTypography.emphasis, color: colors.amber },
  stepsWrap: {
    width: '100%',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: colors.success, borderColor: colors.success },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  stepLabel: { ...butcherTypography.secondary, color: colors.textMuted, flex: 1,  },
  stepLabelDone: { color: colors.textBrandSuccess },
  backBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
  },
  backBtnText: { ...typography.button, color: colors.textMuted },
});
}
