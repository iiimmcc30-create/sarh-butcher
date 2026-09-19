// SAFAT — Butcher Application Entry (بوابة تسجيل الملحمة)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LoadingState } from '@/components/butcherApplication/LoadingState';
import { radius, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useButcherApplication } from '@/hooks/useButcherApplication';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

import type { ApplicationSummary } from '@/services/butcherApplicationTypes';
import { AppText, SarhButton } from '@/design-system/components';
import { Row, Screen, ScreenBody } from '@/design-system/layout';
import { space } from '@/design-system/tokens';

function findActiveDraftOrSubmitted(apps: ApplicationSummary[]): ApplicationSummary | null {
  return (
    apps.find((a) => a.status === 'DRAFT' || a.status === 'SUBMITTED') ?? null
  );
}

function findApproved(apps: ApplicationSummary[]): ApplicationSummary | null {
  return apps.find((a) => a.status === 'APPROVED') ?? null;
}

export default function ButcherApplyScreen() {
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { list, createDraft, loading, error } = useButcherApplication();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [canStartNew, setCanStartNew] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/phone');
    }
  }, [authLoading, isAuthenticated, router]);

  const bootstrap = useCallback(async () => {
    if (!isAuthenticated) return;
    setBootstrapping(true);
    try {
      const result = await list({ limit: 10 });
      const apps = result.applications;

      const approved = findApproved(apps);
      if (approved) {
        if (approved.provisionedButcherId) {
          router.replace({
            pathname: '/butchers/[id]',
            params: { id: approved.provisionedButcherId },
          });
        } else {
          router.replace({
            pathname: '/butchers/application/[id]',
            params: { id: approved.id },
          });
        }
        return;
      }

      const active = findActiveDraftOrSubmitted(apps);
      if (active) {
        if (active.status === 'DRAFT') {
          router.replace({
            pathname: '/butchers/application/edit/[id]',
            params: { id: active.id },
          });
        } else {
          router.replace({
            pathname: '/butchers/application/[id]',
            params: { id: active.id },
          });
        }
        return;
      }

      // REJECTED / WITHDRAWN — allow creating a new application
      setCanStartNew(true);
    } catch {
      // Entry screen still shown; hook.error surfaces below.
      setCanStartNew(true);
    } finally {
      setBootstrapping(false);
    }
  }, [isAuthenticated, list, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    bootstrap();
  }, [authLoading, isAuthenticated, bootstrap]);

  const handleStart = async () => {
    try {
      const draft = await createDraft();
      router.replace({
        pathname: '/butchers/application/edit/[id]',
        params: { id: draft.id },
      });
    } catch {
      // error state handled by hook
    }
  };

  if (authLoading || bootstrapping) {
    return (
      <Screen edges={['top']} pattern={false}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <ScreenBody scroll={false}>
          <LoadingState message="جاري التحقق من طلباتك..." />
        </ScreenBody>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} pattern={false}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <ScreenHeader variant="screen" title="تسجيل ملحمة" showBack />

      <ScreenBody gutter={false} contentContainerStyle={styles.content}>
        <View style={styles.heroIcon}>
          <LinearGradient colors={gradients.electric} style={styles.heroIconInner}>
            <AppIcon name="storefront" size={40} color="#fff" />
          </LinearGradient>
        </View>

        <AppText variant="heading2" align="center" style={styles.title}>
          انضم كجزار في سرح
        </AppText>
        <AppText variant="body" color="textSecondary" align="center" style={styles.subtitle}>
          قدّم طلب تسجيل ملحمتك عبر نظام الطلبات الجديد. سنراجع بياناتك ومستنداتك ثم نفعّل حسابك
          كجزار بعد الموافقة.
        </AppText>

        <View style={styles.stepsCard}>
          {[
            { n: '١', t: 'إنشاء مسودة الطلب' },
            { n: '٢', t: 'إكمال البيانات والمستندات' },
            { n: '٣', t: 'مراجعة الإدارة والموافقة' },
          ].map((step) => (
            <Row key={step.n} align="center" gap="md">
              <View style={styles.stepNum}>
                <AppText variant="label" style={{ color: colors.textBrand }}>
                  {step.n}
                </AppText>
              </View>
              <AppText variant="body" style={styles.stepText}>
                {step.t}
              </AppText>
            </Row>
          ))}
        </View>

        {error ? (
          <Row align="center" gap="sm" style={styles.errorBox}>
            <AppIcon name="alert-circle-outline" size={18} color={colors.danger} />
            <AppText variant="caption" color="danger" style={styles.errorText}>
              {error}
            </AppText>
          </Row>
        ) : null}

        {canStartNew ? (
          <SarhButton
            title="ابدأ طلب التسجيل"
            onPress={handleStart}
            disabled={loading}
            style={styles.cta}
          />
        ) : null}

        <SarhButton
          title="عرض طلباتي السابقة"
          variant="ghost"
          onPress={() => router.push('/butchers/my-application')}
        />
      </ScreenBody>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      padding: space[20],
      paddingBottom: space[48],
      alignItems: 'center',
    },
    heroIcon: {
      marginBottom: space[20],
      marginTop: space[16],
    },
    heroIconInner: {
      width: 88,
      height: 88,
      borderRadius: radius.xxl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      marginBottom: space[12],
    },
    subtitle: {
      marginBottom: space[24],
    },
    stepsCard: {
      width: '100%',
      backgroundColor: colors.bgGlass,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: space[16],
      gap: space[12],
      marginBottom: space[24],
    },
    stepNum: {
      width: 28,
      height: 28,
      borderRadius: 16,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.borderMid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: {
      flex: 1,
    },
    errorBox: {
      backgroundColor: 'rgba(244, 63, 94, 0.12)',
      borderRadius: radius.md,
      padding: space[12],
      marginBottom: space[16],
      width: '100%',
    },
    errorText: {
      flex: 1,
    },
    cta: {
      width: '100%',
      marginBottom: space[16],
    },
  });
}
