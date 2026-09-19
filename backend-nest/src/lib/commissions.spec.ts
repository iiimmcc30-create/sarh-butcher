import {
  BUTCHER_ORDER_COMMISSION_PERCENT,
  butcherOrderCommissionPaymentRef,
  calculateOrderCommission,
  roundMoney,
} from './commissions';

describe('butcher order commission', () => {
  it('uses a 10% order rate', () => {
    expect(BUTCHER_ORDER_COMMISSION_PERCENT).toBe(10);
  });

  it('order value 100 → order commission 10', () => {
    const r = calculateOrderCommission(100);
    expect(r.isExempt).toBe(false);
    expect(r.commission).toBe(10);
    expect(r.ratePercent).toBe(10);
  });

  it('exemption zeros order commission without changing the recorded rate', () => {
    const r = calculateOrderCommission(100, { exempt: true });
    expect(r.isExempt).toBe(true);
    expect(r.commission).toBe(0);
    expect(r.ratePercent).toBe(10);
  });

  it('non-completed amounts are not gated here — callers must only accrue on delivered+paid', () => {
    expect(calculateOrderCommission(100).commission).toBe(10);
  });

  it('rounds 0.1 + 0.2 using cents, not binary float', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(calculateOrderCommission(0.3).commission).toBe(0.03);
  });

  it('builds stable idempotent payment refs per order', () => {
    expect(butcherOrderCommissionPaymentRef('abc')).toBe('BOC-abc');
  });
});
