import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { AppText } from '@/design-system/components';
import { butcherMarket } from '@/constants/butcherMarket';
import { butcherTypography } from '@/constants/butcherTypography';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getRtlRow } from '@/lib/rtl';
import { cloudinaryFitUrl } from '@/lib/listingMedia';
import type { ButcherProduct } from '@/services/butcherData';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const IMAGE_SIZE = 88;
const ADD_SIZE = 40;

type ButcherStoreProductCardProps = {
  product: ButcherProduct;
  currencySymbol: string;
  onPress: () => void;
  onAdd: () => void;
  showDivider?: boolean;
};

export function ButcherStoreProductCard({
  product,
  currencySymbol,
  onPress,
  onAdd,
  showDivider = true,
}: ButcherStoreProductCardProps) {
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const currentPrice = product.pricePerKg ?? product.priceFixed ?? 0;
  const comparePrice =
    product.pricePerKg && product.priceFixed && product.priceFixed > product.pricePerKg
      ? product.priceFixed
      : null;
  const discount =
    comparePrice && currentPrice
      ? Math.round(((comparePrice - currentPrice) / comparePrice) * 100)
      : 0;
  const description =
    product.descriptionAr?.trim() ||
    product.pricingNoteAr?.trim() ||
    product.description?.trim() ||
    '';
  const imageUri = cloudinaryFitUrl(product.images[0], 'row');
  const showKgUnit = product.pricePerKg != null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowWrap,
        !showDivider && styles.rowLast,
        pressed && { opacity: 0.96 },
      ]}
    >
      <View style={[styles.row, getRtlRow()]}>
        {/* Image */}
        <View style={styles.imageWrap}>
          {imageUri ? (
            <Image source={uriSource(imageUri)} style={styles.image} contentFit="cover" />
          ) : (
            <View style={styles.imageFallback} />
          )}
        </View>

        {/* Body: name → price/unit → secondary info */}
        <View style={styles.body}>
          <AppText variant="label" numberOfLines={2} style={styles.nameText}>
            {product.nameAr}
          </AppText>

          {/* Price row */}
          <View style={[styles.priceRow, getRtlRow()]}>
            <Text style={styles.price}>
              {currentPrice.toLocaleString('en-US')} {currencySymbol}
            </Text>
            {showKgUnit ? (
              <Text style={styles.priceUnit}>/ كجم</Text>
            ) : null}
            {comparePrice ? (
              <Text style={styles.compare}>
                {comparePrice.toLocaleString('en-US')} {currencySymbol}
              </Text>
            ) : null}
            {discount > 0 ? (
              <View style={styles.discount}>
                <Text style={styles.discountText}>-{discount}%</Text>
              </View>
            ) : null}
          </View>

          {/* Secondary info */}
          {description ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {description}
            </AppText>
          ) : null}
        </View>

        {/* Add button — meat accent background */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onAdd();
          }}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          hitSlop={8}
          accessibilityLabel="إضافة للسلة"
        >
          <AppIcon name="cart-outline" size={17} color="#fff" />
          <View style={styles.plusDot}>
            <AppIcon name="plus" size={9} color={butcherMarket.action} />
          </View>
        </Pressable>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    rowWrap: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
      backgroundColor: 'transparent',
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    row: {
      alignItems: 'center',
      gap: 12,
    },
    imageWrap: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      flexShrink: 0,
    },
    image: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: radius.md,
      backgroundColor: colors.bgSurface,
    },
    imageFallback: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: radius.md,
      backgroundColor: colors.bgSurface,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    nameText: {
      color: colors.textPrimary,
    },
    priceRow: {
      alignItems: 'baseline',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 2,
    },
    price: {
      ...butcherTypography.title,
      color: butcherMarket.seeAll,
    },
    priceUnit: {
      ...butcherTypography.meta,
      color: colors.textMuted,
    },
    compare: {
      ...butcherTypography.meta,
      color: colors.textMuted,
      textDecorationLine: 'line-through',
    },
    discount: {
      backgroundColor: butcherMarket.seeAll,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.pill,
    },
    discountText: {
      ...butcherTypography.badge,
      color: '#fff',
    },
    addBtn: {
      width: ADD_SIZE,
      height: ADD_SIZE,
      borderRadius: 10,
      backgroundColor: butcherMarket.action,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    plusDot: {
      position: 'absolute',
      top: -2,
      end: -2,
      width: 15,
      height: 15,
      borderRadius: 8,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
