import type { ButcherProduct } from '@/services/butcherData';
import { parseOrderWeightKg } from '@/services/butcherData';
import {
  getProductQuantityMode,
  resolveLineQuantity,
} from '@/lib/butcherProductQuantity';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Same pricing rules as order.tsx / ButchersService.createOrder. */
export function computeProductLineTotal(
  product: ButcherProduct,
  weightKg: number,
): number {
  const mode = getProductQuantityMode(product);
  if (mode === 'sarh_weight' && product.pricePerKg != null) {
    return roundMoney(product.pricePerKg * weightKg);
  }
  if (mode === 'daftra_weight' && product.priceFixed != null) {
    return roundMoney(product.priceFixed * weightKg);
  }
  if (mode === 'daftra_quantity' && product.priceFixed != null) {
    return roundMoney(product.priceFixed * resolveLineQuantity(String(weightKg)));
  }
  if (product.priceFixed != null) {
    return roundMoney(product.priceFixed);
  }
  return 0;
}

export function resolveLineWeightKg(
  rawWeight: string,
  product: ButcherProduct,
): number {
  const mode = getProductQuantityMode(product);
  if (mode === 'daftra_quantity') {
    return resolveLineQuantity(rawWeight);
  }
  return parseOrderWeightKg(rawWeight, product);
}

export function formatWeightLabel(product: ButcherProduct, weightKg: number): string {
  const mode = getProductQuantityMode(product);
  if (mode === 'sarh_weight' || mode === 'daftra_weight') {
    return `${weightKg} كغ`;
  }
  if (mode === 'daftra_quantity') {
    return `${Math.max(1, Math.round(weightKg))}`;
  }
  return '1';
}
