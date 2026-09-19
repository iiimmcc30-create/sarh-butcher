import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Local exemption for butcher order commission.
 * Replaces SARH plan permission `storeCommission`.
 * Default: not exempt → 10% on delivered paid orders.
 */
@Injectable()
export class ButcherCommissionPolicy {
  constructor(private readonly prisma: PrismaService) {}

  async isExemptForUser(userId: string): Promise<boolean> {
    const row = await this.prisma.butcher.findUnique({
      where: { userId },
      select: { commissionExempt: true },
    });
    return row?.commissionExempt === true;
  }
}
