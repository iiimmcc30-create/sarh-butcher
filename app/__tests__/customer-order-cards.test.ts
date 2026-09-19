import { readFileSync } from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

function src(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('customer order cards and completed details', () => {
  it('keeps the HungerStation-like list hierarchy with Sarh tokens', () => {
    const card = src('components/butchers/CustomerOrderCard.tsx');
    expect(card).toContain('formatOrderDatePart');
    expect(card).toContain('عرض التفاصيل');
    expect(card).toContain('إعادة الطلب');
    expect(card).toContain('إكمال الدفع');
    expect(card).toContain('colors.gold');
    expect(card).toContain('getRtlRow()');
    expect(card).toContain('borderHairline');
  });

  it('renders completed order details as one page with hairlines', () => {
    const details = src('app/butchers/order/[id].tsx');
    expect(details).toContain('تم توصيل طلبك');
    expect(details).toContain('تفاصيل الطلب');
    expect(details).toContain('ملخص الطلب');
    expect(details).toContain('رسوم التوصيل');
    expect(details).toContain('تحميل');
    expect(details).toContain("pathname: '/support/help'");
    expect(details).toContain('المساعدة');
    expect(details).not.toContain('محادثة الملحمة');
    expect(details).not.toContain('butcherChatRouteParams');
    expect(details).toContain('useFocusEffect');
    expect(details).toContain('/api/butchers/orders/');
    expect(details).toContain("cache: 'no-store'");
    expect(details).not.toContain('params.paymentStatus');
  });

  it('does not invent a payment brand when the API has no method', () => {
    const details = src('app/butchers/order/[id].tsx');
    expect(details).toContain('PAYMENT_STATUS_LABELS');
    expect(details).not.toContain('Apple Pay');
  });
});
