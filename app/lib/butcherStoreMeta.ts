import type { ButcherProfile } from '@/services/butcherData';
import { gccCurrencies } from '@/services/butcherData';

export function butcherEtaLabel(butcher: ButcherProfile): string {
  return butcher.workingHours.isOpen ? 'يوم' : 'مغلق';
}

export function butcherFeeLabel(butcher: ButcherProfile): string {
  const currency = gccCurrencies[butcher.country];
  if (!butcher.workingHours.isOpen) return '—';
  if (butcher.subscriptionActive) return 'مجاني';
  return `15 ${currency?.symbol ?? 'ر.س'}`;
}

export function butcherPickupLabel(butcher: ButcherProfile): string {
  if (butcher.subscriptionActive) return 'توصيل واستلام';
  return 'استلام من الملحمة';
}

export function butcherMinOrderLabel(butcher: ButcherProfile): string {
  const currency = gccCurrencies[butcher.country];
  const min = butcher.subscriptionActive ? 0 : 50;
  if (min <= 0) return 'بدون حد أدنى';
  return `أدنى طلب: ${min} ${currency?.symbol ?? 'ر.س'}`;
}

export function butcherReviewCountLabel(count: number): string {
  if (count > 999) return `${(count / 1000).toFixed(1)}k+`;
  return `${count}+`;
}

export function hasButcherRating(butcher: Pick<ButcherProfile, 'rating' | 'reviewCount'>): boolean {
  return Number.isFinite(butcher.rating) && (butcher.reviewCount ?? 0) > 0;
}
