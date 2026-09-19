// Powered by OnSpace.AI
// SAFAT — Butchers Section (الملاحم) Data & Types

import { Country } from './types';
export type { Country };

export type ButcherType = 'regular' | 'verified';
export type MeatCategory = 'whole_livestock' | 'lamb' | 'beef' | 'camel' | 'chicken' | 'goat' | 'special_orders';
export type CutType = 'whole' | 'half' | 'quarter' | 'ribs' | 'leg' | 'shoulder' | 'neck' | 'liver' | 'mixed' | 'custom';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type DeliveryType = 'pickup' | 'delivery';
export type OrderPaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'قيد المراجعة',
  confirmed: 'تم قبول الطلب',
  preparing: 'جاري التجهيز',
  ready: 'جاهز للاستلام',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#F59E0B',
  confirmed: '#69D84F',
  preparing: '#06B6D4',
  ready: '#20B66F',
  delivered: '#22C55E',
  cancelled: '#EF4444',
};

export const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  unpaid: 'غير مدفوع',
  paid: 'مدفوع',
  failed: 'غير مدفوع',
  refunded: 'مسترد',
};

export function orderStatusLabel(
  status: OrderStatus,
  deliveryType?: DeliveryType,
): string {
  if (status === 'ready' && deliveryType === 'delivery') return 'جاري التوصيل';
  if (status === 'delivered' && deliveryType === 'pickup') return 'تم الاستلام';
  return ORDER_STATUS_LABELS[status] ?? status;
}

// ─── GCC Currencies ─────────────────────────────────────────────────────────
export const gccCurrencies: Record<Country, { code: string; symbol: string; name: string; nameAr: string }> = {
  SA: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', nameAr: 'ريال سعودي' },
  AE: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', nameAr: 'ريال سعودي' },
  KW: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', nameAr: 'ريال سعودي' },
  QA: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', nameAr: 'ريال سعودي' },
  BH: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', nameAr: 'ريال سعودي' },
  OM: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', nameAr: 'ريال سعودي' },
  EG: { code: 'EGP', symbol: 'ج.م', name: 'Egyptian Pound', nameAr: 'جنيه مصري' },
};

// ─── Butcher Profile ─────────────────────────────────────────────────────────
export interface ButcherProfile {
  id: string;
  name: string;
  nameAr: string;
  logo?: string;
  cover?: string;
  type: ButcherType;
  country: Country;
  city: string;
  cityAr: string;
  address: string;
  addressAr: string;
  lat: number;
  lng: number;
  phone: string;
  rating: number;
  reviewCount: number;
  orderCompletionRate: number;       // 0–100
  workingHours: WorkingHours;
  bio: string;
  bioAr: string;
  specialties: string[];             // e.g. ['ذبح يومي', 'خروف كامل']
  subscriptionActive: boolean;
  subscriptionExpiry?: string;       // ISO date
  commercialReg?: string;
  activityScore: number;             // 0–100 for ranking
  rankingScore?: number;
  favoritesCount?: number;
  completedOrdersCount?: number;
  totalOrders: number;
  joinedAt: string;
  user?: { id: string; username?: string; avatar?: string };
}

export interface WorkingHours {
  open: string;    // '06:00'
  close: string;   // '22:00'
  closedOn?: string[]; // ['Friday']
  isOpen: boolean;
}

// ─── Products ────────────────────────────────────────────────────────────────
export interface ButcherProduct {
  id: string;
  butcherId: string;
  name: string;
  nameAr: string;
  category: MeatCategory;
  images: string[];
  pricePerKg?: number;         // for cuts
  priceFixed?: number;         // for whole animals
  /** Daftra selling unit when synced from دفترة (e.g. كجم, قطعة). */
  saleUnit?: string;
  pricingNote?: string;
  pricingNoteAr?: string;
  availableCuts: CutType[];
  weightRange?: { min: number; max: number }; // kg
  inStock: boolean;
  freshness: 'fresh' | 'frozen' | 'chilled';
  description: string;
  descriptionAr: string;
  country: Country;
}

// ─── Offers ──────────────────────────────────────────────────────────────────
export interface ButcherOffer {
  id: string;
  butcherId: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  discountPercent?: number;
  bundleItems?: string[];        // product IDs
  originalPrice?: number;
  offerPrice?: number;
  image: string;
  validUntil: string;
  country: Country;
}

// ─── Stories ─────────────────────────────────────────────────────────────────
export interface ButcherStory {
  id: string;
  butcherId: string;
  butcherName: string;
  butcherNameAr: string;
  butcherLogo: string;
  isVerified: boolean;
  thumbnail: string;
  mediaUrl?: string;
  caption?: string;
  captionAr?: string;
  postedAt: string;
  duration: number;  // seconds
  seen: boolean;
  type: 'daily_slaughter' | 'offer' | 'new_stock' | 'update';
}

// ─── Orders ──────────────────────────────────────────────────────────────────
export interface ButcherOrder {
  id: string;
  butcherId: string;
  customerId: string;
  product: ButcherProduct;
  cutType: CutType;
  weightKg: number;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  status: OrderStatus;
  totalPrice: number;
  currency: string;
  notes?: string;
  createdAt: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text?: string;
  image?: string;
  video?: string;
  orderId?: string;
  createdAt: string;
  read: boolean;
}

export interface ChatThread {
  id: string;
  butcherId: string;
  customerId: string;
  lastMessage: ChatMessage;
  unreadCount: number;
}

// ─── Reviews ─────────────────────────────────────────────────────────────────
export interface ButcherReview {
  id: string;
  butcherId: string;
  authorName: string;
  authorNameAr: string;
  authorAvatar?: string;
  rating: number;
  comment: string;
  commentAr: string;
  postedAt: string;
}

export type ButcherRankingCategory =
  | 'rank'
  | 'rating'
  | 'favorites'
  | 'orders'
  | 'distance'
  | 'new';

export const BUTCHER_RANKING_TABS: { id: ButcherRankingCategory; label: string }[] = [
  { id: 'distance', label: 'الأقرب إليك' },
  { id: 'rating', label: 'الأعلى تقييماً' },
  { id: 'favorites', label: 'الأكثر تفضيلاً' },
  { id: 'orders', label: 'الأكثر طلباً' },
  { id: 'new', label: 'الملاحم الجديدة' },
];
export function mapButcherFromApi(b: Record<string, unknown>): ButcherProfile {
  const count = b._count as { orders?: number } | undefined;
  const user = b.user as { id?: string; username?: string; avatar?: string } | undefined;

  return {
    id: String(b.id ?? ''),
    name: String(b.nameAr || b.nameEn || ''),
    nameAr: String(b.nameAr || ''),
    logo: (b.logo as string | undefined) || undefined,
    cover: (b.cover as string | undefined) || undefined,
    type: (b.type as ButcherType) || 'regular',
    country: (b.country as Country) || 'SA',
    city: String(b.city || ''),
    cityAr: String(b.cityAr || ''),
    address: String(b.address || ''),
    addressAr: String(b.addressAr || ''),
    lat: Number(b.lat) || 0,
    lng: Number(b.lng) || 0,
    phone: String(b.phone || ''),
    rating: Number(b.rating ?? 5.0),
    reviewCount: Number(b.reviewCount ?? 0),
    orderCompletionRate: Number(b.orderCompletionRate ?? 100),
    workingHours: {
      open: String(b.openTime || '06:00'),
      close: String(b.closeTime || '22:00'),
      isOpen: Boolean(b.isOpen ?? true),
      closedOn: (b.closedDays as string[] | undefined) || [],
    },
    bio: String(b.bioEn || ''),
    bioAr: String(b.bioAr || ''),
    specialties: (b.specialties as string[]) || [],
    subscriptionActive: Boolean(b.subscriptionActive ?? false),
    subscriptionExpiry: b.subscriptionExpiry as string | undefined,
    commercialReg: b.commercialReg as string | undefined,
    activityScore: Number(b.activityScore ?? 50),
    rankingScore: Number(b.rankingScore ?? 0),
    favoritesCount: Number(b.favoritesCount ?? (b._count as { favorites?: number })?.favorites ?? 0),
    completedOrdersCount: Number(b.completedOrdersCount ?? count?.orders ?? b.totalOrders ?? 0),
    totalOrders: Number(b.completedOrdersCount ?? count?.orders ?? b.totalOrders ?? 0),
    joinedAt: String(b.createdAt || new Date().toISOString()),
    user: user?.id
      ? {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        }
      : undefined,
  };
}

export function rankButchers(butchers: ButcherProfile[]): ButcherProfile[] {
  return [...butchers].sort((a, b) => {
    const scoreA = a.rankingScore ?? 0;
    const scoreB = b.rankingScore ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    if ((b.completedOrdersCount ?? 0) !== (a.completedOrdersCount ?? 0)) {
      return (b.completedOrdersCount ?? 0) - (a.completedOrdersCount ?? 0);
    }
    if (b.rating !== a.rating) return b.rating - a.rating;
    if ((b.favoritesCount ?? 0) !== (a.favoritesCount ?? 0)) {
      return (b.favoritesCount ?? 0) - (a.favoritesCount ?? 0);
    }
    return b.activityScore - a.activityScore;
  });
}

export const CUT_LABELS: Record<CutType, { en: string; ar: string }> = {
  whole:    { en: 'Whole',     ar: 'كامل' },
  half:     { en: 'Half',      ar: 'نصف' },
  quarter:  { en: 'Quarter',   ar: 'ربع' },
  ribs:     { en: 'Ribs',      ar: 'ضلوع' },
  leg:      { en: 'Leg',       ar: 'ران' },
  shoulder: { en: 'Shoulder',  ar: 'كتف' },
  neck:     { en: 'Neck',      ar: 'رقبة' },
  liver:    { en: 'Liver',     ar: 'كبد' },
  mixed:    { en: 'Mixed',     ar: 'مشكل' },
  custom:   { en: 'Custom',    ar: 'حسب الطلب' },
};

export const CATEGORY_LABELS: Record<MeatCategory, { en: string; ar: string; icon: string }> = {
  whole_livestock: { en: 'Whole Livestock',  ar: 'ذبيحة كاملة',  icon: '🐑' },
  lamb:            { en: 'Lamb',             ar: 'خروف',          icon: '🍖' },
  beef:            { en: 'Beef',             ar: 'بقر',           icon: '🥩' },
  camel:           { en: 'Camel',            ar: 'جمل',           icon: '🫏' },
  chicken:         { en: 'Chicken',          ar: 'دجاج',          icon: '🍗' },
  goat:            { en: 'Goat',             ar: 'ماعز',          icon: '🐐' },
  special_orders:  { en: 'Special Orders',   ar: 'طلبات خاصة',   icon: '⭐' },
};

/** Normalize expo-router params that may arrive as string | string[]. */
export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function resolveSaleUnitFromApi(p: Record<string, unknown>): string | undefined {
  if (typeof p.saleUnit === 'string' && p.saleUnit.trim()) {
    return p.saleUnit.trim();
  }
  const link = p.daftraLink as { daftraSaleUnit?: string | null } | null | undefined;
  const fromLink = link?.daftraSaleUnit?.trim();
  return fromLink || undefined;
}

export function mapButcherProductFromApi(p: Record<string, unknown>): ButcherProduct {
  const cuts = Array.isArray(p.availableCuts)
    ? (p.availableCuts as string[]).filter(Boolean)
    : [];
  const images = Array.isArray(p.images)
    ? (p.images as string[]).filter((x) => typeof x === 'string' && x.length > 0)
    : [];

  return {
    id: String(p.id ?? ''),
    butcherId: String(p.butcherId ?? ''),
    name: String(p.nameAr || p.nameEn || 'منتج'),
    nameAr: String(p.nameAr || p.nameEn || 'منتج'),
    category: (p.category as MeatCategory) || 'lamb',
    images,
    pricePerKg: p.pricePerKg != null ? Number(p.pricePerKg) : undefined,
    priceFixed: p.priceFixed != null ? Number(p.priceFixed) : undefined,
    saleUnit: resolveSaleUnitFromApi(p),
    pricingNote: p.pricingNoteAr ? String(p.pricingNoteAr) : undefined,
    pricingNoteAr: p.pricingNoteAr ? String(p.pricingNoteAr) : undefined,
    availableCuts: (cuts.length ? cuts : ['whole']) as CutType[],
    weightRange:
      p.weightMin != null
        ? {
            min: Number(p.weightMin),
            max: Number(p.weightMax ?? p.weightMin),
          }
        : undefined,
    inStock: p.inStock !== false,
    freshness: (p.freshness as ButcherProduct['freshness']) || 'fresh',
    description: String(p.descriptionEn || ''),
    descriptionAr: String(p.descriptionAr || p.descriptionEn || ''),
    country: (p.country as Country) || 'SA',
  };
}

export function parseOrderWeightKg(raw: string, product?: ButcherProduct): number {
  const n = parseFloat(String(raw).replace(',', '.').trim());
  const fallback = product?.weightRange?.min ?? 1;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  const min = product?.weightRange?.min ?? 0.5;
  const max = product?.weightRange?.max ?? 999;
  return Math.round(Math.min(max, Math.max(min, n)) * 10) / 10;
}

export function cutLabelAr(cut: string): string {
  return CUT_LABELS[cut as CutType]?.ar ?? cut;
}
