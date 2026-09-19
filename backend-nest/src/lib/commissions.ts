/**
 * Butcher order commission — independent of SARH listing fees.
 * Rate is 10% of a delivered, paid butcher order.
 * Exemption is a local Butcher.commissionExempt flag (not SARH plans).
 */

export const BUTCHER_ORDER_COMMISSION_PERCENT = 10;

/** Merchant payment.orderId for an order-commission ledger row (unique). */
export function butcherOrderCommissionPaymentRef(
  butcherOrderId: string,
): string {
  return `BOC-${butcherOrderId}`;
}

export interface OrderCommissionResult {
  commission: number;
  isExempt: boolean;
  /** Rate used for the accrual (admin/audit). Never expose to butchers. */
  ratePercent: number;
  orderAmount: number;
}

function moneyToCents(amount: number): number {
  return Math.round(amount * 100);
}

function centsToMoney(cents: number): number {
  return cents / 100;
}

/** SAR-style money rounding to 2 decimal places. */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculateOrderCommission(
  orderAmount: number,
  opts?: { exempt?: boolean },
): OrderCommissionResult {
  const amount = Number.isFinite(orderAmount) ? Math.max(0, orderAmount) : 0;
  const ratePercent = BUTCHER_ORDER_COMMISSION_PERCENT;

  if (opts?.exempt) {
    return {
      commission: 0,
      isExempt: true,
      ratePercent,
      orderAmount: amount,
    };
  }

  return {
    commission: centsToMoney(
      Math.round((moneyToCents(amount) * ratePercent) / 100),
    ),
    isExempt: false,
    ratePercent,
    orderAmount: amount,
  };
}
