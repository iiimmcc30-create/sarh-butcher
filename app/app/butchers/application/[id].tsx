// SAFAT — Butcher Application Detail (تفاصيل الطلب — قراءة فقط)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { EmptyState } from '@/components/butcherApplication/EmptyState';
import { LoadingState } from '@/components/butcherApplication/LoadingState';
import { StatusBadge } from '@/components/butcherApplication/StatusBadge';
import { TimelineItem } from '@/components/butcherApplication/TimelineItem';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { AppText, SarhButton } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { useButcherApplication } from '@/hooks/useButcherApplication';
import {
  applicationDisplayName,
  countryLabel,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  formatApplicationDate,
  formatApplicationDateTime,
} from '@/lib/butcherApplicationLabels';

import type { ApplicationDetail } from '@/services/butcherApplicationTypes';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap="xs">
      <AppText variant="bodySmall" color="textMuted">
        {label}
      </AppText>
      <AppText variant="body">{value}</AppText>
    </Stack>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  const d = useThemedStyles(({ colors }) => createDetailStyles(colors));
  return (
    <Stack gap="sm">
      <AppText variant="heading2" color="textSecondary">
        {title}
      </AppText>
      <Stack gap="md" style={d.sectionBody}>
        {children}
      </Stack>
    </Stack>
  );
}

export default function ButcherApplicationDetailScreen() {
  const s = useThemedStyles(({ colors }) => createScreenStyles(colors));
  const d = useThemedStyles(({ colors }) => createDetailStyles(colors));
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { get, loading, error } = useButcherApplication();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const applicationId = typeof id === 'string' ? id : id?.[0];

  const load = useCallback(async () => {
    if (!applicationId) return;
    const detail = await get(applicationId);
    setApplication(detail);
  }, [applicationId, get]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/phone');
      return;
    }
    if (!applicationId) return;
    (async () => {
      try {
        await load();
      } catch {
        // hook.error
      } finally {
        setInitialLoad(false);
      }
    })();
  }, [authLoading, isAuthenticated, applicationId, router, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch {
      // hook.error
    } finally {
      setRefreshing(false);
    }
  };

  const comments = useMemo(() => {
    if (!application) return [];
    const items: { id: string; text: string; at: string; actor: string }[] = [];
    if (application.rejectionReason) {
      items.push({
        id: 'rejection-reason',
        text: application.rejectionReason,
        at: application.rejectedAt ?? application.updatedAt,
        actor: 'الإدارة',
      });
    }
    for (const event of application.timeline) {
      if (event.action === 'COMMENT' && event.comment) {
        items.push({
          id: event.id,
          text: event.comment,
          at: event.createdAt,
          actor: event.actorUsername,
        });
      }
    }
    return items;
  }, [application]);

  if (authLoading || initialLoad) {
    return (
      <Screen edges={['top']} pattern={false}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <LoadingState message="جاري تحميل الطلب..." />
      </Screen>
    );
  }

  if (!applicationId) {
    return (
      <Screen edges={['top']} pattern={false}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <EmptyState
          title="طلب غير موجود"
          description="معرّف الطلب غير صالح."
          actionLabel="العودة"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  if (!application && !loading) {
    return (
      <Screen edges={['top']} pattern={false}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <EmptyState
          title="تعذّر تحميل الطلب"
          description={error ?? 'حاول مرة أخرى لاحقاً.'}
          actionLabel="إعادة المحاولة"
          onAction={load}
          icon="alert-circle-outline"
        />
      </Screen>
    );
  }

  if (!application) {
    return (
      <Screen edges={['top']} pattern={false}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <LoadingState />
      </Screen>
    );
  }

  const title = applicationDisplayName(application.nameAr, application.nameEn);

  return (
    <Screen edges={['top']} pattern={false}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <ScreenHeader
        variant="screen"
        title={`طلب #${application.applicationNumber}`}
        showBack
      />

      <ScreenBody
        gap="lg"
        padTop="lg"
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.glow} />
        }
      >
        <Stack gap="md" align="start">
          <AppText variant="heading1">{title}</AppText>
          <StatusBadge status={application.status} />
          <AppText variant="bodySmall" color="textMuted">
            أُنشئ {formatApplicationDate(application.createdAt)}
            {application.submittedAt
              ? ` · قُدّم ${formatApplicationDate(application.submittedAt)}`
              : ''}
          </AppText>
        </Stack>

        {application.status === 'APPROVED' && application.provisionedButcherId ? (
          <Row gap="md" align="center" style={s.provisionCard}>
            <AppIcon name="checkmark-circle" size={22} color={colors.success} />
            <Stack gap="xs" fill>
              <AppText variant="body" style={s.provisionTitle}>
                تم تفعيل ملحمتك
              </AppText>
              <AppText variant="bodySmall" color="textSecondary">
                يمكنك زيارة صفحة الملحمة من الزر أدناه.
              </AppText>
            </Stack>
            <SarhButton
              title="زيارة الملحمة"
              size="sm"
              variant="primary"
              onPress={() =>
                router.push({
                  pathname: '/butchers/[id]',
                  params: { id: application.provisionedButcherId! },
                })
              }
            />
          </Row>
        ) : null}

        <DetailSection title="البيانات الأساسية">
          <DetailRow label="اسم المحل" value={application.nameAr ?? application.nameEn ?? '—'} />
          <DetailRow label="هاتف المحل" value={application.shopPhone ?? '—'} />
          <DetailRow label="السجل التجاري" value={application.commercialReg ?? '—'} />
        </DetailSection>

        <DetailSection title="الموقع">
          <DetailRow label="الدولة" value={countryLabel(application.country)} />
          <DetailRow label="المدينة" value={application.city ?? '—'} />
          <DetailRow label="المدينة (عربي)" value={application.cityAr ?? '—'} />
          <DetailRow label="العنوان" value={application.address ?? '—'} />
          <DetailRow label="العنوان (عربي)" value={application.addressAr ?? '—'} />
          <DetailRow
            label="الإحداثيات"
            value={
              application.lat != null && application.lng != null
                ? `${application.lat.toFixed(5)}, ${application.lng.toFixed(5)}`
                : '—'
            }
          />
        </DetailSection>

        <DetailSection title="ساعات العمل">
          <DetailRow label="وقت الفتح" value={application.openTime || '—'} />
          <DetailRow label="وقت الإغلاق" value={application.closeTime || '—'} />
        </DetailSection>

        {(application.bioAr || application.specialties.length > 0) && (
          <DetailSection title="نبذة وتخصصات">
            {application.bioAr ? <DetailRow label="نبذة" value={application.bioAr} /> : null}
            {application.specialties.length > 0 ? (
              <DetailRow label="التخصصات" value={application.specialties.join(' · ')} />
            ) : null}
          </DetailSection>
        )}

        <DetailSection title="المستندات">
          {application.documents.length === 0 ? (
            <AppText variant="body" color="textMuted" align="center">
              لا توجد مستندات مرفوعة بعد.
            </AppText>
          ) : (
            application.documents.map((doc) => (
              <Row key={doc.id} align="start" gap="md" style={d.docRow}>
                <Stack gap="xs" fill>
                  <AppText variant="body">{DOCUMENT_TYPE_LABELS[doc.type]}</AppText>
                  <AppText variant="bodySmall" color="textMuted">
                    {doc.originalFileName ?? '—'}
                    {doc.fileSizeBytes
                      ? ` · ${(doc.fileSizeBytes / 1024).toFixed(0)} ك.ب`
                      : ''}
                  </AppText>
                  {doc.notes ? (
                    <AppText variant="bodySmall" style={d.docNotes}>
                      {doc.notes}
                    </AppText>
                  ) : null}
                </Stack>
                <View style={d.docBadge}>
                  <AppText variant="bodyMedium" style={d.docBadgeText}>
                    {DOCUMENT_STATUS_LABELS[doc.status]}
                  </AppText>
                </View>
              </Row>
            ))
          )}
        </DetailSection>

        {comments.length > 0 ? (
          <DetailSection title="التعليقات">
            {comments.map((c) => (
              <Stack key={c.id} gap="xs" style={d.commentRow}>
                <AppText variant="body">{c.text}</AppText>
                <AppText variant="bodySmall" color="textMuted">
                  {c.actor} · {formatApplicationDateTime(c.at)}
                </AppText>
              </Stack>
            ))}
          </DetailSection>
        ) : null}

        <DetailSection title="السجل الزمني">
          {application.timeline.length === 0 ? (
            <AppText variant="body" color="textMuted" align="center">
              لا توجد أحداث بعد.
            </AppText>
          ) : (
            application.timeline.map((event, index) => (
              <TimelineItem
                key={event.id}
                event={event}
                isLast={index === application.timeline.length - 1}
              />
            ))
          )}
        </DetailSection>

        {error ? (
          <AppText variant="bodySmall" color="danger" align="center">
            {error}
          </AppText>
        ) : null}

        {application.status === 'DRAFT' ? (
          <SarhButton
            title="متابعة التعديل"
            onPress={() =>
              router.push({
                pathname: '/butchers/application/edit/[id]',
                params: { id: application.id },
              })
            }
            style={s.footerBtn}
          />
        ) : null}

        <SarhButton
          title="العودة لطلباتي"
          variant="secondary"
          onPress={() => router.push('/butchers/my-application')}
          style={s.footerBtn}
        />
      </ScreenBody>
    </Screen>
  );
}

function createScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingBottom: spacing.huge,
    },
    provisionCard: {
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.35)',
      padding: spacing.lg,
    },
    provisionTitle: {
      color: colors.textBrandSuccess,
    },
    footerBtn: {
      marginTop: spacing.md,
    },
  });
}

function createDetailStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionBody: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.lg,
    },
    docRow: {
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderHairline,
    },
    docNotes: {
      color: colors.amber,
    },
    docBadge: {
      backgroundColor: colors.bgElevated,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    docBadgeText: {
      color: colors.textBrand,
    },
    commentRow: {
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderHairline,
    },
  });
}
