export type BootNavState = {
  authLoading: boolean;
  onboardingLoading: boolean;
  onboardingComplete: boolean | null;
  isAuthenticated: boolean;
  firstSegment: string | undefined;
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
  const inInfo = seg === 'info';
  const inJoin = seg === 'join';
  const inButchers = seg === 'butchers';
  const inPayment = seg === 'payment';
  const inSarhTabs = seg === '(tabs)';
  const onRootIndex = !seg || seg === 'index';
  const marketHome = '/butchers';

  if (!state.onboardingComplete && !inOnboarding && !inJoin) {
    return { type: 'replace', href: '/onboarding' };
  }

  if (state.onboardingComplete && inOnboarding) {
    return {
      type: 'replace',
      href: state.isAuthenticated ? marketHome : '/auth/welcome',
    };
  }

  if (state.isAuthenticated && inAuth) {
    return { type: 'replace', href: marketHome };
  }

  if (onRootIndex || inSarhTabs) {
    return { type: 'replace', href: marketHome };
  }

  if (
    !state.isAuthenticated &&
    !inAuth &&
    !inInfo &&
    !inOnboarding &&
    !inJoin &&
    !inButchers &&
    !inPayment
  ) {
    return { type: 'replace', href: '/auth/welcome' };
  }

  return { type: 'stay' };
}
