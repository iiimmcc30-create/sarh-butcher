import { useButcherOwnerContext } from '@/contexts/ButcherOwnerContext';

/**
 * Whether the current user owns an active butcher shop (approved application or /butchers/me).
 * Backed by ButcherOwnerProvider — single fetch, deduped /api/butchers/me.
 */
export function useButcherOwnerAccess() {
  const ctx = useButcherOwnerContext();
  return {
    loading: ctx.loading,
    applications: ctx.applications,
    approvedApplication: ctx.approvedApplication,
    hasApprovedApplication: ctx.hasApprovedApplication,
    hasAnyApplication: ctx.hasAnyApplication,
    hasPendingApplication: ctx.hasPendingApplication,
    provisionedButcherId: ctx.provisionedButcherId,
    isButcherOwner: ctx.isButcherOwner,
    refresh: ctx.refresh,
  };
}
