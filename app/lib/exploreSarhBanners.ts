import type { ImageSourcePropType } from 'react-native';

const BUTCHERS_IMAGE = require('../assets/images/explore-sarh-butchers.jpg');
const FEED_IMAGE = require('../assets/images/explore-sarh-feed-suppliers.jpg');
const MINISTRY_IMAGE = require('../assets/images/explore-sarh-ministry.jpg');

export type ExploreSarhBannerView = {
  id: string;
  accessibilityLabel: string;
  href: string;
  image: ImageSourcePropType;
};

/** Temporary offline/API-failure fallback — same three local banners as before. */
export const FALLBACK_EXPLORE_SARH_BANNERS: ExploreSarhBannerView[] = [
  {
    id: 'fallback-butchers',
    image: BUTCHERS_IMAGE,
    accessibilityLabel: 'ملاحم سرح',
    href: '/butchers',
  },
  {
    id: 'fallback-feed-suppliers',
    image: FEED_IMAGE,
    accessibilityLabel: 'موردو الأعلاف',
    href: '/feed-suppliers',
  },
  {
    id: 'fallback-ministry',
    image: MINISTRY_IMAGE,
    accessibilityLabel: 'خدمات وزارة البيئة والمياه والزراعة',
    href: '/ministry',
  },
];

export function mapRemoteExploreSarhBanner(raw: {
  id?: unknown;
  imageUrl?: unknown;
  accessibilityLabel?: unknown;
  href?: unknown;
}): ExploreSarhBannerView | null {
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const imageUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : '';
  const accessibilityLabel =
    typeof raw.accessibilityLabel === 'string' ? raw.accessibilityLabel.trim() : '';
  const href = typeof raw.href === 'string' ? raw.href.trim() : '';
  if (!id || !imageUrl || !accessibilityLabel || !href.startsWith('/')) return null;
  return {
    id,
    accessibilityLabel,
    href,
    image: { uri: imageUrl },
  };
}
