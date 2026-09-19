import { FEED_TIMEOUT_MS, fetchPublicFeed } from '../services/fetchPublicFeed';
import { fetchEditorialStories, resetEditorialStoriesCache } from '../services/editorialStories';
import { loadButcherCatalog, resetButcherCatalogCache } from '../hooks/useButcher';
import { resetRequestCoordination } from '../services/requestCoordination';

jest.mock('../services/api', () => ({
  API_BASE: 'https://sarh-new4.onrender.com',
}));

const fetchWithTimeout = jest.fn();
jest.mock('../services/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => fetchWithTimeout(...args),
}));

function jsonResponse(body: unknown, status = 200): Response {
  const text = JSON.stringify(body);
  const buffer = new TextEncoder().encode(text).buffer;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: { get: () => null },
    json: async () => body,
    text: async () => text,
    arrayBuffer: async () => buffer.slice(0),
  } as unknown as Response;
}

describe('home feed speed', () => {
  beforeEach(() => {
    fetchWithTimeout.mockReset();
    resetButcherCatalogCache();
    resetEditorialStoriesCache();
    resetRequestCoordination();
  });

  it('uses a 12s timeout for public feed GETs', async () => {
    expect(FEED_TIMEOUT_MS).toBe(12_000);
    fetchWithTimeout.mockResolvedValue(jsonResponse({ success: true }));
    await fetchPublicFeed('https://sarh-new4.onrender.com/api/posts', 'token');
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://sarh-new4.onrender.com/api/posts',
      expect.any(Object),
      12_000,
    );
  });

  it('fetches editorial stories with the feed timeout and no health probe', async () => {
    fetchWithTimeout.mockResolvedValue(
      jsonResponse({ data: { stories: [{ id: 's1', titleAr: 'خبر' }] } }),
    );
    const stories = await fetchEditorialStories();
    expect(stories).toHaveLength(1);
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://sarh-new4.onrender.com/api/editorial-stories',
      {},
      12_000,
    );
  });

  it('skips butcher stories when the home mini section does not need them', async () => {
    fetchWithTimeout.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/api/butchers')) {
        return jsonResponse({
          success: true,
          data: [
            {
              id: 'b1',
              nameAr: 'ملحمة',
              nameEn: 'Shop',
              city: 'Riyadh',
              cityAr: 'الرياض',
              country: 'SA',
            },
          ],
        });
      }
      throw new Error(`unexpected ${url}`);
    });

    const catalog = await loadButcherCatalog(false);
    expect(catalog.includeStories).toBe(false);
    expect(catalog.stories).toEqual([]);
    expect(catalog.butchers.length).toBeGreaterThan(0);
    const urls = fetchWithTimeout.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/butchers/stories'))).toBe(false);
  });
});
