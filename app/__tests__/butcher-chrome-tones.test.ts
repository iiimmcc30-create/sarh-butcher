import {
  butcherChromeBg,
  butcherChromeTone,
  butcherMarket,
  butcherMeatBg,
  butcherSearchFill,
} from '@/constants/butcherMarket';
import { snapshotTheme } from '@/constants/theme';

describe('butcher chrome tones', () => {
  it('alternates only meat and mint from the banner index', () => {
    expect(butcherChromeTone(0)).toBe('meat');
    expect(butcherChromeTone(1)).toBe('mint');
    expect(butcherChromeTone(2)).toBe('meat');
    expect(butcherChromeTone(3)).toBe('mint');
  });

  it('uses the app light hierarchy in Light and meat/mint only in Dark', () => {
    const light = snapshotTheme('light').colors;
    expect(butcherChromeBg('light', 'meat')).toBe(light.screenRoot);
    expect(butcherChromeBg('light', 'mint')).toBe(light.screenRoot);
    expect(butcherMeatBg('light')).toBe(light.screenRoot);
    expect(butcherSearchFill('light', 'mint')).toBe(light.bgField);
    expect(butcherSearchFill('light')).toBe(light.bgField);
    expect(butcherChromeBg('dark', 'meat')).toBe(butcherMarket.meatDark);
    expect(butcherChromeBg('dark', 'mint')).toBe(butcherMarket.mintDark);
  });
});
