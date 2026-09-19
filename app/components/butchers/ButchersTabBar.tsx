// SAFAT — Butchers market bottom navigation (الرئيسية · الملاحم · الطلبات · المزيد)
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { ambientShadow } from '@/constants/designSystem';
import { butcherTypography } from '@/constants/butcherTypography';
import { spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { getRtlRow } from '@/lib/rtl';
import { safeReplace } from '@/lib/safeNavigate';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Map and offers remain valid screens; they are not bottom-nav tabs. */
export type ButchersTab = 'home' | 'stores' | 'orders' | 'offers' | 'map' | 'more';

type TabDef = {
  key: Exclude<ButchersTab, 'map' | 'offers'>;
  label: string;
  icon: string;
  route: string;
};

/** Visual RTL order (right → left): الرئيسية · الملاحم · الطلبات · المزيد */
const TABS: TabDef[] = [
  { key: 'home', label: 'الرئيسية', icon: 'home-outline', route: '/butchers' },
  { key: 'stores', label: 'الملاحم', icon: 'storefront-outline', route: '/butchers/all' },
  { key: 'orders', label: 'الطلبات', icon: 'bag-outline', route: '/butchers/my-orders' },
  { key: 'more', label: 'المزيد', icon: 'grid-outline', route: '/butchers/more' },
];

export function ButchersTabBar({ active }: { active: ButchersTab }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  const onPress = (tab: TabDef) => {
    if (tab.key === active) return;
    safeReplace(tab.route, undefined, router);
  };

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ambientShadow(scheme, 'soft'),
      ]}
    >
      <View style={[styles.row, getRtlRow()]}>
        {TABS.map((tab) => {
          const focused = tab.key === active;
          const tint = focused ? styles.focused.color : styles.muted.color;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => onPress(tab)}
              style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
            >
              <View style={styles.iconWrap}>
                <AppIcon name={tab.icon} size={22} color={tint} />
              </View>
              <Text
                style={[
                  focused ? butcherTypography.tabActive : butcherTypography.tab,
                  { color: tint },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      backgroundColor: colors.bgElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSoft,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    row: {
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    slot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 4,
      paddingVertical: 2,
      minHeight: 48,
    },
    iconWrap: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
    focused: { color: colors.electricBright },
    muted: { color: colors.textMuted },
  });
}

export default ButchersTabBar;
