import {
  fetchSortedButchersPage,
  getButchersHomeSnapshot,
  loadButchersHome,
  resetButchersDirectoryCache,
} from '../services/butcherDirectory';
import * as butcherOffersPreview from '../services/butcherOffersPreview';
import { fetchButcherOffersPreview } from '../services/butcherOffersPreview';

jest.mock('../services/api', () => ({
  API_BASE: 'https://example.test',
}));

jest.mock('../services/butcherMarketBanners', () => ({
  fetchButcherMarketBanners: jest.fn(async () => [
    { id: 'bn1', slot: 1, titleAr: 'عرض', subtitleAr: '', captionAr: '', imageUrl: '' },
  ]),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function butcherRow(
  id: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    nameAr: `ملحمة ${id}`,
    nameEn: id,
    country: 'SA',
    cityAr: 'الرياض',
    city: 'Riyadh',
    specialties: [],
    ...extra,
  };
}

function butcherUrls(): string[] {
  return (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
}

describe('P0-1 butcher home request reuse', () => {
  beforeEach(() => {
    resetButchersDirectoryCache();
    global.fetch = jest.fn();
  });

  it('loads home with one rating list GET and reuses those records for offers', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (String(url).includes('/api/butchers?sort=rating')) {
        return jsonResponse({
          success: true,
          data: {
            butchers: [
              butcherRow('1', {
                offers: [{ id: 'o1', titleAr: 'عرض 1', offerPrice: 10 }],
              }),
              butcherRow('2', { offers: [] }),
            ],
          },
        });
      }
      throw new Error(`unexpected ${url}`);
    });

    const snap = await loadButchersHome();
    const urls = butcherUrls();
    expect(urls.filter((url) => url.includes('/api/butchers?sort=rating'))).toHaveLength(1);
    expect(urls.some((url) => /\/api\/butchers\/\d+(?:\?|$)/.test(url))).toBe(false);
    expect(snap.picks.map((row) => row.id)).toEqual(['1', '2']);
    expect(snap.offers.map((row) => row.id)).toEqual(['o1']);
    expect(snap.banners).toHaveLength(1);
  });

  it('does not refetch sort=rating when preview receives the rated list', async () => {
    const page = {
      data: [],
      raw: [
        butcherRow('1', { offers: [{ id: 'o1', titleAr: 'عرض' }] }),
        butcherRow('2', { offers: [{ id: 'o2', titleAr: 'عرض 2' }] }),
      ],
    };
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const offers = await fetchButcherOffersPreview(null, 20, { records: page.raw });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(offers.map((row) => row.id)).toEqual(['o1', 'o2']);
  });

  it('returns an empty preview without fan-out when provided records have no offers', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      fetchButcherOffersPreview(null, 20, { records: [butcherRow('1'), butcherRow('2')] }),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps butcher picks when offers preview fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { butchers: [butcherRow('ok', { offers: [{ id: 'o1', titleAr: 'عرض' }] })] },
      }),
    );
    jest
      .spyOn(butcherOffersPreview, 'fetchButcherOffersPreview')
      .mockRejectedValueOnce(new Error('offers_failed'));
    const snap = await loadButchersHome();
    expect(snap.picks.map((row) => row.id)).toEqual(['ok']);
    expect(snap.offers).toEqual([]);
    jest.restoreAllMocks();
  });

  it('handles an empty rating list without extra requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { butchers: [] } }),
    );
    const snap = await loadButchersHome();
    expect(snap.picks).toEqual([]);
    expect(snap.offers).toEqual([]);
    expect(butcherUrls().filter((url) => url.includes('/api/butchers?sort=rating'))).toHaveLength(
      1,
    );
    expect(butcherUrls().some((url) => /\/api\/butchers\/[^?]+$/.test(url))).toBe(false);
  });

  it('returns the same rated records from fetchSortedButchersPage for home reuse', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          butchers: [butcherRow('1', { offers: [{ id: 'o1', titleAr: 'عرض' }] })],
        },
      }),
    );
    const page = await fetchSortedButchersPage('rating');
    expect(page.data[0]?.id).toBe('1');
    expect(page.raw[0]?.id).toBe('1');
    expect(Array.isArray(page.raw[0]?.offers)).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('skips the network on a fresh home snapshot and refetches once when forced', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        success: true,
        data: { butchers: [butcherRow('1', { offers: [{ id: 'o1', titleAr: 'عرض' }] })] },
      }),
    );
    await loadButchersHome();
    (global.fetch as jest.Mock).mockClear();
    const cached = await loadButchersHome();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(cached.picks[0]?.id).toBe('1');

    await loadButchersHome(undefined, { force: true });
    expect(
      butcherUrls().filter((url) => url.includes('/api/butchers?sort=rating')),
    ).toHaveLength(1);
    expect(getButchersHomeSnapshot()?.picks[0]?.id).toBe('1');
  });
});
