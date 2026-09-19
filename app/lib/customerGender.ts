export const CUSTOMER_GENDERS = ['MALE', 'FEMALE'] as const;

export type CustomerGender = (typeof CUSTOMER_GENDERS)[number];

export const CUSTOMER_GENDER_LABELS: Record<CustomerGender, string> = {
  MALE: 'ذكر',
  FEMALE: 'أنثى',
};

export function parseCustomerGender(value: unknown): CustomerGender | null {
  if (value === 'MALE' || value === 'FEMALE') return value;
  if (value === 'ذكر') return 'MALE';
  if (value === 'أنثى') return 'FEMALE';
  return null;
}

export function isCustomerGender(value: unknown): value is CustomerGender {
  return parseCustomerGender(value) !== null;
}
