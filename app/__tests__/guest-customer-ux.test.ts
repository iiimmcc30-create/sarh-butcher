import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveBootNavigation } from '@/lib/bootRouting';
import {
  isGuestCustomer,
  resolveCustomerAuthState,
  shouldHydrateCustomerApis,
} from '@/lib/customerAuthState';
import {
  CUSTOMER_GENDER_LABELS,
  parseCustomerGender,
} from '@/lib/customerGender';
import {
  customerUsernameFromPhone,
  nextCustomerUsername,
} from '@/lib/customerUsername';
import {
  cartIntentResumeHref,
  parsePendingCartIntent,
  requireCustomerForCart,
  serializePendingCartIntent,
  shouldApplyPendingCartIntent,
  type PendingCartIntent,
} from '@/lib/requireCustomerForCart';
import { interpretOtpVerifyResult } from '@/lib/otpVerifyOutcome';

const root = join(__dirname, '..');
const src = (rel: string) => readFileSync(join(root, rel), 'utf8');

const sampleIntent: PendingCartIntent = {
  butcherId: 'shop-a',
  butcherNameAr: 'ملحمة الاختبار',
  product: { id: 'p1', nameAr: 'ريش', price: 40 } as unknown as PendingCartIntent['product'],
  cutType: 'ribs' as PendingCartIntent['cutType'],
  weightRaw: '2',
};

describe('Guest mode', () => {
  it('launch sends guests to home, not login', () => {
    expect(
      resolveBootNavigation({
        authLoading: false,
        onboardingLoading: false,
        onboardingComplete: true,
        isAuthenticated: false,
        firstSegment: undefined,
      }),
    ).toEqual({ type: 'replace', href: '/butchers' });
  });

  it('classifies unauthenticated users as guests', () => {
    expect(resolveCustomerAuthState(false)).toBe('guest');
    expect(isGuestCustomer('guest')).toBe(true);
    expect(shouldHydrateCustomerApis('guest')).toBe(false);
  });
});

describe('Guest browsing', () => {
  it('keeps butcher, product, and more routes open', () => {
    for (const firstSegment of ['butchers', 'search', 'info', 'support']) {
      expect(
        resolveBootNavigation({
          authLoading: false,
          onboardingLoading: false,
          onboardingComplete: true,
          isAuthenticated: false,
          firstSegment,
        }),
      ).toEqual({ type: 'stay' });
    }
  });

  it('does not hydrate customer APIs for guests', () => {
    expect(src('contexts/AppContext.tsx')).toContain('if (!isAuthenticated || !accessToken)');
    expect(src('hooks/useNotifications.ts')).toContain('if (isLoading || !isAuthenticated || !user?.id)');
  });
});

describe('Cart authentication gate', () => {
  it('blocks add-to-cart for guests and allows customers', () => {
    expect(requireCustomerForCart(false)).toEqual({
      ok: false,
      reason: 'auth_required',
    });
    expect(requireCustomerForCart(true)).toEqual({ ok: true });
  });

  it('routes add-to-cart through a single guard', () => {
    const butcher = src('app/butchers/[id].tsx');
    expect(butcher).toContain('requireCustomerForCart');
    expect(butcher).toContain("router.push('/auth/customer'");
    expect(butcher).toContain('savePendingCartIntent');
  });
});

describe('Registration + existing customer', () => {
  it('collects name, gender, phone, then OTP', () => {
    const screen = src('app/auth/customer.tsx');
    expect(screen).toContain('لإضافة المنتجات إلى السلة، سجّل دخولك برقم الجوال.');
    expect(screen).toContain("step === 'name'");
    expect(screen).toContain("step === 'gender'");
    expect(screen).toContain("step === 'phone'");
    expect(screen).toContain("step === 'otp'");
    expect(CUSTOMER_GENDER_LABELS.MALE).toBe('ذكر');
    expect(CUSTOMER_GENDER_LABELS.FEMALE).toBe('أنثى');
    expect(parseCustomerGender('ذكر')).toBe('MALE');
  });

  it('existing phone + OTP is login, not a duplicate customer', () => {
    expect(interpretOtpVerifyResult({ success: true, isNew: false })).toEqual({
      kind: 'existing_login',
    });
    expect(src('app/auth/customer.tsx')).toContain("purpose = taken ? 'login' : 'signup'");
    expect(src('app/auth/customer.tsx')).toContain("verifyOtp(fullPhone, otpCode, 'login'");
  });

  it('builds a customer username from the verified phone', () => {
    expect(customerUsernameFromPhone('+966512345678')).toBe('c512345678');
    expect(nextCustomerUsername('c512345678', 1)).toContain('c512345678');
  });
});

describe('Intent preservation', () => {
  it('keeps butcher, product, and quantity then resumes the shop', () => {
    const raw = serializePendingCartIntent(sampleIntent);
    const parsed = parsePendingCartIntent(raw);
    expect(parsed?.product.id).toBe('p1');
    expect(parsed?.weightRaw).toBe('2');
    expect(cartIntentResumeHref(parsed)).toBe('/butchers/shop-a');
    expect(shouldApplyPendingCartIntent(parsed, 'shop-a')).toBe(true);
    expect(shouldApplyPendingCartIntent(parsed, 'other')).toBe(false);
  });

  it('adds the pending product after OTP', () => {
    const butcher = src('app/butchers/[id].tsx');
    expect(butcher).toContain('consumePendingCartIntent');
    expect(butcher).toContain('shouldApplyPendingCartIntent');
    expect(butcher).toContain('addLine({');
  });
});

describe('Profile + phone + notifications + support', () => {
  it('More lists profile, notifications, then customer service', () => {
    const more = src('app/butchers/more.tsx');
    const profileAt = more.indexOf('الملف الشخصي');
    const notifAt = more.indexOf('الإشعارات');
    const supportAt = more.indexOf('خدمة العملاء');
    expect(profileAt).toBeGreaterThan(-1);
    expect(notifAt).toBeGreaterThan(profileAt);
    expect(supportAt).toBeGreaterThan(notifAt);
    expect(more).toContain('/support');
  });

  it('profile edits name, gender, email, birth date and keeps phone read-only', () => {
    const profile = src('app/butchers/profile.tsx');
    expect(profile).toContain('الاسم');
    expect(profile).toContain('الجنس');
    expect(profile).toContain('البريد الإلكتروني');
    expect(profile).toContain('تاريخ الميلاد');
    expect(profile).toContain('رقم الجوال لا يمكن تغييره');
    expect(profile).not.toContain('change-phone');
    expect(profile).toContain('تم تحديث الملف الشخصي بنجاح');
  });

  it('notification toggle persists through privacy settings', () => {
    const settings = src('app/butchers/notification-settings.tsx');
    expect(settings).toContain('updatePrivacySettings');
    expect(settings).toContain('notificationsEnabled');
    expect(settings).toContain('BrandSwitch');
    expect(src('hooks/useNotifications.ts')).toContain('if (isLoading || !isAuthenticated || !user?.id)');
  });
});

describe('Security', () => {
  it('guest protected APIs stay JWT-gated', () => {
    expect(src('contexts/AppContext.tsx')).toContain('if (!isAuthenticated || !accessToken)');
    expect(requireCustomerForCart(false).ok).toBe(false);
  });
});
