import { readFileSync } from 'fs';
import path from 'path';
import { isOrderChatEligible } from '../services/butcherChat';
import { TICKET_STATUS_LABEL_AR } from '../services/support';
import { messageAuthorLabel } from '../lib/supportRealtime';

describe('customer support UI phase 3', () => {
  it('keeps butcher chat closed and exposes help CTA on order details', () => {
    expect(isOrderChatEligible('delivered' as never)).toBe(false);
    const orderScreen = readFileSync(
      path.join(__dirname, '../app/butchers/order/[id].tsx'),
      'utf8',
    );
    expect(orderScreen).toContain("pathname: '/support/help'");
    expect(orderScreen).toContain('المساعدة');
    expect(orderScreen).not.toContain('محادثة الملحمة');
    expect(orderScreen).not.toContain('butcherChatRouteParams');
  });

  it('labels Sarhan / staff / customer and shows human handoff statuses', () => {
    expect(messageAuthorLabel({ authorKind: 'SARHAN', isStaffReply: true })).toBe('سرحان');
    expect(messageAuthorLabel({ authorKind: 'STAFF', isStaffReply: true })).toBe('خدمة العملاء');
    expect(messageAuthorLabel({ authorKind: 'CUSTOMER', isStaffReply: false })).toBe('أنت');
    expect(TICKET_STATUS_LABEL_AR.WAITING_FOR_SUPPORT).toBeTruthy();
    const ticketScreen = readFileSync(
      path.join(__dirname, '../app/support/tickets/[id].tsx'),
      'utf8',
    );
    expect(ticketScreen).toContain('SUPPORT_CUSTOMER_SERVICE');
    expect(ticketScreen).not.toContain('سرحان لن يرد');
    expect(ticketScreen).toContain("from '@/constants/supportIdentity'");
  });
});
