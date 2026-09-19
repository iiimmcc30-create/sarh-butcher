import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { butcherTypography } from '@/constants/butcherTypography';
import { butcherMarket } from '@/constants/butcherMarket';
import { spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import {
  butcherEtaLabel,
  butcherFeeLabel,
  butcherMinOrderLabel,
  butcherPickupLabel,
  butcherReviewCountLabel,
  hasButcherRating,
} from '@/lib/butcherStoreMeta';
import { getRtlRow } from '@/lib/rtl';
import { cloudinaryFitUrl } from '@/lib/listingMedia';
import { motion } from '@/design-system';
import type { ButcherProfile } from '@/services/butcherData';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  butcher: ButcherProfile;
  onPress: () => void;
  showDivider?: boolean;
};

export function ButcherNearbyRow({ butcher, onPress, showDivider = true }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const name = butcher.nameAr || butcher.name;
  const showRating = hasButcherRating(butcher);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, showDivider && styles.divider, pressed && { opacity: motion.press.opacityCard }]}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View style={[styles.body, getRtlRow()]}>
        <View style={styles.logoWrap}>
          <Image
            source={uriSource(cloudinaryFitUrl(butcher.logo || butcher.cover, 'row'))}
            style={styles.logo}
            contentFit="cover"
          />
        </View>
        <View style={styles.textShell}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {showRating ? (
            <View style={[styles.ratingRow, getRtlRow()]}>
              <AppIcon name="star" size={12} color={colors.gold} />
              <Text style={styles.rating}>
                {butcher.rating.toFixed(1)} ({butcherReviewCountLabel(butcher.reviewCount || butcher.totalOrders)})
              </Text>
            </View>
          ) : null}
          <View style={[styles.metaRow, getRtlRow()]}>
            <View style={[styles.metaItem, getRtlRow()]}>
              <AppIcon name="map-marker-outline" size={12} color={butcherMarket.seeAll} />
              <Text style={styles.metaText}>{butcher.cityAr || '—'}</Text>
            </View>
            <View style={[styles.metaItem, getRtlRow()]}>
              <AppIcon name="bicycle-outline" size={12} color={colors.electricBright} />
              <Text style={styles.metaText}>{butcherFeeLabel(butcher)}</Text>
            </View>
            <View style={[styles.metaItem, getRtlRow()]}>
              <AppIcon name="clock-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>{butcherEtaLabel(butcher)}</Text>
            </View>
          </View>
          <View style={[styles.metaRow, getRtlRow()]}>
            <View style={[styles.metaItem, getRtlRow()]}>
              <AppIcon name="receipt-outline" size={12} color={colors.electricBright} />
              <Text style={styles.metaText} numberOfLines={1}>
                {butcherMinOrderLabel(butcher)}
              </Text>
            </View>
            <View style={[styles.metaItem, getRtlRow()]}>
              <AppIcon name="storefront-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {butcherPickupLabel(butcher)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      backgroundColor: colors.screenRoot,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSoft,
    },
    body: {
      alignItems: 'center',
      gap: 12,
    },
    textShell: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    name: {
      ...butcherTypography.title,
      color: colors.textPrimary,
      width: '100%',
      writingDirection: 'rtl',
    },
    ratingRow: {
      alignItems: 'center',
      gap: 4,
    },
    rating: { ...butcherTypography.secondary, color: colors.textMuted },
    metaRow: {
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaItem: {
      alignItems: 'center',
      gap: 3,
    },
    metaText: {
      ...butcherTypography.meta,
      color: colors.textMuted,
    },
    logoWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: colors.bgSurface,
      flexShrink: 0,
    },
    logo: { width: '100%', height: '100%' },
  });
}
