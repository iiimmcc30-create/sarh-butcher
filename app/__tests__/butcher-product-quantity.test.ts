import {
  formatOrderLineQuantityPrefix,
  formatOrderQuantityLabel,
  getProductQuantityMode,
  isKgSaleUnit,
  resolveLineQuantity,
} from '@/lib/butcherProductQuantity';
import {
  computeProductLineTotal,
  formatWeightLabel,
  resolveLineWeightKg,
} from '@/lib/butcherOrderPricing';
import { createCartLineItem } from '@/services/butcherCart';
import type { ButcherProduct } from '@/services/butcherData';

function product(partial: Partial<ButcherProduct> & { id: string }): ButcherProduct {
  return {
    butcherId: 'b1',
    name: 'منتج',
    nameAr: 'منتج',
    category: 'lamb',
    images: [],
    availableCuts: ['whole'],
    inStock: true,
    freshness: 'fresh',
    description: '',
    descriptionAr: '',
    country: 'SA',
    ...partial,
  };
}

describe('butcher product quantity modes', () => {
  const sarhWeight = product({
    id: 'sarh-kg',
    pricePerKg: 40,
    weightRange: { min: 1, max: 10 },
  });

  const daftraKg = product({
    id: 'daftra-kg',
    priceFixed: 55,
    saleUnit: 'Kg',
  });

  const daftraUnit = product({
    id: 'daftra-unit',
    priceFixed: 20,
    saleUnit: 'قطعة',
  });

  it('selects the correct stepper mode', () => {
    expect(getProductQuantityMode(sarhWeight)).toBe('sarh_weight');
    expect(getProductQuantityMode(daftraKg)).toBe('daftra_weight');
    expect(getProductQuantityMode(daftraUnit)).toBe('daftra_quantity');
    expect(getProductQuantityMode(product({ id: 'fixed', priceFixed: 100 }))).toBe('none');
  });

  it('detects kg aliases', () => {
    expect(isKgSaleUnit('kg')).toBe(true);
    expect(isKgSaleUnit('كجم')).toBe(true);
    expect(isKgSaleUnit('قطعة')).toBe(false);
  });

  it('increments and decrements weight for Sarh and Daftra kg products', () => {
    expect(resolveLineWeightKg('2', sarhWeight)).toBe(2);
    expect(resolveLineWeightKg('1.5', daftraKg)).toBe(1.5);
    expect(computeProductLineTotal(sarhWeight, 2)).toBe(80);
    expect(computeProductLineTotal(daftraKg, 3)).toBe(165);
  });

  it('increments and decrements quantity for Daftra unit products', () => {
    expect(resolveLineQuantity('3')).toBe(3);
    expect(resolveLineWeightKg('3', daftraUnit)).toBe(3);
    expect(computeProductLineTotal(daftraUnit, 4)).toBe(80);
    expect(formatWeightLabel(daftraUnit, 4)).toBe('4');
  });

  it('adds cart lines with correct totals for both Daftra modes', () => {
    const kgLine = createCartLineItem({
      product: daftraKg,
      cutType: 'whole',
      weightRaw: '2',
    });
    const unitLine = createCartLineItem({
      product: daftraUnit,
      cutType: 'whole',
      weightRaw: '3',
    });

    expect(kgLine?.lineTotal).toBe(110);
    expect(kgLine?.weightKg).toBe(2);
    expect(unitLine?.lineTotal).toBe(60);
    expect(unitLine?.weightKg).toBe(3);
  });

  it('keeps Sarh fixed products unchanged', () => {
    const sarhFixed = product({ id: 'sarh-fixed', priceFixed: 500 });
    expect(getProductQuantityMode(sarhFixed)).toBe('none');
    expect(computeProductLineTotal(sarhFixed, 1)).toBe(500);
    expect(computeProductLineTotal(sarhFixed, 5)).toBe(500);
  });

  it('formats order/invoice quantity from saleUnit without guessing', () => {
    expect(formatOrderQuantityLabel(2.5, sarhWeight)).toBe('2.5 كغ');
    expect(formatOrderQuantityLabel(2.5, daftraKg)).toBe('2.5 كغ');
    expect(formatOrderQuantityLabel(3, daftraUnit)).toBe('3');
    expect(formatOrderQuantityLabel(3, daftraUnit)).not.toContain('كغ');
    expect(formatOrderLineQuantityPrefix(3, daftraUnit)).toBe('3x');
    expect(formatOrderLineQuantityPrefix(3, daftraUnit)).not.toBe('1x');
    expect(formatOrderQuantityLabel(2.5, product({ id: 'legacy' }))).toBe('2.5 كغ');
    expect(formatOrderQuantityLabel(2.5, undefined)).toBe('2.5 كغ');
    expect(formatOrderQuantityLabel(null)).toBe('');
  });

  it('prices Daftra kg and unit lines without double multiplication', () => {
    const kg = product({ id: 'p-kg', priceFixed: 30, saleUnit: 'kg' });
    const unit = product({ id: 'p-unit', priceFixed: 30, saleUnit: 'قطعة' });
    expect(computeProductLineTotal(kg, 2.5)).toBe(75);
    expect(computeProductLineTotal(unit, 3)).toBe(90);
    expect(resolveLineWeightKg('2.5', kg)).toBe(2.5);
    expect(resolveLineWeightKg('3', unit)).toBe(3);
    expect(resolveLineWeightKg('1.5', unit)).toBe(1);
  });
});
