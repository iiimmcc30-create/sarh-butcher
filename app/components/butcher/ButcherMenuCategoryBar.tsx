import { butcherMarket } from '@/constants/butcherMarket';
import { butcherTypography } from '@/constants/butcherTypography';
import { spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getRtlRow } from '@/lib/rtl';
import type { ButcherStoreNavItem } from '@/components/butcher/ButcherCategoryBar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  items: ButcherStoreNavItem[];
  activeId: string;
  onChange: (item: ButcherStoreNavItem) => void;
};

export function ButcherMenuCategoryBar({ items, activeId, onChange }: Props) {
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  if (!items.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, getRtlRow()]}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Pressable
            key={`${item.kind}:${item.id}`}
            onPress={() => onChange(item)}
            testID={`butcher-nav-${item.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            <View style={[styles.underline, active && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      alignItems: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      gap: spacing.lg,
    },
    tab: {
      alignItems: 'center',
      paddingBottom: 2,
    },
    label: {
      ...butcherTypography.secondary,
      color: colors.textMuted,
    },
    labelActive: {
      ...butcherTypography.emphasis,
      color: butcherMarket.seeAll,
    },
    underline: {
      marginTop: 6,
      height: 3,
      width: '100%',
      borderRadius: 2,
      backgroundColor: 'transparent',
    },
    underlineActive: {
      backgroundColor: butcherMarket.seeAll,
    },
  });
}

export default ButcherMenuCategoryBar;
