import { launchPaymentCheckout } from '../services/payments';
import { startButcherCheckout } from '../services/butcherOrders';
import { readFileSync } from 'fs';
import path from 'path';

jest.mock('../services/api', () => ({
  API_BASE: 'https://sarh.example',
}));

const goToPaymentResult = jest.fn();
const openPaymentCheckout = jest.fn();

jest.mock('../services/paymentCheckout', () => ({
  openPaymentCheckout: (...args: unknown[]) => openPaymentCheckout(...args),
}));

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => goToPaymentResult(...args),
    back: jest.fn(),
    push: jest.fn(),
  },
}));

describe('alreadyPaid and payment-first butcher checkout', () => {
  beforeEach(() => {
    goToPaymentResult.mockReset();
    openPaymentCheckout.mockReset();
  });

  it('does not open a dead checkout URL when alreadyPaid or status=paid', async () => {
    const outcome = await launchPaymentCheckout({
      accessToken: 't',
      paymentId: 'pay-1',
      checkoutUrl: 'https://ni.example/dead-session',
      alreadyPaid: true,
      status: 'paid',
      context: 'butcher_checkout',
      returnParams: { checkoutId: 'chk-1' },
    });

    expect(outcome).toBe('paid');
    expect(openPaymentCheckout).not.toHaveBeenCalled();
    expect(goToPaymentResult).toHaveBeenCalledWith({
      pathname: '/payment/result',
      params: expect.objectContaining({
        paymentId: 'pay-1',
        context: 'butcher_checkout',
      }),
    });
  });

  it('starts checkout via POST /api/butchers/checkout not /orders', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          checkoutId: 'chk-1',
          paymentId: 'pay-1',
          checkoutUrl: 'https://ni.example/ok',
          alreadyPaid: true,
          status: 'paid',
          orderId: 'ord-final',
          orderNumber: 'ORD-2026-000001',
        },
      }),
    });
    (global as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const outcome = await startButcherCheckout({
      accessToken: 't',
      butcherId: 'b1',
      payload: { butcherId: 'b1', productId: 'p1', cutType: 'whole', weightKg: 2 },
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/butchers/checkout');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/api/butchers/orders');
    expect(outcome).toBe('paid');
    expect(openPaymentCheckout).not.toHaveBeenCalled();
  });
});

describe('payment-first frontend copy and routes', () => {
  const root = path.join(__dirname, '..');
  const src = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

  it('cart and direct order use checkout instead of creating an unpaid order', () => {
    const cart = src('app/butchers/cart.tsx');
    const order = src('app/butchers/order.tsx');
    expect(cart).toContain('startButcherCheckout');
    expect(cart).not.toContain('/api/butchers/orders');
    expect(order).toContain('startButcherCheckout');
    expect(order).not.toMatch(/fetch\(`\$\{API_BASE\}\/api\/butchers\/orders`/);
  });

  it('butcher payment verification copy does not mention subscription', () => {
    const result = src('app/payment/result.tsx');
    const cancel = src('app/payment/cancel.tsx');
    expect(result).toContain('butcher_checkout');
    expect(result).toContain('جارٍ التحقق من حالة الدفع');
    expect(result).not.toMatch(/butcher_checkout[\s\S]{0,400}اشتراك/);
    expect(cancel).toContain('لم يُرسل طلب للملحمة');
    expect(cancel).toContain('abandonButcherCheckout');
  });

  it('order-success paid copy matches the existing confirmation screen', () => {
    const success = src('app/butchers/order-success.tsx');
    expect(success).toContain('تم الدفع وإرسال الطلب');
    expect(success).toContain('وصل طلبك المدفوع وسيواصل معك الجزار قريبًا لتأكيد التفاصيل');
  });
});
