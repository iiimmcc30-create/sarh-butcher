/**
 * Butcher UI typography — aliases global `typography` (weight-aware Tajawal).
 * `tab` / `tabActive` stay frozen for ButchersTabBar.
 */
import { APP_FONT_NAME } from '@/constants/fonts';
import { typography } from '@/constants/theme';

export { APP_FONT_NAME as BUTCHER_FONT };

export const butcherTabLabel = typography.tab;
export const butcherTabLabelActive = typography.tabActive;

export const butcherTypography = {
  tab: typography.tab,
  tabActive: typography.tabActive,
  title: typography.cardHeadingLarge,
  titleLarge: typography.sectionHeading,
  primary: typography.body,
  body: typography.body,
  secondary: typography.secondary,
  meta: typography.caption,
  emphasis: typography.emphasis,
  badge: typography.badge,
} as const;
