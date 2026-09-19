import { Image, uriSource } from '@/components/ui/AppImage';
import { butcherTypography } from '@/constants/butcherTypography';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { ButcherMarketBanner } from '@/services/butcherMarketBanners';
import { useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

type Props = {
  banners: ButcherMarketBanner[];
  onActiveIndexChange?: (index: number) => void;
};

export function ButcherMarketBannerSlider({ banners, onActiveIndexChange }: Props) {
  const { width } = useWindowDimensions();
  const inset = spacing.lg;
  const slideWidth = width;
  const cardWidth = width - inset * 2;
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  onActiveIndexChangeRef.current = onActiveIndexChange;

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scroller.current?.scrollTo({ x: next * slideWidth, animated: true });
        onActiveIndexChangeRef.current?.(next);
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length, slideWidth]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / slideWidth);
    if (next !== index && next >= 0 && next < banners.length) {
      setIndex(next);
      onActiveIndexChangeRef.current?.(next);
    }
  };

  if (banners.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {banners.map((banner) => (
          <View key={banner.id} style={[styles.slide, { width: slideWidth }]}>
            <View style={[styles.card, { width: cardWidth }]}>
              <Image source={uriSource(banner.imageUrl)} style={styles.image} contentFit="cover" />
              {banner.titleAr.trim() || banner.subtitleAr.trim() || banner.captionAr.trim() ? (
                <View style={styles.veil} />
              ) : null}
              <View style={styles.copy}>
                {banner.titleAr.trim() ? (
                  <Text style={styles.title} numberOfLines={1}>
                    {banner.titleAr}
                  </Text>
                ) : null}
                {banner.subtitleAr.trim() ? (
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {banner.subtitleAr}
                  </Text>
                ) : null}
                {banner.captionAr.trim() ? (
                  <Text style={styles.caption} numberOfLines={1}>
                    {banner.captionAr}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {banners.map((banner, i) => (
          <Pressable
            key={banner.id}
            onPress={() => {
              setIndex(i);
              onActiveIndexChangeRef.current?.(i);
              scroller.current?.scrollTo({ x: i * slideWidth, animated: true });
            }}
            accessibilityLabel={`بنر ${i + 1}`}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  const overlayText = '#FBF6F2';
  return StyleSheet.create({
    wrap: {
      backgroundColor: 'transparent',
      paddingBottom: spacing.md,
    },
    slide: {
      alignItems: 'center',
    },
    card: {
      height: 168,
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: colors.bgSurface,
    },
    image: { ...StyleSheet.absoluteFillObject },
    veil: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(28, 14, 10, 0.28)',
    },
    copy: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'stretch',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: 4,
    },
    title: {
      ...butcherTypography.meta,
      color: overlayText,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    subtitle: {
      ...butcherTypography.title,
      fontSize: 22,
      lineHeight: 28,
      color: overlayText,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    caption: {
      ...butcherTypography.meta,
      color: overlayText,
      textAlign: 'right',
      writingDirection: 'rtl',
      opacity: 0.9,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.sm,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.45)',
    },
    dotActive: {
      backgroundColor: overlayText,
      width: 16,
      borderRadius: 4,
    },
  });
}

export default ButcherMarketBannerSlider;
