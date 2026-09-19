// Powered by OnSpace.AI
// SAFAT — Home Tab (الصفاة)

import { useRouter } from 'expo-router';
import { ExploreSarhSection, type ExploreSarhSectionHandle } from '@/components/feature/ExploreSarhSection';
import { HomeLatestListings, type HomeLatestListingsHandle } from '@/components/feature/HomeLatestListings';
import { HomeQuickAccess } from '@/components/feature/HomeQuickAccess';
import { HomeAppBar, HOME_APP_BAR_STACK_H } from '@/components/ui/HomeAppBar';
import { Screen, ScreenBody } from '@/design-system/layout';
import { motion } from '@/design-system/tokens/motion';
import { useAppUser } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { HOME_TAB_RESELECT_EVENT } from '@/lib/homeQuickAccess';
import { safePush } from '@/lib/safeNavigate';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Easing,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

const HIDE_Y = 12;
const HIDE_DY = 6;
const SHOW_DY = 6;

export default function HomeScreen() {
  const router = useRouter();
  const { me } = useAppUser();
  const { isAuthenticated } = useAuth();
  const displayName = isAuthenticated
    ? me.arabicName || me.displayName || me.username || 'حسابي'
    : 'ضيف';

  const bannerRef = useRef<ExploreSarhSectionHandle>(null);
  const listingsRef = useRef<HomeLatestListingsHandle>(null);
  const refreshBusyRef = useRef(false);
  const hiddenRef = useRef(false);
  const lastYRef = useRef(0);
  const headerHRef = useRef(HOME_APP_BAR_STACK_H);
  const [headerH, setHeaderH] = useState(HOME_APP_BAR_STACK_H);
  const headerProgress = useRef(new Animated.Value(1)).current;
  const headerAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const setHeaderVisible = useCallback(
    (visible: boolean) => {
      if (refreshBusyRef.current) visible = true;
      if (hiddenRef.current === !visible) return;
      hiddenRef.current = !visible;
      headerAnimRef.current?.stop();
      headerAnimRef.current = Animated.timing(headerProgress, {
        toValue: visible ? 1 : 0,
        duration: motion.duration.ui,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      headerAnimRef.current.start();
    },
    [headerProgress],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const dy = y - lastYRef.current;
      lastYRef.current = y;
      if (refreshBusyRef.current || y <= HIDE_Y) {
        setHeaderVisible(true);
        return;
      }
      if (dy > HIDE_DY) setHeaderVisible(false);
      else if (dy < -SHOW_DY) setHeaderVisible(true);
    },
    [setHeaderVisible],
  );

  const onScrollIdle = useCallback(() => {
    setHeaderVisible(true);
  }, [setHeaderVisible]);

  const refreshHome = useCallback(() => {
    if (refreshBusyRef.current) return;
    refreshBusyRef.current = true;
    setHeaderVisible(true);
    void Promise.all([
      bannerRef.current?.refresh() ?? Promise.resolve(),
      listingsRef.current?.refresh() ?? Promise.resolve(),
    ]).finally(() => {
      refreshBusyRef.current = false;
    });
  }, [setHeaderVisible]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(HOME_TAB_RESELECT_EVENT, refreshHome);
    return () => sub.remove();
  }, [refreshHome]);

  const translateY = headerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-headerH, 0],
  });

  return (
    <Screen edges={['top']}>
      <Animated.View
        pointerEvents="box-none"
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          if (!next || Math.abs(next - headerHRef.current) < 1) return;
          headerHRef.current = next;
          setHeaderH(next);
        }}
        style={[styles.header, { opacity: headerProgress, transform: [{ translateY }] }]}
      >
        <HomeAppBar
          displayName={displayName}
          avatarUri={me.avatar}
          onSearch={() => safePush('/search', undefined, router)}
          onProfilePress={() => {
            if (!isAuthenticated) {
              safePush('/auth/phone', undefined, router);
              return;
            }
            safePush('/(tabs)/profile', undefined, router);
          }}
          onAvatarPress={() => {
            if (!isAuthenticated) {
              safePush('/auth/phone', undefined, router);
              return;
            }
            safePush('/sidebar', undefined, router);
          }}
        />
      </Animated.View>

      <ScreenBody
        gutter={false}
        bottomInset="tabBar"
        padBottom="md"
        onScroll={onScroll}
        onScrollEndDrag={onScrollIdle}
        onMomentumScrollEnd={onScrollIdle}
        contentContainerStyle={{ paddingTop: headerH }}
      >
        <ExploreSarhSection ref={bannerRef} />
        <HomeQuickAccess />
        <HomeLatestListings ref={listingsRef} />
      </ScreenBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 2,
  },
});
