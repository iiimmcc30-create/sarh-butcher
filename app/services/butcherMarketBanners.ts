import { API_BASE } from '@/services/api';

export type ButcherMarketBanner = {
  id: string;
  slot: number;
  titleAr: string;
  subtitleAr: string;
  captionAr: string;
  imageUrl: string;
};

export async function fetchButcherMarketBanners(): Promise<ButcherMarketBanner[]> {
  try {
    const res = await fetch(`${API_BASE}/api/butcher-banners`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success || !Array.isArray(json.data?.banners)) return [];
    return json.data.banners.map((b: Record<string, unknown>) => ({
      id: String(b.id),
      slot: Number(b.slot) || 0,
      titleAr: String(b.titleAr || ''),
      subtitleAr: String(b.subtitleAr || ''),
      captionAr: String(b.captionAr || ''),
      imageUrl: String(b.imageUrl || ''),
    }));
  } catch {
    return [];
  }
}
