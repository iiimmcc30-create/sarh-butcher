import { SAUDI_REGIONS, resolveSaudiMainCities } from '../constants/saudiRegions';
import {
  listingMatchesRegionSelection,
  regionMatchTokens,
  regionSelectionLabel,
} from '../lib/saudiRegionSearch';

describe('saudi region filter matching', () => {
  const riyadh = SAUDI_REGIONS.find((r) => r.id === 'riyadh')!;
  const eastern = SAUDI_REGIONS.find((r) => r.id === 'eastern')!;
  const qassim = SAUDI_REGIONS.find((r) => r.id === 'qassim')!;
  const zulfi = riyadh.cities.find((c) => c.id === 'zulfi')!;
  const hafr = eastern.cities.find((c) => c.id === 'hafr-albatin')!;

  it('matches region filter by city name inside that region', () => {
    expect(
      listingMatchesRegionSelection('الزلفي', { type: 'region', region: riyadh }),
    ).toBe(true);
    expect(
      listingMatchesRegionSelection('حفرالباطن', { type: 'region', region: eastern }),
    ).toBe(true);
    expect(
      listingMatchesRegionSelection('القصيم', { type: 'region', region: qassim }),
    ).toBe(true);
  });

  it('matches exact city filter and rejects other cities', () => {
    expect(
      listingMatchesRegionSelection('الزلفي', {
        type: 'city',
        region: riyadh,
        city: zulfi,
      }),
    ).toBe(true);
    expect(
      listingMatchesRegionSelection('الرياض', {
        type: 'city',
        region: riyadh,
        city: zulfi,
      }),
    ).toBe(false);
    expect(
      listingMatchesRegionSelection('حفر الباطن', {
        type: 'city',
        region: eastern,
        city: hafr,
      }),
    ).toBe(true);
  });

  it('keeps all-regions open and labels selections', () => {
    expect(listingMatchesRegionSelection('أي مكان', { type: 'all' })).toBe(true);
    expect(regionSelectionLabel({ type: 'all' })).toBe('كل المناطق');
    expect(regionSelectionLabel({ type: 'region', region: eastern })).toContain('الشرقية');
    expect(regionMatchTokens(qassim)).toContain('القصيم');
  });

  it('resolves featured main cities for the empty region state', () => {
    expect(resolveSaudiMainCities().map((c) => c.city.nameAr)).toEqual([
      'الدمام',
      'الرياض',
      'جدة',
      'المدينة المنورة',
      'مكة المكرمة',
    ]);
  });
});
