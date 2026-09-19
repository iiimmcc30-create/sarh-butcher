import { type ThemeColors } from '@/constants/theme';
import { motion } from '@/design-system';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { type ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

export type MenuPagerPage = {
  id: string;
  render: () => ReactNode;
};

type Props = {
  pages: MenuPagerPage[];
  activeId: string;
  onActiveId: (id: string) => void;
};

/** Active category plus one neighbor so horizontal swipe still has a page to land on. */
export const MENU_PAGER_RENDER_WINDOW = 1;

export function isMenuPageMounted(pageIndex: number, activeIndex: number): boolean {
  return Math.abs(pageIndex - activeIndex) <= MENU_PAGER_RENDER_WINDOW;
}

export function ButcherMenuPager({ pages, activeId, onActiveId }: Props) {
  const { width } = useWindowDimensions();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const scroller = useRef<ScrollView>(null);
  const rise = useRef(new Animated.Value(1)).current;
  const prevIndex = useRef(0);
  const index = Math.max(0, pages.findIndex((p) => p.id === activeId));

  useEffect(() => {
    const distance = Math.abs(index - prevIndex.current);
    scroller.current?.scrollTo({
      x: index * width,
      // Far jumps (category tap) skip empty in-between slots; adjacent keeps swipe animation.
      animated: distance === 1,
    });
    prevIndex.current = index;
  }, [index, width]);

  useEffect(() => {
    rise.setValue(0);
    Animated.timing(rise, {
      toValue: 1,
      duration: motion.duration.screen,
      useNativeDriver: true,
    }).start();
  }, [activeId, rise]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    const page = pages[next];
    if (page && page.id !== activeId) onActiveId(page.id);
  };

  if (!pages.length) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        keyboardShouldPersistTaps="handled"
      >
        {pages.map((page, pageIndex) => (
          <View key={page.id} style={{ width }}>
            {isMenuPageMounted(pageIndex, index) ? (
              <Animated.View
                style={{
                  opacity: rise,
                  transform: [
                    {
                      translateY: rise.interpolate({
                        inputRange: [0, 1],
                        outputRange: [28, 0],
                      }),
                    },
                  ],
                }}
              >
                {page.render()}
              </Animated.View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      minHeight: 220,
      backgroundColor: colors.screenRoot,
    },
  });
}

export default ButcherMenuPager;
