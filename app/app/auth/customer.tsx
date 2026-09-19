import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { AppText, SarhButton, SarhInput } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
  CUSTOMER_GENDER_LABELS,
  type CustomerGender,
} from '@/lib/customerGender';
import {
  customerUsernameFromPhone,
  nextCustomerUsername,
} from '@/lib/customerUsername';
import { interpretOtpVerifyResult } from '@/lib/otpVerifyOutcome';
import { peekPendingCartResumeHref } from '@/services/pendingCartIntent';
import { updateAccountSettings } from '@/services/users';
import { type ThemeColors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

const SAUDI_DIAL = '+966';
const AUTH_FORM_WIDTH = { maxWidth: 440, width: '100%', alignSelf: 'center' } as const;

type Step = 'gate' | 'name' | 'gender' | 'phone' | 'otp';

export default function CustomerCartAuthScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors: c }) => createStyles(c));
  const router = useRouter();
  const { sendOtp, verifyOtp, register, checkSignup } = useAuth();

  const [step, setStep] = useState<Step>('gate');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<CustomerGender | null>(null);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [existingPhone, setExistingPhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cleanPhoneDigits = phone.trim().replace(/\D/g, '').replace(/^0/, '');
  const fullPhone = `${SAUDI_DIAL}${cleanPhoneDigits}`;
  const isPhoneValid = cleanPhoneDigits.length >= 9 && cleanPhoneDigits.startsWith('5');

  const finish = async () => {
    const href = await peekPendingCartResumeHref();
    router.replace(href as never);
  };

  const applyProfileExtras = async () => {
    const name = displayName.trim();
    if (!name && !gender) return;
    await updateAccountSettings({
      ...(name ? { displayName: name, arabicName: name } : {}),
      ...(gender ? { gender } : {}),
    } as never);
  };

  const advanceFromPhone = async () => {
    setError('');
    if (!isPhoneValid) {
      setError('أدخل رقم جوال سعودي صحيح');
      return;
    }
    setLoading(true);
    const check = await checkSignup({ phone: fullPhone });
    const taken = Boolean(
      !check.success && (check.code === 'phone_taken' || check.error?.includes('مسجل')),
    );
    const purpose = taken ? 'login' : 'signup';
    const otp = await sendOtp(fullPhone, 'sms', purpose);
    setLoading(false);
    if (!otp.success) {
      setError(otp.error ?? 'تعذّر إرسال الرمز');
      return;
    }
    setExistingPhone(taken);
    setStep('otp');
  };

  const completeOtp = async () => {
    setError('');
    if (otpCode.length !== 6) {
      setError('أدخل رمز التحقق المكوّن من 6 أرقام');
      return;
    }
    setLoading(true);
    if (existingPhone) {
      const verified = await verifyOtp(fullPhone, otpCode, 'login');
      if (!verified.success) {
        setLoading(false);
        setError(verified.error ?? 'الرمز غير صحيح');
        return;
      }
      await applyProfileExtras();
      setLoading(false);
      await finish();
      return;
    }

    const verified = await verifyOtp(fullPhone, otpCode, 'signup');
    const otpFlow = interpretOtpVerifyResult(verified);
    if (otpFlow.kind === 'existing_login') {
      const login = await verifyOtp(fullPhone, otpCode, 'login');
      setLoading(false);
      if (!login.success) {
        setError(login.error ?? 'الرمز غير صحيح');
        return;
      }
      await applyProfileExtras();
      await finish();
      return;
    }
    if (otpFlow.kind !== 'registration_continuation') {
      setLoading(false);
      setError(otpFlow.kind === 'invalid' ? otpFlow.error : 'تعذّر التحقق من الرمز');
      return;
    }

    const baseUsername = customerUsernameFromPhone(fullPhone);
    let created = false;
    let lastError = '';
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const username = nextCustomerUsername(baseUsername, attempt);
      const result = await register({
        phone: fullPhone,
        phone_token: otpFlow.phoneToken,
        displayName: displayName.trim(),
        arabicName: displayName.trim(),
        username,
        country: 'SA',
        gender: gender ?? undefined,
      });
      if (result.success) {
        created = true;
        break;
      }
      lastError = result.error ?? 'فشل إنشاء الحساب';
      if (result.code !== 'username_taken' && !result.error?.includes('مستخدم')) {
        break;
      }
    }
    setLoading(false);
    if (!created) {
      setError(lastError);
      return;
    }
    await applyProfileExtras();
    await finish();
  };

  const title =
    step === 'gate'
      ? 'تسجيل الدخول'
      : step === 'name'
        ? 'الاسم'
        : step === 'gender'
          ? 'الجنس'
          : step === 'phone'
            ? 'رقم الجوال'
            : 'رمز التحقق';

  return (
    <Screen edges={['top', 'bottom']} keyboard pattern={false} style={styles.root}>
      <LinearGradient
        colors={[colors.bgDeep, colors.bgPrimary, colors.bgDeep]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenHeader
        variant="screen"
        title={title}
        showBack
        onBackPress={() => {
          if (step === 'otp') return setStep('phone');
          if (step === 'phone') return setStep('gender');
          if (step === 'gender') return setStep('name');
          if (step === 'name') return setStep('gate');
          if (router.canGoBack()) router.back();
          else router.replace('/butchers' as never);
        }}
      />
      <ScreenBody padTop="lg" padBottom="xxxl" gap="section" contentContainerStyle={AUTH_FORM_WIDTH}>
        {step === 'gate' ? (
          <Stack gap="lg">
            <AppText variant="heading3" align="center">
              لإضافة المنتجات إلى السلة، سجّل دخولك برقم الجوال.
            </AppText>
            <AppText variant="body" color="textMuted" align="center">
              يمكنك تصفح الملاحم والمنتجات كزائر. الحساب مطلوب فقط عند إضافة منتج إلى السلة.
            </AppText>
            <SarhButton title="متابعة" fullWidth onPress={() => setStep('name')} />
          </Stack>
        ) : null}

        {step === 'name' ? (
          <Stack gap="lg">
            <SarhInput
              label="الاسم"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="الاسم"
              autoComplete="name"
            />
            {error ? <AppText variant="caption" color="danger">{error}</AppText> : null}
            <SarhButton
              title="التالي"
              fullWidth
              onPress={() => {
                if (displayName.trim().length < 2) {
                  setError('الاسم مطلوب');
                  return;
                }
                setError('');
                setStep('gender');
              }}
            />
          </Stack>
        ) : null}

        {step === 'gender' ? (
          <Stack gap="lg">
            <AppText variant="body">الجنس</AppText>
            <Row gap="md">
              {(['MALE', 'FEMALE'] as const).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setGender(value)}
                  style={[styles.genderOption, gender === value && styles.genderOptionActive]}
                >
                  <AppText variant="body">{CUSTOMER_GENDER_LABELS[value]}</AppText>
                </Pressable>
              ))}
            </Row>
            {error ? <AppText variant="caption" color="danger">{error}</AppText> : null}
            <SarhButton
              title="التالي"
              fullWidth
              onPress={() => {
                if (!gender) {
                  setError('اختر الجنس');
                  return;
                }
                setError('');
                setStep('phone');
              }}
            />
          </Stack>
        ) : null}

        {step === 'phone' ? (
          <Stack gap="lg">
            <SarhInput
              label="رقم الجوال"
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/[^\d\s]/g, ''))}
              placeholder="05xxxxxxxx"
              keyboardType="phone-pad"
              maxLength={10}
              autoComplete="tel"
            />
            {error ? <AppText variant="caption" color="danger">{error}</AppText> : null}
            <SarhButton
              title="إرسال رمز التحقق"
              fullWidth
              loading={loading}
              onPress={() => void advanceFromPhone()}
            />
          </Stack>
        ) : null}

        {step === 'otp' ? (
          <Stack gap="lg">
            <AppText variant="body" color="textMuted" align="center">
              أدخل الرمز المرسل إلى {fullPhone}
            </AppText>
            <SarhInput
              label="رمز التحقق"
              value={otpCode}
              onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
            {error ? <AppText variant="caption" color="danger">{error}</AppText> : null}
            <SarhButton
              title="تحقق"
              fullWidth
              loading={loading}
              onPress={() => void completeOtp()}
            />
          </Stack>
        ) : null}
      </ScreenBody>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { backgroundColor: colors.bgDeep },
    genderOption: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgPrimary,
    },
    genderOptionActive: {
      borderColor: colors.electric,
      backgroundColor: colors.bgDeep,
    },
  });
}
