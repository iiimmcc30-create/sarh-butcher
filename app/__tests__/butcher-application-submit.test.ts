import { validateSubmitInput } from '../lib/butcherApplicationValidation';

describe('butcher application submit credentials', () => {
  const base = {
    acceptedTerms: true as const,
    confirmAccuracy: true as const,
    accountUsername: 'shop_user',
    password: 'secret1',
    confirmPassword: 'secret1',
  };

  it('accepts matching butcher-account passwords', () => {
    expect(validateSubmitInput(base).valid).toBe(true);
  });

  it('requires password and confirmation', () => {
    expect(
      validateSubmitInput({ ...base, password: '', confirmPassword: '' }).valid,
    ).toBe(false);
    expect(
      validateSubmitInput({ ...base, confirmPassword: 'other99' }).issues.some(
        (issue) => issue.field === 'confirmPassword',
      ),
    ).toBe(true);
  });

  it('does not treat plaintext password as a stored field on the client snapshot', () => {
    const result = validateSubmitInput(base);
    expect(JSON.stringify(result)).not.toContain('secret1');
  });
});
