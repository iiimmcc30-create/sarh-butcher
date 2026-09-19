import type { ButcherProduct } from '@/services/butcherData';

const KG_UNIT_ALIASES = new Set([
  'kg',
  'kilogram',
  'kilograms',
  'كجم',
  'كيلو',
  'كيلوغرام',
  'كيلوجرام',
  'كغ',
]);

export type ProductQuantityMode =
  | 'sarh_weight'
  | 'daftra_weight'
  | 'daftra_quantity'
  | 'none';

export function isKgSaleUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  const normalized = unit.trim().toLowerCase().replace(/\s+/g, '');
  if (!normalized) return false;
  if (KG_UNIT_ALIASES.has(normalized)) return true;
  return normalized === 'kg' || normalized.endsWith('kg');
}

export function getProductQuantityMode(
  product: Pick<ButcherProduct, 'pricePerKg' | 'priceFixed' | 'saleUnit'>,
): ProductQuantityMode {
  if (product.pricePerKg != null) return 'sarh_weight';
  if (product.priceFixed != null && product.saleUnit) {
    return isKgSaleUnit(product.saleUnit) ? 'daftra_weight' : 'daftra_quantity';
  }
  return 'none';
}

export function showsProductStepper(mode: ProductQuantityMode): boolean {
  return mode !== 'none';
}

export function resolveLineQuantity(raw: string, fallback = 1): number {
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 999);
}

export type SaleUnitSource = {
  saleUnit?: string | null;
  daftraLink?: { daftraSaleUnit?: string | null } | null;
};

export function resolveSaleUnit(source?: SaleUnitSource | null): string | null {
  if (!source) return null;
  if (typeof source.saleUnit === 'string' && source.saleUnit.trim()) {
    return source.saleUnit.trim();
  }
  const fromLink = source.daftraLink?.daftraSaleUnit?.trim();
  return fromLink || null;
}

/**
 * Formats stored `weightKg` for butcher order/invoice screens.
 * Uses saleUnit only — never infers Daftra kg from pricePerKg.
 * Missing saleUnit keeps the previous "كغ" label (legacy, no guessing).
 */
export function formatOrderQuantityLabel(
  weightKg: number | null | undefined,
  source?: SaleUnitSource | null,
): string {
  if (weightKg == null || !Number.isFinite(Number(weightKg))) return '';
  const amount = Number(weightKg);
  const saleUnit = resolveSaleUnit(source);
  if (saleUnit && !isKgSaleUnit(saleUnit)) {
    return String(Math.max(1, Math.round(amount)));
  }
  return `${amount} كغ`;
}

/** Prefix for `{qty} {name}` on order detail. Units use Nx; kg/legacy use the كغ label. */
export function formatOrderLineQuantityPrefix(
  weightKg: number,
  source?: SaleUnitSource | null,
): string {
  const saleUnit = resolveSaleUnit(source);
  if (saleUnit && !isKgSaleUnit(saleUnit)) {
    return `${Math.max(1, Math.round(weightKg))}x`;
  }
  return formatOrderQuantityLabel(weightKg, source);
}
