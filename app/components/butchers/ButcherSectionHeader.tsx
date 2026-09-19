import { AppText } from '@/design-system/components';
import { butcherMarket } from '@/constants/butcherMarket';
import { spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getRtlRow } from '@/lib/rtl';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
};

export function ButcherSectionHeader({
  title,
  onSeeAll,
  seeAllLabel = 'عرض الكل',
}: Props) {
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  return (
    <View style={[styles.row, getRtlRow()]}>
      <AppText variant="heading3" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel={seeAllLabel}>
          <AppText variant="label" style={styles.seeAll}>
            {seeAllLabel}
          </AppText>
        </Pressable>
      ) : (
        <View />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    title: {
      flex: 1,
      color: colors.textPrimary,
    },
    seeAll: {
      color: butcherMarket.seeAll,
    },
  });
}

export default ButcherSectionHeader;
