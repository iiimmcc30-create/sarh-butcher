import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { AppText } from '@/design-system/components';
import { butcherTypography } from '@/constants/butcherTypography';
import { butcherMarket } from '@/constants/butcherMarket';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import {
  butcherEtaLabel,
  butcherFeeLabel,
  butcherMinOrderLabel,
  butcherReviewCountLabel,
  hasButcherRating,
} from '@/lib/butcherStoreMeta';
import { cloudinaryFitUrl } from '@/lib/listingMedia';
import { getRtlRow } from '@/lib/rtl';
import type { ButcherProfile } from '@/services/butcherData';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  butcher: ButcherProfile;
  width: number;
  promoted?: boolean;
  onPress: () => void;
};

export function ButcherPickCard({ butcher, width, promoted, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const name = butcher.nameAr || butcher.name;
  const cover = butcher.cover || butcher.logo;
  const showRating = hasButcherRating(butcher);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.94 }]}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View style={styles.cover}>
        {cover ? (
          <Image source={uriSource(cloudinaryFitUrl(cover, 'card'))} style={styles.coverImg} contentFit="cover" />
        ) : (
          <View style={styles.coverFallback} />
        )}
        {promoted || butcher.subscriptionActive ? (
          <View style={styles.promo}>
            <AppText variant="micro" style={styles.promoText}>
              مروج
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="label" numberOfLines={2} style={styles.name}>
        {name}
      </AppText>
      {showRating ? (
        <View style={[styles.ratingRow, getRtlRow()]}>
          <AppIcon name="star" size={13} color={colors.gold} />
          <AppText variant="caption">{butcher.rating.toFixed(1)}</AppText>
          <AppText variant="caption" color="textMuted">
            ({butcherReviewCountLabel(butcher.reviewCount || butcher.totalOrders)})
          </AppText>
        </View>
      ) : null}
      <View style={[styles.metaRow, getRtlRow()]}>
        <View style={[styles.metaItem, getRtlRow()]}>
          <AppIcon name="map-marker-outline" size={12} color={butcherMarket.seeAll} />
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {butcher.cityAr || '—'}
          </AppText>
        </View>
        <View style={[styles.metaItem, getRtlRow()]}>
          <AppIcon name="bicycle-outline" size={12} color={colors.electricBright} />
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {butcherFeeLabel(butcher)}
          </AppText>
        </View>
        <View style={[styles.metaItem, getRtlRow()]}>
          <AppIcon name="clock-outline" size={12} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {butcherEtaLabel(butcher)}
          </AppText>
        </View>
        <View style={[styles.metaItem, getRtlRow()]}>
          <AppIcon name="receipt-outline" size={12} color={colors.electricBright} />
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {butcherMinOrderLabel(butcher)}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: 6,
      backgroundColor: 'transparent',
      paddingBottom: spacing.xs,
    },
    cover: {
      height: 132,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.bgSurface,
    },
    coverImg: { width: '100%', height: '100%' },
    coverFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bgSurface,
    },
    promo: {
      position: 'absolute',
      top: 8,
      start: 8,
      backgroundColor: colors.electric,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    promoText: {
      color: colors.bgDeep,
    },
    name: {
      ...butcherTypography.title,
      color: colors.textPrimary,
      marginTop: 2,
    },
    ratingRow: {
      alignItems: 'center',
      gap: 4,
    },
    metaRow: {
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaItem: {
      alignItems: 'center',
      gap: 3,
      maxWidth: '100%',
    },
  });
}

export default ButcherPickCard;
