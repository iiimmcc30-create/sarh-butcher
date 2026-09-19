import { readFileSync } from 'fs';
import path from 'path';
import {
  BUTCHERS_HOME_TTL_MS,
  getCachedButcherOffersFeed,
  loadButcherOffersFeed,
  resetButchersDirectoryCache,
} from '../services/butcherDirectory';
import { BUTCHER_OFFERS_TTL_MS } from '../services/butcherOffersPreview';

jest.mock('../services/api', () => ({
  API_BASE: 'https://example.test',
}));

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function butcherWithOffer(id: string, extra?: Record<string, unknown>) {
  return {
    id,
    nameAr: `ملحمة ${id}`,
    nameEn: id,
    country: 'SA',
    cityAr: 'الرياض',
    rating: 4.5,
    reviewCount: 3,
    subscriptionActive: true,
    offers: [
      {
        id: `${id}-o1`,
        titleAr: `عرض ${id}`,
        offerPrice: 40,
        originalPrice: 50,
        discountPercent: 20,
        validUntil: '2026-12-01',
      },
    ],
    ...extra,
  };
}

describe('P1-1 butcher offers feed TTL and focus dedupe', () => {
  beforeEach(() => {
    resetButchersDirectoryCache();
    global.fetch = jest.fn();
  });

  it('uses a 60s TTL and one rating list GET on first load when offers are embedded', async () => {
    expect(BUTCHER_OFFERS_TTL_MS).toBe(60_000);
    expect(BUTCHERS_HOME_TTL_MS).toBe(60_000);
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers: [butcherWithOffer('1')] } }),
    );
    const feed = await loadButcherOffersFeed();
    expect(feed).toHaveLength(1);
    expect(feed[0]?.butcherId).toBe('1');
    expect(feed[0]?.offers[0]?.titleAr).toBe('عرض 1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      '/api/butchers?sort=rating',
    );
  });

  it('reuses the fresh directory cache on a later focus with zero requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers: [butcherWithOffer('1')] } }),
    );
    await loadButcherOffersFeed();
    (global.fetch as jest.Mock).mockClear();
    const again = await loadButcherOffersFeed();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(again.map((row) => row.butcherId)).toEqual(['1']);
    expect(getCachedButcherOffersFeed()?.map((row) => row.butcherId)).toEqual(['1']);
  });

  it('shares one inflight rating request across overlapping loads', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const first = loadButcherOffersFeed();
    const second = loadButcherOffersFeed();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    resolveFetch?.(
      jsonResponse({ success: true, data: { butchers: [butcherWithOffer('2')] } }),
    );
    const [a, b] = await Promise.all([first, second]);
    expect(a.map((row) => row.butcherId)).toEqual(['2']);
    expect(b.map((row) => row.butcherId)).toEqual(['2']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes once after TTL expires', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1_700_000_000_000;
    nowSpy.mockImplementation(() => now);
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ success: true, data: { butchers: [butcherWithOffer('fresh')] } }),
    );
    await loadButcherOffersFeed();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    now += BUTCHERS_HOME_TTL_MS - 1;
    await loadButcherOffersFeed();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    now += 2;
    await loadButcherOffersFeed();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('keeps the previous feed when a refresh fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers: [butcherWithOffer('ok')] } }),
    );
    await loadButcherOffersFeed();
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ success: false }, 500));
    await expect(loadButcherOffersFeed(undefined, { force: true })).rejects.toThrow(
      'butchers_fetch_failed',
    );
    expect(getCachedButcherOffersFeed()?.map((row) => row.butcherId)).toEqual(['ok']);
  });

  it('treats HTTP 200 with an empty butcher list as a real empty feed', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers: [] } }),
    );
    await expect(loadButcherOffersFeed()).resolves.toEqual([]);
    expect(getCachedButcherOffersFeed()).toEqual([]);
  });

  it('does not let a slower stale rating response overwrite a newer force refresh', async () => {
    let resolveFirst: ((value: Response) => void) | undefined;
    let resolveSecond: ((value: Response) => void) | undefined;
    (global.fetch as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const stale = loadButcherOffersFeed();
    const newer = loadButcherOffersFeed(undefined, { force: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    resolveSecond?.(
      jsonResponse({ success: true, data: { butchers: [butcherWithOffer('new')] } }),
    );
    await expect(newer).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ butcherId: 'new' })]),
    );

    resolveFirst?.(
      jsonResponse({ success: true, data: { butchers: [butcherWithOffer('old')] } }),
    );
    await stale;
    expect(getCachedButcherOffersFeed()?.map((row) => row.butcherId)).toEqual(['new']);
  });

  it('fetches butcher details only when list records do not embed offers, then reuses that cache', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (String(url).includes('/api/butchers?sort=rating')) {
        return jsonResponse({
          success: true,
          data: { butchers: [{ id: 'b1', nameAr: 'ملحمة', country: 'SA' }] },
        });
      }
      return jsonResponse({
        success: true,
        data: {
          id: 'b1',
          nameAr: 'ملحمة',
          offers: [{ id: 'd1', titleAr: 'من التفاصيل', offerPrice: 9 }],
        },
      });
    });
    const first = await loadButcherOffersFeed();
    expect(first[0]?.offers[0]?.id).toBe('d1');
    const urls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes('/api/butchers?sort=rating'))).toHaveLength(1);
    expect(urls.filter((url) => url.includes('/api/butchers/b1'))).toHaveLength(1);

    (global.fetch as jest.Mock).mockClear();
    const again = await loadButcherOffersFeed();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(again[0]?.offers[0]?.id).toBe('d1');
  });

  it('hydrates the offers screen from directory cache and drops stale focus applies', () => {
    const store = readFileSync(path.join(__dirname, '../app/butchers/offers.tsx'), 'utf8');
    expect(store).toContain('getCachedButcherOffersFeed');
    expect(store).toContain('loadButcherOffersFeed');
    expect(store).toContain('loadGenRef');
    expect(store).toContain('if (gen !== loadGenRef.current) return');
    expect(store).toContain('loading && data.length === 0');
    expect(store).toContain('force: true');
    expect(store).not.toContain('MAX_BUTCHERS');
    expect(store).not.toContain('/api/butchers/${b.id}');
  });
});
