import { StyleSheet, type ViewStyle } from 'react-native';
import { MENU_CARD } from '@/components/feature/SidebarMenu';
import type { ColorScheme, ThemeColors } from '@/constants/theme';

/** Soft butcher cards — white surfaces on the page background in Light. */
export function butcherSoftCardStyle(
  colors: ThemeColors,
  _scheme: ColorScheme,
): ViewStyle {
  return {
    backgroundColor: colors.bgSurface,
    borderRadius: MENU_CARD.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  };
}
