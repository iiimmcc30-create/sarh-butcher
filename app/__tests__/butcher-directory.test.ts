import {
  BUTCHERS_HOME_TTL_MS,
  fetchSortedButchers,
  findCachedButcher,
  getButchersHomeSnapshot,
  isButchersHomeSnapshotFresh,
  loadButchersHome,
  resetButchersDirectoryCache,
} from '../services/butcherDirectory';
import { fetchButcherOffersPreview } from '../services/butcherOffersPreview';

jest.mock('../services/api', () => ({
  API_BASE: 'https://example.test',
}));

jest.mock('../services/butcherMarketBanners', () => ({
  fetchButcherMarketBanners: jest.fn(async () => [{ id: 'b1', slot: 1, titleAr: 'عرض', subtitleAr: '', captionAr: '', imageUrl: '' }]),
}));

jest.mock('../services/butcherOffersPreview', () => ({
  BUTCHER_HOME_OFFERS_LIMIT: 20,
  fetchButcherOffersPreview: jest.fn(async () => []),
  butcherRecordsHaveEmbeddedOffers: jest.fn(() => false),
  butcherOffersFeedFromRecords: jest.fn(() => []),
  resolveButcherOffersFeed: jest.fn(async () => []),
  getCachedResolvedOffersFeed: jest.fn(() => null),
  resetButcherOffersFeedCache: jest.fn(),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function butcherPayload(id: string) {
  return {
    id,
    nameAr: `ملحمة ${id}`,
    nameEn: id,
    country: 'SA',
    cityAr: 'الرياض',
    city: 'Riyadh',
    specialties: [],
  };
}

describe('butcher directory P0 cache and failures', () => {
  beforeEach(() => {
    resetButchersDirectoryCache();
    global.fetch = jest.fn();
  });

  it('throws on HTTP failure instead of returning an empty list', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ success: false }, 429));
    await expect(fetchSortedButchers('rating')).rejects.toThrow('butchers_fetch_failed');
    expect(getButchersHomeSnapshot()).toBeNull();
  });

  it('treats 200 + [] as a real empty directory', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers: [] } }),
    );
    await expect(fetchSortedButchers('rating')).resolves.toEqual([]);
  });

  it('keeps a successful payload in cache after the caller unmounts', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers: [butcherPayload('1')] } }),
    );
    const pending = loadButchersHome();
    await pending;
    expect(isButchersHomeSnapshotFresh()).toBe(true);
    expect(getButchersHomeSnapshot()?.picks.map((b) => b.id)).toEqual(['1']);

    (global.fetch as jest.Mock).mockClear();
    const again = await loadButchersHome();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(again.picks.map((b) => b.id)).toEqual(['1']);
  });

  it('dedupes overlapping home loads so a remount does not start a second storm', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const first = loadButchersHome();
    const second = loadButchersHome();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    resolveFetch?.(
      jsonResponse({ success: true, data: { butchers: [butcherPayload('2')] } }),
    );
    const [a, b] = await Promise.all([first, second]);
    expect(a.picks.map((row) => row.id)).toEqual(['2']);
    expect(b.picks.map((row) => row.id)).toEqual(['2']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a cached home snapshot when a later fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers: [butcherPayload('ok')] } }),
    );
    await loadButchersHome();
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ success: false }, 500));
    await expect(loadButchersHome(undefined, { force: true })).rejects.toThrow(
      'butchers_fetch_failed',
    );
    expect(getButchersHomeSnapshot()?.picks.map((b) => b.id)).toEqual(['ok']);
  });

  it('passes rating list records into offers preview instead of refetching or fanning out details', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers: [butcherPayload('1')] } }),
    );
    await loadButchersHome();
    expect(fetchButcherOffersPreview).toHaveBeenCalledWith(
      undefined,
      20,
      expect.objectContaining({
        records: [expect.objectContaining({ id: '1', country: 'SA' })],
      }),
    );
    const urls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes('/api/butchers?sort=rating'))).toHaveLength(1);
    expect(urls.some((url) => /\/api\/butchers\/1(?:\?|$)/.test(url))).toBe(false);
  });

  it('finds a butcher in a fresh home snapshot or sorted cache and ignores TTL expiry', async () => {
    expect(BUTCHERS_HOME_TTL_MS).toBe(60_000);
    const butchers = Array.from({ length: 13 }, (_, i) =>
      i === 0
        ? { ...butcherPayload('1'), offers: [{ id: 'o1', titleAr: 'عرض', butcherId: '1' }] }
        : butcherPayload(String(i + 1)),
    );
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers } }),
    );
    await loadButchersHome();
    const fromHome = findCachedButcher('1');
    expect(fromHome?.profile.id).toBe('1');
    expect(fromHome?.profile.nameAr).toBe('ملحمة 1');
    expect(Array.isArray(fromHome?.raw?.offers)).toBe(true);
    expect(getButchersHomeSnapshot()?.picks.some((row) => row.id === '13')).toBe(false);

    const fromSorted = findCachedButcher('13');
    expect(fromSorted?.profile.id).toBe('13');

    const expiredAt = Date.now() + BUTCHERS_HOME_TTL_MS + 1;
    expect(findCachedButcher('1', expiredAt)).toBeNull();
    expect(findCachedButcher('13', expiredAt)).toBeNull();
  });

  it('seeds from a fresh sorted list even when the home snapshot is absent', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers: [butcherPayload('solo')] } }),
    );
    await fetchSortedButchers('rating');
    expect(getButchersHomeSnapshot()).toBeNull();
    expect(findCachedButcher('solo')?.profile.id).toBe('solo');
    expect(findCachedButcher('missing')).toBeNull();
  });
});
