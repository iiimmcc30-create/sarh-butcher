import { readFileSync } from 'fs';
import path from 'path';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiGet: jest.fn(),
}));

import { handleNotificationNavigation } from '@/lib/notifications';
import { resetNavigationLockForTests, setCurrentPathname } from '@/lib/safeNavigate';

function router() {
  return { push: jest.fn(), replace: jest.fn() };
}

function lastPush(r: { push: jest.Mock }) {
  return r.push.mock.calls[r.push.mock.calls.length - 1]?.[0];
}

describe('order and support notification deep links', () => {
  beforeEach(() => {
    setCurrentPathname('/notifications');
    resetNavigationLockForTests();
  });

  it('opens live order details for preparing — not order-success snapshot', () => {
    const r = router();
    const ok = handleNotificationNavigation(
      {
        type: 'order_update',
        data: {
          orderId: 'ord-prep',
          butcherId: 'b1',
          status: 'pending',
          paymentStatus: 'unpaid',
        },
      },
      { router: r as never, isAdmin: false },
    );
    expect(ok).toBe(true);
    const arg = lastPush(r);
    expect(arg.pathname).toBe('/butchers/order/[id]');
    expect(arg.params.id).toBe('ord-prep');
    expect(arg.params.fresh).toBeTruthy();
    expect(JSON.stringify(arg)).not.toContain('order-success');
    expect(arg.params.paymentStatus).toBeUndefined();
    expect(arg.params.status).toBeUndefined();
  });

  it('opens live order details for delivered using orderId only', () => {
    const r = router();
    handleNotificationNavigation(
      {
        type: 'order_update',
        data: { orderId: 'ord-done', status: 'delivered' },
      },
      { router: r as never, isAdmin: false },
    );
    const arg = lastPush(r);
    expect(arg.pathname).toBe('/butchers/order/[id]');
    expect(arg.params.id).toBe('ord-done');
  });

  it('opens the same order again from a stale notification (force + fresh)', () => {
    const r = router();
    handleNotificationNavigation(
      { type: 'order_update', data: { orderId: 'ord-same' } },
      { router: r as never, isAdmin: false },
    );
    const firstFresh = lastPush(r).params.fresh;
    setCurrentPathname('/butchers/order/ord-same');
    resetNavigationLockForTests();
    handleNotificationNavigation(
      { type: 'order_update', data: { orderId: 'ord-same', paymentStatus: 'unpaid' } },
      { router: r as never, isAdmin: false },
    );
    const second = lastPush(r);
    expect(second.pathname).toBe('/butchers/order/[id]');
    expect(second.params.id).toBe('ord-same');
    expect(second.params.fresh).toBeTruthy();
    expect(firstFresh).toBeTruthy();
    expect(r.push).toHaveBeenCalledTimes(2);
    expect(second.params.paymentStatus).toBeUndefined();
  });

  it('opens the support ticket by id and ignores payload snapshot fields', () => {
    const r = router();
    handleNotificationNavigation(
      {
        type: 'system',
        data: {
          event: 'support_ticket_staff_reply',
          ticketId: 'tix-9',
          status: 'OPEN',
          lastMessage: 'old',
        },
      },
      { router: r as never, isAdmin: false },
    );
    const arg = lastPush(r);
    expect(arg.pathname).toBe('/support/tickets/[id]');
    expect(arg.params.id).toBe('tix-9');
    expect(arg.params.fresh).toBeTruthy();
    expect(arg.params.lastMessage).toBeUndefined();
  });
});

describe('order details screen fetches live API state', () => {
  const source = readFileSync(
    path.join(__dirname, '../app/butchers/order/[id].tsx'),
    'utf8',
  );

  it('refetches the order on focus and does not read notification paymentStatus', () => {
    expect(source).toContain('useFocusEffect');
    expect(source).toContain('/api/butchers/orders/');
    expect(source).toContain("cache: 'no-store'");
    expect(source).not.toContain('params.paymentStatus');
    expect(source).not.toContain('order-success');
  });
});
