import { Image, uriSource } from '@/components/ui/AppImage';
import { cloudinaryFitUrl } from '@/lib/listingMedia';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { AppText, SarhAvatar } from '@/design-system/components';
import { butcherTypography } from '@/constants/butcherTypography';
import { radius, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import type { ButcherOfferPreview } from '@/services/butcherOffersPreview';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  offer: ButcherOfferPreview;
  width: number;
  onPress: () => void;
};

export function ButcherHomeOfferCard({ offer, width, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const price = offer.offerPrice ?? offer.originalPrice;
  const butcherName = offer.butcherNameAr || 'ملحمة';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, { width }, pressed && { opacity: 0.94 }]}
      accessibilityRole="button"
      accessibilityLabel={offer.titleAr}
    >
      <View style={[styles.imageWrap, { width, height: width }]}>
        {offer.image ? (
          <Image source={uriSource(cloudinaryFitUrl(offer.image, 'card'))} style={styles.image} contentFit="cover" />
        ) : (
          <View style={styles.imageFallback} />
        )}
        <View style={styles.avatar}>
          <SarhAvatar uri={offer.butcherLogo} name={butcherName} size="xs" />
        </View>
        <Pressable
          onPress={onPress}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel="عرض المنتج"
        >
          <AppIcon name="plus" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
      <AppText variant="label" numberOfLines={2} style={styles.name}>
        {offer.titleAr}
      </AppText>
      {price != null ? (
        <AppText variant="label" style={styles.price}>
          {price.toLocaleString('en-US')} ﷼
        </AppText>
      ) : null}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      gap: 6,
    },
    imageWrap: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.bgSurface,
    },
    image: { width: '100%', height: '100%' },
    imageFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bgSurface,
    },
    avatar: {
      position: 'absolute',
      top: 8,
      end: 8,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: colors.bgElevated,
      padding: 2,
    },
    addBtn: {
      position: 'absolute',
      start: 8,
      bottom: 8,
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      ...butcherTypography.title,
      color: colors.textPrimary,
    },
    price: {
      ...butcherTypography.title,
      color: colors.textPrimary,
    },
  });
}

export default ButcherHomeOfferCard;
