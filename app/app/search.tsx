// SAFAT — Unified Search Screen (البحث)
import { Image, uriSource } from '@/components/ui/AppImage';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { UserIdentityRow, USER_IDENTITY } from '@/components/ui/UserIdentityRow';
import { ListingCard } from '@/components/feature/ListingCard';
import { cloudinaryFitUrl } from '@/lib/listingMedia';
import { openPostDetail } from '@/lib/openPost';
import { AppText, SarhBackButton, SarhChip, SarhChipRow, SarhInput } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLayout } from '@/hooks/useLayout';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { ensureApiReachable } from '@/services/api';
import {
  fetchSearchSuggestions,
  fetchTrendingTags,
  mapListingFromSearch,
  unifiedSearch,
  type SearchContentType,
  type SearchGroup,
  type SearchResultItem,
} from '@/services/unifiedSearch';
import { ds } from '@/constants/designSystem';
import { type ThemeColors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

const RECENT_KEY = 'safat_recent_searches';
const MIN_QUERY = 2;

type SearchFilter = SearchContentType;

const FILTERS: { id: SearchFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'listings', label: 'الإعلانات' },
  { id: 'posts', label: 'المنشورات' },
  { id: 'butchers', label: 'الملاحم' },
  { id: 'news', label: 'الأخبار' },
  { id: 'services', label: 'الخدمات' },
];

const GROUP_LABELS: Record<Exclude<SearchFilter, 'all'>, string> = {
  listings: 'الإعلانات',
  posts: 'المنشورات',
  butchers: 'الملاحم',
  news: 'الأخبار',
  services: 'الخدمات',
  users: 'الحسابات',
};

export default function SearchScreen() {
  const { colors } = useTheme();
  const { gutter } = useLayout();
  const styles = useThemedStyles(({ colors: c, scheme }) => createStyles(c, scheme));
  const router = useRouter();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingTags, setTrendingTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [suggestions, setSuggestions] = useState<Array<{ text: string; kind: string }>>([]);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featuredUsers, setFeaturedUsers] = useState<
    Array<{ id: string; username: string; arabicName?: string; displayName?: string; avatar?: string; verified?: boolean; followers?: number }>
  >([]);

  const searchSeq = useRef(0);

  useEffect(() => {
    fetchTrendingTags().then(setTrendingTags).catch(() => {});
    AsyncStorage.getItem(RECENT_KEY)
      .then((val) => {
        if (val) setRecentSearches(JSON.parse(val));
      })
      .catch(() => {});

    (async () => {
      try {
        const base = await ensureApiReachable();
        const res = await fetch(`${base}/api/users`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setFeaturedUsers(json.data.slice(0, 4));
        }
      } catch {
        /* optional idle content */
      }
    })();
  }, []);

  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY) {
      setSuggestions([]);
      setGroups([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchSearchSuggestions(debouncedQuery)
      .then((items) => {
        if (!cancelled) setSuggestions(items);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY) return;

    const seq = ++searchSeq.current;
    setLoading(true);
    setError(null);

    unifiedSearch({ q: debouncedQuery, type: filter, limit: filter === 'all' ? 8 : 20 })
      .then((res) => {
        if (seq !== searchSeq.current) return;
        setGroups(res.groups);
      })
      .catch((err: unknown) => {
        if (seq !== searchSeq.current) return;
        setError(err instanceof Error ? err.message : 'تعذّر إكمال البحث');
      })
      .finally(() => {
        if (seq === searchSeq.current) setLoading(false);
      });
  }, [debouncedQuery, filter]);

  const saveRecent = useCallback((searches: string[]) => {
    setRecentSearches(searches);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(searches)).catch(() => {});
  }, []);

  const addRecentSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (trimmed.length < MIN_QUERY) return;
      const updated = [trimmed, ...recentSearches.filter((r) => r !== trimmed)].slice(0, 10);
      saveRecent(updated);
    },
    [recentSearches, saveRecent],
  );

  const applyQuery = useCallback(
    (term: string) => {
      setQuery(term);
      addRecentSearch(term);
    },
    [addRecentSearch],
  );

  const hasQuery = query.trim().length > 0;
  const canSearch = debouncedQuery.length >= MIN_QUERY;

  const visibleGroups = useMemo(() => {
    if (filter === 'all') return groups;
    return groups.filter((g) => g.type === filter);
  }, [groups, filter]);

  const totalResults = useMemo(
    () => visibleGroups.reduce((n, g) => n + g.items.length, 0),
    [visibleGroups],
  );

  const renderResult = (item: SearchResultItem) => {
    switch (item.type) {
      case 'listings': {
        const listing = mapListingFromSearch(item.data);
        if (!listing) return null;
        return (
          <ListingCard
            key={`listing-${item.id}`}
            listing={listing}
            variant="grid"
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
          />
        );
      }
      case 'butchers':
        return (
          <Pressable
            key={`butcher-${item.id}`}
            style={styles.resultRow}
            onPress={() => router.push({ pathname: '/butchers/[id]', params: { id: item.id } } as never)}
          >
            <Row gap="md" align="center">
            {item.imageUrl ? (
              <Image source={uriSource(cloudinaryFitUrl(item.imageUrl, 'row'))} style={styles.resultThumb} contentFit="cover" />
            ) : (
              <View style={[styles.resultThumb, styles.resultThumbPlaceholder]}>
                <AppIcon name="store" size={20} color={colors.textMuted} />
              </View>
            )}
            <Stack gap="xs" style={styles.resultBody}>
              <AppText variant="body" numberOfLines={2}>{item.title}</AppText>
              {item.subtitle ? (
                <AppText variant="caption" color="textMuted" numberOfLines={1}>{item.subtitle}</AppText>
              ) : null}
            </Stack>
            </Row>
          </Pressable>
        );
      case 'news':
        return (
          <Pressable
            key={`news-${item.id}`}
            style={styles.resultRow}
            onPress={() => router.push('/news' as never)}
          >
            <Row gap="md" align="center">
            {item.imageUrl ? (
              <Image source={uriSource(cloudinaryFitUrl(item.imageUrl, 'row'))} style={styles.resultThumb} contentFit="cover" />
            ) : null}
            <Stack gap="xs" style={styles.resultBody}>
              <AppText variant="body" numberOfLines={2}>{item.title}</AppText>
              {item.subtitle ? (
                <AppText variant="caption" color="textMuted" numberOfLines={2}>{item.subtitle}</AppText>
              ) : null}
            </Stack>
            </Row>
          </Pressable>
        );
      case 'services':
        return (
          <Pressable
            key={`service-${item.id}`}
            style={styles.resultRow}
            onPress={() =>
              router.push({ pathname: '/ministry/services/[id]', params: { id: item.id } } as never)
            }
          >
            <Row gap="md" align="center">
            <View style={[styles.resultThumb, styles.resultThumbPlaceholder]}>
              <AppIcon name="briefcase" size={20} color={colors.textMuted} />
            </View>
            <Stack gap="xs" style={styles.resultBody}>
              <AppText variant="body" numberOfLines={2}>{item.title}</AppText>
              {item.subtitle ? (
                <AppText variant="caption" color="textMuted" numberOfLines={1}>{item.subtitle}</AppText>
              ) : null}
            </Stack>
            </Row>
          </Pressable>
        );
      case 'posts':
        return (
          <Pressable
            key={`post-${item.id}`}
            style={styles.resultRow}
            onPress={() => openPostDetail(router, item.id)}
          >
            <Row gap="md" align="center">
            {item.imageUrl ? (
              <Image source={uriSource(cloudinaryFitUrl(item.imageUrl, 'row'))} style={styles.resultThumb} contentFit="cover" />
            ) : (
              <View style={[styles.resultThumb, styles.resultThumbPlaceholder]}>
                <AppIcon name="file-text" size={20} color={colors.textMuted} />
              </View>
            )}
            <Stack gap="xs" style={styles.resultBody}>
              <AppText variant="body" numberOfLines={3}>{item.title}</AppText>
              {item.subtitle ? (
                <AppText variant="caption" color="textMuted" numberOfLines={1}>{item.subtitle}</AppText>
              ) : null}
            </Stack>
            </Row>
          </Pressable>
        );
      default:
        return null;
    }
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Row gap="sm" align="center" style={[styles.searchBar, { paddingHorizontal: gutter }]}>
        <SarhBackButton onPress={() => router.back()} color={colors.textPrimary} style={styles.backBtn} />
        <SarhInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث في سرح..."
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => addRecentSearch(query)}
          leadingIcon="search"
          trailingIcon={hasQuery ? 'close-circle' : undefined}
          onTrailingPress={hasQuery ? () => setQuery('') : undefined}
          accessibilityLabel={hasQuery ? 'مسح البحث' : 'ابحث في سرح...'}
          containerStyle={styles.inputFlex}
        />
      </Row>

      {hasQuery && query.trim().length >= MIN_QUERY && suggestions.length > 0 && !loading ? (
        <Stack gap="none" style={[styles.suggestBox, { marginHorizontal: gutter }]}>
          {suggestions.map((s) => (
            <Pressable key={`${s.kind}-${s.text}`} onPress={() => applyQuery(s.text)}>
              <Row gap="sm" align="center" style={styles.suggestRow}>
                <AppIcon name="search" size={14} color={colors.textMuted} />
                <AppText variant="body" color="textSecondary" style={styles.flex}>
                  {s.text}
                </AppText>
              </Row>
            </Pressable>
          ))}
        </Stack>
      ) : null}

      {hasQuery ? (
        <SarhChipRow contentPaddingHorizontal={gutter} style={styles.filterRowWrap}>
          {FILTERS.map((f) => (
            <SarhChip
              appearance="filter"
              key={f.id}
              label={f.label}
              selected={filter === f.id}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </SarhChipRow>
      ) : null}

      <ScreenBody padBottom="xxxl" gutter={false}>
        {!hasQuery ? (
          <Stack gap="lg" style={{ paddingHorizontal: gutter }}>
            {recentSearches.length > 0 ? (
              <Stack gap="md" style={styles.section}>
                <Row justify="between" align="center">
                  <AppText variant="heading3">البحث الأخير</AppText>
                  <Pressable onPress={() => saveRecent([])}>
                    <AppText variant="caption" color="primary">مسح الكل</AppText>
                  </Pressable>
                </Row>
                {recentSearches.map((term) => (
                  <Pressable key={term} onPress={() => applyQuery(term)}>
                    <Row gap="md" align="center" style={styles.recentRow}>
                      <AppIcon name="time-outline" size={16} color={colors.textPrimary} />
                      <AppText variant="body" color="textSecondary" style={styles.flex}>
                        {term}
                      </AppText>
                      <Pressable
                        onPress={() => saveRecent(recentSearches.filter((r) => r !== term))}
                        hitSlop={8}
                      >
                        <AppIcon name="close" size={14} color={colors.textPrimary} />
                      </Pressable>
                    </Row>
                  </Pressable>
                ))}
              </Stack>
            ) : null}

            <Stack gap="md" style={styles.section}>
              <AppText variant="heading3">🔥 الأكثر تداولاً</AppText>
              {trendingTags.length === 0 ? (
                <AppText variant="caption" color="textMuted">لا توجد هاشتاقات رائجة حالياً</AppText>
              ) : (
                <Row gap="sm" wrap>
                  {trendingTags.map((item) => (
                    <Pressable key={item.tag} style={styles.trendingChip} onPress={() => applyQuery(item.tag)}>
                      <AppText variant="caption" color="textSecondary">{item.tag}</AppText>
                    </Pressable>
                  ))}
                </Row>
              )}
            </Stack>

            {featuredUsers.length > 0 ? (
              <Stack gap="sm" style={styles.section}>
                <AppText variant="heading3">🏆 أبرز المربّين</AppText>
                {featuredUsers.map((user) => (
                  <UserIdentityRow
                    key={user.id}
                    avatarUri={user.avatar}
                    displayName={user.arabicName || user.displayName || user.username}
                    username={user.username}
                    verified={user.verified}
                    avatarSize={USER_IDENTITY.listAvatarSize}
                    avatarRadius={USER_IDENTITY.listAvatarRadius}
                    avatarBorderWidth={USER_IDENTITY.listAvatarBorder}
                    nameLines={2}
                    onPress={() => router.push({ pathname: '/users/[id]', params: { id: user.id } } as never)}
                    style={styles.userRow}
                  />
                ))}
              </Stack>
            ) : null}
          </Stack>
        ) : (
          <Stack gap="lg" style={{ paddingHorizontal: gutter }}>
            {query.trim().length > 0 && query.trim().length < MIN_QUERY ? (
              <Stack gap="sm" align="center" style={styles.hintBox}>
                <AppText variant="caption" color="textMuted">
                  اكتب {MIN_QUERY} أحرف على الأقل للبحث
                </AppText>
              </Stack>
            ) : null}

            {loading && totalResults === 0 ? (
              <Stack gap="md" align="center" style={styles.loadingBox}>
                <ActivityIndicator color={colors.glow} />
                <AppText variant="caption" color="textMuted">جاري البحث...</AppText>
              </Stack>
            ) : null}

            {error && totalResults === 0 ? (
              <Stack gap="sm" align="center" style={styles.hintBox}>
                <AppText variant="body" color="danger" align="center">{error}</AppText>
                <AppText variant="caption" color="textMuted">تحقق من الاتصال وحاول مرة أخرى</AppText>
              </Stack>
            ) : null}

            {error && totalResults > 0 ? (
              <Stack gap="sm" align="center" style={styles.hintBox}>
                <AppText variant="caption" color="danger" align="center">{error}</AppText>
              </Stack>
            ) : null}

            {canSearch
              ? visibleGroups.map((group) =>
                  group.items.length > 0 ? (
                    <Stack key={group.type} gap="md" style={styles.section}>
                      <AppText variant="heading3">
                        {GROUP_LABELS[group.type]} ({group.items.length})
                      </AppText>
                      <Stack gap={group.type === 'listings' ? 'md' : 'none'}>
                        {group.items.map((item) => renderResult(item))}
                      </Stack>
                    </Stack>
                  ) : null,
                )
              : null}

            {!loading && !error && canSearch && totalResults === 0 ? (
              <Stack gap="md" align="center" style={styles.noResults}>
                <AppText variant="display">🔍</AppText>
                <AppText variant="heading3" align="center">لم نجد نتائج مطابقة لبحثك</AppText>
                <AppText variant="body" color="textMuted" align="center">جرّب كلمة مختلفة أو عدّل الفلاتر</AppText>
              </Stack>
            ) : null}
          </Stack>
        )}
      </ScreenBody>
    </Screen>
  );
}

function createStyles(colors: ThemeColors, scheme: 'light' | 'dark') {
  const tokens = scheme === 'light' ? ds.light : ds.dark;
  return StyleSheet.create({
    searchBar: {
      paddingVertical: 12,
      backgroundColor: colors.bgDeep,
    },
    backBtn: {
      width: ds.iconBtn.md,
      height: ds.iconBtn.md,
      borderRadius: 12,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputFlex: { flex: 1 },
    flex: { flex: 1 },
    filterRowWrap: {
      backgroundColor: colors.bgDeep,
      paddingVertical: 8,
    },
    suggestBox: {
      marginTop: 8,
      borderRadius: 14,
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
    },
    suggestRow: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    section: {
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.bgElevated,
    },
    recentRow: {
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    trendingChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: ds.radius.pill,
      backgroundColor: tokens.primaryMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMid,
    },
    userRow: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    resultRow: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSoft,
    },
    resultThumb: { width: 56, height: 56, borderRadius: ds.radius.md },
    resultThumbPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgDeep,
    },
    resultBody: { flex: 1, justifyContent: 'center' },
    loadingBox: { paddingVertical: 32 },
    hintBox: { paddingVertical: 24 },
    noResults: { paddingVertical: 60 },
  });
}
