import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image } from '@/components/ui/AppImage';
import { SarhBackButton } from '@/design-system/components';
import { butcherMarket } from '@/constants/butcherMarket';
import { butcherTypography } from '@/constants/butcherTypography';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { getRtlRow } from '@/lib/rtl';
import type { ButcherProfile } from '@/services/butcherData';
import { resolveMediaUrl } from '@/services/media';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  butcher: ButcherProfile;
  favorited: boolean;
  onBack: () => void;
  onFavorite: () => void;
  onInfo: () => void;
};

export function ButcherStoreHero({ butcher, favorited, onBack, onFavorite, onInfo }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const cover = resolveMediaUrl(butcher.cover || butcher.logo);
  const logo = resolveMediaUrl(butcher.logo || butcher.cover);
  return (
    <View style={styles.coverWrap}>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
      ) : (
        <View style={[styles.cover, styles.coverFallback]} />
      )}
      <View style={styles.veil} />

      <View style={styles.backBtn}>
        <SarhBackButton
          onPress={onBack}
          color="#fff"
          accessibilityLabel="رجوع"
          style={styles.backBtnInner}
        />
      </View>

      <View style={[styles.leftActions, getRtlRow()]}>
        <Pressable onPress={onInfo} style={styles.roundBtn} accessibilityLabel="معلومات الملحمة">
          <AppIcon name="information-circle-outline" size={18} color="#fff" />
        </Pressable>
        <Pressable
          onPress={onFavorite}
          style={styles.roundBtn}
          accessibilityLabel={favorited ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
        >
          <AppIcon name={favorited ? 'heart' : 'heart-outline'} size={18} color={favorited ? butcherMarket.seeAll : '#fff'} />
        </Pressable>
      </View>

      <View style={[styles.ratingOnCover, getRtlRow()]}>
        <AppIcon name="star" size={13} color={colors.gold} />
        <Text style={styles.ratingOnCoverText}>
          {butcher.rating.toFixed(1)} ({butcher.reviewCount} + التقييمات)
        </Text>
      </View>

      <View style={styles.avatarFrame}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback} />
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    coverWrap: {
      height: 210,
      overflow: 'hidden',
      backgroundColor: colors.bgSurface,
    },
    cover: { width: '100%', height: '100%' },
    coverFallback: { backgroundColor: colors.bgSurface },
    veil: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(20, 10, 8, 0.22)',
    },
    backBtn: {
      position: 'absolute',
      top: spacing.md,
      start: spacing.md,
      zIndex: 2,
    },
    backBtnInner: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(28, 14, 10, 0.55)',
    },
    leftActions: {
      position: 'absolute',
      top: spacing.md,
      end: spacing.md,
      alignItems: 'center',
      gap: spacing.sm,
      zIndex: 2,
    },
    roundBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(28, 14, 10, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ratingOnCover: {
      position: 'absolute',
      end: spacing.md,
      bottom: spacing.md,
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(28, 14, 10, 0.55)',
    },
    ratingOnCoverText: {
      ...butcherTypography.meta,
      color: '#fff',
    },
    avatarFrame: {
      position: 'absolute',
      start: spacing.md,
      bottom: spacing.md,
      width: 58,
      height: 58,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: '#fff',
      backgroundColor: colors.bgElevated,
    },
    avatar: { width: '100%', height: '100%' },
    avatarFallback: { flex: 1, backgroundColor: colors.bgSurface },
  });
}

export default ButcherStoreHero;
