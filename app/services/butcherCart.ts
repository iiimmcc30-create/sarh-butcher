import type { ButcherProduct, CutType, DeliveryType } from '@/services/butcherData';
import { computeProductLineTotal, resolveLineWeightKg } from '@/lib/butcherOrderPricing';

export type ButcherCartLineItem = {
  /** Client-side line id (stable for list keys). */
  id: string;
  productId: string;
  product: ButcherProduct;
  cutType: CutType;
  weightKg: number;
  lineTotal: number;
};

export type ButcherCartSnapshot = {
  butcherId: string;
  butcherNameAr: string;
  butcherLogo?: string;
  deliveryType: DeliveryType;
  deliveryAddress: string;
  notes: string;
  items: ButcherCartLineItem[];
};

export function createCartLineItem(input: {
  product: ButcherProduct;
  cutType: CutType;
  weightRaw: string;
}): ButcherCartLineItem | null {
  const weightKg = resolveLineWeightKg(input.weightRaw, input.product);
  const lineTotal = computeProductLineTotal(input.product, weightKg);
  if (lineTotal <= 0 || !Number.isFinite(lineTotal)) return null;

  return {
    id: `${input.product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: input.product.id,
    product: input.product,
    cutType: input.cutType,
    weightKg,
    lineTotal,
  };
}

export function cartItemsCount(items: ButcherCartLineItem[]): number {
  return items.length;
}

export function cartSubtotal(items: ButcherCartLineItem[]): number {
  const sum = items.reduce((acc, line) => acc + line.lineTotal, 0);
  return Math.round(sum * 100) / 100;
}

export function emptyCartSnapshot(butcherId: string): ButcherCartSnapshot {
  return {
    butcherId,
    butcherNameAr: '',
    butcherLogo: undefined,
    deliveryType: 'pickup',
    deliveryAddress: '',
    notes: '',
    items: [],
  };
}
