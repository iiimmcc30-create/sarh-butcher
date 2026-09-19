/**
 * Admin sidebar for ملاحم سرح — butcher operations only.
 */
export type AdminNavItem = {
  href: string;
  label: string;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/', label: 'لوحة التحكم' },
  { href: '/health', label: 'صحة النظام' },
  { href: '/payments', label: 'المدفوعات' },
  { href: '/commissions', label: 'العمولات' },
  { href: '/users', label: 'المستخدمون' },
  { href: '/support', label: 'خدمة العملاء' },
  { href: '/butchers', label: 'الملاحم' },
  { href: '/butcher-banners', label: 'بنرات الملاحم' },
  { href: '/applications', label: 'طلبات الملاحم' },
  { href: '/orders', label: 'الطلبات' },
  { href: '/settings', label: 'الإعدادات' },
];

export const ADMIN_FEATURE_ROUTES = [
  '/login',
  '/',
  '/health',
  '/payments',
  '/commissions',
  '/users',
  '/users/[id]',
  '/support',
  '/support/faqs',
  '/support/tickets',
  '/support/tickets/[id]',
  '/support/verification',
  '/support/verification/[id]',
  '/butchers',
  '/butcher-banners',
  '/applications',
  '/orders',
  '/orders/[id]',
  '/settings',
] as const;

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
