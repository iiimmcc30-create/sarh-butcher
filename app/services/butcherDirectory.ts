import { API_BASE } from './api';
import {
  mapButcherFromApi,
  mapButcherProductFromApi,
  type ButcherOffer,
  type ButcherProduct,
  type ButcherProfile,
  type ButcherReview,
  type ButcherStory,
} from './butcherData';
import { fetchButcherMarketBanners, type ButcherMarketBanner } from './butcherMarketBanners';
import { dedupeInflight, shouldReuseFreshResult } from './requestCoordination';
import {
  BUTCHER_HOME_OFFERS_LIMIT,
  butcherOffersFeedFromRecords,
  butcherRecordsHaveEmbeddedOffers,
  fetchButcherOffersPreview,
  getCachedResolvedOffersFeed,
  resetButcherOffersFeedCache,
  resolveButcherOffersFeed,
  type ButcherOfferPreview,
  type ButcherOffersGroup,
} from './butcherOffersPreview';

export const BUTCHERS_HOME_TTL_MS = 60_000;
export const BUTCHERS_HOME_SECTION_LIMIT = 12;

export type ButchersHomeSnapshot = {
  picks: ButcherProfile[];
  nearby: ButcherProfile[];
  banners: ButcherMarketBanner[];
  offers: ButcherOfferPreview[];
  fetchedAt: number;
};

export type ButcherSort = 'rating' | 'distance';

type SortedCacheEntry = {
  data: ButcherProfile[];
  raw: Record<string, unknown>[];
  fetchedAt: number;
};

let homeSnapshot: ButchersHomeSnapshot | null = null;
let homeLoadInflight: Promise<ButchersHomeSnapshot> | null = null;
const sortedCache = new Map<string, SortedCacheEntry>();
export type SortedButchersPage = {
  data: ButcherProfile[];
  raw: Record<string, unknown>[];
};

const sortedInflight = new Map<string, Promise<SortedButchersPage>>();
const sortedApplyGen = new Map<string, number>();
let offersFeedInflight: Promise<ButcherOffersGroup[]> | null = null;
let offersFeedApplyGen = 0;
const detailCache = new Map<string, ButcherDetailSnapshot>();
let storiesCache: { list: ButcherStory[]; at: number } | null = null;

function coordsKey(coords?: { lat: number; lng: number } | null): string {
  if (!coords) return '';
  return `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`;
}

export function butcherSortCacheKey(
  sort: ButcherSort,
  coords?: { lat: number; lng: number } | null,
): string {
  if (sort === 'distance' && coords) return `distance:${coordsKey(coords)}`;
  return sort;
}

/** Test-only reset. */
export function resetButchersDirectoryCache() {
  homeSnapshot = null;
  homeLoadInflight = null;
  sortedCache.clear();
  sortedInflight.clear();
  sortedApplyGen.clear();
  offersFeedInflight = null;
  offersFeedApplyGen = 0;
  detailCache.clear();
  storiesCache = null;
  resetButcherOffersFeedCache();
}

export function getButchersHomeSnapshot(): ButchersHomeSnapshot | null {
  return homeSnapshot;
}

export function isButchersHomeSnapshotFresh(now = Date.now()): boolean {
  return Boolean(homeSnapshot && now - homeSnapshot.fetchedAt < BUTCHERS_HOME_TTL_MS);
}

export function setButchersHomeSnapshot(
  partial: Partial<Omit<ButchersHomeSnapshot, 'fetchedAt'>> & { fetchedAt?: number },
): ButchersHomeSnapshot {
  homeSnapshot = {
    picks: partial.picks ?? homeSnapshot?.picks ?? [],
    nearby: partial.nearby ?? homeSnapshot?.nearby ?? [],
    banners: partial.banners ?? homeSnapshot?.banners ?? [],
    offers: partial.offers ?? homeSnapshot?.offers ?? [],
    fetchedAt: partial.fetchedAt ?? Date.now(),
  };
  return homeSnapshot;
}

export function getCachedSortedButchers(
  sort: ButcherSort,
  coords?: { lat: number; lng: number } | null,
): ButcherProfile[] | null {
  return sortedCache.get(butcherSortCacheKey(sort, coords))?.data ?? null;
}

export function getCachedSortedButcherRecords(
  sort: ButcherSort,
  coords?: { lat: number; lng: number } | null,
): Record<string, unknown>[] | null {
  return sortedCache.get(butcherSortCacheKey(sort, coords))?.raw ?? null;
}

export function isSortedButchersFresh(
  sort: ButcherSort,
  coords?: { lat: number; lng: number } | null,
  now = Date.now(),
): boolean {
  const entry = sortedCache.get(butcherSortCacheKey(sort, coords));
  return Boolean(entry && now - entry.fetchedAt < BUTCHERS_HOME_TTL_MS);
}

export type CachedButcherLookup = {
  profile: ButcherProfile;
  raw?: Record<string, unknown>;
};

export type ButcherDetailSnapshot = {
  profile: ButcherProfile;
  products: ButcherProduct[];
  offers: ButcherOffer[];
  reviews: ButcherReview[];
  reviewDistribution: Record<number, number>;
  fetchedAt: number;
};

const EMPTY_REVIEW_DISTRIBUTION: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
};

function findFreshRawRecord(id: string, now: number): Record<string, unknown> | undefined {
  for (const entry of sortedCache.values()) {
    if (now - entry.fetchedAt >= BUTCHERS_HOME_TTL_MS) continue;
    const raw = entry.raw.find((row) => String(row.id ?? '') === id);
    if (raw) return raw;
  }
  return undefined;
}

/** TTL-respecting lookup of a butcher already shown on Home / directory lists. */
export function findCachedButcher(id: string, now = Date.now()): CachedButcherLookup | null {
  if (!id) return null;

  if (homeSnapshot && now - homeSnapshot.fetchedAt < BUTCHERS_HOME_TTL_MS) {
    const profile =
      homeSnapshot.picks.find((b) => b.id === id) ??
      homeSnapshot.nearby.find((b) => b.id === id);
    if (profile) {
      return { profile, raw: findFreshRawRecord(id, now) };
    }
  }

  for (const entry of sortedCache.values()) {
    if (now - entry.fetchedAt >= BUTCHERS_HOME_TTL_MS) continue;
    const idx = entry.data.findIndex((b) => b.id === id);
    if (idx >= 0) {
      return { profile: entry.data[idx], raw: entry.raw[idx] };
    }
  }

  return null;
}

export async function fetchSortedButchersPage(
  sort: ButcherSort,
  options?: {
    lat?: number;
    lng?: number;
    token?: string | null;
    force?: boolean;
  },
): Promise<SortedButchersPage> {
  const coords =
    options?.lat != null && options?.lng != null
      ? { lat: options.lat, lng: options.lng }
      : null;
  const key = butcherSortCacheKey(sort, coords);
  if (!options?.force) {
    const cached = sortedCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < BUTCHERS_HOME_TTL_MS) {
      return { data: cached.data, raw: cached.raw };
    }
    const inflight = sortedInflight.get(key);
    if (inflight) return inflight;
  }

  const gen = (sortedApplyGen.get(key) ?? 0) + 1;
  sortedApplyGen.set(key, gen);

  const promise = (async () => {
    const headers: HeadersInit = options?.token
      ? { Authorization: `Bearer ${options.token}` }
      : {};
    const params = new URLSearchParams({ sort });
    if (sort === 'distance' && coords) {
      params.set('lat', String(coords.lat));
      params.set('lng', String(coords.lng));
    }
    const res = await fetch(`${API_BASE}/api/butchers?${params.toString()}`, { headers });
    if (!res.ok) throw new Error('butchers_fetch_failed');
    const json = await res.json().catch(() => ({}));
    if (!json.success || !Array.isArray(json.data?.butchers)) {
      throw new Error('butchers_fetch_failed');
    }
    const raw = (json.data.butchers as Record<string, unknown>[]).filter(
      (b) => (b.country || 'SA') !== 'EG',
    );
    const data = raw.map((b) => mapButcherFromApi(b));
    const page = { data, raw };
    if (sortedApplyGen.get(key) !== gen) {
      const previous = sortedCache.get(key);
      return previous ? { data: previous.data, raw: previous.raw } : page;
    }
    sortedCache.set(key, { data, raw, fetchedAt: Date.now() });
    return page;
  })().finally(() => {
    if (sortedInflight.get(key) === promise) sortedInflight.delete(key);
  });

  sortedInflight.set(key, promise);
  return promise;
}

export async function fetchSortedButchers(
  sort: ButcherSort,
  options?: {
    lat?: number;
    lng?: number;
    token?: string | null;
    force?: boolean;
  },
): Promise<ButcherProfile[]> {
  const page = await fetchSortedButchersPage(sort, options);
  return page.data;
}

export async function loadButchersHome(
  accessToken?: string | null,
  options?: { force?: boolean },
): Promise<ButchersHomeSnapshot> {
  if (!options?.force && isButchersHomeSnapshotFresh() && homeSnapshot) {
    return homeSnapshot;
  }
  if (!options?.force && homeLoadInflight) return homeLoadInflight;

  const promise = (async () => {
    const { data: rated, raw: ratingRecords } = await fetchSortedButchersPage('rating', {
      token: accessToken,
      force: options?.force,
    });
    const [banners, offers] = await Promise.all([
      fetchButcherMarketBanners(),
      fetchButcherOffersPreview(accessToken, BUTCHER_HOME_OFFERS_LIMIT, {
        records: ratingRecords,
      }).catch(() => homeSnapshot?.offers ?? []),
    ]);
    return setButchersHomeSnapshot({
      picks: rated.slice(0, BUTCHERS_HOME_SECTION_LIMIT),
      nearby: (homeSnapshot?.nearby.length
        ? homeSnapshot.nearby
        : rated
      ).slice(0, BUTCHERS_HOME_SECTION_LIMIT),
      banners,
      offers,
    });
  })().finally(() => {
    if (homeLoadInflight === promise) homeLoadInflight = null;
  });

  homeLoadInflight = promise;
  return promise;
}

export function getCachedButcherOffersFeed(): ButcherOffersGroup[] | null {
  const records = getCachedSortedButcherRecords('rating');
  if (!records) return getCachedResolvedOffersFeed();
  if (records.length === 0 || butcherRecordsHaveEmbeddedOffers(records)) {
    return butcherOffersFeedFromRecords(records);
  }
  return getCachedResolvedOffersFeed();
}

export async function loadButcherOffersFeed(
  accessToken?: string | null,
  options?: { force?: boolean },
): Promise<ButcherOffersGroup[]> {
  const gen = ++offersFeedApplyGen;
  if (!options?.force && isSortedButchersFresh('rating')) {
    const records = getCachedSortedButcherRecords('rating');
    if (records) {
      return resolveButcherOffersFeed(records, accessToken, options);
    }
  }
  if (!options?.force && offersFeedInflight) return offersFeedInflight;

  const promise = (async () => {
    await fetchSortedButchers('rating', {
      token: accessToken,
      force: options?.force,
    });
    const records = getCachedSortedButcherRecords('rating') ?? [];
    const feed = await resolveButcherOffersFeed(records, accessToken, options);
    if (gen !== offersFeedApplyGen) {
      return getCachedButcherOffersFeed() ?? feed;
    }
    return feed;
  })().finally(() => {
    if (offersFeedInflight === promise) offersFeedInflight = null;
  });

  offersFeedInflight = promise;
  return promise;
}

function mapOfferFromApi(o: Record<string, unknown>): ButcherOffer {
  return {
    id: String(o.id ?? ''),
    butcherId: String(o.butcherId ?? ''),
    title: String(o.titleAr || o.titleEn || ''),
    titleAr: String(o.titleAr ?? ''),
    description: String(o.descriptionEn ?? ''),
    descriptionAr: String(o.descriptionAr ?? ''),
    discountPercent: typeof o.discountPercent === 'number' ? o.discountPercent : undefined,
    originalPrice: typeof o.originalPrice === 'number' ? o.originalPrice : undefined,
    offerPrice: typeof o.offerPrice === 'number' ? o.offerPrice : undefined,
    image: typeof o.image === 'string' ? o.image : '',
    validUntil: String(o.validUntil ?? ''),
    country: (o.country as ButcherOffer['country']) || 'SA',
  };
}

function mapReviewFromApi(r: Record<string, unknown>, butcherId: string): ButcherReview {
  const reviewer = r.reviewer as
    | { displayName?: string; arabicName?: string; avatar?: string }
    | undefined;
  return {
    id: String(r.id ?? ''),
    butcherId: String(r.butcherId || butcherId),
    authorName: String(reviewer?.displayName || r.authorName || 'عميل سرح'),
    authorNameAr: String(
      reviewer?.arabicName || reviewer?.displayName || r.authorNameAr || 'عميل سرح',
    ),
    authorAvatar: (reviewer?.avatar || r.authorAvatar || undefined) as string | undefined,
    rating: Number(r.rating ?? 5),
    comment: String(r.comment || ''),
    commentAr: String(r.comment || ''),
    postedAt: String(r.createdAt ?? ''),
  };
}

function distributionFromReviews(list: { rating?: number }[]): Record<number, number> {
  const dist: Record<number, number> = { ...EMPTY_REVIEW_DISTRIBUTION };
  for (const row of list) {
    const rating = Math.round(Number(row.rating) || 0);
    if (rating >= 1 && rating <= 5) dist[rating] += 1;
  }
  return dist;
}

function hasUsableEmbeddedReviews(b: { reviews?: unknown; reviewCount?: unknown }): boolean {
  if (!Array.isArray(b.reviews)) return false;
  if (b.reviews.length > 0) return true;
  return Number(b.reviewCount ?? 0) === 0;
}

export function getCachedButcherDetail(id: string): ButcherDetailSnapshot | null {
  if (!id) return null;
  return detailCache.get(id) ?? null;
}

export function peekButcherDetailCachedAt(id: string): number | undefined {
  return detailCache.get(id)?.fetchedAt;
}

export function getCachedButcherStories(): ButcherStory[] | null {
  return storiesCache?.list ?? null;
}

export function peekButcherStoriesCachedAt(): number | undefined {
  return storiesCache?.at;
}

async function loadReviewsIfNeeded(
  id: string,
  headers: HeadersInit,
  embedded: { reviews?: unknown; reviewCount?: unknown },
): Promise<{ reviews: ButcherReview[]; reviewDistribution: Record<number, number> }> {
  if (hasUsableEmbeddedReviews(embedded) && Array.isArray(embedded.reviews)) {
    const reviews = (embedded.reviews as Record<string, unknown>[]).map((row) =>
      mapReviewFromApi(row, id),
    );
    return {
      reviews,
      reviewDistribution:
        reviews.length > 0 ? distributionFromReviews(reviews) : { ...EMPTY_REVIEW_DISTRIBUTION },
    };
  }

  try {
    const res = await fetch(`${API_BASE}/api/butchers/${id}/reviews`, { headers });
    if (!res.ok) {
      return { reviews: [], reviewDistribution: { ...EMPTY_REVIEW_DISTRIBUTION } };
    }
    const json = await res.json();
    if (!json.success) {
      return { reviews: [], reviewDistribution: { ...EMPTY_REVIEW_DISTRIBUTION } };
    }
    const payload = json.data;
    const list = Array.isArray(payload) ? payload : payload?.reviews;
    const reviews = Array.isArray(list)
      ? (list as Record<string, unknown>[]).map((row) => mapReviewFromApi(row, id))
      : [];
    return {
      reviews,
      reviewDistribution: payload?.distribution
        ? (payload.distribution as Record<number, number>)
        : reviews.length > 0
          ? distributionFromReviews(reviews)
          : { ...EMPTY_REVIEW_DISTRIBUTION },
    };
  } catch {
    return { reviews: [], reviewDistribution: { ...EMPTY_REVIEW_DISTRIBUTION } };
  }
}

async function loadButcherDetailNetwork(
  id: string,
  token?: string | null,
): Promise<ButcherDetailSnapshot | null> {
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}/api/butchers/${id}`, { headers });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.success || !json.data) return null;
  const b = json.data as Record<string, unknown>;
  if (b.id && String(b.id) !== String(id)) return null;

  const products = Array.isArray(b.products)
    ? (b.products as Record<string, unknown>[]).map((row) => mapButcherProductFromApi(row))
    : [];
  const offers = Array.isArray(b.offers)
    ? (b.offers as Record<string, unknown>[]).map((row) => mapOfferFromApi(row))
    : [];
  const reviewState = await loadReviewsIfNeeded(id, headers, b);

  const snapshot: ButcherDetailSnapshot = {
    profile: mapButcherFromApi(b),
    products,
    offers,
    reviews: reviewState.reviews,
    reviewDistribution: reviewState.reviewDistribution,
    fetchedAt: Date.now(),
  };
  detailCache.set(id, snapshot);
  return snapshot;
}

export function fetchButcherDetail(
  id: string,
  options?: { token?: string | null; force?: boolean },
): Promise<ButcherDetailSnapshot | null> {
  const butcherId = id?.trim();
  if (!butcherId) return Promise.resolve(null);
  const force = options?.force === true;
  const cached = detailCache.get(butcherId);
  if (cached && shouldReuseFreshResult(cached.fetchedAt, BUTCHERS_HOME_TTL_MS, force)) {
    return Promise.resolve(cached);
  }

  return dedupeInflight(`GET:/api/butchers/${butcherId}`, async () => {
    try {
      const snapshot = await loadButcherDetailNetwork(butcherId, options?.token);
      if (snapshot) return snapshot;
      return detailCache.get(butcherId) ?? null;
    } catch {
      return detailCache.get(butcherId) ?? null;
    }
  });
}

/** Stories are optional and must not block butcher details. */
export function fetchButcherStories(options?: { force?: boolean }): Promise<ButcherStory[]> {
  const force = options?.force === true;
  if (storiesCache && shouldReuseFreshResult(storiesCache.at, BUTCHERS_HOME_TTL_MS, force)) {
    return Promise.resolve(storiesCache.list);
  }

  return dedupeInflight('GET:/api/butchers/stories', async () => {
    try {
      const res = await fetch(`${API_BASE}/api/butchers/stories`);
      if (!res.ok) return storiesCache?.list ?? [];
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) return storiesCache?.list ?? [];
      storiesCache = { list: json.data as ButcherStory[], at: Date.now() };
      return storiesCache.list;
    } catch {
      return storiesCache?.list ?? [];
    }
  });
}
