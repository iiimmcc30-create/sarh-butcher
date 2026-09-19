import { ButcherCommissionPolicy } from './butcher-commission.policy';

describe('ButcherCommissionPolicy', () => {
  it('is not exempt when no butcher row exists', async () => {
    const prisma = {
      butcher: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const policy = new ButcherCommissionPolicy(prisma as never);
    await expect(policy.isExemptForUser('u1')).resolves.toBe(false);
  });

  it('is not exempt by default', async () => {
    const prisma = {
      butcher: {
        findUnique: jest.fn().mockResolvedValue({ commissionExempt: false }),
      },
    };
    const policy = new ButcherCommissionPolicy(prisma as never);
    await expect(policy.isExemptForUser('u1')).resolves.toBe(false);
  });

  it('is exempt only when the local butcher flag is true', async () => {
    const prisma = {
      butcher: {
        findUnique: jest.fn().mockResolvedValue({ commissionExempt: true }),
      },
    };
    const policy = new ButcherCommissionPolicy(prisma as never);
    await expect(policy.isExemptForUser('u1')).resolves.toBe(true);
  });
});
