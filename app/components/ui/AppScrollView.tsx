import React, { forwardRef } from 'react';
import {
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type AppScrollViewProps = ScrollViewProps & {
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * Shared scroll defaults for Sarh — iOS-like momentum / inertia.
 * Callers may override any prop (e.g. carousels using decelerationRate="fast").
 */
export const AppScrollView = forwardRef<ScrollView, AppScrollViewProps>(
  function AppScrollView(
    {
      showsVerticalScrollIndicator = false,
      showsHorizontalScrollIndicator = false,
      keyboardShouldPersistTaps = 'handled',
      scrollEventThrottle = 16,
      decelerationRate = 'normal',
      bounces = true,
      alwaysBounceVertical,
      overScrollMode,
      ...rest
    },
    ref,
  ) {
    return (
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        scrollEventThrottle={scrollEventThrottle}
        decelerationRate={decelerationRate}
        bounces={bounces}
        alwaysBounceVertical={alwaysBounceVertical ?? bounces}
        overScrollMode={overScrollMode ?? (Platform.OS === 'android' ? 'always' : undefined)}
        {...rest}
      />
    );
  },
);

export default AppScrollView;
