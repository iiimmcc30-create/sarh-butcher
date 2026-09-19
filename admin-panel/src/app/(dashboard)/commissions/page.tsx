'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Breadcrumbs, PageState } from '@/components/ui/AdminChrome';
import { fetchDashboardStats, type DashboardStats } from '@/services/dashboard.service';
import { getStoredUser } from '@/services/auth.service';
import { Percent, Wallet } from 'lucide-react';

export default function CommissionsPage() {
  const user = getStoredUser();
  const isAdmin = user?.role === 'ADMIN';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    fetchDashboardStats()
      .then(setStats)
      .catch((e: Error) => setError(e.message));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <PageState
        kind="error"
        message="مركز العمولات متاح لمسؤول النظام (ADMIN) فقط"
      />
    );
  }

  if (error) return <PageState kind="error" message={error} />;
  if (!stats?.commission) {
    return <PageState kind="loading" message="جارٍ تحميل ملخص العمولات..." />;
  }

  const c = stats.commission;
  const orderRate = c.orderCommissionRatePercent ?? 10;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'لوحة التحكم', href: '/' },
          { label: 'العمولات' },
        ]}
      />
      <PageHeader
        title="مركز العمولات"
        description="عرض فقط — لا تعديل للنسب من هذه الشاشة"
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Order Commission"
          value={`${orderRate}%`}
          subtitle="عمولة الطلب المكتمل — delivered"
          icon={Percent}
          accent="blue"
        />
        <StatCard
          title="Order Commissions"
          value={`${(c.orderCommissionsTotal ?? 0).toLocaleString('ar-SA')} ر.س`}
          subtitle={`${c.orderCommissionsCount ?? 0} طلب مكتمل`}
          icon={Wallet}
          accent="blue"
        />
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-300">
        <h2 className="font-semibold text-white">مصدر الحقيقة</h2>
        <p>{c.noteAr}</p>
        <ul className="list-disc space-y-1 pr-5 text-slate-400">
          <li>
            الحساب في <code className="text-emerald-300">backend-nest/src/lib/commissions.ts</code>
          </li>
          <li>
            اكتمال الطلب = حالة <code>delivered</code> في OrderLifecycleService
          </li>
          <li>
            الإعفاء عبر <code>Butcher.commissionExempt</code> من تعديل الملحمة — ليس باقات سرح
          </li>
          <li>دفتر العمولة: <code>Payment(referenceType=order_commission)</code> والمعرّف <code>BOC-{'{orderId}'}</code></li>
          <li>النسبة الرقمية للطلب لا تُعرض في لوحة الملحمة أو تطبيق الموبايل</li>
        </ul>
      </div>
    </div>
  );
}
