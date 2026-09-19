import { completeButcherOrderPayment } from '../services/butcherOrders';
import { launchPaymentCheckout } from '../services/payments';

jest.mock('../services/api', () => ({
  API_BASE: 'https://sarh-new4.onrender.com',
}));

jest.mock('../services/payments', () => ({
  launchPaymentCheckout: jest.fn(async () => 'opened'),
}));

const unpaidOrder = {
  id: 'ord-same',
  orderNumber: 'ORD-1',
  totalPrice: 150,
  currency: 'SAR',
  butcherId: 'b1',
  status: 'pending' as const,
  paymentStatus: 'unpaid' as const,
};

describe('completeButcherOrderPayment', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    (launchPaymentCheckout as jest.Mock).mockClear();
    (global as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });

  it('does not start checkout for cancelled or paid orders', async () => {
    await expect(
      completeButcherOrderPayment({
        accessToken: 't',
        order: { ...unpaidOrder, status: 'cancelled' },
      }),
    ).resolves.toBe('blocked');
    await expect(
      completeButcherOrderPayment({
        accessToken: 't',
        order: { ...unpaidOrder, paymentStatus: 'paid' },
      }),
    ).resolves.toBe('blocked');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(launchPaymentCheckout).not.toHaveBeenCalled();
  });

  it('initiates payment against the existing butcher order id and amount', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          paymentId: 'pay-2',
          checkoutUrl: 'https://checkout.example/2',
          devMode: true,
        },
      }),
    });

    const outcome = await completeButcherOrderPayment({
      accessToken: 'token',
      order: unpaidOrder,
    });

    expect(outcome).toBe('opened');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/payments/initiate');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      amount: 150,
      type: 'butcher_order',
      referenceId: 'ord-same',
    });
    expect(launchPaymentCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay-2',
        context: 'butcher_order',
        alreadyPaid: false,
        status: undefined,
        returnParams: expect.objectContaining({ orderId: 'ord-same' }),
      }),
    );
  });

  it('passes alreadyPaid through so a dead NI checkout URL is not opened', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          paymentId: 'pay-paid',
          checkoutUrl: 'https://ni.example/dead',
          alreadyPaid: true,
          status: 'paid',
        },
      }),
    });

    await completeButcherOrderPayment({
      accessToken: 'token',
      order: unpaidOrder,
    });

    expect(launchPaymentCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay-paid',
        alreadyPaid: true,
        status: 'paid',
        checkoutUrl: 'https://ni.example/dead',
      }),
    );
  });
});
