import { API_BASE } from '@/services/api';
import { resolveMediaUrl } from '@/services/media';

export const BUTCHER_HOME_OFFERS_LIMIT = 20;
const MAX_BUTCHERS = 12;

export type ButcherOfferPreview = {
  id: string;
  butcherId: string;
  butcherNameAr?: string;
  butcherLogo?: string;
  titleAr: string;
  image?: string;
  originalPrice?: number;
  offerPrice?: number;
  discountPercent?: number;
};

export type ButcherOfferPreviewOptions = {
  /** Already-fetched butcher list records — skips GET /api/butchers?sort=rating. */
  records?: Record<string, unknown>[];
};

function mapOffers(
  raw: unknown,
  butcherId: string,
  butcherNameAr?: string,
  butcherLogo?: string,
): ButcherOfferPreview[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o: Record<string, unknown>) => ({
    id: String(o.id),
    butcherId,
    butcherNameAr,
    butcherLogo: resolveMediaUrl(butcherLogo) ?? butcherLogo,
    titleAr: String(o.titleAr || o.titleEn || 'عرض'),
    image: resolveMediaUrl(o.image as string | undefined) ?? undefined,
    originalPrice: typeof o.originalPrice === 'number' ? o.originalPrice : undefined,
    offerPrice: typeof o.offerPrice === 'number' ? o.offerPrice : undefined,
    discountPercent: typeof o.discountPercent === 'number' ? o.discountPercent : undefined,
  }));
}

function previewCandidates(
  list: Record<string, unknown>[],
): Record<string, unknown>[] {
  return list
    .filter((b) => (b.country || 'SA') !== 'EG')
    .slice(0, MAX_BUTCHERS);
}

export function butcherRecordsHaveEmbeddedOffers(
  records: Record<string, unknown>[],
): boolean {
  return records.some((b) => Array.isArray(b.offers));
}

export function offersPreviewFromRecords(
  records: Record<string, unknown>[],
  limit = BUTCHER_HOME_OFFERS_LIMIT,
): ButcherOfferPreview[] {
  const collected: ButcherOfferPreview[] = [];
  for (const b of previewCandidates(records)) {
    const id = String(b.id ?? '');
    if (!id) continue;
    const nameAr = String(b.nameAr || b.name || '');
    const logo =
      resolveMediaUrl((b.logo || b.cover) as string | undefined) ??
      (typeof b.logo === 'string' ? b.logo : undefined) ??
      (typeof b.cover === 'string' ? b.cover : undefined);
    for (const offer of mapOffers(b.offers, id, nameAr, logo)) {
      collected.push(offer);
      if (collected.length >= limit) return collected;
    }
  }
  return collected;
}

async function offersPreviewFromDetails(
  records: Record<string, unknown>[],
  accessToken?: string | null,
  limit = BUTCHER_HOME_OFFERS_LIMIT,
): Promise<ButcherOfferPreview[]> {
  const headers: HeadersInit = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};
  const candidates = previewCandidates(records);
  const collected: ButcherOfferPreview[] = [];
  for (const batchStart of [0, 4, 8]) {
    if (collected.length >= limit) break;
    const batch = candidates.slice(batchStart, batchStart + 4);
    if (!batch.length) break;
    const details = await Promise.all(
      batch.map(async (b) => {
        try {
          const res = await fetch(`${API_BASE}/api/butchers/${b.id}`, { headers });
          if (!res.ok) return [] as ButcherOfferPreview[];
          const json = await res.json();
          const d = json?.data;
          if (!d?.id) return [];
          const nameAr = String(d.nameAr || d.name || b.nameAr || b.name || '');
          const logo =
            resolveMediaUrl((d.logo || d.cover || b.logo || b.cover) as string | undefined) ??
            undefined;
          return mapOffers(d.offers, String(d.id), nameAr, logo);
        } catch {
          return [] as ButcherOfferPreview[];
        }
      }),
    );
    for (const group of details) {
      for (const offer of group) {
        collected.push(offer);
        if (collected.length >= limit) return collected;
      }
    }
  }
  return collected;
}

async function fetchRatingListRecords(
  accessToken?: string | null,
): Promise<Record<string, unknown>[]> {
  const headers: HeadersInit = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};
  try {
    const listRes = await fetch(`${API_BASE}/api/butchers?sort=rating`, { headers });
    const listJson = (await listRes.json().catch(() => ({}))) as Record<string, unknown>;
    const rawList = (listJson.data as { butchers?: unknown } | undefined)?.butchers;
    return Array.isArray(rawList) ? (rawList as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

/** Preview rail for butchers home — prefers already-loaded list records. */
export async function fetchButcherOffersPreview(
  accessToken?: string | null,
  limit = BUTCHER_HOME_OFFERS_LIMIT,
  options?: ButcherOfferPreviewOptions,
): Promise<ButcherOfferPreview[]> {
  const provided = options?.records;
  const records = provided ?? (await fetchRatingListRecords(accessToken));
  if (records.length === 0) return [];
  // Home already loaded the rating list (backend embeds offers). Reusing
  // those records avoids a second ?sort=rating GET and the 12-way detail fan-out.
  if (provided || butcherRecordsHaveEmbeddedOffers(records)) {
    return offersPreviewFromRecords(records, limit);
  }
  return offersPreviewFromDetails(records, accessToken, limit);
}

export const BUTCHER_OFFERS_TTL_MS = 60_000;
export const BUTCHER_OFFERS_PAGE_LIMIT = 24;

export type ButcherOfferView = {
  id: string;
  titleAr: string;
  image?: string;
  originalPrice?: number;
  offerPrice?: number;
  discountPercent?: number;
  validUntil?: string;
};

export type ButcherOffersGroup = {
  butcherId: string;
  nameAr: string;
  logo?: string;
  cover?: string;
  cityAr?: string;
  rating: number;
  reviewCount: number;
  subscriptionActive: boolean;
  offers: ButcherOfferView[];
};

function mapOfferViews(raw: unknown): ButcherOfferView[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o: Record<string, unknown>) => ({
    id: String(o.id),
    titleAr: String(o.titleAr || o.titleEn || 'عرض'),
    image: resolveMediaUrl(o.image as string | undefined) ?? undefined,
    originalPrice: o.originalPrice != null ? Number(o.originalPrice) : undefined,
    offerPrice: o.offerPrice != null ? Number(o.offerPrice) : undefined,
    discountPercent: o.discountPercent != null ? Number(o.discountPercent) : undefined,
    validUntil: typeof o.validUntil === 'string' ? o.validUntil : undefined,
  }));
}

function mapOffersGroup(
  b: Record<string, unknown>,
  offersRaw: unknown,
): ButcherOffersGroup | null {
  const offers = mapOfferViews(offersRaw);
  if (offers.length === 0) return null;
  const id = String(b.id ?? '');
  if (!id) return null;
  return {
    butcherId: id,
    nameAr: String(b.nameAr || b.nameEn || b.name || 'ملحمة'),
    logo: resolveMediaUrl(b.logo as string | undefined) ?? undefined,
    cover: resolveMediaUrl(b.cover as string | undefined) ?? undefined,
    cityAr: String(b.cityAr || ''),
    rating: Number(b.rating ?? 5),
    reviewCount: Number(b.reviewCount ?? 0),
    subscriptionActive: Boolean(b.subscriptionActive),
    offers,
  };
}

function pageCandidates(list: Record<string, unknown>[]): Record<string, unknown>[] {
  return list
    .filter((b) => (b.country || 'SA') !== 'EG')
    .slice(0, BUTCHER_OFFERS_PAGE_LIMIT);
}

export function butcherOffersFeedFromRecords(
  records: Record<string, unknown>[],
): ButcherOffersGroup[] {
  const groups: ButcherOffersGroup[] = [];
  for (const b of pageCandidates(records)) {
    const group = mapOffersGroup(b, b.offers);
    if (group) groups.push(group);
  }
  return groups;
}

type DetailsFeedCache = {
  key: string;
  data: ButcherOffersGroup[];
  fetchedAt: number;
};

let detailsFeedCache: DetailsFeedCache | null = null;
let detailsFeedInflight: { key: string; promise: Promise<ButcherOffersGroup[]> } | null = null;
let detailsFeedApplyGen = 0;

function detailsFeedKey(records: Record<string, unknown>[]): string {
  return pageCandidates(records)
    .map((b) => String(b.id ?? ''))
    .join(',');
}

/** Test-only reset for the offers-page details fallback cache. */
export function resetButcherOffersFeedCache() {
  detailsFeedCache = null;
  detailsFeedInflight = null;
  detailsFeedApplyGen = 0;
}

export function getCachedResolvedOffersFeed(): ButcherOffersGroup[] | null {
  return detailsFeedCache?.data ?? null;
}

async function fetchOffersFeedFromDetails(
  records: Record<string, unknown>[],
  accessToken?: string | null,
  options?: { force?: boolean },
): Promise<ButcherOffersGroup[]> {
  const key = detailsFeedKey(records);
  const now = Date.now();
  if (!options?.force && detailsFeedCache && detailsFeedCache.key === key) {
    if (now - detailsFeedCache.fetchedAt < BUTCHER_OFFERS_TTL_MS) {
      return detailsFeedCache.data;
    }
  }
  if (!options?.force && detailsFeedInflight && detailsFeedInflight.key === key) {
    return detailsFeedInflight.promise;
  }

  const gen = ++detailsFeedApplyGen;
  const headers: HeadersInit = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};
  const candidates = pageCandidates(records);

  const promise = (async () => {
    const results = await Promise.all(
      candidates.map(async (b) => {
        try {
          const res = await fetch(`${API_BASE}/api/butchers/${b.id}`, { headers });
          if (!res.ok) return { ok: false as const, group: null };
          const json = await res.json();
          const d = json?.data as Record<string, unknown> | undefined;
          if (!d) return { ok: false as const, group: null };
          return { ok: true as const, group: mapOffersGroup(d, d.offers) };
        } catch {
          return { ok: false as const, group: null };
        }
      }),
    );
    if (candidates.length > 0 && results.every((row) => !row.ok)) {
      throw new Error('butcher_offers_fetch_failed');
    }
    const data = results
      .map((row) => row.group)
      .filter((group): group is ButcherOffersGroup => group != null);
    if (gen !== detailsFeedApplyGen) {
      return detailsFeedCache?.key === key ? detailsFeedCache.data : data;
    }
    detailsFeedCache = { key, data, fetchedAt: Date.now() };
    return data;
  })().finally(() => {
    if (detailsFeedInflight?.promise === promise) detailsFeedInflight = null;
  });

  detailsFeedInflight = { key, promise };
  return promise;
}

export async function resolveButcherOffersFeed(
  records: Record<string, unknown>[],
  accessToken?: string | null,
  options?: { force?: boolean },
): Promise<ButcherOffersGroup[]> {
  if (records.length === 0) return [];
  if (butcherRecordsHaveEmbeddedOffers(records)) {
    return butcherOffersFeedFromRecords(records);
  }
  return fetchOffersFeedFromDetails(records, accessToken, options);
}
