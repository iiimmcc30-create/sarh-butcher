import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { AppText, SarhButton, SarhInput } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { useAppUser } from '@/hooks/useApp';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
  CUSTOMER_GENDER_LABELS,
  type CustomerGender,
} from '@/lib/customerGender';
import { resolveCustomerAuthState } from '@/lib/customerAuthState';
import { showToast } from '@/lib/toast';
import { fetchAccountSettings, updateAccountSettings } from '@/services/users';
import { type ThemeColors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatLocalPhone(phone?: string | null): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('966') && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }
  return phone;
}

export default function CustomerProfileScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors: c }) => createStyles(c));
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { me, updateMe } = useAppUser();
  const guest = resolveCustomerAuthState(isAuthenticated) === 'guest';

  const [name, setName] = useState(me.arabicName || me.displayName || '');
  const [gender, setGender] = useState<CustomerGender | null>(null);
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (guest) return;
    void fetchAccountSettings().then((account) => {
      if (!account) return;
      setPhone(account.phone ?? user?.phone ?? '');
      setEmail(account.email ?? '');
      setBirthDate(account.birthDate ?? '');
      setGender(account.gender ?? null);
    });
  }, [guest, user?.phone]);

  const save = async () => {
    if (name.trim().length < 2) {
      void showToast('الاسم مطلوب', 'warning');
      return;
    }
    if (birthDate.trim() && !DOB_RE.test(birthDate.trim())) {
      void showToast('تاريخ الميلاد يجب أن يكون YYYY-MM-DD', 'warning');
      return;
    }
    setSaving(true);
    const trimmed = name.trim();
    const profile = await updateMe({ displayName: trimmed, arabicName: trimmed });
    const account = await updateAccountSettings(
      {
        email: email.trim() || null,
        birthDate: birthDate.trim() || null,
        gender,
        displayName: trimmed,
        arabicName: trimmed,
      },
      me.id,
    );
    setSaving(false);
    if (!profile.ok && !account.account) {
      void showToast(account.message || profile.error || 'تعذّر حفظ الملف', 'error');
      return;
    }
    void showToast('تم تحديث الملف الشخصي بنجاح', 'success');
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader variant="screen" title="الملف الشخصي" showBack />
      <ScreenBody padTop="lg" padBottom="xxl" gap="lg" width="form">
        {guest ? (
          <Stack gap="md">
            <AppText variant="heading3">زائر</AppText>
            <AppText variant="body" color="textMuted">
              سجّل دخولك برقم الجوال لإدارة ملفك الشخصي وإضافة المنتجات إلى السلة.
            </AppText>
            <SarhButton
              title="تسجيل الدخول"
              fullWidth
              onPress={() => router.push('/auth/customer' as never)}
            />
          </Stack>
        ) : (
          <Stack gap="lg">
            <SarhInput label="الاسم" value={name} onChangeText={setName} />
            <Stack gap="sm">
              <AppText variant="label">الجنس</AppText>
              <Row gap="md">
                {(['MALE', 'FEMALE'] as const).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setGender(value)}
                    style={[styles.choice, gender === value && styles.choiceActive]}
                  >
                    <AppText variant="body">{CUSTOMER_GENDER_LABELS[value]}</AppText>
                  </Pressable>
                ))}
              </Row>
            </Stack>
            <Stack gap="xs">
              <AppText variant="label">رقم الجوال</AppText>
              <AppText variant="heading3">{formatLocalPhone(phone)}</AppText>
              <AppText variant="caption" color="textMuted">
                رقم الجوال لا يمكن تغييره
              </AppText>
            </Stack>
            <SarhInput
              label="البريد الإلكتروني"
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <SarhInput
              label="تاريخ الميلاد"
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="YYYY-MM-DD"
            />
            <SarhButton title="حفظ" fullWidth loading={saving} onPress={() => void save()} />
          </Stack>
        )}
      </ScreenBody>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    choice: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    choiceActive: {
      borderColor: colors.electric,
      backgroundColor: colors.bgDeep,
    },
  });
}
