import { readFileSync } from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

function src(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('Sidebar + bottom nav + profile/settings flatten', () => {
  it('replaces المزيد with مجتمع سرح and keeps profile off the tab bar', () => {
    const tabs = src('components/navigation/FloatingTabBar.tsx');
    const layout = src('app/(tabs)/_layout.tsx');
    expect(tabs).toContain("label: 'مجتمع سرح'");
    expect(tabs).toContain("route: 'posts'");
    expect(tabs).not.toContain("route: 'profile'");
    expect(tabs).not.toContain("label: 'المزيد'");
    expect(tabs).not.toContain("label: 'الملف الشخصي'");
    expect(layout).toContain("title: 'مجتمع سرح'");
    expect(layout).toContain('name="more"');
    expect(layout).toContain('name="profile"');
    expect(layout).toMatch(/name="more"[\s\S]*href: null/);
    expect(layout).toMatch(/name="profile"[\s\S]*href: null/);
  });

  it('opens the existing sidebar route from the home avatar', () => {
    const home = src('app/(tabs)/index.tsx');
    const sidebar = src('app/sidebar.tsx');
    const panel = src('components/feature/AppSidebar.tsx');
    expect(home).toContain("safePush('/sidebar'");
    expect(sidebar).toContain('AppSidebar');
    expect(panel).toContain('الملف الشخصي');
    expect(panel).toContain('مركز المعلومات');
    expect(panel).toContain("route: '/settings/info'");
    expect(panel).toContain("route: '/support'");
    expect(panel).toContain("route: '/profile/settings'");
    expect(panel).toContain('weather-night');
    expect(panel).toContain('يتابع');
    expect(panel).toContain('متابعون');
    expect(panel).toContain('marginBottom: spacing.lg');
    expect(panel).not.toContain('menuCardStyle');
    expect(panel).not.toContain('خدمات الوزارة');
    expect(panel).not.toContain('/sarh-services');
  });

  it('slides the app sidebar in from the RTL start edge (right)', () => {
    const layout = src('app/_layout.tsx');
    const sidebarScreen = layout.match(
      /<Stack\.Screen\s+name="sidebar"[\s\S]*?\/>/,
    )?.[0];
    expect(sidebarScreen).toBeTruthy();
    expect(sidebarScreen).toContain("animation: 'none'");
    expect(sidebarScreen).toContain("presentation: 'transparentModal'");
    expect(sidebarScreen).not.toContain('stackSlideBackAnimation()');
    expect(src('lib/rtl.ts')).toContain(
      "return isAppRtl() ? 'slide_from_right' : 'slide_from_left'",
    );

    const sidebar = src('app/sidebar.tsx');
    expect(sidebar).toContain('new Animated.Value(0)');
    expect(sidebar).toContain('{ opacity: progress }');
    expect(sidebar).toContain('transform: [{ translateX }]');
    expect(sidebar).toContain('progress.interpolate');
    expect(sidebar).toContain("rgba(0,0,0,0.28)");
    expect(sidebar).toContain('isAppRtl() ? slideDistance : -slideDistance');
    expect(sidebar).not.toContain('LayoutAnimation');
  });

  it('flattens own-profile stats/tabs and removes settings icon entry', () => {
    const profile = src('app/(tabs)/profile.tsx');
    const layout = src('components/feature/ProfileScreenLayout.tsx');
    expect(profile).not.toContain('onSettings=');
    expect(layout).toContain("backgroundColor: 'transparent'");
    expect(layout).not.toContain('MENU_CARD');
  });

  it('uses flat settings sections', () => {
    const settings = src('components/feature/ProfileSettingsMenuScreen.tsx');
    expect(settings).toContain('SarhSettingsSection');
    expect(settings).toContain('SarhSettingsRow');
    expect(settings).not.toContain('menuCardStyle');
    expect(settings).not.toContain('variant="card"');
  });
});
