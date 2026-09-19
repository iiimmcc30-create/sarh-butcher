import { API_BASE } from '@/services/api';
import type { OrderStatus } from '@/services/butcherData';

export type ButcherChatAccess = {
  allowed: boolean;
  orderId?: string | null;
  receiverId?: string | null;
  reason?:
    | 'login_required'
    | 'order_not_accepted'
    | 'direct_chat_disabled'
    | null;
  messageAr?: string | null;
};

export function isOrderChatEligible(_status: OrderStatus): boolean {
  return false;
}

export async function fetchButcherChatAccess(
  butcherId: string,
  accessToken?: string | null,
): Promise<ButcherChatAccess> {
  const headers: HeadersInit = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};
  const res = await fetch(`${API_BASE}/api/butchers/${butcherId}/chat-access`, {
    headers,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    return {
      allowed: false,
      reason: 'order_not_accepted',
      messageAr:
        json.messageAr ||
        json.message ||
        'المحادثة متاحة بعد تقديم الطلب وقبوله من الملحمة',
    };
  }
  return json.data as ButcherChatAccess;
}

export function butcherChatRouteParams(input: {
  butcherId: string;
  receiverId?: string | null;
  receiverName?: string;
  receiverAvatar?: string;
  orderId?: string | null;
}) {
  return {
    pathname: '/butchers/chat' as const,
    params: {
      butcherId: input.butcherId,
      threadType: 'BUTCHER',
      ...(input.receiverId ? { receiverId: input.receiverId } : {}),
      ...(input.receiverName ? { receiverName: input.receiverName } : {}),
      ...(input.receiverAvatar ? { receiverAvatar: input.receiverAvatar } : {}),
      ...(input.orderId ? { orderId: input.orderId } : {}),
    },
  };
}
