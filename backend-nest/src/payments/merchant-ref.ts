/**
 * Merchant order references written to Payment.orderId / NI merchantOrderReference.
 * New rows use MALAHM-. Legacy SFAT-/FTR-/… rows stay valid for lookup.
 */

export const MALAHEM_MERCHANT_PREFIX = 'MALAHM';

/** Historical prefixes that must still be treated as internal (not NI UUIDs). */
export const LEGACY_MERCHANT_PREFIXES = [
  'SFAT',
  'FTR',
  'PRM',
  'PIN',
  'BOTH',
] as const;

export const INTERNAL_MERCHANT_PREFIXES = [
  MALAHEM_MERCHANT_PREFIX,
  ...LEGACY_MERCHANT_PREFIXES,
] as const;

export function buildMerchantOrderReference(userId: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const uid = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${MALAHEM_MERCHANT_PREFIX}-${uid}-${ts}`;
}

export function isLegacyMerchantOrderReference(
  ref: string | null | undefined,
): boolean {
  const trimmed = ref?.trim();
  if (!trimmed) return false;
  return LEGACY_MERCHANT_PREFIXES.some((prefix) =>
    trimmed.startsWith(`${prefix}-`),
  );
}
