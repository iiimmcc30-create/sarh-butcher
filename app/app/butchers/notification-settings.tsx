import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { BrandSwitch } from '@/components/feature/SidebarMenu';
import { useAuth } from '@/contexts/AuthContext';
import { AppText, SarhButton } from '@/design-system/components';
import { Screen, ScreenBody, Stack } from '@/design-system/layout';
import { useTheme } from '@/hooks/useTheme';
import { resolveCustomerAuthState } from '@/lib/customerAuthState';
import { showToast } from '@/lib/toast';
import {
  DEFAULT_PRIVACY_SETTINGS,
  fetchPrivacySettings,
  updatePrivacySettings,
} from '@/services/users';
import { registerForPushNotifications, syncPushToken } from '@/lib/notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

export default function CustomerNotificationSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const guest = resolveCustomerAuthState(isAuthenticated) === 'guest';
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (guest) return;
    void fetchPrivacySettings(user?.id).then((privacy) => {
      setEnabled(privacy.notificationsEnabled);
    });
  }, [guest, user?.id]);

  const persist = async (next: boolean) => {
    if (guest) return;
    setSaving(true);
    const result = await updatePrivacySettings(
      { notificationsEnabled: next },
      user?.id,
      { ...DEFAULT_PRIVACY_SETTINGS, notificationsEnabled: enabled },
    );
    setSaving(false);
    if (!result.settings) {
      void showToast(result.message || 'تعذّر حفظ الإشعارات', 'error');
      return;
    }
    setEnabled(result.settings.notificationsEnabled);
    if (next && user?.id) {
      await registerForPushNotifications();
      await syncPushToken(user.id);
    }
    void showToast(next ? 'تم تفعيل الإشعارات' : 'تم إيقاف الإشعارات', 'success');
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader variant="screen" title="الإشعارات" showBack />
      <ScreenBody padTop="lg" padBottom="xxl" gap="lg" width="form">
        {guest ? (
          <Stack gap="md">
            <AppText variant="body" color="textMuted">
              إشعارات الطلبات والحساب تظهر بعد تسجيل الدخول كعميل.
            </AppText>
            <SarhButton
              title="تسجيل الدخول"
              fullWidth
              onPress={() => router.push('/auth/customer' as never)}
            />
          </Stack>
        ) : (
          <Stack gap="md">
            <AppText variant="heading3">الإشعارات</AppText>
            <Stack gap="sm" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="body">الإشعارات</AppText>
              <BrandSwitch
                value={enabled}
                onValueChange={(next) => void persist(next)}
                colors={colors}
              />
            </Stack>
            {saving ? <AppText variant="caption" color="textMuted">جاري الحفظ…</AppText> : null}
          </Stack>
        )}
      </ScreenBody>
    </Screen>
  );
}
