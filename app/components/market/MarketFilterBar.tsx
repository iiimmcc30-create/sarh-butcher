import { SarhChip, SarhChipRow } from '@/design-system/components';
import type { RegionSelection } from '@/constants/saudiRegions';
import { regionSelectionLabel } from '@/lib/saudiRegionSearch';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getRtlRow } from '@/lib/rtl';
import { MARKET_CHIP } from '@/components/ui/filterChipTokens';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  regionSelection: RegionSelection;
  onRegionPress: () => void;
  onNearbyPress: () => void;
  onSortPress: () => void;
  onCategoryPress: () => void;
  categoryActive?: boolean;
  categoryPickerOpen?: boolean;
  regionActive?: boolean;
};

/** Region + nearby chips, then paired sort/category bar (reference layout). */
export function MarketFilterBar({
  regionSelection,
  onRegionPress,
  onNearbyPress,
  onSortPress,
  onCategoryPress,
  categoryActive = false,
  categoryPickerOpen = false,
  regionActive = false,
}: Props) {
  const { styles, colors } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    colors: theme.colors,
  }));

  const regionOpen = regionActive || regionSelection.type !== 'all';
  const regionLabel = regionSelectionLabel(regionSelection);
  const categoryOpen = categoryPickerOpen || categoryActive;
  const accent = colors.electricBright;

  return (
    <View style={styles.wrap}>
      <SarhChipRow contentPaddingHorizontal={spacing.md}>
        <Pressable
          style={[
            styles.regionBtn,
            regionOpen && styles.regionBtnActive,
            getRtlRow(),
          ]}
          onPress={onRegionPress}
          accessibilityRole="button"
          accessibilityLabel={regionLabel}
        >
          <AppIcon
            name="map-marker-outline"
            size={MARKET_CHIP.iconSize}
            color={regionOpen ? accent : colors.textPrimary}
          />
          <Text
            style={[styles.regionText, regionOpen && styles.regionTextActive]}
            numberOfLines={1}
          >
            {regionLabel}
          </Text>
          <AppIcon
            name="angle-down"
            size={11}
            color={regionOpen ? accent : colors.textSecondary}
          />
        </Pressable>

        <SarhChip appearance="filter" label="القريب" icon="navigation" compact onPress={onNearbyPress} />

        <Pressable
          style={[styles.filterChip, getRtlRow()]}
          onPress={onSortPress}
          accessibilityRole="button"
          accessibilityLabel="الترتيب"
          testID="market-sort-chip"
        >
          <AppIcon name="sort-alt" size={MARKET_CHIP.iconSize} color={accent} />
          <Text style={styles.filterChipLabel}>الترتيب</Text>
        </Pressable>

        <Pressable
          style={[styles.filterChip, categoryOpen && styles.filterChipActive, getRtlRow()]}
          onPress={onCategoryPress}
          accessibilityRole="button"
          accessibilityLabel="التصنيف"
          testID="market-category-chip"
        >
          <AppIcon
            name="options-outline"
            size={MARKET_CHIP.iconSize}
            color={categoryOpen ? accent : colors.textPrimary}
          />
          <Text
            style={[styles.filterChipLabel, categoryOpen && styles.filterChipLabelActive]}
          >
            التصنيف
          </Text>
        </Pressable>
      </SarhChipRow>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexGrow: 0,
      flexShrink: 0,
      paddingVertical: spacing.xs,
    },
    regionBtn: {
      height: MARKET_CHIP.height,
      flexDirection: 'row',
      alignItems: 'center',
      gap: MARKET_CHIP.gap,
      paddingHorizontal: MARKET_CHIP.paddingHorizontal,
      borderRadius: MARKET_CHIP.radius,
      backgroundColor: colors.bgElevated,
      borderWidth: 0,
      maxWidth: 160,
      flexShrink: 0,
    },
    regionBtnActive: {
      borderWidth: 1,
      borderColor: colors.electricBright,
      backgroundColor: `${colors.electricBright}14`,
    },
    regionText: {
      ...typography.caption,
      fontSize: MARKET_CHIP.fontSize,
      lineHeight: MARKET_CHIP.lineHeight,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      flexShrink: 1,
      includeFontPadding: false,
    },
    regionTextActive: {
      color: colors.electricBright,
    },
    filterChip: {
      height: MARKET_CHIP.height,
      alignItems: 'center',
      justifyContent: 'center',
      gap: MARKET_CHIP.gap,
      paddingHorizontal: MARKET_CHIP.paddingHorizontal,
      borderRadius: MARKET_CHIP.radius,
      backgroundColor: colors.bgElevated,
      borderWidth: 0,
      flexShrink: 0,
    },
    filterChipActive: {
      borderWidth: 1,
      borderColor: colors.electricBright,
      backgroundColor: `${colors.electricBright}14`,
    },
    filterChipLabel: {
      ...typography.caption,
      fontSize: MARKET_CHIP.fontSize,
      lineHeight: MARKET_CHIP.lineHeight,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      includeFontPadding: false,
    },
    filterChipLabelActive: {
      color: colors.electricBright,
      fontWeight: '600',
    },
  });
}

export default MarketFilterBar;
