import { readFileSync } from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

function src(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('SarhButton label layout', () => {
  it('keeps short labels on one line without shrinking the text', () => {
    const button = src('design-system/components/SarhButton.tsx');
    expect(button).toContain('numberOfLines={1}');
    expect(button).toContain("flexWrap: 'nowrap'");
    expect(button).toContain('flexShrink: 0');
    expect(button).not.toContain('fontSize:');
  });
});

describe('Back control uses a single RTL icon helper', () => {
  it('shared back button only reads rtlBackIcon', () => {
    const back = src('design-system/components/SarhBackButton.tsx');
    expect(back).toContain('rtlBackIcon()');
    expect(back).not.toContain('scaleX');
    expect(back).not.toContain('row-reverse');
  });

  it('ScreenHeader uses the shared back button; butchers market exits left beside the cart', () => {
    const header = src('components/layout/ScreenHeader.tsx');
    const bar = src('components/butchers/ButchersAppBar.tsx');
    expect(header).toContain('SarhBackButton');
    expect(header).toContain('getRtlRow()');
    expect(bar).toContain('accessibilityLabel="رجوع للتطبيق"');
    expect(bar).toContain('angle-left');
    expect(bar).toContain('ButcherLocationBar');
    expect(bar.indexOf('ButcherLocationBar')).toBeLessThan(bar.indexOf('السلة'));
    expect(bar.indexOf('السلة')).toBeLessThan(bar.indexOf('رجوع للتطبيق'));
  });

  it('profile visitor back uses SarhBackButton instead of a raw icon', () => {
    const layout = src('components/feature/ProfileScreenLayout.tsx');
    expect(layout).toContain('SarhBackButton');
    expect(layout).not.toContain('rtlBackIcon');
  });
});
