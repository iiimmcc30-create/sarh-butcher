import {
  isMenuPageMounted,
  MENU_PAGER_RENDER_WINDOW,
} from '@/components/butcher/ButcherMenuPager';

describe('ButcherMenuPager render window', () => {
  it('keeps the active page and one neighbor mounted for swipe', () => {
    expect(MENU_PAGER_RENDER_WINDOW).toBe(1);
    expect(isMenuPageMounted(0, 0)).toBe(true);
    expect(isMenuPageMounted(1, 0)).toBe(true);
    expect(isMenuPageMounted(2, 0)).toBe(false);
    expect(isMenuPageMounted(4, 5)).toBe(true);
    expect(isMenuPageMounted(5, 5)).toBe(true);
    expect(isMenuPageMounted(6, 5)).toBe(true);
    expect(isMenuPageMounted(3, 5)).toBe(false);
  });
});
