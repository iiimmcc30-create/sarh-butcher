import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppScrollView } from '@/components/ui/AppScrollView';
import { ds } from '@/constants/designSystem';
import { useLayout, type ContentWidth } from '@/hooks/useLayout';
import { BOTTOM_ACTION_MIN_HEIGHT, GAP, type GapToken } from './metrics';

/** Space reserved under the content so a fixed layer never covers it. */
export type ScreenBodyInset = 'none' | 'tabBar' | 'action';

export type ScreenBodyProps = {
  children?: ReactNode;
  /** Scrollable by default. Set false for a fixed body that hosts its own list. */
  scroll?: boolean;
  /** Apply the responsive horizontal gutter. Turn off for full-bleed screens. */
  gutter?: boolean;
  width?: ContentWidth;
  gap?: GapToken;
  /** Breathing room between the navigation chrome and the first block. */
  padTop?: GapToken;
  /** Scroll breathing room under the last block. Added to `bottomInset`. */
  padBottom?: GapToken;
  bottomInset?: ScreenBodyInset;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  refreshControl?: ScrollViewProps['refreshControl'];
  /** Children that pin to the top while the rest scrolls, e.g. a tab bar. */
  stickyHeaderIndices?: number[];
  onScroll?: ScrollViewProps['onScroll'];
  onScrollEndDrag?: ScrollViewProps['onScrollEndDrag'];
  onMomentumScrollEnd?: ScrollViewProps['onMomentumScrollEnd'];
  scrollEventThrottle?: ScrollViewProps['scrollEventThrottle'];
  testID?: string;
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

/**
 * The content container. Owns the horizontal gutter, the responsive max
 * width, the bottom inset, and scroll defaults.
 *
 * Screens must not set `paddingHorizontal` or `maxWidth` themselves. Media
 * and hero blocks that need the full width use `<FullBleed>`.
 */
export function ScreenBody({
  children,
  scroll = true,
  gutter = true,
  width = 'content',
  gap = 'none',
  padTop = 'none',
  padBottom = 'none',
  bottomInset = 'none',
  contentContainerStyle,
  style,
  refreshControl,
  stickyHeaderIndices,
  onScroll,
  onScrollEndDrag,
  onMomentumScrollEnd,
  scrollEventThrottle,
  testID,
}: ScreenBodyProps) {
  const layout = useLayout();
  const insets = useSafeAreaInsets();
  const maxWidth = layout.maxWidthFor(width);

  const reserved =
    bottomInset === 'tabBar'
      ? ds.tabBar.height + insets.bottom
      : bottomInset === 'action'
        ? BOTTOM_ACTION_MIN_HEIGHT + insets.bottom
        : 0;

  const content: StyleProp<ViewStyle>[] = [
    {
      paddingHorizontal: gutter ? layout.gutter : 0,
      paddingTop: GAP[padTop],
      paddingBottom: reserved + GAP[padBottom],
      gap: GAP[gap],
    },
    maxWidth != null ? { maxWidth, width: '100%', alignSelf: 'center' } : null,
    contentContainerStyle,
  ];

  if (!scroll) {
    return (
      <View testID={testID} style={[styles.fill, content, style]}>
        {children}
      </View>
    );
  }

  return (
    <AppScrollView
      testID={testID}
      style={[styles.fill, style]}
      contentContainerStyle={content}
      refreshControl={refreshControl}
      stickyHeaderIndices={stickyHeaderIndices}
      onScroll={onScroll}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      scrollEventThrottle={scrollEventThrottle}
    >
      {children}
    </AppScrollView>
  );
}

export type FullBleedProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Escape the `ScreenBody` gutter for hero images, carousels, and maps. */
export function FullBleed({ children, style, testID }: FullBleedProps) {
  const { gutter } = useLayout();
  return (
    <View testID={testID} style={[{ marginHorizontal: -gutter }, style]}>
      {children}
    </View>
  );
}

export default ScreenBody;
