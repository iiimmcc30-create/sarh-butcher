import {
  CUSTOMER_FLOW_LABELS,
  CUSTOMER_ORDER_FLOW,
  customerOrderHeadline,
  flowReached,
  isPayableButcherOrder,
  orderLineItems,
  orderMoneySummary,
  orderProductSummary,
  orderSpecsLine,
  timelineStamp,
} from '../lib/customerOrders';

describe('customerOrders', () => {
  it('keeps the five customer tracking steps in RTL visual order', () => {
    expect(CUSTOMER_ORDER_FLOW).toEqual([
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'delivered',
    ]);
    expect(CUSTOMER_FLOW_LABELS.pending).toBe('قيد الانتظار');
    expect(CUSTOMER_FLOW_LABELS.confirmed).toBe('تم قبول الطلب');
    expect(CUSTOMER_FLOW_LABELS.delivered).toBe('مكتمل');
  });

  it('summarizes product and specs for the outer card', () => {
    const order = {
      id: '1',
      orderNumber: 'ORD-1',
      butcherId: 'b',
      customerId: 'c',
      productId: 'p',
      cutType: 'whole',
      weightKg: 1,
      deliveryType: 'delivery',
      status: 'delivered',
      paymentStatus: 'paid',
      totalPrice: 1,
      currency: 'SAR',
      createdAt: '2026-08-14T15:08:00.000Z',
      product: { id: 'p', nameAr: 'خروف كامل' },
      items: [{ id: 'i1', productId: 'p', cutType: 'whole', weightKg: 1, linePrice: 1, product: { id: 'p', nameAr: 'خروف كامل' } }],
    } as const;
    expect(orderProductSummary(order as any)).toBe('خروف كامل');
    expect(orderSpecsLine(order as any)).toBe('1 كغ • كامل • توصيل');
  });

  it('labels Daftra kg vs unit quantity on the specs line', () => {
    const base = {
      id: '1',
      orderNumber: 'ORD-1',
      butcherId: 'b',
      customerId: 'c',
      productId: 'p',
      cutType: 'whole',
      deliveryType: 'delivery',
      status: 'delivered',
      paymentStatus: 'paid',
      totalPrice: 90,
      currency: 'SAR',
      createdAt: '2026-08-14T15:08:00.000Z',
    };
    expect(
      orderSpecsLine({
        ...base,
        weightKg: 2.5,
        product: { id: 'p', nameAr: 'لحم', saleUnit: 'kg' },
      } as any),
    ).toBe('2.5 كغ • كامل • توصيل');
    expect(
      orderSpecsLine({
        ...base,
        weightKg: 3,
        product: { id: 'p', nameAr: 'صدر', saleUnit: 'قطعة' },
      } as any),
    ).toBe('3 • كامل • توصيل');
    expect(
      orderSpecsLine({
        ...base,
        weightKg: 3,
        product: { id: 'p', nameAr: 'صدر', saleUnit: 'قطعة' },
      } as any),
    ).not.toContain('كغ');
  });

  it('builds item cards and money rows for the inner card', () => {
    const order = {
      id: '1',
      totalPrice: 1020,
      currency: 'SAR',
      items: [
        {
          id: 'i1',
          cutType: 'whole',
          weightKg: 1.2,
          linePrice: 1020,
          product: { nameAr: 'لحم ضأن طازج' },
        },
      ],
    };
    const lines = orderLineItems(order);
    expect(lines[0].name).toBe('لحم ضأن طازج');
    expect(lines[0].unitPrice).toBeCloseTo(850);
    expect(lines[0].quantityLabel).toBe('1.2 كغ');
    expect(orderMoneySummary(order)).toEqual({
      subtotal: 1020,
      deliveryFee: null,
      total: 1020,
    });
  });

  it('uses stored weightKg for unit-count lines instead of 1x', () => {
    const lines = orderLineItems({
      id: '1',
      totalPrice: 90,
      items: [
        {
          id: 'i1',
          cutType: 'whole',
          weightKg: 3,
          linePrice: 90,
          product: { nameAr: 'صدر دجاج', saleUnit: 'قطعة' },
        },
      ],
    });
    expect(lines[0].quantityLabel).toBe('3x');
    expect(lines[0].quantityLabel).not.toBe('1x');
    expect(lines[0].quantity).toBe(3);
  });

  it('marks flow steps reached and reads timeline times', () => {
    const reached = flowReached({
      status: 'preparing',
      timeline: [{ status: 'pending' }, { status: 'confirmed' }],
    });
    expect(reached.has('pending')).toBe(true);
    expect(reached.has('confirmed')).toBe(true);
    expect(reached.has('preparing')).toBe(true);
    expect(reached.has('ready')).toBe(false);
    expect(
      timelineStamp(
        [{ status: 'pending', createdAt: '2026-05-16T07:30:00.000Z' }],
        'pending',
      ),
    ).not.toBe('');
  });

  it('shows complete-payment headline only for pending unpaid orders', () => {
    expect(
      customerOrderHeadline({ status: 'pending', paymentStatus: 'unpaid' }),
    ).toEqual({ label: 'بانتظار الدفع', awaitingPayment: true, expired: false });
    expect(
      customerOrderHeadline({ status: 'pending', paymentStatus: 'failed' }),
    ).toEqual({ label: 'بانتظار الدفع', awaitingPayment: true, expired: false });
    expect(
      customerOrderHeadline({ status: 'pending', paymentStatus: 'paid' }),
    ).toEqual({
      label: 'بانتظار قبول الملحمة',
      awaitingPayment: false,
      expired: false,
    });
    expect(
      customerOrderHeadline({ status: 'confirmed', paymentStatus: 'paid' }),
    ).toEqual({ label: 'تم قبول الطلب', awaitingPayment: false, expired: false });
    expect(
      customerOrderHeadline({ status: 'delivered', paymentStatus: 'paid' }),
    ).toEqual({ label: 'مكتمل', awaitingPayment: false, expired: false });
    expect(
      customerOrderHeadline({
        status: 'cancelled',
        paymentStatus: 'unpaid',
        cancellationReason: 'انتهت مهلة الدفع لهذا الطلب وتم تحرير الكمية المحجوزة',
      }),
    ).toEqual({ label: 'انتهت صلاحية الطلب', awaitingPayment: false, expired: true });
    expect(isPayableButcherOrder({ status: 'pending', paymentStatus: 'unpaid' })).toBe(true);
    expect(isPayableButcherOrder({ status: 'cancelled', paymentStatus: 'unpaid' })).toBe(false);
    expect(isPayableButcherOrder({ status: 'pending', paymentStatus: 'paid' })).toBe(false);
  });
});
