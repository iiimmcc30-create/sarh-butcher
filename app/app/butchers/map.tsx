// Powered by OnSpace.AI
// SAFAT — Butchers Map Screen (خريطة الملاحم)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
  type TextStyle,
} from 'react-native';
import { butcherTypography } from '@/constants/butcherTypography';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { marginAutoStart, rtlForwardIcon } from '@/lib/rtl';
import { cloudinaryFitUrl } from '@/lib/listingMedia';
import {
  ButcherProfile,
  Country,
  gccCurrencies,
  rankButchers,
} from '@/services/butcherData';
import { countries } from '@/services/types';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { hasValidCoords, COUNTRY_MAP_CENTER } from '@/lib/butcherLocation';
import { isNativeMapsEnabled } from '@/lib/maps';
import { NativeButchersMap } from '@/components/feature/NativeButchersMap';
import { ButchersTabBar } from '@/components/butchers/ButchersTabBar';
import { AppText, SarhBackButton } from '@/design-system/components';
import { Row, Screen } from '@/design-system/layout';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

// ─── Map pin layout coordinates (% of map container) ─────────────────────────────
const GCC_COORDINATES: Partial<Record<Country, { x: number; y: number }>> = {
  SA: { x: 44, y: 48 },
  EG: { x: 38, y: 28 },
};

function getPinPosition(butcher: ButcherProfile): { x: number; y: number } {
  if (hasValidCoords(butcher.lat, butcher.lng)) {
    const minLat = 12;
    const maxLat = 32;
    const minLng = 34;
    const maxLng = 60;
    const x = ((butcher.lng - minLng) / (maxLng - minLng)) * 80 + 10;
    const y = ((maxLat - butcher.lat) / (maxLat - minLat)) * 80 + 10;
    return {
      x: Math.min(Math.max(x, 8), 92),
      y: Math.min(Math.max(y, 8), 92),
    };
  }

  const countryPos = GCC_COORDINATES[butcher.country] ?? { x: 50, y: 50 };
  
  // Deterministic offset based on ID string to avoid exact overlap
  let hash = 0;
  for (let i = 0; i < butcher.id.length; i++) {
    hash = butcher.id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const jitterX = (hash % 10) - 5; // -5% to +5%
  const jitterY = ((hash >> 4) % 10) - 5;

  return {
    x: Math.min(Math.max(countryPos.x + jitterX, 10), 90),
    y: Math.min(Math.max(countryPos.y + jitterY, 10), 90),
  };
}

// ─── Map pin component ────────────────────────────────────────────────────────
function MapPin({
  butcher,
  selected,
  onPress,
}: {
  butcher: ButcherProfile;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const mp = useThemedStyles(({ colors }) => createPinStyles(colors));
  const pos = getPinPosition(butcher);

  return (
    <Pressable
      onPress={onPress}
      style={[
        mp.pin,
        { left: `${pos.x}%`, top: `${pos.y}%` },
        selected && mp.pinSelected,
      ]}
    >
      {butcher.subscriptionActive ? (
        <LinearGradient
          colors={[colors.gold, '#F59E0B']}
          style={mp.pinInner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <AppIcon name="shield-checkmark" size={11} color="#1A1300" />
        </LinearGradient>
      ) : (
        <View style={[mp.pinInner, { backgroundColor: colors.electric }]}>
          <Text style={mp.pinIcon}>🥩</Text>
        </View>
      )}
      <View style={mp.pinTail} />
      {selected && (
        <View style={mp.pinLabel}>
          <Text style={mp.pinLabelText} numberOfLines={1}>
            {butcher.nameAr.split(' ').slice(0, 2).join(' ')}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Butcher bottom card ──────────────────────────────────────────────────────
function BottomCard({
  butcher,
  onProfile,
  onOrder,
}: {
  butcher: ButcherProfile;
  onProfile: () => void;
  onOrder: () => void;
}) {
  const { colors } = useTheme();
  const bc = useThemedStyles(({ colors }) => createCardStyles(colors));
  const currency = gccCurrencies[butcher.country];
  const country = countries[butcher.country];

  return (
    <View style={bc.card}>
      <LinearGradient
        colors={[colors.bgSurface, colors.bgElevated]}
        style={StyleSheet.absoluteFill}
      />
      {/* Header row */}
      <View style={bc.header}>
        <Image source={uriSource(cloudinaryFitUrl(butcher.logo, 'row'))} style={bc.logo} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <View style={bc.nameRow}>
            <Text style={bc.name} numberOfLines={1}>{butcher.nameAr}</Text>
            {butcher.subscriptionActive && (
              <AppIcon name="shield-checkmark" size={14} color={colors.gold} />
            )}
          </View>
          <View style={bc.locationRow}>
            <Text style={bc.countryFlag}>{country.flag}</Text>
            <Text style={bc.location}>{butcher.cityAr} · {country.ar}</Text>
          </View>
        </View>
        <View style={bc.ratingBadge}>
          <AppIcon name="star" size={12} color={colors.gold} />
          <Text style={bc.rating}>{butcher.rating.toFixed(1)}</Text>
        </View>
      </View>

      {/* Status + hours */}
      <View style={bc.infoRow}>
        <View style={[
          bc.statusPill,
          { backgroundColor: butcher.workingHours.isOpen ? colors.success + '22' : colors.danger + '22' },
        ]}>
          <View style={[
            bc.statusDot,
            { backgroundColor: butcher.workingHours.isOpen ? colors.success : colors.danger },
          ]} />
          <Text style={[
            bc.statusText,
            { color: butcher.workingHours.isOpen ? colors.success : colors.danger },
          ]}>
            {butcher.workingHours.isOpen ? 'مفتوح' : 'مغلق'}
          </Text>
        </View>
        <View style={bc.hoursPill}>
          <AppIcon name="time-outline" size={12} color={colors.textMuted} />
          <Text style={bc.hoursText as TextStyle}>{butcher.workingHours.open}–{butcher.workingHours.close}</Text>
        </View>
        <View style={bc.completionPill}>
          <AppIcon name="check-circle-outline" size={12} color={colors.electricBright} />
          <Text style={bc.completionText as TextStyle}>{butcher.orderCompletionRate}%</Text>
        </View>
        <Text style={bc.currencyText as TextStyle}>{currency.symbol}</Text>
      </View>

      {/* Specialties */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={bc.chipsRow}>
          {butcher.specialties.map((s, i) => (
            <View key={i} style={bc.chip}>
              <Text style={bc.chipText}>{s}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={bc.actions}>
        <Pressable style={bc.orderBtn} onPress={onOrder}>
          <LinearGradient
            colors={[colors.electric, colors.cyan]}
            style={bc.orderBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <AppIcon name="bag-add-outline" size={16} color="#fff" />
            <Text style={bc.orderBtnText}>اطلب الآن</Text>
          </LinearGradient>
        </Pressable>
        <Pressable style={bc.profileBtn} onPress={onProfile}>
          <Text style={bc.profileBtnText}>الملف الكامل</Text>
          <AppIcon name={rtlForwardIcon()} size={14} color={colors.electricBright} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ButchersMapScreen() {
  const s = useThemedStyles(({ colors }) => createScreenStyles(colors));
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [butchersList, setButchersList] = useState<ButcherProfile[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const hasButchersRef = useRef(false);

  useEffect(() => {
    hasButchersRef.current = butchersList.length > 0;
  }, [butchersList.length]);

  const fetchButchers = useCallback(async () => {
    if (!hasButchersRef.current) setLoadState('loading');
    try {
      const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      const res = await fetch(`${API_BASE}/api/butchers`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.butchers) {
          const mapped = json.data.butchers
            .filter((b: any) => (b.country || 'SA') !== 'EG')
            .map((b: any) => ({
            id: b.id,
            name: b.nameAr || b.nameEn,
            nameAr: b.nameAr,
            logo: b.logo || undefined,
            cover: b.cover || undefined,
            type: b.type || 'regular',
            country: b.country || 'SA',
            city: b.city || '',
            cityAr: b.cityAr || '',
            address: b.address || '',
            addressAr: b.addressAr || '',
            lat: b.lat || 0,
            lng: b.lng || 0,
            phone: b.phone || '',
            rating: b.rating ?? 5.0,
            reviewCount: b.reviewCount ?? 0,
            orderCompletionRate: b.orderCompletionRate ?? 100,
            workingHours: {
              open: b.openTime || '06:00',
              close: b.closeTime || '22:00',
              isOpen: b.isOpen ?? true,
              closedOn: b.closedDays || [],
            },
            bio: b.bioAr || b.bioEn || '',
            bioAr: b.bioAr || '',
            specialties: b.specialties || [],
            subscriptionActive: b.subscriptionActive ?? false,
            subscriptionExpiry: b.subscriptionExpiry,
            commercialReg: b.commercialReg,
            activityScore: b.activityScore ?? 50,
            totalOrders: b.totalOrders ?? 0,
            joinedAt: b.createdAt || new Date().toISOString(),
            }));
          setButchersList(mapped);
          setLoadState('ready');
          return;
        }
      }
      setLoadState('error');
    } catch (err) {
      console.warn('[ButchersMapScreen] Failed to fetch butchers:', err);
      setLoadState('error');
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchButchers();
  }, [fetchButchers]);

  const ranked = rankButchers(butchersList);
  const filtered = ranked;

  const mappableButchers = filtered.filter((b) => hasValidCoords(b.lat, b.lng));
  const selectedButcher = filtered.find((b) => b.id === selectedId) ?? null;

  const mapRegion = useMemo(() => {
    if (selectedButcher && hasValidCoords(selectedButcher.lat, selectedButcher.lng)) {
      return {
        latitude: selectedButcher.lat,
        longitude: selectedButcher.lng,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    if (mappableButchers.length > 0) {
      const avgLat = mappableButchers.reduce((s, b) => s + b.lat, 0) / mappableButchers.length;
      const avgLng = mappableButchers.reduce((s, b) => s + b.lng, 0) / mappableButchers.length;
      return {
        latitude: avgLat,
        longitude: avgLng,
        latitudeDelta: 0.45,
        longitudeDelta: 0.45,
      };
    }
    const center = COUNTRY_MAP_CENTER.SA;
    return {
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: center.delta * 2.5,
      longitudeDelta: center.delta * 2.5,
    };
  }, [mappableButchers, selectedButcher]);

  return (
    <Screen edges={['top']} pattern={false} style={s.screen}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <Row align="center" gap="sm" style={s.header}>
        <SarhBackButton onPress={() => router.replace('/(tabs)')} color={colors.textPrimary} style={s.backBtn} />
        <View style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
          <AppText variant="cardTitle" numberOfLines={1} align="center">خريطة الملاحم</AppText>
          <AppText variant="caption" style={s.headerSub}>{filtered.length} ملحمة متاحة</AppText>
        </View>
        <Pressable
          onPress={() => router.push('/butchers/cart')}
          style={s.listBtn}
          accessibilityRole="button"
          accessibilityLabel="السلة"
        >
          <AppIcon name="cart-outline" size={20} color={colors.electricBright} />
        </Pressable>
      </Row>

      {loadState === 'loading' && butchersList.length === 0 ? (
        <Row align="center" justify="center" gap="sm" style={s.statusBanner}>
          <ActivityIndicator color={colors.electricBright} />
          <AppText variant="caption" color="textMuted" style={s.statusText}>جاري تحميل الملاحم...</AppText>
        </Row>
      ) : null}
      {loadState === 'error' ? (
        <Pressable
          onPress={() => void fetchButchers()}
          accessibilityRole="button"
          accessibilityLabel="إعادة تحميل الملاحم"
        >
          <Row align="center" justify="center" gap="sm" style={s.statusBanner}>
            <AppText variant="caption" color="textMuted" style={s.statusText}>تعذر تحميل الملاحم. اضغط لإعادة المحاولة</AppText>
          </Row>
        </Pressable>
      ) : null}

      {/* Map area */}
      <View style={s.mapContainer}>
        {Platform.OS !== 'web' && isNativeMapsEnabled() && mappableButchers.length > 0 ? (
          <NativeButchersMap
            region={mapRegion}
            butchers={mappableButchers}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : (
          <>
        {/* Calm schematic map background — Sarh surface tones */}
        <LinearGradient
          colors={[colors.bgDeep, colors.bgSurface, colors.bgDeep]}
          style={StyleSheet.absoluteFill}
        />
        {/* Grid lines (simulated map grid) */}
        {[...Array(8)].map((_, i) => (
          <View key={`h${i}`} style={[s.gridLine, s.gridLineH, { top: `${(i + 1) * 11}%` }]} />
        ))}
        {[...Array(8)].map((_, i) => (
          <View key={`v${i}`} style={[s.gridLine, s.gridLineV, { left: `${(i + 1) * 11}%` }]} />
        ))}

        {/* Region label */}
        <View style={s.regionLabel}>
          <AppText variant="micro" color="textMuted">المملكة العربية السعودية</AppText>
        </View>

        {/* Map pins */}
        {filtered.map((butcher) => (
          <MapPin
            key={butcher.id}
            butcher={butcher}
            selected={selectedId === butcher.id}
            onPress={() => setSelectedId(selectedId === butcher.id ? null : butcher.id)}
          />
        ))}
          </>
        )}

        {/* Legend */}
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.gold }]} />
            <AppText variant="micro" color="textMuted">موثّق</AppText>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.electric }]} />
            <AppText variant="micro" color="textMuted">عادي</AppText>
          </View>
        </View>

        {/* Tap hint if nothing selected */}
        {!selectedId && (
          <View style={s.tapHint}>
            <AppIcon name="gesture-tap" size={16} color={colors.textMuted} />
            <AppText variant="caption" color="textMuted">اضغط على أي دبوس لعرض تفاصيل الملحمة</AppText>
          </View>
        )}
      </View>

      {/* Bottom card / list */}
      {selectedButcher ? (
        <BottomCard
          butcher={selectedButcher}
          onProfile={() =>
            router.push({ pathname: '/butchers/[id]', params: { id: selectedButcher.id } })
          }
          onOrder={() =>
            router.push({ pathname: '/butchers/order', params: { butcherId: selectedButcher.id } })
          }
        />
      ) : (
        /* Mini list when nothing selected */
        <View style={s.miniList}>
          <AppText variant="caption" color="textMuted" style={s.miniListTitle}>أقرب الملاحم</AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.miniListRow}
          >
            {filtered.slice(0, 5).map((b) => {
              const ctr = countries[b.country];
              return (
                <Pressable
                  key={b.id}
                  style={s.miniCard}
                  onPress={() => setSelectedId(b.id)}
                >
                  <LinearGradient
                    colors={[colors.bgSurface, colors.bgElevated]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Image source={uriSource(cloudinaryFitUrl(b.logo, 'row'))} style={s.miniLogo} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <AppText variant="label" numberOfLines={1}>{b.nameAr}</AppText>
                    <View style={s.miniMeta}>
                      <Text style={s.miniFlag}>{ctr.flag}</Text>
                      <AppText variant="micro" color="textMuted">{b.cityAr}</AppText>
                      {b.subscriptionActive && (
                        <AppIcon name="shield-checkmark" size={11} color={colors.gold} />
                      )}
                    </View>
                  </View>
                  <View style={s.miniRating}>
                    <AppIcon name="star" size={11} color={colors.gold} />
                    <AppText variant="label" style={s.miniRatingText}>{b.rating.toFixed(1)}</AppText>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ButchersTabBar active="map" />
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenRoot },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgGlass,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  statusBanner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  statusText: { flexShrink: 1 },
  headerSub: { color: colors.textBrand, marginTop: 1 },
  listBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgGlass,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  // Map
  mapContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderMid,
    marginBottom: spacing.md,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(32,182,111,0.06)',
  },
  gridLineH: { left: 0, right: 0, height: 1 },
  gridLineV: { top: 0, bottom: 0, width: 1 },
  regionLabel: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(6,9,26,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  regionText: {},
  legend: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: 'rgba(6,9,26,0.8)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: {},
  tapHint: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6,9,26,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  tapHintText: {},

  // Mini list
  miniList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  miniListTitle: { marginBottom: spacing.sm },
  miniListRow: { flexDirection: 'row', gap: spacing.sm },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: 220,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  miniLogo: { width: 36, height: 36, borderRadius: 16, backgroundColor: colors.bgElevated },
  miniName: {},
  miniMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  miniFlag: { fontSize: 11 },
  miniCity: {},
  miniRating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  miniRatingText: { color: colors.gold },
});
}


// Map pin styles
function createPinStyles(colors: ThemeColors) {
  return StyleSheet.create({
  pin: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
    transform: [{ translateX: -18 }, { translateY: -38 }],
  },
  pinSelected: { zIndex: 20 },
  pinInner: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  pinIcon: { fontSize: 14 },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
    marginTop: -2,
  },
  pinLabel: {
    backgroundColor: 'rgba(6,9,26,0.9)',
    borderWidth: 1,
    borderColor: colors.borderMid,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    maxWidth: 120,
  },
  pinLabelText: { ...butcherTypography.meta, color: colors.textPrimary },
});
}


// Bottom card styles
function createCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderMid,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 48, height: 48, borderRadius: 20,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5, borderColor: colors.borderMid,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...butcherTypography.primary, color: colors.textPrimary, flex: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  countryFlag: { fontSize: 13 },
  location: { ...butcherTypography.secondary, color: colors.textMuted },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.gold + '22',
    borderWidth: 1, borderColor: colors.gold + '44',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  rating: { ...butcherTypography.emphasis, color: colors.gold },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...butcherTypography.emphasis },
  hoursPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  hoursText: { ...butcherTypography.meta, color: colors.textMuted } as TextStyle,
  completionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.electric + '11',
    borderWidth: 1, borderColor: colors.electricBright + '33',
  },
  completionText: { ...butcherTypography.meta, color: colors.textBrandStrong },
  currencyText: { ...butcherTypography.secondary, color: colors.textMuted, ...marginAutoStart() },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  chipText: { ...butcherTypography.meta, color: colors.textBrand },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.electricBright + '66',
    backgroundColor: colors.electric + '11',
  },
  chatBtnText: { ...butcherTypography.emphasis, color: colors.textBrandStrong },
  orderBtn: { flex: 1, borderRadius: radius.xl, overflow: 'hidden' },
  orderBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
  },
  orderBtnText: { ...butcherTypography.emphasis, color: '#fff' },
  profileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSoft,
    backgroundColor: colors.bgElevated,
  },
  profileBtnText: { ...butcherTypography.meta, color: colors.textBrandStrong },
});
}
