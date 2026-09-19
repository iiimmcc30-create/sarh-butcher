import {
  cartItemsCount,
  cartSubtotal,
  createCartLineItem,
  emptyCartSnapshot,
} from '../services/butcherCart';
import {
  formatCurrency,
  isActiveOrder,
  isInvoiceOrder,
  type ButcherOrderRecord,
} from '../services/butcherOrders';
import { rankButchers, routeParam, type ButcherProfile } from '../services/butcherData';
import {
  normalizeShopPhone,
  normalizeCommercialReg,
  validateWizardStep1,
  validateDocumentUploadInput,
  isAllowedDocumentMime,
} from '../lib/butcherApplicationValidation';
import { formatLocationLabel } from '../lib/formatAddress';
import { hasValidCoords, coordsToMapPercent } from '../lib/butcherLocation';
import { osmEmbedUrl, osmStaticMapUrl } from '../lib/osmMap';
import {
  formatRemainingMs,
  promotionSuccessMessage,
} from '../services/listingPromotion';
import { sanitizeApiMessage } from '../services/apiError';

const product = {
  id: 'pr1',
  butcherId: 'b1',
  name: 'Meat',
  nameAr: 'لحم',
  category: 'lamb' as const,
  images: [],
  pricePerKg: 40,
  availableCuts: ['whole' as const],
  inStock: true,
  freshness: 'fresh' as const,
  description: 'd',
  descriptionAr: 'و',
  country: 'SA' as const,
  weightRange: { min: 1, max: 20 },
};

function butcher(partial: Partial<ButcherProfile> & { id: string }): ButcherProfile {
  const { id, ...overrides } = partial;
  return {
    id,
    name: 'Shop',
    nameAr: overrides.nameAr ?? 'ملحمة',
    type: 'verified',
    country: 'SA',
    city: 'Riyadh',
    cityAr: 'الرياض',
    address: 'a',
    addressAr: 'ع',
    lat: 24.7,
    lng: 46.7,
    phone: '+966500000000',
    rating: overrides.rating ?? 4,
    reviewCount: 0,
    orderCompletionRate: 90,
    workingHours: { open: '08:00', close: '22:00', isOpen: true },
    bio: '',
    bioAr: '',
    specialties: [],
    subscriptionActive: true,
    activityScore: overrides.activityScore ?? 50,
    rankingScore: overrides.rankingScore ?? 0,
    favoritesCount: overrides.favoritesCount ?? 0,
    completedOrdersCount: overrides.completedOrdersCount ?? 0,
    totalOrders: overrides.totalOrders ?? 0,
    joinedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('butcher cart & orders', () => {
  it('builds cart line and totals', () => {
    const line = createCartLineItem({
      product,
      cutType: 'whole',
      weightRaw: '2',
    });
    expect(line?.lineTotal).toBe(80);
    expect(cartItemsCount([line!])).toBe(1);
    expect(cartSubtotal([line!])).toBe(80);
    expect(emptyCartSnapshot('b1').items).toEqual([]);
  });

  it('classifies order states for pages', () => {
    const active: ButcherOrderRecord = {
      id: 'o1',
      orderNumber: '1',
      butcherId: 'b1',
      customerId: 'c1',
      productId: 'pr1',
      cutType: 'whole',
      weightKg: 2,
      deliveryType: 'pickup',
      status: 'preparing',
      paymentStatus: 'unpaid',
      totalPrice: 80,
      currency: 'SAR',
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(isActiveOrder(active)).toBe(true);
    expect(
      isInvoiceOrder({ ...active, status: 'delivered', paymentStatus: 'paid' }),
    ).toBe(true);
    expect(formatCurrency(80, 'SAR')).toContain('ر.س');
  });

  it('ranks butchers by ranking score then completed orders', () => {
    const ranked = rankButchers([
      butcher({ id: 'a', rankingScore: 10, completedOrdersCount: 5 }),
      butcher({ id: 'b', rankingScore: 20, completedOrdersCount: 1 }),
      butcher({ id: 'c', rankingScore: 20, completedOrdersCount: 9 }),
    ]);
    expect(ranked.map((b) => b.id)).toEqual(['c', 'b', 'a']);
  });

  it('routeParam flattens array params', () => {
    expect(routeParam(['x', 'y'])).toBe('x');
    expect(routeParam('z')).toBe('z');
  });
});

describe('butcher application validation (register flow)', () => {
  it('normalizes phone and commercial registration digits', () => {
    expect(normalizeShopPhone('٠٥٠١٢٣٤٥٦٧')).toMatch(/501234567/);
    expect(normalizeCommercialReg('١٢٣٤٥')).toBe('12345');
  });

  it('validates wizard step 1 required identity fields', () => {
    const bad = validateWizardStep1({
      nameAr: '',
      nameEn: '',
      city: '',
      cityAr: '',
      shopPhone: '',
      commercialReg: '',
      country: 'SA',
    } as never);
    expect(bad.valid).toBe(false);
  });

  it('checks document mime allow-list', () => {
    expect(isAllowedDocumentMime('application/pdf')).toBe(true);
    expect(isAllowedDocumentMime('text/html')).toBe(false);
    const upload = validateDocumentUploadInput({
      type: 'commercial_license',
      mimeType: 'application/pdf',
      fileSizeBytes: 1000,
      fileKey: 'uploads/docs/commercial-reg-abc',
      originalFileName: 'reg.pdf',
    });
    expect(upload.valid).toBe(true);
  });
});

describe('maps / location / listing promotion copy', () => {
  it('formats location labels and map helpers', () => {
    expect(formatLocationLabel('الرياض', 'حي النرجس')).toContain('الرياض');
    expect(hasValidCoords(24.7, 46.7)).toBe(true);
    expect(hasValidCoords(0, 0)).toBe(false);
    const pct = coordsToMapPercent(24.7, 46.7);
    expect(pct.x).toBeGreaterThan(0);
    expect(osmStaticMapUrl(24.7, 46.7)).toContain('24.7');
    expect(osmEmbedUrl(24.7, 46.7)).toContain('46.7');
  });

  it('formats promotion remaining time and success message', () => {
    expect(formatRemainingMs(0)).toBe('منتهٍ');
    expect(formatRemainingMs(2 * 60 * 60 * 1000)).toContain('ساعة');
    expect(formatRemainingMs(26 * 60 * 60 * 1000)).toContain('يوم');
    expect(promotionSuccessMessage()).toContain('ترويج');
  });

  it('sanitizes API error messages', () => {
    expect(sanitizeApiMessage('')).toContain('خطأ');
    expect(sanitizeApiMessage('فشل الدفع')).toBe('فشل الدفع');
  });
});
