// Powered by OnSpace.AI
// SAFAT — Market Tab (السوق)
import { MarketAppBar } from '@/components/market/MarketAppBar';
import { MarketFilterBar } from '@/components/market/MarketFilterBar';
import {
  MarketCategoryPicker,
} from '@/components/market/MarketCategoryPicker';
import { RegionCityPicker } from '@/components/market/RegionCityPicker';

import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  View,
  ListRenderItemInfo,
} from 'react-native';
import * as Location from 'expo-location';
import type { RegionSelection } from '@/constants/saudiRegions';
import { spacing } from '@/constants/theme';
import { compareListingBoostPriority, interleavePromotedListings } from '@/lib/listingSort';
import { listingMatchesMarketSelection } from '@/lib/marketCategoriesFallback';
import { listingMatchesRegionSelection } from '@/lib/saudiRegionSearch';
import { ListingCard } from '@/components/feature/ListingCard';
import { AppFlatList } from '@/components/ui/AppFlatList';
import { AppText } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { safePush } from '@/lib/safeNavigate';
import { useMarketCategories } from '@/hooks/useMarketCategories';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import {
  getBootstrappedListingsPage,
  mergeListingPages,
  searchListingsPage,
  shouldFetchNextListingPage,
} from '@/services/listings';
import { Listing } from '@/services/types';

const MARKET_FOCUS_TTL_MS = 60_000;

type SortMode = 'newest' | 'oldest' | 'price_asc' | 'price_desc';

/** Light-mode market keeps the grey page tone so listing cards read as cards. */
const MARKET_PAGE_LIGHT = '#F8F9FA';

export default function MarketScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors, scheme } = useTheme();
  const { categories, reload: reloadCategories } = useMarketCategories();
  const lastCategoriesFocusAt = useRef(0);
  const listRef = useRef<FlatList<Listing>>(null);
  const loadingMoreRef = useRef(false);
  const loadGenRef = useRef(0);
  const hasItemsRef = useRef(false);
  const loadingRef = useRef(true);
  const skipFirstFocusRef = useRef(true);

  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [regionSelection, setRegionSelection] = useState<RegionSelection>({ type: 'all' });
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [items, setItems] = useState<Listing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  hasItemsRef.current = items.length > 0;
  loadingRef.current = loading;

  const apiFilters = useMemo(
    () => ({
      featured: showFeaturedOnly || undefined,
      categoryId: activeSubId ?? activeParentId ?? undefined,
      subcategoryId: activeSubId ?? undefined,
    }),
    [showFeaturedOnly, activeParentId, activeSubId],
  );

  const loadFirstPage = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const hasServerFilters = Boolean(
      apiFilters.featured || apiFilters.categoryId || apiFilters.subcategoryId,
    );
    if (!hasServerFilters) {
      const boot = getBootstrappedListingsPage(accessToken);
      if (boot) {
        if (gen !== loadGenRef.current) return;
        setItems(boot.listings);
        setNextCursor(boot.nextCursor);
        setHasMore(boot.hasMore);
        setLoadFailed(false);
        setLoading(false);
        return;
      }
    }
    if (!hasItemsRef.current) setLoading(true);
    setLoadFailed(false);
    try {
      const page = await searchListingsPage(apiFilters, accessToken);
      if (gen !== loadGenRef.current) return;
      setItems(page.listings);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setLoadFailed(false);
    } catch {
      if (gen !== loadGenRef.current) return;
      // Keep the last good page — HTTP/network failure must not wipe the list.
      setLoadFailed(true);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [accessToken, apiFilters]);

  const loadNextPage = useCallback(async () => {
    if (
      !shouldFetchNextListingPage({
        hasMore,
        nextCursor,
        loading,
        loadingMore: loadingMoreRef.current,
      })
    ) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await searchListingsPage(
        { ...apiFilters, cursor: nextCursor ?? undefined },
        accessToken,
      );
      setItems((prev) => mergeListingPages(prev, page.listings));
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Keep the current page — a failed load-more must not wipe listings.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [accessToken, apiFilters, hasMore, loading, nextCursor]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastCategoriesFocusAt.current >= MARKET_FOCUS_TTL_MS) {
        lastCategoriesFocusAt.current = now;
        void reloadCategories();
      }
      if (skipFirstFocusRef.current) {
        skipFirstFocusRef.current = false;
        return;
      }
      if (hasItemsRef.current || loadingRef.current) return;
      void loadFirstPage();
    }, [reloadCategories, loadFirstPage]),
  );

  const activeParent = useMemo(
    () => categories.find((c) => c.id === activeParentId) ?? null,
    [categories, activeParentId],
  );
  const activeSub = useMemo(() => {
    if (!activeSubId || !activeParent) return null;
    return activeParent.children?.find((c) => c.id === activeSubId) ?? null;
  }, [activeParent, activeSubId]);

  const onApplyCategory = useCallback((sel: { parentId: string | null; subId: string | null }) => {
    setActiveParentId(sel.parentId);
    setActiveSubId(sel.subId);
  }, []);

  const categoryActive = activeParentId !== null;

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeParentId, activeSubId]);

  const filtered = useMemo(() => {
    let list = items.filter((l) => {
      if (l.country === 'EG') return false;
      if (showFeaturedOnly && !l.featured) return false;
      if (activeParent && !listingMatchesMarketSelection(l, activeParent, activeSub)) {
        return false;
      }
      if (
        !listingMatchesRegionSelection(l.arabicLocation || l.location || '', regionSelection)
      ) {
        return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortMode === 'oldest') return (a.createdAt || '').localeCompare(b.createdAt || '');
      if (sortMode === 'price_asc') return a.price - b.price;
      if (sortMode === 'price_desc') return b.price - a.price;
      return compareListingBoostPriority(a, b);
    });

    return interleavePromotedListings(list);
  }, [items, showFeaturedOnly, activeParent, activeSub, regionSelection, sortMode]);

  useEffect(() => {
    if (regionSelection.type === 'all') return;
    if (!hasMore || loading || loadingMore) return;
    if (filtered.length >= 8) return;
    void loadNextPage();
  }, [filtered.length, hasMore, loadNextPage, loading, loadingMore, regionSelection.type]);

  const cycleSort = () => {
    setSortMode((prev) => {
      if (prev === 'newest') return 'oldest';
      if (prev === 'oldest') return 'price_asc';
      if (prev === 'price_asc') return 'price_desc';
      return 'newest';
    });
  };

  const onNearby = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('إذن الموقع', 'يرجى السماح بالوصول للموقع لعرض الإعلانات القريبة');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const city = geo?.city || geo?.subregion || geo?.region;
      if (!city) {
        Alert.alert('الموقع', 'تعذّر تحديد مدينتك');
        return;
      }
      setRegionSelection({
        type: 'city',
        region: {
          id: 'nearby',
          nameAr: 'بالقرب منك',
          nameEn: 'Nearby',
          cities: [{ id: 'nearby-city', nameAr: city, nameEn: city }],
        },
        city: { id: 'nearby-city', nameAr: city, nameEn: city },
      });
    } catch {
      Alert.alert('خطأ', 'تعذّر الحصول على موقعك');
    }
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Listing>) => (
      <ListingCard
        listing={item}
        variant="list"
        listMode="market"
        onPress={() =>
          safePush({ pathname: '/listing/[id]', params: { id: item.id } }, undefined, router)
        }
      />
    ),
    [router],
  );

  const ListSeparator = useCallback(
    () => <View style={styles.listSeparator} />,
    [],
  );

  const ListHeader = useCallback(
    () => (
      <View style={styles.listingsHead}>
        <Row justify="between" gap="sm">
          <AppText variant="heading3" color="textPrimary" style={styles.listingsTitle}>
            أحدث الإعلانات
          </AppText>
          <AppText variant="caption" color="textMuted">
            {filtered.length} إعلان
          </AppText>
        </Row>
      </View>
    ),
    [filtered.length],
  );

  return (
    <Screen
      edges={['top']}
      style={scheme === 'light' ? { backgroundColor: MARKET_PAGE_LIGHT } : undefined}
    >
      {/* Sticky chrome — must not flex-grow or horizontal ScrollViews open a gap. */}
      <View style={styles.stickyChrome}>
        <MarketAppBar
          onSearch={() => safePush('/search', undefined, router)}
          onFilterPress={() => setRegionPickerOpen(true)}
          onFeaturedPress={() => setShowFeaturedOnly((v) => !v)}
          featuredActive={showFeaturedOnly}
        />

        <MarketFilterBar
          regionSelection={regionSelection}
          onRegionPress={() => setRegionPickerOpen(true)}
          onNearbyPress={() => void onNearby()}
          onSortPress={cycleSort}
          onCategoryPress={() => setCategoryPickerOpen(true)}
          categoryActive={categoryActive}
          categoryPickerOpen={categoryPickerOpen}
          regionActive={regionPickerOpen}
        />
      </View>

      <ScreenBody scroll={false} gutter={false} bottomInset="tabBar">
        <AppFlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          ItemSeparatorComponent={ListSeparator}
          ListEmptyComponent={
            loading || (loadFailed && items.length === 0) ? (
              <Stack gap="md" align="center" style={styles.empty}>
                <ActivityIndicator color={colors.electric} />
              </Stack>
            ) : (
              <Stack gap="md" align="center" style={styles.empty}>
                <AppText variant="heading2" align="center">
                  🔍
                </AppText>
                <AppText variant="body" color="textMuted" align="center">
                  لا توجد إعلانات مطابقة
                </AppText>
              </Stack>
            )
          }
          ListFooterComponent={
            <View style={styles.listFooter}>
              {loadingMore ? <ActivityIndicator color={colors.electric} /> : null}
            </View>
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            void loadNextPage();
          }}
          removeClippedSubviews={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={8}
        />
      </ScreenBody>

      <RegionCityPicker
        visible={regionPickerOpen}
        selection={regionSelection}
        onClose={() => setRegionPickerOpen(false)}
        onSelect={setRegionSelection}
      />

      <MarketCategoryPicker
        visible={categoryPickerOpen}
        categories={categories}
        selection={{ parentId: activeParentId, subId: activeSubId }}
        onClose={() => setCategoryPickerOpen(false)}
        onSelect={onApplyCategory}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stickyChrome: {
    flexGrow: 0,
    flexShrink: 0,
    zIndex: 2,
  },
  list: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  listContent: {
    flexGrow: 0,
  },
  listSeparator: {
    height: spacing.xs,
  },
  listingsHead: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  listingsTitle: {
    flex: 1,
    minWidth: 0,
  },
  listFooter: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  empty: { paddingVertical: spacing.xxxl },
});
