import { snapshotTheme } from './theme';

/** Butchers-market chrome — dark keeps meat/mint; light follows app surface hierarchy. */
export const butcherMarket = {
  meatDark: '#3F2A26',
  mintDark: '#1E3326',
  searchDark: '#2A1C19',
  searchMintDark: '#16241C',
  seeAll: '#C43C3C',
  /** Meat-red CTA used by add-to-cart, delivery/pickup, and other market actions. */
  action: '#C43C3C',
  pin: '#2E9B57',
} as const;

const butcherLightSnapshot = snapshotTheme('light');

export type ButcherChromeTone = 'meat' | 'mint';

export function butcherChromeTone(bannerIndex: number): ButcherChromeTone {
  return bannerIndex % 2 === 0 ? 'meat' : 'mint';
}

export function butcherChromeBg(
  scheme: 'light' | 'dark',
  tone: ButcherChromeTone = 'meat',
): string {
  if (scheme === 'light') {
    return butcherLightSnapshot.colors.screenRoot;
  }
  if (tone === 'mint') {
    return butcherMarket.mintDark;
  }
  return butcherMarket.meatDark;
}

export function butcherMeatBg(scheme: 'light' | 'dark'): string {
  return butcherChromeBg(scheme, 'meat');
}

export function butcherSearchFill(
  scheme: 'light' | 'dark',
  tone: ButcherChromeTone = 'meat',
): string {
  if (scheme === 'light') {
    return butcherLightSnapshot.colors.bgField;
  }
  if (tone === 'mint') {
    return butcherMarket.searchMintDark;
  }
  return butcherMarket.searchDark;
}
