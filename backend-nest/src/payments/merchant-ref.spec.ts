import {
  buildMerchantOrderReference,
  isLegacyMerchantOrderReference,
  MALAHEM_MERCHANT_PREFIX,
} from './merchant-ref';
import { isInternalMerchantOrderReference } from './ni-client';

describe('Malahem merchant order references', () => {
  it('issues MALAHM- for new payments', () => {
    const ref = buildMerchantOrderReference('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(ref.startsWith(`${MALAHEM_MERCHANT_PREFIX}-`)).toBe(true);
    expect(ref.startsWith('SFAT-')).toBe(false);
    expect(isInternalMerchantOrderReference(ref)).toBe(true);
  });

  it('still recognizes leftover SFAT- rows', () => {
    expect(isLegacyMerchantOrderReference('SFAT-OLD-REF')).toBe(true);
    expect(isInternalMerchantOrderReference('SFAT-OLD-REF')).toBe(true);
    expect(isLegacyMerchantOrderReference('MALAHM-NEW-REF')).toBe(false);
  });
});
