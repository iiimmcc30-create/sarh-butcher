import type { CutType } from '@/services/butcherData';
import type { ButcherProduct } from '@/services/butcherData';
import { resolveCustomerAuthState } from '@/lib/customerAuthState';

export const PENDING_CART_INTENT_KEY = 'butcherapp_pending_cart_intent';

export type PendingCartIntent = {
  butcherId: string;
  butcherNameAr: string;
  butcherLogo?: string;
  product: ButcherProduct;
  cutType: CutType;
  weightRaw: string;
};

export type CartGuardResult =
  | { ok: true }
  | { ok: false; reason: 'auth_required' };

export function requireCustomerForCart(isAuthenticated: boolean): CartGuardResult {
  return resolveCustomerAuthState(isAuthenticated) === 'authenticated'
    ? { ok: true }
    : { ok: false, reason: 'auth_required' };
}

export function cartIntentResumeHref(intent: Pick<PendingCartIntent, 'butcherId'> | null): string {
  if (!intent?.butcherId) return '/butchers';
  return `/butchers/${encodeURIComponent(intent.butcherId)}`;
}

export function serializePendingCartIntent(intent: PendingCartIntent): string {
  return JSON.stringify(intent);
}

export function parsePendingCartIntent(raw: string | null | undefined): PendingCartIntent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PendingCartIntent;
    if (!value?.butcherId || !value.product || !value.cutType) return null;
    if (typeof value.weightRaw !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

export function shouldApplyPendingCartIntent(
  intent: PendingCartIntent | null,
  butcherId: string | undefined,
): intent is PendingCartIntent {
  return Boolean(intent && butcherId && intent.butcherId === butcherId);
}
