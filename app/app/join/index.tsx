import { AppText, SarhButton, SarhInput } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { SarhLogoMark } from '@/components/ui/SarhLogoMark';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { ButcherLocationPicker } from '@/components/feature/ButcherLocationPicker';
import { API_BASE } from '@/services/api';
import { radius, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { SARH_BUTCHER_LOGIN_URL } from '@/constants/sarhOfficial';
import {
  DOCUMENT_TYPE_LABELS,
} from '@/lib/butcherApplicationLabels';
import {
  maxBytesLabelForDocumentType,
  validatePickedDocumentFile,
} from '@/lib/butcherApplicationValidation';
import {
  pickApplicationDocument,
  type PickedApplicationFile,
} from '@/lib/pickApplicationDocument';
import { hasValidCoords } from '@/lib/butcherLocation';
import type { ButcherApplicationDocumentType } from '@/services/butcherApplicationTypes';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

const SAUDI_DIAL = '+966';

const REQUIRED_DOCS: ButcherApplicationDocumentType[] = [
  'commercial_license',
  'national_id',
  'municipal_permit',
  'shop_photo',
];

function envelopeData(json: Record<string, unknown>) {
  if (json && json.success && json.data && typeof json.data === 'object') {
    return json.data as Record<string, unknown>;
  }
  return json;
}

async function appendJoinFile(
  form: FormData,
  field: string,
  file: PickedApplicationFile,
) {
  if (Platform.OS === 'web') {
    const res = await fetch(file.localUri);
    const blob = await res.blob();
    form.append(field, blob, file.originalFileName);
    return;
  }
  form.append(field, {
    uri: file.localUri,
    name: file.originalFileName,
    type: file.mimeType,
  } as never);
}

export default function ButcherJoinScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors: c }) => createStyles(c));

  const [phoneDigits, setPhoneDigits] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isNewUser, setIsNewUser] = useState(true);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accountUsername, setAccountUsername] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showAccountPasswordConfirm, setShowAccountPasswordConfirm] = useState(false);

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [commercialReg, setCommercialReg] = useState('');
  const [cityAr, setCityAr] = useState('');
  const [city, setCity] = useState('');
  const [addressAr, setAddressAr] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [bioAr, setBioAr] = useState('');
  const [bioEn, setBioEn] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [openTime, setOpenTime] = useState('06:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [docs, setDocs] = useState<Partial<Record<ButcherApplicationDocumentType, PickedApplicationFile>>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmAccuracy, setConfirmAccuracy] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  const fullPhone = useMemo(() => {
    const digits = phoneDigits.replace(/\D/g, '').replace(/^0/, '');
    return `${SAUDI_DIAL}${digits}`;
  }, [phoneDigits]);

  const phoneValid =
    phoneDigits.replace(/\D/g, '').replace(/^0/, '').length === 9 &&
    phoneDigits.replace(/\D/g, '').replace(/^0/, '').startsWith('5');

  async function sendOtp() {
    setError('');
    if (!phoneValid) {
      setError('أدخل رقم جوال سعودي صحيح يبدأ بـ 5');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, channel: 'sms' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(json.messageAr ?? json.message_ar ?? 'فشل إرسال رمز التحقق'));
        return;
      }
      setOtpSent(true);
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError('');
    if (!/^\d{6}$/.test(otp)) {
      setError('أدخل رمز التحقق المكوّن من 6 أرقام');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, code: otp, purpose: 'join' }),
      });
      const json = await res.json().catch(() => ({}));
      const data = envelopeData(json);
      if (!res.ok) {
        setError(String(json.messageAr ?? json.message_ar ?? 'رمز التحقق غير صحيح'));
        return;
      }
      const token = String(data.phone_token ?? '');
      if (!token) {
        setError('تعذّر التحقق من الجوال');
        return;
      }
      setPhoneToken(token);
      setIsNewUser(Boolean(data.is_new_user));
      if (!shopPhone) setShopPhone(fullPhone);
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  async function pickDoc(type: ButcherApplicationDocumentType) {
    setError('');
    const picked = await pickApplicationDocument();
    if (!picked) return;
    const issue = validatePickedDocumentFile(
      type,
      picked.mimeType ?? 'application/octet-stream',
      picked.fileSizeBytes,
    );
    if (issue) {
      setError(issue.message);
      return;
    }
    setDocs((prev) => ({ ...prev, [type]: picked }));
  }

  async function submit() {
    setError('');
    setUploadStatus('');
    if (!phoneToken) {
      setError('تحقق من رقم الجوال أولاً');
      return;
    }
    if (!acceptedTerms) {
      setError('يجب الموافقة على الشروط');
      return;
    }
    if (!confirmAccuracy) {
      setError('يجب تأكيد صحة البيانات');
      return;
    }
    if (!accountUsername.trim()) {
      setError('اسم مستخدم حساب الملحمة مطلوب');
      return;
    }
    if (!accountPassword) {
      setError('كلمة المرور مطلوبة');
      return;
    }
    if (!accountPasswordConfirm) {
      setError('تأكيد كلمة المرور مطلوب');
      return;
    }
    if (accountPassword !== accountPasswordConfirm) {
      setError('تأكيد كلمة المرور غير مطابق');
      return;
    }
    if (!hasValidCoords(lat, lng)) {
      setError('يجب تحديد موقع المحل على الخريطة');
      return;
    }
    for (const type of REQUIRED_DOCS) {
      const file = docs[type];
      if (!file) {
        setError('مستند مطلوب غير مرفوع');
        return;
      }
      const issue = validatePickedDocumentFile(
        type,
        file.mimeType ?? 'application/octet-stream',
        file.fileSizeBytes,
      );
      if (issue) {
        setError(issue.message);
        return;
      }
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('phone', fullPhone);
      form.append('phone_token', phoneToken);
      form.append('displayName', displayName.trim());
      form.append('arabicName', displayName.trim());
      if (email.trim()) form.append('email', email.trim());
      if (isNewUser) form.append('username', username.trim().toLowerCase());
      if (isNewUser && password) form.append('password', password);
      form.append('nameAr', nameAr.trim());
      form.append('nameEn', nameEn.trim());
      form.append('shopPhone', shopPhone.trim() || fullPhone);
      form.append('commercialReg', commercialReg.trim());
      form.append('country', 'SA');
      form.append('city', city.trim());
      form.append('cityAr', cityAr.trim());
      form.append('address', address.trim() || addressAr.trim());
      form.append('addressAr', addressAr.trim());
      form.append('lat', String(lat));
      form.append('lng', String(lng));
      if (bioAr.trim()) form.append('bioAr', bioAr.trim());
      if (bioEn.trim()) form.append('bioEn', bioEn.trim());
      if (specialties.trim()) form.append('specialties', specialties.trim());
      form.append('openTime', openTime);
      form.append('closeTime', closeTime);
      form.append('acceptedTerms', 'true');
      form.append('confirmAccuracy', 'true');
      form.append('accountUsername', accountUsername.trim().toLowerCase());
      if (accountEmail.trim()) form.append('accountEmail', accountEmail.trim().toLowerCase());
      form.append('accountPassword', accountPassword);
      form.append('accountPasswordConfirm', accountPasswordConfirm);
      for (const type of REQUIRED_DOCS) {
        await appendJoinFile(form, type, docs[type]!);
      }
      if (docs.other) await appendJoinFile(form, 'other', docs.other);
      setUploadStatus('جاري رفع المستندات وإرسال الطلب...');
      const res = await fetch(`${API_BASE}/api/butcher-applications/join`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      const data = envelopeData(json);
      if (!res.ok) {
        setError(String(json.messageAr ?? json.message_ar ?? 'تعذّر إرسال الطلب'));
        return;
      }
      router.replace({
        pathname: '/join/success',
        params: {
          n: String(data.applicationNumber ?? ''),
          name: String(data.nameAr ?? nameAr),
        },
      });
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setUploadStatus('');
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard pattern={false} style={styles.screen}>
      <LinearGradient
        colors={[colors.bgDeep, colors.bgPrimary, colors.bgDeep]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${colors.emerald}2E`, 'transparent']}
        style={styles.glow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
      />
      <ScreenBody width="form" padTop="lg" padBottom="xxxl" gap="section">
        <Stack gap="sm" align="center">
          <SarhLogoMark size={64} color={colors.textPrimary} />
          <AppText variant="caption" style={styles.kicker}>سرح للمنشآت</AppText>
          <AppText variant="display" align="center">انضمام الملاحم</AppText>
          <AppText variant="body" color="textSecondary" align="center" style={styles.lead}>
            قدّم طلب انضمام رسمي إلى منصة سرح بنفس متطلبات نموذج الملاحم داخل التطبيق.
          </AppText>
        </Stack>

        <Stack gap="sm" style={styles.card}>
          <AppText variant="heading3">1. التحقق من الجوال</AppText>
          <Row gap="sm" align="center">
            <AppText variant="body" color="textSecondary">{SAUDI_DIAL}</AppText>
            <SarhInput
              value={phoneDigits}
              onChangeText={setPhoneDigits}
              keyboardType="phone-pad"
              placeholder="5xxxxxxxx"
              ltr
              containerStyle={styles.inputFlex}
            />
          </Row>
          {otpSent ? (
            <Stack gap="md">
              <SarhInput
                label="رمز التحقق"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                ltr
              />
              <SarhButton
                title="تأكيد الرمز"
                fullWidth
                loading={loading}
                onPress={verifyOtp}
              />
            </Stack>
          ) : (
            <SarhButton
              title="إرسال رمز التحقق"
              fullWidth
              loading={loading}
              onPress={sendOtp}
            />
          )}
          {phoneToken ? (
            <AppText variant="caption" color="success">تم التحقق من الجوال</AppText>
          ) : null}
        </Stack>

        <Stack gap="sm" style={styles.card}>
          <AppText variant="heading3">2. بيانات صاحب الطلب</AppText>
          <SarhInput
            label="الاسم"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="الاسم الكامل"
          />
          <SarhInput
            label="البريد الإلكتروني (اختياري)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@example.com"
            ltr
          />
          {isNewUser ? (
            <>
              <SarhInput
                label="اسم المستخدم"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="latin_username"
                ltr
              />
              <SarhInput
                label="كلمة المرور (اختياري)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                ltr
              />
            </>
          ) : null}
        </Stack>

        <Stack gap="sm" style={styles.card}>
          <AppText variant="heading3">3. بيانات الملحمة</AppText>
          <SarhInput label="اسم الملحمة (عربي)" value={nameAr} onChangeText={setNameAr} />
          <SarhInput label="اسم الملحمة (إنجليزي)" value={nameEn} onChangeText={setNameEn} ltr />
          <SarhInput
            label="هاتف المحل"
            value={shopPhone}
            onChangeText={setShopPhone}
            keyboardType="phone-pad"
            ltr
          />
          <SarhInput
            label="السجل التجاري"
            value={commercialReg}
            onChangeText={setCommercialReg}
            ltr
          />
          <SarhInput label="المدينة" value={cityAr} onChangeText={setCityAr} />
          <SarhInput label="المدينة (إنجليزي)" value={city} onChangeText={setCity} ltr />
          <SarhInput
            label="العنوان"
            value={addressAr}
            onChangeText={setAddressAr}
            placeholder="الحي، الشارع"
          />
          <SarhInput label="العنوان (إنجليزي)" value={address} onChangeText={setAddress} ltr />
        </Stack>

        <Stack gap="sm" style={styles.card}>
          <AppText variant="heading3">حساب الملحمة</AppText>
          <AppText variant="caption" color="textMuted">
            هذه البيانات لحساب الملحمة عند قبول الطلب. حسابك الحالي يبقى كما هو.
          </AppText>
          <SarhInput
            label="اسم المستخدم"
            value={accountUsername}
            onChangeText={setAccountUsername}
            autoCapitalize="none"
            placeholder="latin_username"
            ltr
          />
          <SarhInput
            label="البريد الإلكتروني (اختياري)"
            value={accountEmail}
            onChangeText={setAccountEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="shop@example.com"
            ltr
          />
          <SarhInput
            label="كلمة المرور"
            value={accountPassword}
            onChangeText={setAccountPassword}
            secureTextEntry={!showAccountPassword}
            placeholder="••••••••"
            ltr
            trailingIcon={showAccountPassword ? 'eye-off-outline' : 'eye-outline'}
            onTrailingPress={() => setShowAccountPassword((v) => !v)}
            accessibilityLabel={showAccountPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          />
          <SarhInput
            label="تأكيد كلمة المرور"
            value={accountPasswordConfirm}
            onChangeText={setAccountPasswordConfirm}
            secureTextEntry={!showAccountPasswordConfirm}
            placeholder="••••••••"
            ltr
            trailingIcon={showAccountPasswordConfirm ? 'eye-off-outline' : 'eye-outline'}
            onTrailingPress={() => setShowAccountPasswordConfirm((v) => !v)}
            accessibilityLabel={showAccountPasswordConfirm ? 'إخفاء تأكيد كلمة المرور' : 'إظهار تأكيد كلمة المرور'}
          />
        </Stack>

        <Stack gap="sm" style={styles.card}>
          <AppText variant="heading3">4. بيانات الموقع</AppText>
          <ButcherLocationPicker
            lat={hasValidCoords(lat, lng) ? lat : null}
            lng={hasValidCoords(lat, lng) ? lng : null}
            onChange={({ lat: nextLat, lng: nextLng }) => {
              setLat(nextLat);
              setLng(nextLng);
            }}
          />
        </Stack>

        <Stack gap="sm" style={styles.card}>
          <AppText variant="heading3">5. النشاط وأوقات العمل</AppText>
          <SarhInput
            label="نبذة عربية (اختياري)"
            value={bioAr}
            onChangeText={setBioAr}
            multiline
            style={styles.multiline}
          />
          <SarhInput
            label="نبذة إنجليزية (اختياري)"
            value={bioEn}
            onChangeText={setBioEn}
            multiline
            ltr
            style={styles.multiline}
          />
          <SarhInput
            label="التخصصات (اختياري)"
            value={specialties}
            onChangeText={setSpecialties}
            placeholder="لحم بقري، غنم"
          />
          <Row gap="md">
            <View style={styles.col}>
              <SarhInput label="الفتح" value={openTime} onChangeText={setOpenTime} ltr />
            </View>
            <View style={styles.col}>
              <SarhInput label="الإغلاق" value={closeTime} onChangeText={setCloseTime} ltr />
            </View>
          </Row>
        </Stack>

        <Stack gap="sm" style={styles.card}>
          <AppText variant="heading3">6. المستندات المطلوبة</AppText>
          <AppText variant="caption" color="textMuted">المسموح: PDF أو JPG أو PNG أو WEBP.</AppText>
          {[...REQUIRED_DOCS, 'other' as const].map((type) => {
            const picked = docs[type];
            const required = type !== 'other';
            return (
              <Pressable
                key={type}
                style={styles.fileBtn}
                onPress={() => void pickDoc(type)}
                accessibilityRole="button"
                accessibilityLabel={`رفع ${DOCUMENT_TYPE_LABELS[type]}`}
              >
                <AppText variant="label">
                  {DOCUMENT_TYPE_LABELS[type]}
                  {required ? ' *' : ' (اختياري)'}
                </AppText>
                <AppText variant="caption" color="textMuted">حتى {maxBytesLabelForDocumentType(type)}</AppText>
                <AppText variant="caption" color={picked ? 'success' : 'textMuted'}>
                  {picked ? picked.originalFileName : 'اختيار ملف'}
                </AppText>
              </Pressable>
            );
          })}
        </Stack>

        <Pressable onPress={() => setAcceptedTerms((v) => !v)}>
          <Row gap="md" align="start">
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxOn]} />
            <AppText variant="bodySmall" color="textSecondary" style={styles.checkText}>
              أوافق على الشروط ومراجعة الطلب من فريق سرح.
            </AppText>
          </Row>
        </Pressable>
        <Pressable onPress={() => setConfirmAccuracy((v) => !v)}>
          <Row gap="md" align="start">
            <View style={[styles.checkbox, confirmAccuracy && styles.checkboxOn]} />
            <AppText variant="bodySmall" color="textSecondary" style={styles.checkText}>
              أؤكد أن البيانات والمستندات صحيحة.
            </AppText>
          </Row>
        </Pressable>

        {uploadStatus ? (
          <AppText variant="caption" color="success">{uploadStatus}</AppText>
        ) : null}
        {error ? (
          <AppText variant="caption" color="danger" align="center">{error}</AppText>
        ) : null}

        <SarhButton
          title="إرسال طلب الانضمام"
          fullWidth
          loading={loading}
          onPress={() => void submit()}
        />
        <Pressable
          onPress={() => void Linking.openURL(SARH_BUTCHER_LOGIN_URL)}
          accessibilityRole="link"
        >
          <AppText variant="label" align="center" style={styles.loginLink}>
            لديك حساب ملحمة؟ تسجيل الدخول
          </AppText>
        </Pressable>
        <AppText variant="caption" color="textMuted" align="center">
          لن يتم إنشاء حساب دفترة في هذه المرحلة.
        </AppText>
      </ScreenBody>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.bgDeep },
    glow: { position: 'absolute', top: 0, start: 0, end: 0, height: 280 },
    kicker: { color: colors.gold, letterSpacing: 1 },
    lead: { maxWidth: 520 },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.xxl,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 16,
    },
    inputFlex: { flex: 1 },
    multiline: { minHeight: 84 },
    col: { flex: 1 },
    fileBtn: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.borderMid,
      borderRadius: radius.lg,
      padding: 12,
      gap: 4,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.borderMid,
      marginTop: 2,
    },
    checkboxOn: { backgroundColor: colors.emerald, borderColor: colors.emerald },
    checkText: { flex: 1 },
    loginLink: {
      color: colors.gold,
      textDecorationLine: 'underline',
    },
  });
}
