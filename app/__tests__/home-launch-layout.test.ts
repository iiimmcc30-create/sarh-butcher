import { readFileSync } from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

function src(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('home launch layout', () => {
  it('keeps Home section order: banner, quick access, latest listings', () => {
    const home = src('app/(tabs)/index.tsx');
    expect(home.indexOf('<ExploreSarhSection ref={bannerRef}')).toBeLessThan(home.indexOf('<HomeQuickAccess'));
    expect(home.indexOf('<HomeQuickAccess />')).toBeLessThan(home.indexOf('<HomeLatestListings ref={listingsRef}'));
    expect(home).not.toContain('<HomeFeedSuppliers');
    expect(home).not.toContain('<EditorialStoriesBar');
    expect(home).not.toContain('<HomeCommunityPosts');
    expect(home).toContain("safePush('/search'");
    expect(home).toContain("safePush('/sidebar'");
  });

  it('wires quick access to existing app routes and stays append-only', () => {
    const catalog = src('lib/homeQuickAccess.ts');
    const quick = src('components/feature/HomeQuickAccess.tsx');
    expect(catalog).toContain("key: 'services'");
    expect(catalog).toContain("key: 'favorites'");
    expect(catalog).toContain("key: 'feed-suppliers'");
    expect(catalog).toContain("label: 'الموردين'");
    expect(catalog).toContain("key: 'settings'");
    expect(catalog).toContain("pathname: '/ministry'");
    expect(catalog).toContain("tab: 'services'");
    expect(catalog).toContain("href: '/favorites'");
    expect(catalog).toContain("href: '/feed-suppliers'");
    expect(catalog).toContain("href: '/settings'");
    expect(catalog).toContain('HOME_QUICK_ACCESS_ITEMS');
    expect(quick).toContain('HOME_QUICK_ACCESS_ITEMS.map');
    expect(quick).toContain('horizontal');
    expect(quick).toContain('borderRadius: radius[12]');
    expect(src('app/ministry/index.tsx')).toContain("value === 'posts' || value === 'services'");
    expect(src('app/favorites.tsx')).toContain('export default function FavoritesScreen');
    expect(src('app/feed-suppliers/index.tsx')).toContain('export default function FeedSuppliersScreen');
    expect(src('app/settings/index.tsx')).toContain('export default function SettingsScreen');
  });

  it('keeps the hero on the existing explore-sarh banner CMS and CTA to /butchers', () => {
    const banner = src('components/feature/ExploreSarhSection.tsx');
    const catalog = src('lib/homeQuickAccess.ts');
    expect(banner).toContain('fetchExploreSarhBanners');
    expect(banner).not.toContain('FALLBACK_EXPLORE_SARH_BANNERS');
    expect(banner).toContain('useState<ExploreSarhBannerView[]>([])');
    expect(banner).toContain('HOME_BANNER_CTA_LABEL');
    expect(banner).not.toContain('safePush(banner.href');
    expect(banner).not.toContain('styles.title');
    expect(banner).not.toContain('styles.subtitle');
    expect(banner).not.toContain('styles.scrim');
    expect(banner).not.toContain('HOME_BANNER_SUBTITLE_AR');
    expect(banner).toContain("alignItems: 'flex-end'");
    expect(banner).toContain("variant={scheme === 'light' ? 'secondary' : 'inverse'}");
    expect(catalog).toContain("HOME_BANNER_CTA_HREF = '/butchers'");
    expect(catalog).toContain("HOME_BANNER_CTA_LABEL = 'تصفح الملاحم'");
    expect(src('app/butchers/index.tsx')).toContain('ButcherMarketBannerSlider');
  });

  it('shows ten latest market listings without changing ListingCard internals', () => {
    const catalog = src('lib/homeQuickAccess.ts');
    const listings = src('components/feature/HomeLatestListings.tsx');
    expect(catalog).toContain('HOME_LATEST_LISTINGS_LIMIT = 10');
    expect(listings).toContain('searchListingsPage');
    expect(listings).toContain('getBootstrappedListingsPage');
    expect(listings).toContain('HOME_LATEST_LISTINGS_LIMIT');
    expect(listings).toContain('listMode="market"');
    expect(listings).not.toContain('cardShell');
    expect(listings).toContain("pathname: '/listing/[id]'");
    expect(listings).toContain("safePush('/(tabs)/market'");
    expect(src('components/feature/ListingCard.tsx')).not.toContain('cardShell');
    expect(src('components/feature/ListingCard.tsx')).not.toContain("from '@/design-system'");
  });

  it('keeps feed suppliers off Home while preserving the existing screen and routes', () => {
    const catalog = src('lib/homeQuickAccess.ts');
    const section = src('components/feature/HomeFeedSuppliers.tsx');
    const sidebar = src('components/feature/AppSidebar.tsx');
    expect(catalog).toContain('HOME_FEED_SUPPLIERS_PREVIEW_LIMIT = 4');
    expect(section).toContain('fetchFeedSuppliers');
    expect(section).toContain('موردين الأعلاف');
    expect(section).toContain("pathname: '/feed-suppliers/[id]'");
    expect(section).toContain("safePush('/feed-suppliers'");
    expect(sidebar).toContain("route: '/feed-suppliers'");
    expect(sidebar).toContain('موردو الأعلاف');
    expect(sidebar).toContain("label: 'الترويج'");
    expect(sidebar).toContain("route: '/promote'");
    expect(sidebar).not.toContain('تعزيز سرح');
  });

  it('reorders settings account rows onto existing screens and drops the duplicate info hub', () => {
    const settings = src('app/settings/index.tsx');
    expect(settings).toContain("label: 'إدارة الملف الشخصي'");
    expect(settings).toContain("route: '/profile/edit'");
    expect(settings).toContain("label: 'التحقق من الحساب والأمان'");
    expect(settings).toContain("route: '/profile/settings'");
    expect(settings).toContain("label: 'تغيير كلمة المرور'");
    expect(settings).toContain("route: '/profile/settings/password'");
    expect(settings).toContain("label: 'المحظورين'");
    expect(settings).toContain("route: '/settings/blocked'");
    expect(settings).not.toContain("route: '/settings/info'");
    expect(settings).not.toContain("label: 'مركز المعلومات'");
    expect(src('app/profile/edit.tsx')).toContain('export default function EditProfileScreen');
    expect(src('app/profile/settings/index.tsx')).toContain('export default function ProfileSettingsScreen');
    expect(src('app/profile/settings/password.tsx')).toContain('currentPassword');
    expect(src('app/profile/settings/password.tsx')).toContain('newPassword');
    expect(src('app/settings/info.tsx')).toContain('export default function InfoCenterScreen');
  });

  it('hides Home chrome on scroll using the existing ScreenBody, not a second scroller', () => {
    const home = src('app/(tabs)/index.tsx');
    const body = src('design-system/layout/ScreenBody.tsx');
    expect(home).toContain('onScroll={onScroll}');
    expect(home).toContain('onScrollEndDrag={onScrollIdle}');
    expect(home).toContain('onMomentumScrollEnd={onScrollIdle}');
    expect(home).toContain('headerProgress');
    expect(home).toContain('useNativeDriver: true');
    expect(home).not.toContain('AppScrollView');
    expect(home).not.toContain('<ScrollView');
    expect(body).toContain('onScrollEndDrag');
    expect(body).toContain('onMomentumScrollEnd');
  });

  it('refreshes Home data on re-press of the focused Home tab without remounting', () => {
    const home = src('app/(tabs)/index.tsx');
    const banner = src('components/feature/ExploreSarhSection.tsx');
    const listings = src('components/feature/HomeLatestListings.tsx');
    const tabs = src('components/navigation/FloatingTabBar.tsx');
    expect(home).toContain('HOME_TAB_RESELECT_EVENT');
    expect(home).toContain('DeviceEventEmitter.addListener');
    expect(home).toContain('refreshBusyRef');
    expect(home).toContain('bannerRef.current?.refresh()');
    expect(home).toContain('listingsRef.current?.refresh()');
    expect(banner).toContain('fetchExploreSarhBanners(force ? { force: true }');
    expect(banner).toContain('inflightRef');
    expect(listings).toContain('refresh: () => load(true)');
    expect(listings).toContain('if (inflightRef.current) return');
    expect(tabs).toContain("routeName === 'index'");
    expect(tabs).toContain('DeviceEventEmitter.emit(HOME_TAB_RESELECT_EVENT)');
  });

  it('slides the existing tab bar indicator without changing tab routes or chrome', () => {
    const tabs = src('components/navigation/FloatingTabBar.tsx');
    expect(tabs).toContain("route: 'index'");
    expect(tabs).toContain("route: 'market'");
    expect(tabs).toContain("route: 'messages'");
    expect(tabs).toContain("route: 'posts'");
    expect(tabs).toContain('addBox');
    expect(tabs).toContain('indicatorX');
    expect(tabs).toContain('useNativeDriver: true');
    expect(tabs).not.toContain('SarhButton');
    expect(tabs).not.toContain('react-native-reanimated');
  });
});
