/** Stable customer username from a verified Saudi mobile. Backend still requires uniqueness. */
export function customerUsernameFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^966/, '').replace(/^0/, '');
  const core = digits.slice(-9).padStart(9, '0');
  return `c${core}`;
}

export function nextCustomerUsername(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  const suffix = attempt.toString(36).replace(/[^a-z0-9]/g, '').slice(0, 4);
  return `${base}${suffix || attempt}`;
}
