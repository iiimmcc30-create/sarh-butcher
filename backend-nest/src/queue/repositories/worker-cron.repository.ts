import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkerCronRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOverdueListingFees(take = 1000) {
    return this.prisma.listingFee.findMany({
      where: { status: 'pending', dueDate: { lt: new Date() } },
      select: { id: true, userId: true, commission: true },
      take,
    });
  }
}
