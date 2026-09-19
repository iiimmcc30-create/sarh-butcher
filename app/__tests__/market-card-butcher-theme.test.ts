import { readFileSync } from 'fs';
import path from 'path';
import {
  applyThemeScheme,
  colors,
  getActiveScheme,
  snapshotTheme,
} from '@/constants/theme';
import { resolveSarhButtonColorsForScheme } from '@/design-system/components/resolvers';

const root = path.join(__dirname, '..');

function src(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('market listing card height', () => {
  it('keeps a fixed square thumb with rounded corners on both sides and no stretch', () => {
    const card = src('components/feature/ListingCard.tsx');
    const listBlock = card.slice(card.indexOf('listRow:'), card.indexOf('listPhotoCountText:'));
    expect(card).toContain('const LIST_THUMB = 120');
    expect(card).toContain('LIST_THUMB_RADIUS');
    expect(card).toContain('numberOfLines={2}');
    expect(listBlock).toContain("alignItems: 'flex-start'");
    expect(listBlock).toContain('aspectRatio: 1');
    expect(listBlock).toContain('height: LIST_THUMB');
    expect(listBlock).toContain('borderRadius: LIST_THUMB_RADIUS');
    expect(listBlock).not.toContain('borderTopEndRadius');
    expect(listBlock).not.toContain('borderBottomEndRadius');
    expect(listBlock).not.toContain('minHeight: 118');
    expect(listBlock).not.toContain("alignSelf: 'stretch'");
    expect(listBlock).not.toContain('flexGrow: 1');
    expect(listBlock).not.toContain('borderWidth');
    expect(listBlock).not.toContain('marginHorizontal');
  });
});

describe('butcher theme isolation', () => {
  afterEach(() => {
    applyThemeScheme('dark');
  });

  it('scopes light butcher chrome without flipping the live app scheme', () => {
    const layout = src('app/butchers/_layout.tsx');
    expect(layout).toContain('ButcherThemeScope');
    expect(layout).toContain('enabled={!isChat}');
    expect(layout).toContain('useSegments');
    expect(layout).not.toContain('setSchemeOverride');
    expect(layout).not.toContain('useFocusEffect');
    expect(layout).not.toMatch(/applyThemeScheme\(/);

    const scope = src('contexts/ButcherThemeScope.tsx');
    expect(scope).toContain("scheme: 'light'");
    expect(scope).toContain('snapshotTheme');
    expect(scope).toContain('enabled = true');
    expect(scope).toContain('if (!enabled) return parent');
    expect(scope).not.toMatch(/applyThemeScheme\(/);
    expect(scope).toContain('setSchemeOverride: () => {}');
  });

  it('keeps the root navigator wrapper stable across Light and Dark', () => {
    const rootLayout = src('app/_layout.tsx');
    expect(rootLayout).toContain('<SarhPatternBackground>{stack}</SarhPatternBackground>');
    expect(rootLayout).not.toContain('return stack');
  });

  it('snapshots light colors without mutating the live dark theme', () => {
    applyThemeScheme('dark');
    const before = colors.textPrimary;
    const snap = snapshotTheme('light');
    expect(snap.colors.textPrimary).toBe('#101820');
    expect(snap.colors.screenRoot).toBe('#FFFFFF');
    expect(snap.colors.bgField).toBe('#F1F3F5');
    expect(colors.textPrimary).toBe(before);
    expect(getActiveScheme()).toBe('dark');
    expect(resolveSarhButtonColorsForScheme('light', 'primary', 'default').backgroundColor).toBe(
      '#20B66F',
    );
    expect(resolveSarhButtonColorsForScheme('dark', 'primary', 'default').backgroundColor).toBe(
      '#FFFFFF',
    );
  });
});
