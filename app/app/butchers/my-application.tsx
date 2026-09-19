// SAFAT — My Butcher Application (طلبي)
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { ApplicationCard } from '@/components/butcherApplication/ApplicationCard';
import { EmptyState } from '@/components/butcherApplication/EmptyState';
import { LoadingState } from '@/components/butcherApplication/LoadingState';
import { StatusBadge } from '@/components/butcherApplication/StatusBadge';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { AppText, SarhButton, SarhInput } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { useButcherApplication } from '@/hooks/useButcherApplication';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import {
  applicationDisplayName,
  formatApplicationDate,
} from '@/lib/butcherApplicationLabels';
import { confirmDestructive } from '@/lib/actionSheet';

import type { ApplicationSummary } from '@/services/butcherApplicationTypes';

function pickCurrentApplication(apps: ApplicationSummary[]): ApplicationSummary | null {
  if (apps.length === 0) return null;
  const priority: ApplicationSummary['status'][] = [
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN',
  ];
  for (const status of priority) {
    const found = apps.find((a) => a.status === status);
    if (found) return found;
  }
  return apps[0];
}

export default function MyButcherApplicationScreen() {
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const actionStyles = useThemedStyles(() => createActionStyles());
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { list, withdraw, loading, error } = useButcherApplication();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [showWithdrawInput, setShowWithdrawInput] = useState(false);

  const current = useMemo(() => pickCurrentApplication(applications), [applications]);

  const fetchApplications = useCallback(async () => {
    const result = await list({ limit: 20 });
    setApplications(result.applications);
  }, [list]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/phone');
      return;
    }
    (async () => {
      try {
        await fetchApplications();
      } catch {
        // hook.error
      } finally {
        setInitialLoad(false);
      }
    })();
  }, [authLoading, isAuthenticated, router, fetchApplications]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchApplications();
    } catch {
      // hook.error
    } finally {
      setRefreshing(false);
    }
  };

  const openDetails = (id: string) => {
    router.push({ pathname: '/butchers/application/[id]', params: { id } });
  };

  const openEdit = (id: string) => {
    router.push({ pathname: '/butchers/application/edit/[id]', params: { id } });
  };

  const confirmWithdraw = async () => {
    if (!current) return;
    const confirmed = await confirmDestructive(
      'سحب الطلب',
      'هل أنت متأكد من سحب طلب التسجيل؟',
      'سحب الطلب',
    );
    if (!confirmed) return;
    try {
      await withdraw(current.id, withdrawReason.trim() ? { reason: withdrawReason.trim() } : {});
      setWithdrawReason('');
      setShowWithdrawInput(false);
      await fetchApplications();
    } catch {
      // hook.error
    }
  };

  const renderActions = () => {
    if (!current) return null;

    switch (current.status) {
      case 'DRAFT':
        return (
          <>
            <SarhButton
              title="متابعة إكمال الطلب"
              onPress={() => openEdit(current.id)}
              style={actionStyles.btn}
            />
            <SarhButton
              title="عرض التفاصيل"
              variant="secondary"
              onPress={() => openDetails(current.id)}
              style={actionStyles.btn}
            />
          </>
        );
      case 'SUBMITTED':
        return (
          <>
            <SarhButton
              title="عرض التفاصيل"
              onPress={() => openDetails(current.id)}
              style={actionStyles.btn}
            />
            {showWithdrawInput ? (
              <SarhInput
                appearance="theme"
                label="سبب السحب (اختياري)"
                value={withdrawReason}
                onChangeText={setWithdrawReason}
                placeholder="اذكر سبب السحب إن رغبت"
                multiline
                maxLength={500}
                containerStyle={actionStyles.input}
              />
            ) : null}
            <SarhButton
              title={showWithdrawInput ? 'تأكيد سحب الطلب' : 'سحب الطلب'}
              variant="secondary"
              onPress={showWithdrawInput ? confirmWithdraw : () => setShowWithdrawInput(true)}
              style={actionStyles.btn}
              disabled={loading}
            />
          </>
        );
      case 'APPROVED':
        return (
          <>
            <SarhButton
              title="عرض التفاصيل"
              onPress={() => openDetails(current.id)}
              style={actionStyles.btn}
            />
            {current.provisionedButcherId ? (
              <SarhButton
                title="زيارة الملحمة"
                variant="primary"
                onPress={() =>
                  router.push({
                    pathname: '/butchers/[id]',
                    params: { id: current.provisionedButcherId! },
                  })
                }
                style={actionStyles.btn}
              />
            ) : null}
          </>
        );
      case 'REJECTED':
      case 'WITHDRAWN':
        return (
          <>
            <SarhButton
              title="عرض التفاصيل"
              onPress={() => openDetails(current.id)}
              style={actionStyles.btn}
            />
            <SarhButton
              title="تقديم طلب جديد"
              onPress={() => router.push('/butchers/apply')}
              style={actionStyles.btn}
            />
          </>
        );
      default:
        return null;
    }
  };

  if (authLoading || initialLoad) {
    return (
      <Screen edges={['top']} pattern={false}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} pattern={false}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <ScreenHeader variant="screen" title="طلب تسجيل الملحمة" showBack />

      <ScreenBody
        gap="lg"
        padTop="lg"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.glow} />
        }
      >
        {error ? (
          <View style={styles.errorBox}>
            <AppText variant="bodySmall" color="danger" align="center">
              {error}
            </AppText>
          </View>
        ) : null}

        {!current ? (
          <EmptyState
            title="لا يوجد طلب حالياً"
            description="لم تقدّم طلب تسجيل ملحمة بعد. ابدأ الآن لإنشاء مسودة طلبك."
            actionLabel="ابدأ طلب التسجيل"
            onAction={() => router.push('/butchers/apply')}
            icon="storefront-outline"
          />
        ) : (
          <>
            <Stack gap="md">
              <AppText variant="heading1">
                {applicationDisplayName(current.nameAr, current.nameEn)}
              </AppText>
              <StatusBadge status={current.status} />
            </Stack>

            <Stack gap="md" style={styles.datesCard}>
              <Row justify="between">
                <AppText variant="bodySmall" color="textMuted">
                  تاريخ الإنشاء
                </AppText>
                <AppText variant="body">{formatApplicationDate(current.createdAt)}</AppText>
              </Row>
              <View style={styles.divider} />
              <Row justify="between">
                <AppText variant="bodySmall" color="textMuted">
                  تاريخ التقديم
                </AppText>
                <AppText variant="body">{formatApplicationDate(current.submittedAt)}</AppText>
              </Row>
            </Stack>

            <ApplicationCard application={current} onPress={() => openDetails(current.id)} />

            <Stack gap="md" style={styles.actions}>
              {renderActions()}
            </Stack>

            {applications.length > 1 ? (
              <Stack gap="md" style={styles.history}>
                <AppText variant="heading2" color="textSecondary">
                  سجل الطلبات
                </AppText>
                {applications
                  .filter((a) => a.id !== current.id)
                  .map((app) => (
                    <ApplicationCard
                      key={app.id}
                      application={app}
                      onPress={() => openDetails(app.id)}
                    />
                  ))}
              </Stack>
            ) : null}
          </>
        )}
      </ScreenBody>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingBottom: spacing.huge,
      flexGrow: 1,
    },
    errorBox: {
      backgroundColor: 'rgba(244, 63, 94, 0.12)',
      borderRadius: 12,
      padding: spacing.md,
    },
    datesCard: {
      backgroundColor: colors.bgGlass,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.lg,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderHairline,
    },
    actions: {
      marginTop: spacing.sm,
    },
    history: {
      marginTop: spacing.lg,
    },
  });
}

function createActionStyles() {
  return StyleSheet.create({
    btn: { width: '100%' },
    input: { marginBottom: spacing.sm },
  });
}
