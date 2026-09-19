import {
  CUT_LABELS,
  type CutType,
  type OrderStatus,
} from '@/services/butcherData';
import type { ButcherOrderRecord } from '@/services/butcherOrders';
import {
  formatOrderLineQuantityPrefix,
  formatOrderQuantityLabel,
} from '@/lib/butcherProductQuantity';

export const CUSTOMER_ORDER_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivered',
];

export const CUSTOMER_FLOW_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'تم قبول الطلب',
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  delivered: 'مكتمل',
  cancelled: 'ملغي',
};

/** Same copy as OrderLifecycleService unpaid-order expiry. */
export const UNPAID_ORDER_EXPIRED_REASON =
  'انتهت مهلة الدفع لهذا الطلب وتم تحرير الكمية المحجوزة';

export function isPayableButcherOrder(order: {
  status?: string | null;
  paymentStatus?: string | null;
}): boolean {
  return (
    order.status === 'pending' &&
    (order.paymentStatus === 'unpaid' || order.paymentStatus === 'failed')
  );
}

export function isUnpaidOrderExpired(order: {
  status?: string | null;
  cancellationReason?: string | null;
}): boolean {
  return (
    order.status === 'cancelled' &&
    Boolean(order.cancellationReason) &&
    String(order.cancellationReason).includes('انتهت مهلة الدفع')
  );
}

export function customerOrderHeadline(order: {
  status?: string | null;
  paymentStatus?: string | null;
  cancellationReason?: string | null;
}): { label: string; awaitingPayment: boolean; expired: boolean } {
  if (isUnpaidOrderExpired(order)) {
    return { label: 'انتهت صلاحية الطلب', awaitingPayment: false, expired: true };
  }
  if (order.status === 'cancelled') {
    return { label: 'ملغي', awaitingPayment: false, expired: false };
  }
  if (order.status === 'delivered') {
    return { label: 'مكتمل', awaitingPayment: false, expired: false };
  }
  if (isPayableButcherOrder(order)) {
    return { label: 'بانتظار الدفع', awaitingPayment: true, expired: false };
  }
  if (order.paymentStatus === 'paid' && order.status === 'pending') {
    return { label: 'بانتظار قبول الملحمة', awaitingPayment: false, expired: false };
  }
  if (order.status === 'confirmed') {
    return { label: 'تم قبول الطلب', awaitingPayment: false, expired: false };
  }
  return {
    label: CUSTOMER_FLOW_LABELS[String(order.status ?? '')] ?? 'قيد الانتظار',
    awaitingPayment: false,
    expired: false,
  };
}

export function formatOrderDatePart(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ar-SA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatOrderTimePart(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatOrderStamp(iso?: string | null): string {
  const date = formatOrderDatePart(iso);
  const time = formatOrderTimePart(iso);
  if (date && time) return `${date} - ${time}`;
  return date || time;
}

export function orderProductSummary(order: ButcherOrderRecord): string {
  const items = order.items ?? [];
  if (items.length > 1) {
    const first = items[0]?.product?.nameAr ?? 'منتج';
    return `${first} + ${items.length - 1} أصناف`;
  }
  if (items.length === 1) {
    return items[0]?.product?.nameAr ?? order.product?.nameAr ?? 'منتج';
  }
  return order.product?.nameAr ?? '—';
}

export function orderSpecsLine(order: ButcherOrderRecord): string {
  const cut = CUT_LABELS[order.cutType as CutType]?.ar ?? order.cutType;
  const delivery = order.deliveryType === 'delivery' ? 'توصيل' : 'استلام';
  const quantity = formatOrderQuantityLabel(order.weightKg, order.product);
  return [quantity || null, cut, delivery].filter(Boolean).join(' • ');
}

export function firstProductImage(order: {
  product?: { images?: string[] };
  items?: Array<{ product?: { images?: string[] } }>;
}): string | undefined {
  const fromItem = order.items?.find((item) => item.product?.images?.[0])?.product?.images?.[0];
  return fromItem || order.product?.images?.[0];
}

export function orderLineItems(order: any): Array<{
  id: string;
  name: string;
  image?: string;
  weightKg: number;
  unitPrice: number;
  linePrice: number;
  quantity: number;
  quantityLabel: string;
  cutLabel: string;
}> {
  const currencyItems = Array.isArray(order?.items) ? order.items : [];
  if (currencyItems.length > 0) {
    return currencyItems.map((item: any, index: number) => {
      const weightKg = Number(item.weightKg || 0);
      const linePrice = Number(item.linePrice || 0);
      const quantityLabel = formatOrderLineQuantityPrefix(weightKg, item.product);
      const quantity = Number.parseInt(quantityLabel, 10);
      const unitPrice = weightKg > 0 ? linePrice / weightKg : linePrice;
      return {
        id: String(item.id ?? `${order.id}-line-${index}`),
        name: item.product?.nameAr ?? order.product?.nameAr ?? 'منتج',
        image: item.product?.images?.[0] ?? order.product?.images?.[0],
        weightKg,
        unitPrice,
        linePrice,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : Math.max(1, Math.round(weightKg) || 1),
        quantityLabel,
        cutLabel: CUT_LABELS[item.cutType as CutType]?.ar ?? item.cutType ?? '',
      };
    });
  }

  const weightKg = Number(order?.weightKg || 0);
  const linePrice = Number(order?.totalPrice || 0);
  const quantityLabel = formatOrderLineQuantityPrefix(weightKg, order?.product);
  const quantity = Number.parseInt(quantityLabel, 10);
  return [
    {
      id: String(order?.id ?? 'line'),
      name: order?.product?.nameAr ?? 'منتج',
      image: order?.product?.images?.[0],
      weightKg,
      unitPrice: weightKg > 0 ? linePrice / weightKg : linePrice,
      linePrice,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : Math.max(1, Math.round(weightKg) || 1),
      quantityLabel,
      cutLabel: CUT_LABELS[order?.cutType as CutType]?.ar ?? order?.cutType ?? '',
    },
  ];
}

export function orderMoneySummary(order: any): {
  subtotal: number;
  deliveryFee: number | null;
  total: number;
} {
  const items = orderLineItems(order);
  const itemSum = items.reduce((sum, item) => sum + item.linePrice, 0);
  const total = Number(order?.totalPrice || itemSum || 0);
  const rawFee = order?.deliveryFee ?? order?.deliveryPrice;
  const deliveryFee =
    rawFee == null || rawFee === '' ? null : Number(rawFee);
  const subtotal = itemSum > 0 ? itemSum : total;
  return {
    subtotal,
    deliveryFee: deliveryFee != null && Number.isFinite(deliveryFee) ? deliveryFee : null,
    total,
  };
}

export function timelineStamp(
  timeline: Array<{ status?: string; createdAt?: string }> | undefined,
  status: string,
  fallbackIso?: string,
): string {
  const hit = timeline?.find((event) => event.status === status);
  return formatOrderTimePart(hit?.createdAt ?? (status === 'pending' ? fallbackIso : undefined));
}

export function flowReached(order: { status?: string; timeline?: Array<{ status?: string }> }): Set<string> {
  const reached = new Set((order.timeline ?? []).map((event) => String(event.status)));
  const current = String(order.status ?? '');
  const currentIndex = CUSTOMER_ORDER_FLOW.indexOf(current as OrderStatus);
  if (currentIndex >= 0) {
    CUSTOMER_ORDER_FLOW.slice(0, currentIndex + 1).forEach((step) => reached.add(step));
  }
  return reached;
}
