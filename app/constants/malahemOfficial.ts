/**
 * Public Malahem identity. Never fall back to the Sarh production hostname.
 * Site URL is empty until the operator sets EXPO_PUBLIC_APP_URL / MALAHEM_APP_URL.
 */
export const MALAHEM_BRAND_AR = 'ملاحم سرح';
export const MALAHEM_BRAND_EN = 'Malahem Sarh';
export const MALAHEM_LEGAL_OWNER = 'مؤسسة ماد يونيت للتجارة';
export const MALAHEM_SUPPORT_PHONE = '+966591298136';
export const MALAHEM_SUPPORT_PHONE_DISPLAY = '+966 591 298 136';

function trimUrl(value: string | undefined): string {
  return (value || '').trim().replace(/\/$/, '');
}

/** Empty until a dedicated Malahem domain exists. */
export const MALAHEM_PUBLIC_SITE = trimUrl(
  process.env.EXPO_PUBLIC_APP_URL || process.env.MALAHEM_APP_URL,
);

export const MALAHEM_PRIVACY_PATH = '/info/privacy';
export const MALAHEM_JOIN_PATH = '/join';

export function malahemSiteUrl(path = ''): string {
  if (!MALAHEM_PUBLIC_SITE) return '';
  const suffix = path.startsWith('/') ? path : path ? `/${path}` : '';
  return `${MALAHEM_PUBLIC_SITE}${suffix}`;
}

export const PRIVACY_POLICY_URL = malahemSiteUrl(MALAHEM_PRIVACY_PATH);
