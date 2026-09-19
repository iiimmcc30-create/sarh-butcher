import { useMemo, type ReactNode } from 'react';
import { snapshotTheme } from '@/constants/theme';
import { ThemeContext, useTheme } from '@/contexts/ThemeContext';

const butcherLight = snapshotTheme('light');

/**
 * Local light palette for the butchers tree.
 * Must not call `applyThemeScheme` — flipping the live theme remounts the
 * root navigator when `isDark` changes and blocks entry from Dark mode.
 *
 * `enabled={false}` keeps this Provider mounted and passes the parent theme
 * through. Chat lives under `/butchers/chat` (inbox, listing, profile) and
 * must inherit Light/Dark instead of butcher chrome.
 */
export function ButcherThemeScope({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const parent = useTheme();
  const value = useMemo(() => {
    if (!enabled) return parent;
    return {
      preference: parent.preference,
      scheme: 'light' as const,
      isDark: false,
      colors: butcherLight.colors,
      gradients: butcherLight.gradients,
      shadow: butcherLight.shadow,
      setPreference: parent.setPreference,
      setSchemeOverride: () => {},
    };
  }, [enabled, parent]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
