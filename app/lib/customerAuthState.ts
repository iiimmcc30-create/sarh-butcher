export type CustomerAuthState = 'guest' | 'authenticated';

export function resolveCustomerAuthState(isAuthenticated: boolean): CustomerAuthState {
  return isAuthenticated ? 'authenticated' : 'guest';
}

export function isGuestCustomer(state: CustomerAuthState): boolean {
  return state === 'guest';
}

export function shouldHydrateCustomerApis(state: CustomerAuthState): boolean {
  return state === 'authenticated';
}
