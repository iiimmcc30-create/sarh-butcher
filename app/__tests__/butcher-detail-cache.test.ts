import { readFileSync } from 'fs';
import path from 'path';
import {
  BUTCHERS_HOME_TTL_MS,
  fetchButcherDetail,
  fetchButcherStories,
  getCachedButcherDetail,
  loadButchersHome,
  resetButchersDirectoryCache,
} from '@/services/butcherDirectory';
import { resetRequestCoordination } from '@/services/requestCoordination';

const root = path.join(__dirname, '..');

function src(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8');
}

jest.mock('@/services/api', () => ({
  API_BASE: 'https://example.test',
}));

jest.mock('@/services/butcherMarketBanners', () => ({
  fetchButcherMarketBanners: jest.fn(async () => []),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function detailPayload(
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
    products: [
      {
        id: `p-${id}`,
        butcherId: id,
        nameAr: 'لحم',
        category: 'lamb',
        inStock: true,
      },
    ],
    offers: [{ id: `o-${id}`, butcherId: id, titleAr: 'عرض' }],
    reviews: [
      {
        id: `r-${id}`,
        butcherId: id,
        rating: 5,
        comment: 'ممتاز',
        createdAt: '2026-09-16T00:00:00.000Z',
        reviewer: { displayName: 'عميل', arabicName: 'عميل' },
      },
    ],
    reviewCount: 1,
    ...extra,
  };
}

function urls(): string[] {
  return (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
}

function count(substring: string) {
  return urls().filter((url) => url.includes(substring)).length;
}

describe('P1-06 butcher detail + stories cache', () => {
  let now = 1_000_000;

  beforeEach(() => {
    resetButchersDirectoryCache();
    resetRequestCoordination();
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    resetButchersDirectoryCache();
    resetRequestCoordination();
    jest.restoreAllMocks();
  });

  it('keeps directory seed, detail TTL, force refresh, and freezeOnBlur', () => {
    const store = src('app/butchers/[id].tsx');
    const directory = src('services/butcherDirectory.ts');
    expect(store).toContain('fetchButcherDetail');
    expect(store).toContain('fetchButcherStories');
    expect(store).toContain('getCachedButcherDetail');
    expect(store).toContain('force: true');
    expect(store).toContain('RefreshControl');
    expect(store).toContain('useFocusEffect');
    expect(directory).toContain('dedupeInflight(`GET:/api/butchers/${butcherId}`');
    expect(directory).toContain("dedupeInflight('GET:/api/butchers/stories'");
    expect(directory).toContain('shouldReuseFreshResult');
    expect(src('app/_layout.tsx')).toContain('enableFreeze(true)');
    expect(src('app/_layout.tsx')).toContain('freezeOnBlur: true');
  });

  it('first detail load GETs /api/butchers/:id even when the directory already has the card', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes('/api/butchers?sort=rating')) {
        return jsonResponse({
          success: true,
          data: {
            butchers: [
              {
                id: 'b1',
                nameAr: 'ملحمة b1',
                country: 'SA',
                offers: [{ id: 'o-home', titleAr: 'عرض قائمة' }],
              },
            ],
          },
        });
      }
      if (href === 'https://example.test/api/butchers/b1') {
        return jsonResponse({ success: true, data: detailPayload('b1') });
      }
      throw new Error(`unexpected ${href}`);
    });

    await loadButchersHome();
    const snapshot = await fetchButcherDetail('b1');
    expect(snapshot?.profile.id).toBe('b1');
    expect(snapshot?.products.map((row) => row.id)).toEqual(['p-b1']);
    expect(count('/api/butchers?sort=rating')).toBe(1);
    expect(count('/api/butchers/b1')).toBe(1);
    expect(count('/reviews')).toBe(0);
  });

  it('return within TTL issues 0 detail GET and keeps products', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ success: true, data: detailPayload('b1') }),
    );
    await fetchButcherDetail('b1');
    (global.fetch as jest.Mock).mockClear();
    now += BUTCHERS_HOME_TTL_MS - 1;
    const again = await fetchButcherDetail('b1');
    expect(again?.products[0]?.id).toBe('p-b1');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('after TTL revalidates once without dropping the previous snapshot', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ success: true, data: detailPayload('b1', { nameAr: 'قديمة' }) }),
    );
    await fetchButcherDetail('b1');
    expect(getCachedButcherDetail('b1')?.profile.nameAr).toBe('قديمة');
    (global.fetch as jest.Mock).mockClear();

    now += BUTCHERS_HOME_TTL_MS + 1;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (global.fetch as jest.Mock).mockImplementation(async () => {
      await gate;
      return jsonResponse({ success: true, data: detailPayload('b1', { nameAr: 'جديدة' }) });
    });
    const pending = fetchButcherDetail('b1');
    expect(getCachedButcherDetail('b1')?.profile.nameAr).toBe('قديمة');
    release();
    const next = await pending;
    expect(next?.profile.nameAr).toBe('جديدة');
    expect(count('/api/butchers/b1')).toBe(1);
  });

  it('force refresh bypasses TTL', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ success: true, data: detailPayload('b1') }),
    );
    await fetchButcherDetail('b1');
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        success: true,
        data: detailPayload('b1', {
          products: [{ id: 'p-new', butcherId: 'b1', nameAr: 'جديد', category: 'beef' }],
        }),
      }),
    );
    const refreshed = await fetchButcherDetail('b1', { force: true });
    expect(refreshed?.products[0]?.id).toBe('p-new');
    expect(count('/api/butchers/b1')).toBe(1);
  });

  it('concurrent same-butcher requests share one GET', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (global.fetch as jest.Mock).mockImplementation(async () => {
      await gate;
      return jsonResponse({ success: true, data: detailPayload('b1') });
    });
    const first = fetchButcherDetail('b1');
    const second = fetchButcherDetail('b1', { force: true });
    expect(first).toBe(second);
    release();
    await Promise.all([first, second]);
    expect(count('/api/butchers/b1')).toBe(1);
  });

  it('does not share detail cache between butcher A and butcher B', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      const id = String(url).split('/').pop() as string;
      return jsonResponse({ success: true, data: detailPayload(id) });
    });
    const a = await fetchButcherDetail('butcher-a');
    const b = await fetchButcherDetail('butcher-b');
    expect(a?.profile.id).toBe('butcher-a');
    expect(b?.profile.id).toBe('butcher-b');
    expect(getCachedButcherDetail('butcher-a')?.products[0]?.id).toBe('p-butcher-a');
    expect(getCachedButcherDetail('butcher-b')?.products[0]?.id).toBe('p-butcher-b');
  });

  it('fetches reviews when the detail payload omitted them', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      const href = String(url);
      if (href === 'https://example.test/api/butchers/b1') {
        return jsonResponse({
          success: true,
          data: detailPayload('b1', { reviews: undefined, reviewCount: 3 }),
        });
      }
      if (href === 'https://example.test/api/butchers/b1/reviews') {
        return jsonResponse({
          success: true,
          data: {
            reviews: [{ id: 'r-extra', rating: 4, comment: 'جيد', createdAt: 't' }],
            distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
          },
        });
      }
      throw new Error(`unexpected ${href}`);
    });
    const snapshot = await fetchButcherDetail('b1');
    expect(snapshot?.reviews.map((row) => row.id)).toEqual(['r-extra']);
    expect(count('/api/butchers/b1/reviews')).toBe(1);
  });

  it('loads stories on a cold fetch and reuses them within TTL', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        success: true,
        data: [{ id: 's1', butcherId: 'b1' }],
      }),
    );
    const first = await fetchButcherStories();
    expect(first).toEqual([{ id: 's1', butcherId: 'b1' }]);
    expect(count('/api/butchers/stories')).toBe(1);
    (global.fetch as jest.Mock).mockClear();
    now += BUTCHERS_HOME_TTL_MS - 1;
    await fetchButcherStories();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the current detail when a background revalidate fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ success: true, data: detailPayload('b1', { nameAr: 'باقية' }) }),
    );
    await fetchButcherDetail('b1');
    now += BUTCHERS_HOME_TTL_MS + 1;
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ success: false }, 500));
    const afterError = await fetchButcherDetail('b1');
    expect(afterError?.profile.nameAr).toBe('باقية');
    expect(getCachedButcherDetail('b1')?.products[0]?.id).toBe('p-b1');
  });
});
