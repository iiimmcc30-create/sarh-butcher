import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { ActivityIndicator, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ButchersTabBar } from '@/components/butchers/ButchersTabBar';
import { ButcherNearbyRow } from '@/components/butchers/ButcherNearbyRow';
import { AppFlatList } from '@/components/ui/AppFlatList';
import { AppText } from '@/design-system/components';
import { Screen, ScreenBody } from '@/design-system/layout';
import { space } from '@/design-system/tokens';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { ButcherProfile } from '@/services/butcherData';
import {
  fetchSortedButchers,
  getButchersHomeSnapshot,
  getCachedSortedButchers,
} from '@/services/butcherDirectory';
import { safePush } from '@/lib/safeNavigate';

export default function ButchersAllScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { accessToken } = useAuth();
  const [butchers, setButchers] = useState<ButcherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async (cancelled: () => boolean) => {
    const home = getButchersHomeSnapshot();
    const cachedRating = getCachedSortedButchers('rating');
    const seed = (cachedRating && cachedRating.length > 0 ? cachedRating : null)
      ?? (home?.picks.length ? home.picks : null)
      ?? (home?.nearby.length ? home.nearby : null);
    if (seed && !cancelled()) {
      setButchers(seed);
      setLoading(false);
      setLoadFailed(false);
    } else if (!cancelled()) {
      setLoading(true);
    }

    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {
        /* fall back to rating */
      }

      const sort = lat != null && lng != null ? 'distance' : 'rating';
      const coords = lat != null && lng != null ? { lat, lng } : null;
      const cachedSorted = getCachedSortedButchers(sort, coords);
      if (cachedSorted && cachedSorted.length > 0 && !cancelled()) {
        setButchers(cachedSorted);
        setLoading(false);
        setLoadFailed(false);
      }

      const list = await fetchSortedButchers(sort, {
        lat,
        lng,
        token: accessToken,
      });
      if (cancelled()) return;
      setButchers(list);
      setLoadFailed(false);
    } catch {
      if (cancelled()) return;
      if (seed && seed.length > 0) {
        setButchers(seed);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } finally {
      if (!cancelled()) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const openButcher = useCallback(
    (id: string) => {
      safePush({ pathname: '/butchers/[id]', params: { id } }, undefined, router);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ButcherProfile>) => (
      <ButcherNearbyRow
        butcher={item}
        onPress={() => openButcher(item.id)}
        showDivider={index < butchers.length - 1}
      />
    ),
    [openButcher, butchers.length],
  );

  const keyExtractor = useCallback((item: ButcherProfile) => item.id, []);

  return (
    <Screen edges={['top']}>
      <ScreenHeader variant="screen" title="الملاحم" showBack />
      {loading || (loadFailed && butchers.length === 0) ? (
        <ScreenBody scroll={false} gutter={false}>
          <View style={styles.loader}>
            <ActivityIndicator color={colors.electric} />
          </View>
        </ScreenBody>
      ) : (
        <ScreenBody scroll={false} gutter={false}>
          <AppFlatList
            style={styles.list}
            data={butchers}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={{ width: '100%' }}>
                  <AppText variant="body" color="textMuted">
                    لا توجد ملاحم حالياً
                  </AppText>
                </View>
              </View>
            }
          />
        </ScreenBody>
      )}
      <ButchersTabBar active="stores" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: {
    paddingTop: space[8],
    paddingBottom: space[16],
    flexGrow: 1,
  },
  empty: { paddingVertical: 80, paddingHorizontal: space[16] },
});
