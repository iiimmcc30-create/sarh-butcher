import { useSubscription } from '@/contexts/SubscriptionContext';
import { useButcherOwnerAccess } from '@/hooks/useButcherOwnerAccess';
import type { PlanAudience } from '@/services/subscriptionPlans';

/** Effective plan catalog audience (butcher owners always use BUTCHER plans). */
export function useSubscriptionAudience(): PlanAudience {
  const { subscription } = useSubscription();
  const { isButcherOwner } = useButcherOwnerAccess();

  if (isButcherOwner || subscription.planAudience === 'BUTCHER') {
    return 'BUTCHER';
  }
  return 'USER';
}
