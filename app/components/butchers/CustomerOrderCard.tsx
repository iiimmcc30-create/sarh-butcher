import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { AppText } from '@/design-system/components';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { customerOrderHeadline, formatOrderDatePart } from '@/lib/customerOrders';
import { cloudinaryFitUrl } from '@/lib/listingMedia';
import { getRtlRow } from '@/lib/rtl';
import { orderStatusLabel } from '@/services/butcherData';
import { ButcherOrderRecord, formatCurrency } from '@/services/butcherOrders';
import { Pressable, StyleSheet, View } from 'react-native';

export function CustomerOrderCard({
  order,
  onPress,
  onChat,
  onReorder,
  colors,
}: {
  order: ButcherOrderRecord;
  onPress: () => void;
  onChat?: () => void;
  onReorder?: () => void;
  colors: ThemeColors;
}) {
  const styles = createStyles(colors);
  const headline = customerOrderHeadline(order);
  const statusText =
    order.status === 'delivered'
      ? orderStatusLabel(order.status, order.deliveryType)
      : headline.label;
  const delivered = order.status === 'delivered';
  const butcherName = order.butcher?.nameAr?.trim() || 'ملحمة';
  const logo = uriSource(
    cloudinaryFitUrl(order.butcher?.logo || order.butcher?.cover, 'row'),
  );
  const canReorder = delivered && Boolean(onReorder);
  const primaryLabel = headline.awaitingPayment
    ? 'إكمال الدفع'
    : canReorder
      ? 'إعادة الطلب'
      : onChat
        ? 'محادثة'
        : null;

  const onPrimary = headline.awaitingPayment
    ? onPress
    : canReorder
      ? onReorder
      : onChat;

  const statusTone = headline.awaitingPayment
    ? 'warn'
    : headline.expired || order.status === 'cancelled'
      ? 'danger'
      : delivered
        ? 'info'
        : 'active';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.96 }]}
      accessibilityRole="button"
      accessibilityLabel={`${butcherName} — ${statusText}`}
    >
      <View style={[styles.header, getRtlRow()]}>
        <AppText variant="bodySmall" color="textMuted">
          {formatOrderDatePart(order.createdAt)}
        </AppText>
        <View style={[styles.statusChip, styles[`chip_${statusTone}`]]}>
          <AppText variant="micro" style={styles[`chipText_${statusTone}`]}>
            {statusText}
          </AppText>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={[styles.body, getRtlRow()]}>
        <View style={styles.logoWrap}>
          {logo ? (
            <Image source={logo} style={styles.logo} contentFit="cover" />
          ) : (
            <AppIcon name="storefront-outline" size={18} color={colors.textMuted} />
          )}
        </View>

        <View style={styles.info}>
          <AppText variant="label" numberOfLines={1}>
            {butcherName}
          </AppText>
          <AppText variant="bodySmall">{formatCurrency(order.totalPrice, order.currency)}</AppText>
          <AppText variant="caption" color="textSecondary" style={styles.detailsLink}>
            عرض التفاصيل
          </AppText>
          {onChat && !headline.awaitingPayment && !canReorder ? (
            <AppText variant="caption" color="primary">
              محادثة الملحمة
            </AppText>
          ) : null}
        </View>

        {primaryLabel && onPrimary ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onPrimary();
            }}
            style={({ pressed }) => [
              styles.cta,
              headline.awaitingPayment ? styles.ctaPay : styles.ctaGold,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityLabel={primaryLabel}
          >
            <AppText
              variant="label"
              numberOfLines={1}
              style={headline.awaitingPayment ? styles.ctaPayText : styles.ctaGoldText}
            >
              {primaryLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export function CustomerOrderCardSkeleton({ colors }: { colors: ThemeColors }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.card}>
      <View style={[styles.header, getRtlRow()]}>
        <View style={[styles.skeleton, { width: 110, height: 12 }]} />
        <View style={[styles.skeleton, { width: 72, height: 22, borderRadius: radius.pill }]} />
      </View>
      <View style={styles.divider} />
      <View style={[styles.body, getRtlRow()]}>
        <View style={[styles.logoWrap, styles.skeleton]} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={[styles.skeleton, { width: '70%', height: 14 }]} />
          <View style={[styles.skeleton, { width: '40%', height: 12 }]} />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgElevated,
      borderRadius: 16,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    header: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: spacing.sm,
    },
    statusChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    chip_info: {
      backgroundColor: colors.cyan + '22',
    },
    chip_active: {
      backgroundColor: colors.electric + '18',
    },
    chip_warn: {
      backgroundColor: colors.gold + '24',
    },
    chip_danger: {
      backgroundColor: colors.danger + '18',
    },
    chipText_info: {
      color: colors.cyan,
    },
    chipText_active: {
      color: colors.electricBright,
    },
    chipText_warn: {
      color: colors.textPrimary,
    },
    chipText_danger: {
      color: colors.danger,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderHairline,
    },
    body: {
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.md,
    },
    logoWrap: {
      width: 52,
      height: 52,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    logo: { width: '100%', height: '100%' },
    info: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    detailsLink: {
      textDecorationLine: 'underline',
    },
    cta: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      flexWrap: 'nowrap',
    },
    ctaGold: {
      backgroundColor: colors.gold,
    },
    ctaPay: {
      backgroundColor: colors.electric,
    },
    ctaGoldText: {
      color: colors.textPrimary,
    },
    ctaPayText: {
      color: colors.bgDeep,
    },
    skeleton: {
      backgroundColor: colors.bgSurface,
      opacity: 0.7,
      borderRadius: 8,
    },
  });
}
