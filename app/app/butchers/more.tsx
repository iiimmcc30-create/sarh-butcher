// SAFAT — Butchers market "More" hub (المزيد) — user summary + section shortcuts
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SidebarMenuItem } from '@/components/ui/SidebarMenuItem';
import { ButchersTabBar } from '@/components/butchers/ButchersTabBar';
import { AppText } from '@/design-system/components';
import { Screen, ScreenBody } from '@/design-system/layout';
import { space } from '@/design-system/tokens';
import { type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAppUser } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { safePush } from '@/lib/safeNavigate';
import { StyleSheet, View } from 'react-native';
import { CoverTrailRow } from '@/components/ui/CoverTrailRow';

function formatPhone(phone?: string): string {
  if (!phone) return 'لم يتم إضافة رقم جوال';
  return phone;
}

export default function ButchersMoreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { me } = useAppUser();
  const { user } = useAuth();

  const displayName = me.arabicName || me.displayName || me.username || 'مستخدم سرح';
  const phone = user?.phone;

  const goRegister = () => {
    safePush('/join', undefined, router);
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader variant="screen" title="المزيد" />

      <ScreenBody gutter={false} padTop="md" padBottom="lg" gap="md">
        <View>
          <View style={styles.userRow}>
            <CoverTrailRow justify="flex-end" gap={10} style={styles.coverTrail}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="heading3" numberOfLines={1}>
                  {displayName}
                </AppText>
                <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.userPhone}>
                  {formatPhone(phone)}
                </AppText>
              </View>
              <View style={styles.avatarWrap}>
                {me.avatar ? (
                  <Image source={uriSource(me.avatar)} style={styles.avatar} contentFit="cover" />
                ) : (
                  <AppIcon name="person-outline" size={22} color={colors.textPrimary} />
                )}
              </View>
            </CoverTrailRow>
          </View>
        </View>

        <View style={styles.sectionLabelWrap}>
          <View style={{ width: '100%' }}>
            <AppText variant="label">حسابي</AppText>
          </View>
        </View>
        <View>
          <SidebarMenuItem
            icon="heart-outline"
            title="تفضيلاتي"
            subtitle="الملاحم المفضلة لديك"
            colors={colors}
            showDivider
            onPress={() => safePush('/butchers/favorites', undefined, router)}
          />
          <SidebarMenuItem
            icon="receipt-outline"
            title="الفواتير"
            subtitle="فواتير طلباتك المكتملة"
            colors={colors}
            showDivider={false}
            onPress={() => safePush('/butchers/invoices', undefined, router)}
          />
        </View>

        <View style={styles.sectionLabelWrap}>
          <View style={{ width: '100%' }}>
            <AppText variant="label">الخدمات والدعم</AppText>
          </View>
        </View>
        <View>
          <SidebarMenuItem
            icon="storefront-outline"
            title="سجّل ملحمتك"
            subtitle="انضم كشريك بائع في سرح"
            colors={colors}
            showDivider
            onPress={goRegister}
          />
          <SidebarMenuItem
            icon="chatbubble-ellipses-outline"
            title="الدعم والمساعدة"
            colors={colors}
            showDivider
            onPress={() => safePush('/support', undefined, router)}
          />
          <SidebarMenuItem
            icon="shield-outline"
            title="سياسة الخصوصية"
            colors={colors}
            showDivider={false}
            onPress={() => safePush('/info/privacy', undefined, router)}
          />
        </View>
      </ScreenBody>

      <ButchersTabBar active="more" />
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    userRow: {
      paddingHorizontal: space[16],
      paddingVertical: 14,
    },
    coverTrail: {
      width: '100%',
    },
    avatarWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgDeep,
      flexShrink: 0,
    },
    avatar: { width: '100%', height: '100%' },
    userPhone: {
      marginTop: 2,
    },
    sectionLabelWrap: {
      marginTop: space[4],
      paddingHorizontal: space[16],
    },
  });
}
