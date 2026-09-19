export type BootNavState = {
  authLoading: boolean;
  onboardingLoading: boolean;
  onboardingComplete: boolean | null;
  isAuthenticated: boolean;
  firstSegment: string | undefined;
  postAuthHref?: string | null;
};

export type BootNavAction =
  | { type: 'wait' }
  | { type: 'stay' }
  | { type: 'replace'; href: string };

export function resolveBootNavigation(state: BootNavState): BootNavAction {
  if (state.authLoading || state.onboardingLoading) {
    return { type: 'wait' };
  }

  const seg = state.firstSegment;
  if (seg === 'expo-auth-session') {
    return { type: 'stay' };
  }

  const inOnboarding = seg === 'onboarding';
  const inAuth = seg === 'auth';
  const inJoin = seg === 'join';
  const inSarhTabs = seg === '(tabs)';
  const onRootIndex = !seg || seg === 'index';
  const marketHome = '/butchers';

  if (!state.onboardingComplete && !inOnboarding && !inJoin) {
    return { type: 'replace', href: '/onboarding' };
  }

  if (state.onboardingComplete && inOnboarding) {
    return { type: 'replace', href: marketHome };
  }

  if (state.isAuthenticated && inAuth) {
    return { type: 'replace', href: state.postAuthHref || marketHome };
  }

  if (onRootIndex || inSarhTabs) {
    return { type: 'replace', href: marketHome };
  }

  // Guests browse the marketplace. Login is only opened by an explicit action.
  return { type: 'stay' };
}
