import {
  FALLBACK_EXPLORE_SARH_BANNERS,
  mapRemoteExploreSarhBanner,
} from '../lib/exploreSarhBanners';
import {
  fetchExploreSarhBanners,
  resetExploreSarhBannersCache,
} from '../services/exploreSarhBanners';
import { resetRequestCoordination } from '../services/requestCoordination';

describe('exploreSarhBanners mapping', () => {
  it('keeps the local fallback trio in order', () => {
    expect(FALLBACK_EXPLORE_SARH_BANNERS.map((b) => b.href)).toEqual([
      '/butchers',
      '/feed-suppliers',
      '/ministry',
    ]);
  });

  it('maps valid remote rows and rejects bad href/image', () => {
    expect(
      mapRemoteExploreSarhBanner({
        id: '1',
        imageUrl: 'https://cdn.example/a.jpg',
        accessibilityLabel: 'ملاحم',
        href: '/butchers',
      }),
    ).toEqual({
      id: '1',
      accessibilityLabel: 'ملاحم',
      href: '/butchers',
      image: { uri: 'https://cdn.example/a.jpg' },
    });
    expect(
      mapRemoteExploreSarhBanner({
        id: '1',
        imageUrl: 'https://cdn.example/a.jpg',
        accessibilityLabel: 'ملاحم',
        href: 'https://evil.example',
      }),
    ).toBeNull();
    expect(
      mapRemoteExploreSarhBanner({
        id: '1',
        imageUrl: '',
        accessibilityLabel: 'ملاحم',
        href: '/butchers',
      }),
    ).toBeNull();
  });
});

describe('fetchExploreSarhBanners', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetExploreSarhBannersCache();
    resetRequestCoordination();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    resetExploreSarhBannersCache();
    resetRequestCoordination();
  });

  it('caches successful responses and dedupes in-flight requests', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            banners: [
              {
                id: 'r1',
                imageUrl: 'https://cdn.example/r.jpg',
                accessibilityLabel: 'ملاحم',
                href: '/butchers',
                sortOrder: 0,
              },
            ],
          },
        }),
      } as Response;
    });

    const [a, b] = await Promise.all([
      fetchExploreSarhBanners(),
      fetchExploreSarhBanners(),
    ]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
    expect(a[0].href).toBe('/butchers');

    await fetchExploreSarhBanners();
    expect(calls).toBe(1);
  });

  it('falls back to local banners when the API fails or returns empty', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network');
    }) as typeof fetch;
    const failed = await fetchExploreSarhBanners({ force: true });
    expect(failed.map((b) => b.href)).toEqual([
      '/butchers',
      '/feed-suppliers',
      '/ministry',
    ]);

    resetExploreSarhBannersCache();
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        json: async () => ({ success: true, data: { banners: [] } }),
      }) as Response,
    );
    const empty = await fetchExploreSarhBanners({ force: true });
    expect(empty.map((b) => b.href)).toEqual([
      '/butchers',
      '/feed-suppliers',
      '/ministry',
    ]);
  });
});
