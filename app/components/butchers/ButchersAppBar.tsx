import { AppIcon } from '@/components/ui/FlaticonIcon';
import { ButcherLocationBar } from '@/components/butchers/ButcherLocationBar';
import { butcherTypography } from '@/constants/butcherTypography';
import {
  butcherChromeBg,
  butcherSearchFill,
  type ButcherChromeTone,
} from '@/constants/butcherMarket';
import { ds } from '@/constants/designSystem';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { getRtlRow, rtlInputText } from '@/lib/rtl';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const HOME_SEARCH_DEBOUNCE_MS = 200;

type ButchersAppBarProps = {
  onBack: () => void;
  onCart: () => void;
  cartCount?: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  chromeTone?: ButcherChromeTone;
};

/**
 * Meat-wash header: location on the right, cart + physical-left exit on the left,
 * full-width search pill underneath (Hunger-style).
 */
export function ButchersAppBar({
  onBack,
  onCart,
  cartCount = 0,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'ابحث عن ملحمة أو منتج...',
  chromeTone = 'meat',
}: ButchersAppBarProps) {
  const { scheme } = useTheme();
  const { styles, colors } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    colors: theme.colors,
  }));
  const [text, setText] = useState(searchQuery);
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;

  useEffect(() => {
    if (text === searchQuery) return;
    const timer = setTimeout(() => {
      onSearchChangeRef.current(text);
    }, HOME_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, searchQuery]);

  return (
    <View style={[styles.shell, { backgroundColor: butcherChromeBg(scheme, chromeTone) }]}>
      <View style={[styles.top, getRtlRow()]}>
        <View style={styles.location}>
          <ButcherLocationBar compact />
        </View>
        <Pressable onPress={onCart} style={styles.iconBtn} hitSlop={8} accessibilityLabel="السلة">
          <AppIcon name="cart-outline" size={ds.icon.md} color={colors.textPrimary} />
          <Text style={styles.cartCaption}>السلة</Text>
          {cartCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          onPress={onBack}
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityLabel="رجوع للتطبيق"
        >
          <AppIcon name="angle-left" size={ds.icon.md} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View
        style={[
          styles.searchPill,
          getRtlRow(),
          { backgroundColor: butcherSearchFill(scheme, chromeTone) },
        ]}
      >
        <AppIcon name="search" size={ds.icon.sm} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, rtlInputText]}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          returnKeyType="search"
          accessibilityLabel="بحث"
        />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    shell: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: spacing.sm,
      overflow: 'hidden',
    },
    top: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    location: {
      flex: 1,
      minWidth: 0,
    },
    iconBtn: {
      width: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    cartCaption: {
      ...butcherTypography.badge,
      color: colors.textPrimary,
      marginTop: 1,
    },
    badge: {
      position: 'absolute',
      top: 2,
      start: 6,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: colors.electric,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      ...butcherTypography.badge,
      color: colors.bgDeep,
    },
    searchPill: {
      alignItems: 'center',
      minHeight: 38,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    searchInput: {
      ...butcherTypography.secondary,
      color: colors.textPrimary,
      flex: 1,
      paddingVertical: 0,
    },
  });
}

export default ButchersAppBar;
