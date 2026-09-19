import { readFileSync } from 'fs';
import path from 'path';
import { hasButcherRating } from '@/lib/butcherStoreMeta';
import {
  BUTCHER_HOME_OFFERS_LIMIT,
  fetchButcherOffersPreview,
} from '@/services/butcherOffersPreview';

const root = path.join(__dirname, '..');

function src(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('malahm home redesign', () => {
  it('hides rating overlay when there are no reviews', () => {
    expect(hasButcherRating({ rating: 5, reviewCount: 0 })).toBe(false);
    expect(hasButcherRating({ rating: 4.8, reviewCount: 12 })).toBe(true);
  });

  it('keeps home offers preview at 20 and omits the section when empty', () => {
    const home = src('app/butchers/index.tsx');
    expect(src('services/butcherDirectory.ts')).toContain('BUTCHER_HOME_OFFERS_LIMIT');
    expect(home).toContain('filteredOffers.length > 0');
    expect(home).toContain('title="العروض"');
    expect(home).toContain("'/butchers/offers'");
    expect(home).not.toContain('لا توجد عروض');
    expect(BUTCHER_HOME_OFFERS_LIMIT).toBe(20);
  });

  it('keeps banner carousel and makes the slide easier to read', () => {
    const slider = src('components/butchers/ButcherMarketBannerSlider.tsx');
    expect(slider).toContain('pagingEnabled');
    expect(slider).toContain('useWindowDimensions');
    expect(slider).toContain('banner.titleAr');
    expect(slider).toContain('banner.imageUrl');
    expect(slider).not.toContain('cloudinaryFitUrl');
  });

  it('puts the butcher avatar on offer photos and store meta on pick cards', () => {
    const offer = src('components/butchers/ButcherHomeOfferCard.tsx');
    const pick = src('components/butchers/ButcherPickCard.tsx');
    expect(offer).toContain('SarhAvatar');
    expect(offer).toContain('offer.butcherLogo');
    expect(offer).toContain("position: 'absolute'");
    expect(pick).toContain('butcherMinOrderLabel');
    expect(pick).toContain('cityAr');
    expect(pick).not.toContain('butcherSoftCardStyle');
  });

  it('uses a meat-wash header with search pill, cart, and a left exit arrow', () => {
    const bar = src('components/butchers/ButchersAppBar.tsx');
    const home = src('app/butchers/index.tsx');
    expect(bar).toContain('ButcherLocationBar');
    expect(bar).toContain('accessibilityLabel="السلة"');
    expect(bar).toContain('accessibilityLabel="بحث"');
    expect(bar).toContain('searchPill');
    expect(bar).toContain('angle-left');
    expect(bar).toContain('رجوع للتطبيق');
    expect(bar).toContain('butcherChromeBg');
    expect(bar).not.toContain('washUri');
    expect(home).toContain('butcherChromeTone');
    expect(home).toContain('chromeTone={chromeTone}');
    expect(home).not.toContain('washUri');
    expect(home).not.toContain('chromeWash');
  });

  it('renders store products as divider rows without card chrome', () => {
    const card = src('components/butcher/ButcherStoreProductCard.tsx');
    const store = src('app/butchers/[id].tsx');
    expect(card).toContain('borderBottomWidth: StyleSheet.hairlineWidth');
    expect(card).toContain("backgroundColor: 'transparent'");
    expect(card).toContain('getRtlRow()');
    expect(store).toContain('ButcherStoreHero');
    expect(store).toContain('ButcherMenuCategoryBar');
    expect(store).toContain('البحث في القائمة...');
    expect(store).not.toContain("label: 'الكل'");
    expect(store).toContain('CATEGORY_LABELS');
  });

  it('keeps more rows on the page background', () => {
    const more = src('app/butchers/more.tsx');
    expect(more).not.toContain('menuCardStyle');
    expect(more).toContain('<Screen');
    expect(more).toContain('SidebarMenuItem');
  });

  it('uses الرئيسية · الملاحم · الطلبات · المزيد on the butcher tab bar', () => {
    const tabs = src('components/butchers/ButchersTabBar.tsx');
    expect(tabs).toContain("label: 'الرئيسية'");
    expect(tabs).toContain("label: 'الملاحم'");
    expect(tabs).toContain("label: 'الطلبات'");
    expect(tabs).toContain("label: 'المزيد'");
    expect(tabs).not.toContain("label: 'العروض'");
    expect(tabs).toContain("route: '/butchers/all'");
  });

  it('caps preview offers at the requested limit', async () => {
    const butchers = Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, country: 'SA' }));
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/api/butchers?sort=rating')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { butchers } }),
        };
      }
      const id = url.split('/').pop();
      return {
        ok: true,
        json: async () => ({
          data: {
            id,
            offers: [
              { id: `${id}-o1`, titleAr: 'عرض 1', offerPrice: 10, originalPrice: 12, discountPercent: 15 },
              { id: `${id}-o2`, titleAr: 'عرض 2', offerPrice: 8 },
              { id: `${id}-o3`, titleAr: 'عرض 3', offerPrice: 6 },
              { id: `${id}-o4`, titleAr: 'عرض 4', offerPrice: 4 },
            ],
          },
        }),
      };
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const offers = await fetchButcherOffersPreview(null, 5);
    expect(offers).toHaveLength(5);
    expect(offers.every((o) => o.butcherId && o.titleAr)).toBe(true);
  });

  it('builds preview from embedded list offers without rating refetch or detail GETs', async () => {
    const fetchMock = jest.fn();
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const offers = await fetchButcherOffersPreview(null, 5, {
      records: [
        {
          id: 'b1',
          country: 'SA',
          nameAr: 'ملحمة 1',
          offers: [
            { id: 'o1', titleAr: 'عرض 1', offerPrice: 10 },
            { id: 'o2', titleAr: 'عرض 2' },
          ],
        },
        {
          id: 'b2',
          country: 'SA',
          nameAr: 'ملحمة 2',
          offers: [{ id: 'o3', titleAr: 'عرض 3' }],
        },
      ],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(offers.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
    expect(offers[0]?.butcherNameAr).toBe('ملحمة 1');
  });

  it('does not refetch sort=rating or fan out details when list records are already provided', async () => {
    const fetchMock = jest.fn();
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const offers = await fetchButcherOffersPreview(null, 5, {
      records: [{ id: 'b0', country: 'SA', nameAr: 'ملحمة' }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(offers).toEqual([]);
  });
});
