import { SarhChip } from '@/design-system/components';
import { space } from '@/design-system';
import { getRtlRow } from '@/lib/rtl';
import { ScrollView, StyleSheet } from 'react-native';

export type ButcherStoreNavItem = {
  /** Stable key — category slug, or "offers" / "about" / "stories". */
  id: string;
  label: string;
  /** Product categories vs store sections (about is never a product category). */
  kind: 'category' | 'offers' | 'about' | 'stories';
};

type ButcherStoreNavBarProps = {
  items: ButcherStoreNavItem[];
  activeId: string;
  onChange: (item: ButcherStoreNavItem) => void;
};

/**
 * Single unified horizontal bar for the butcher store:
 * dynamic product categories + offers + about (+ stories when present).
 */
export function ButcherStoreNavBar({
  items,
  activeId,
  onChange,
}: ButcherStoreNavBarProps) {
  if (!items.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, getRtlRow()]}
    >
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <SarhChip
            key={`${item.kind}:${item.id}`}
            label={item.label}
            selected={isActive}
            onPress={() => onChange(item)}
            style={styles.chip}
            testID={`butcher-nav-${item.id}`}
          />
        );
      })}
    </ScrollView>
  );
}

/** @deprecated Prefer ButcherStoreNavBar — kept for any residual imports. */
export function ButcherCategoryBar({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (cat: string) => void;
}) {
  const items: ButcherStoreNavItem[] = categories.map((id) => ({
    id,
    label: id === 'all' ? 'الكل' : id,
    kind: 'category',
  }));
  return (
    <ButcherStoreNavBar
      items={items}
      activeId={active}
      onChange={(item) => onChange(item.id)}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexWrap: 'nowrap',
    paddingHorizontal: space[16],
    paddingTop: space[12],
    paddingBottom: space[8],
    gap: space[8],
  },
  chip: {
    flexShrink: 0,
  },
});
