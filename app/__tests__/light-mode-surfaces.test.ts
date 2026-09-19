import { readFileSync } from 'fs';
import path from 'path';
import { applyThemeScheme, colors as liveTheme, snapshotTheme } from '@/constants/theme';
import { butcherChromeBg, butcherSearchFill } from '@/constants/butcherMarket';
import { sarh } from '@/constants/sarhTokens';
import { ds } from '@/constants/designSystem';

const root = path.join(__dirname, '..');

function src(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('light mode surface hierarchy', () => {
  afterEach(() => {
    applyThemeScheme('dark');
  });

  it('maps page, card, field, chip, and border tiers from the central theme', () => {
    applyThemeScheme('light');
    expect(liveTheme.screenRoot).toBe('#FFFFFF');
    expect(liveTheme.bgSurface).toBe('#FFFFFF');
    expect(liveTheme.bgElevated).toBe('#FFFFFF');
    expect(liveTheme.bgField).toBe('#F1F3F5');
    expect(liveTheme.royal).toBe('#F3F4F5');
    expect(liveTheme.borderSoft).toBe('#E6E8EB');
  });

  it('keeps dark mode surfaces unchanged', () => {
    applyThemeScheme('dark');
    expect(liveTheme.screenRoot).toBe('#07131C');
    expect(liveTheme.bgSurface).toBe('#0C1C27');
    expect(liveTheme.bgField).toBe(liveTheme.bgElevated);
  });

  it('routes inputs and market search through bgField and chips through royal', () => {
    expect(src('design-system/components/SarhInput.tsx')).toContain('themeColors.bgField');
    expect(src('components/market/MarketAppBar.tsx')).toContain('backgroundColor: colors.bgField');
    expect(src('components/ui/filterChipAppearance.tsx')).toContain('colors.royal');
  });

  it('aligns butcher light chrome with the same hierarchy', () => {
    const light = snapshotTheme('light').colors;
    expect(butcherChromeBg('light', 'meat')).toBe(light.screenRoot);
    expect(butcherSearchFill('light')).toBe(light.bgField);
    expect(src('components/butchers/butcherSoftCard.ts')).toContain('backgroundColor: colors.bgSurface');
    expect(butcherChromeBg('dark', 'meat')).toBe('#3F2A26');
  });

  it('mirrors the light palette in sarhTokens and ds.light without duplicating dark values', () => {
    expect(sarh.color.lightBg).toBe('#F8F9FA');
    expect(sarh.color.lightField).toBe('#F1F3F5');
    expect(sarh.color.lightChip).toBe('#F3F4F5');
    expect(sarh.color.lightBorder).toBe('#E6E8EB');
    expect(ds.light.page).toBe('#F8F9FA');
    expect(ds.light.field).toBe('#F1F3F5');
    expect(ds.light.chip).toBe('#F3F4F5');
  });
});
