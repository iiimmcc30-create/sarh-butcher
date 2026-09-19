import { SidebarMenuItem } from '@/components/ui/SidebarMenuItem';
import { menuCardStyle } from '@/components/feature/SidebarMenu';
import { SidebarCloseHeader } from '@/components/feature/SidebarCloseHeader';
import { SidebarProfileRow } from '@/components/feature/SidebarProfileRow';
import { useRouter, useSegments } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppScrollView } from '@/components/ui/AppScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sarh } from '@/constants/sarhTokens';
import {
  panelSurfaceBg,
  spacing,
  typography,
  type ThemeColors,
} from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useAppUser } from '@/hooks/useApp';
import { borderInlineEnd } from '@/lib/rtl';
import { closeThenPush } from '@/lib/safeNavigate';

export type ButchersMarketMenuItem = {
  key: string;
  icon: string;
  label: string;
  route: string;
  matchRoutes?: string[];
};

export const BUTCHERS_MARKET_MENU: ButchersMarketMenuItem[] = [
  { key: 'home', icon: 'home-outline', label: 'الرئيسية', route: '/(tabs)' },
  {
    key: 'butchers',
    icon: 'storefront-outline',
    label: 'الملاحم',
    route: '/butchers',
    matchRoutes: ['/butchers', '/butchers/map'],
  },
  {
    key: 'orders',
    icon: 'bag-outline',
    label: 'طلباتي',
    route: '/butchers/my-orders',
    matchRoutes: ['/butchers/my-orders', '/butchers/order'],
  },
  {
    key: 'favorites',
    icon: 'heart-outline',
    label: 'تفضيلاتي',
    route: '/butchers/favorites',
  },
  {
    key: 'invoices',
    icon: 'receipt-outline',
    label: 'الفواتير',
    route: '/butchers/invoices',
    matchRoutes: ['/butchers/invoices', '/butchers/invoice'],
  },
  {
    key: 'register',
    icon: 'document-text-outline',
    label: 'سجل ملحمتك',
    route: '/join',
  },
  {
    key: 'support',
    icon: 'chatbubble-ellipses-outline',
    label: 'الدعم والمساعدة',
    route: '/support',
  },
  {
    key: 'privacy',
    icon: 'shield-outline',
    label: 'سياسة الخصوصية',
    route: '/info/privacy',
  },
];

type Props = {
  onClose: () => void;
};

function isItemActive(item: ButchersMarketMenuItem, path: string): boolean {
  const matches = item.matchRoutes ?? [item.route];
  return matches.some((route) => path === route || path.startsWith(`${route}/`));
}

export function ButchersMarketSidebarPanel({ onClose }: Props) {
  const router = useRouter();
  const segments = useSegments();
  const { me } = useAppUser();
  const { styles, colors } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors, theme.scheme),
    colors: theme.colors,
  }));
  const currentPath = `/${segments.join('/')}`;

  const handleNav = (route: string) => {
    // onClose = router.back via shell; closeThenPush handles back + guarded push
    closeThenPush(route, undefined, router);
  };

  return (
    <SafeAreaView
      style={[styles.panel, borderInlineEnd(StyleSheet.hairlineWidth, colors.borderMid)]}
      edges={['top', 'bottom']}
    >
      <SidebarCloseHeader onClose={onClose} colors={colors} />

      <SidebarProfileRow
        avatarUri={me.avatar}
        displayName={me.arabicName || me.displayName || me.username}
        username={me.username || 'user'}
        badgeLabel="قسم الملاحم"
        colors={colors}
        onPress={() => handleNav('/(tabs)/profile')}
      />

      <AppScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.menuCard}>
          {BUTCHERS_MARKET_MENU.map((item, index) => (
            <SidebarMenuItem
              key={item.key}
              icon={item.icon}
              title={item.label}
              active={isItemActive(item, currentPath)}
              showDivider={index < BUTCHERS_MARKET_MENU.length - 1}
              colors={colors}
              onPress={() => handleNav(item.route)}
            />
          ))}
        </View>
      </AppScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>سرح · سوق الملاحم</Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
  const panelBg = panelSurfaceBg(scheme, colors);

  return StyleSheet.create({
    panel: {
      width: '88%',
      maxWidth: 400,
      alignSelf: 'stretch',
      backgroundColor: panelBg,
      shadowColor: '#000',
      shadowOffset: { width: isDark ? -4 : -2, height: 0 },
      shadowOpacity: isDark ? 0.35 : 0.12,
      shadowRadius: isDark ? 16 : 20,
      elevation: 12,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingVertical: spacing.md,
      paddingBottom: spacing.lg,
    },
    menuCard: {
      marginHorizontal: spacing.lg,
      ...menuCardStyle(colors),
    },
    footer: {
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderMid,
      alignItems: 'center',
    },
    footerText: {
      ...typography.micro,
      color: colors.textMuted,
      writingDirection: 'rtl',
    },
  });
}

export default ButchersMarketSidebarPanel;
