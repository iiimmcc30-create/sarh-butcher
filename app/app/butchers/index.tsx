// SAFAT — Butchers market home: banners · offers · picks · nearby
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { butcherChromeBg, butcherChromeTone } from '@/constants/butcherMarket';
import { spacing, type ThemeColors } from '@/constants/theme';
import { AppText } from '@/design-system/components';
import { Screen, ScreenBody } from '@/design-system/layout';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { ButcherProfile } from '@/services/butcherData';
import { type ButcherMarketBanner } from '@/services/butcherMarketBanners';
import { ButchersAppBar } from '@/components/butchers/ButchersAppBar';
import { ButchersTabBar } from '@/components/butchers/ButchersTabBar';
import { ButcherMarketBannerSlider } from '@/components/butchers/ButcherMarketBannerSlider';
import { ButcherPickCard } from '@/components/butchers/ButcherPickCard';
import { ButcherHomeOfferCard } from '@/components/butchers/ButcherHomeOfferCard';
import { ButcherNearbyRow } from '@/components/butchers/ButcherNearbyRow';
import { ButcherSectionHeader } from '@/components/butchers/ButcherSectionHeader';
import { safePush, safeReplace } from '@/lib/safeNavigate';
import { useButcherCart } from '@/contexts/ButcherCartContext';
import { type ButcherOfferPreview } from '@/services/butcherOffersPreview';
import {
  BUTCHERS_HOME_SECTION_LIMIT,
  fetchSortedButchers,
  getButchersHomeSnapshot,
  isButchersHomeSnapshotFresh,
  loadButchersHome,
  setButchersHomeSnapshot,
} from '@/services/butcherDirectory';

function filterButchers(list: ButcherProfile[], query: string): ButcherProfile[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (b) =>
      b.nameAr.includes(q) ||
      b.name.toLowerCase().includes(q) ||
      b.cityAr.includes(q) ||
      b.specialties.some((sp) => sp.includes(q)),
  );
}

export default function ButchersScreen() {
  const { colors, scheme } = useTheme();
  const s = useThemedStyles(({ colors, scheme }) => createScreenStyles(colors, scheme));
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { accessToken } = useAuth();
  const { itemCount, butcherId } = useButcherCart();
  const [picks, setPicks] = useState<ButcherProfile[]>([]);
  const [nearby, setNearby] = useState<ButcherProfile[]>([]);
  const [banners, setBanners] = useState<ButcherMarketBanner[]>([]);
  const [homeOffers, setHomeOffers] = useState<ButcherOfferPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const hasHomeDataRef = useRef(false);
  const picksRef = useRef<ButcherProfile[]>([]);
  const chromeTone = butcherChromeTone(bannerIndex);
  const chromeBg = butcherChromeBg(scheme, chromeTone);

  const pickWidth = Math.round((screenWidth - spacing.lg * 2) * 0.72);
  const offerWidth = Math.round(Math.min(156, screenWidth * 0.38));

  useEffect(() => {
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({});
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        /* nearby falls back to rating order */
      }
    })();
  }, []);

  useEffect(() => {
    hasHomeDataRef.current = picks.length > 0;
    picksRef.current = picks;
  }, [picks]);

  useEffect(() => {
    let cancelled = false;
    const snap = getButchersHomeSnapshot();
    if (snap && isButchersHomeSnapshotFresh()) {
      setPicks(snap.picks);
      setNearby(snap.nearby);
      setBanners(snap.banners);
      setHomeOffers(snap.offers);
      setLoadFailed(false);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    if (snap && snap.picks.length > 0) {
      setPicks(snap.picks);
      setNearby(snap.nearby);
      setBanners(snap.banners);
      setHomeOffers(snap.offers);
      setLoadFailed(false);
      setLoading(false);
    }

    void (async () => {
      if (!hasHomeDataRef.current) setLoading(true);
      setLoadFailed(false);
      try {
        const next = await loadButchersHome(accessToken);
        if (cancelled) return;
        setPicks(next.picks);
        setNearby(next.nearby);
        setBanners(next.banners);
        setHomeOffers(next.offers);
        setLoadFailed(false);
      } catch (err) {
        console.warn('[ButchersScreen] Failed to fetch home:', err);
        const cached = getButchersHomeSnapshot();
        if (cancelled) return;
        if (cached && cached.picks.length > 0) {
          setPicks(cached.picks);
          setNearby(cached.nearby);
          setBanners(cached.banners);
          setHomeOffers(cached.offers);
          setLoadFailed(false);
        } else {
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!userCoords) return;
    let cancelled = false;
    void fetchSortedButchers('distance', {
      lat: userCoords.lat,
      lng: userCoords.lng,
      token: accessToken,
    })
      .then((near) => {
        const next = near.slice(0, BUTCHERS_HOME_SECTION_LIMIT);
        const fallback = picksRef.current.slice(0, BUTCHERS_HOME_SECTION_LIMIT);
        const nearby = next.length ? next : fallback;
        setButchersHomeSnapshot({ nearby });
        if (!cancelled) setNearby(nearby);
      })
      .catch(() => {
        /* keep current nearby */
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, userCoords]);

  const filteredPicks = useMemo(() => filterButchers(picks, searchQuery), [picks, searchQuery]);
  const filteredNearby = useMemo(() => filterButchers(nearby, searchQuery), [nearby, searchQuery]);
  const filteredOffers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return homeOffers;
    return homeOffers.filter(
      (o) =>
        o.titleAr.toLowerCase().includes(q) ||
        (o.butcherNameAr ?? '').toLowerCase().includes(q),
    );
  }, [homeOffers, searchQuery]);
  const openButcher = (id: string) =>
    safePush({ pathname: '/butchers/[id]', params: { id } }, undefined, router);

  return (
    <Screen
      edges={['top']}
      pattern={false}
      style={{ backgroundColor: chromeBg }}
    >
      <ScreenBody
        stickyHeaderIndices={[0]}
        gutter={false}
        width="full"
        contentContainerStyle={s.scroll}
      >
        <View style={s.stickyHeader}>
          <ButchersAppBar
            onBack={() => safeReplace('/(tabs)', undefined, router)}
            onCart={() =>
              safePush(
                {
                  pathname: '/butchers/cart',
                  params: butcherId ? { butcherId } : {},
                },
                undefined,
                router,
              )
            }
            cartCount={itemCount}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            chromeTone={chromeTone}
          />
        </View>

        <ButcherMarketBannerSlider banners={banners} onActiveIndexChange={setBannerIndex} />

        <View style={s.pageBody}>
        {loading || (loadFailed && picks.length === 0) ? (
          <View style={s.loader}>
            <ActivityIndicator color={colors.electricBright} />
          </View>
        ) : null}

        {!loading &&
        searchQuery.trim() &&
        filteredPicks.length === 0 &&
        filteredNearby.length === 0 &&
        filteredOffers.length === 0 ? (
          <View style={s.emptyState}>
            <AppText variant="sectionTitle">لا توجد نتائج</AppText>
            <AppText variant="bodySmall" color="textMuted">
              جرّب كلمة بحث أخرى
            </AppText>
          </View>
        ) : (
          <>
            {filteredOffers.length > 0 ? (
              <>
                <ButcherSectionHeader
                  title="العروض"
                  onSeeAll={() => safePush('/butchers/offers', undefined, router)}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.offersRow}
                >
                  {filteredOffers.map((offer) => (
                    <ButcherHomeOfferCard
                      key={`${offer.butcherId}-${offer.id}`}
                      offer={offer}
                      width={offerWidth}
                      onPress={() => openButcher(offer.butcherId)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            {filteredPicks.length > 0 ? (
              <>
                <ButcherSectionHeader
                  title="مختارات سرح"
                  onSeeAll={() => safePush('/butchers/all', undefined, router)}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.picksRow}
                >
                  {filteredPicks.map((butcher, i) => (
                    <ButcherPickCard
                      key={butcher.id}
                      butcher={butcher}
                      width={pickWidth}
                      promoted={i < 2 || butcher.subscriptionActive}
                      onPress={() => openButcher(butcher.id)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            {filteredNearby.length > 0 ? (
              <>
                <ButcherSectionHeader
                  title="الأقرب إليك"
                  onSeeAll={() => safePush('/butchers/all', undefined, router)}
                />
                <View style={s.nearbyList}>
                  {filteredNearby.map((butcher, index) => (
                    <ButcherNearbyRow
                      key={butcher.id}
                      butcher={butcher}
                      onPress={() => openButcher(butcher.id)}
                      showDivider={index < filteredNearby.length - 1}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
        </View>
      </ScreenBody>

      <ButchersTabBar active="home" />
    </Screen>
  );
}

function createScreenStyles(colors: ThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    scroll: { paddingBottom: 20, backgroundColor: 'transparent' },
    stickyHeader: { backgroundColor: 'transparent' },
    pageBody: { backgroundColor: colors.screenRoot },
    offersRow: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.md,
    },
    loader: { paddingVertical: 40, alignItems: 'center', backgroundColor: colors.screenRoot },
    picksRow: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.md,
    },
    nearbyList: { backgroundColor: colors.screenRoot, paddingBottom: spacing.sm },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
      gap: spacing.sm,
      backgroundColor: colors.screenRoot,
    },
  });
}
