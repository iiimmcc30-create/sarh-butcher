import type { Listing } from '@/services/types';
import { interleavePromotedListings } from '@/lib/listingSort';
import { formatRelativeTimeAr, formatPostTimestampAr } from '@/lib/formatRelativeTime';
import {
  computeProductLineTotal,
  formatWeightLabel,
  resolveLineWeightKg,
} from '@/lib/butcherOrderPricing';
import type { ButcherProduct } from '@/services/butcherData';
import {
  FALLBACK_OFFICIAL_SERVICES,
  groupOfficialServicesByCategory,
  previewOfficialServices,
  type OfficialService,
} from '@/services/officialServices';

function listing(partial: Partial<Listing> & { id: string }): Listing {
  return {
    id: partial.id,
    title: 't',
    arabicTitle: 'ع',
    price: 100,
    currency: 'SAR',
    category: 'sheep',
    breed: '',
    age: '',
    location: 'Riyadh',
    arabicLocation: 'الرياض',
    country: 'SA',
    images: [],
    description: 'd',
    arabicDescription: 'و',
    seller: {
      id: 's1',
      username: 'u',
      displayName: 'U',
      arabicName: 'م',
      verified: false,
      followers: 0,
      following: 0,
      rating: null,
      country: 'SA',
      bio: '',
    },
    featured: partial.featured ?? false,
    pinned: partial.pinned ?? false,
    promoted: partial.promoted ?? false,
    promotionWeight: partial.promotionWeight,
    postedAt: 'اليوم',
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
  };
}

describe('interleavePromotedListings (app)', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps pinned first and includes all promoted items', () => {
    const items = [
      listing({ id: 'r1' }),
      listing({ id: 'p1', pinned: true }),
      listing({ id: 'm1', promoted: true, promotionWeight: 80 }),
      listing({ id: 'r2' }),
      listing({ id: 'm2', promoted: true, promotionWeight: 40 }),
    ];
    const out = interleavePromotedListings(items);
    expect(out[0].id).toBe('p1');
    expect(out.map((x) => x.id).sort()).toEqual(['m1', 'm2', 'p1', 'r1', 'r2'].sort());
  });
});

describe('formatRelativeTimeAr', () => {
  it('handles empty/invalid and recent times', () => {
    expect(formatRelativeTimeAr(null)).toBe('');
    expect(formatRelativeTimeAr('not-a-date')).toBe('not-a-date');
    expect(formatRelativeTimeAr(new Date())).toBe('الآن');
    expect(formatRelativeTimeAr(new Date(Date.now() - 2 * 60 * 1000))).toBe('قبل دقيقتين');
    expect(formatRelativeTimeAr(new Date(Date.now() - 5 * 60 * 1000))).toContain('دقائق');
  });

  it('uses relative format for posts younger than a week', () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatPostTimestampAr(recent)).toBe(formatRelativeTimeAr(recent));
  });
});

describe('butcherOrderPricing', () => {
  const fixed: ButcherProduct = {
    id: 'p1',
    nameAr: 'لحم',
    priceFixed: 120,
    pricePerKg: null,
  } as unknown as ButcherProduct;

  const byKg: ButcherProduct = {
    id: 'p2',
    nameAr: 'لحم كيلو',
    priceFixed: null,
    pricePerKg: 40,
  } as unknown as ButcherProduct;

  it('computes fixed and per-kg totals', () => {
    expect(computeProductLineTotal(fixed, 3)).toBe(120);
    expect(computeProductLineTotal(byKg, 2.5)).toBe(100);
    expect(
      computeProductLineTotal(
        { ...fixed, priceFixed: null, pricePerKg: null } as unknown as ButcherProduct,
        1,
      ),
    ).toBe(0);
  });

  it('formats weight labels and resolves weight', () => {
    expect(formatWeightLabel(byKg, 2)).toBe('2 كغ');
    expect(formatWeightLabel(fixed, 2)).toBe('1');
    expect(typeof resolveLineWeightKg('2.5', byKg)).toBe('number');
  });
});

describe('officialServices grouping', () => {
  it('groups fallback services in canonical category order', () => {
    const groups = groupOfficialServicesByCategory(FALLBACK_OFFICIAL_SERVICES);
    expect(groups.map((g) => g.category)).toEqual(['veterinary', 'livestock', 'slaughter']);
    expect(groups[0].label).toBe('الخدمات البيطرية');
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });

  it('appends unknown categories after known order', () => {
    const custom: OfficialService = {
      ...FALLBACK_OFFICIAL_SERVICES[0],
      id: 'custom',
      category: 'custom-cat',
      title: 'خدمة أخرى',
    };
    const groups = groupOfficialServicesByCategory([
      custom,
      FALLBACK_OFFICIAL_SERVICES[0],
    ]);
    expect(groups[0].category).toBe('veterinary');
    expect(groups[groups.length - 1].category).toBe('custom-cat');
    expect(groups[groups.length - 1].emoji).toBe('📋');
  });

  it('previews the first active services in backend order', () => {
    const inactive: OfficialService = {
      ...FALLBACK_OFFICIAL_SERVICES[0],
      id: 'inactive',
      active: false,
      title: 'مخفية',
    };
    const preview = previewOfficialServices([inactive, ...FALLBACK_OFFICIAL_SERVICES], 3);
    expect(preview).toHaveLength(3);
    expect(preview.map((item) => item.id)).toEqual(
      FALLBACK_OFFICIAL_SERVICES.slice(0, 3).map((item) => item.id),
    );
    expect(preview.every((item) => item.active !== false)).toBe(true);
  });
});
