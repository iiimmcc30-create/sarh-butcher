import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { bullRootConfig, isRedisEnabled, QUEUE_NAMES } from './constants';
import { AppNotificationsService } from './services/app-notifications.service';
import { EmailQueueService } from './services/email-queue.service';
import { ImageQueueService } from './services/image-queue.service';
import { NotificationPersistService } from './services/notification-persist.service';
import { NotificationQueueService } from './services/notification-queue.service';
import { PushQueueService } from './services/push-queue.service';
import { NotificationRepository } from './repositories/notification.repository';
import { WorkerCronRepository } from './repositories/worker-cron.repository';

const bullImports = isRedisEnabled()
  ? [
      BullModule.forRoot(bullRootConfig()),
      BullModule.registerQueue(
        { name: QUEUE_NAMES.NOTIFICATIONS },
        {
          name: QUEUE_NAMES.EMAILS,
          defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 },
        },
        {
          name: QUEUE_NAMES.PUSH,
          defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 },
        },
        {
          name: QUEUE_NAMES.IMAGE_PROCESSING,
          defaultJobOptions: { removeOnComplete: 20, removeOnFail: 50 },
        },
      ),
    ]
  : [];

@Global()
@Module({
  imports: [CommonModule, PrismaModule, RedisModule, ...bullImports],
  providers: [
    NotificationRepository,
    WorkerCronRepository,
    NotificationPersistService,
    NotificationQueueService,
    EmailQueueService,
    PushQueueService,
    ImageQueueService,
    AppNotificationsService,
  ],
  exports: [
    NotificationQueueService,
    EmailQueueService,
    PushQueueService,
    ImageQueueService,
    AppNotificationsService,
    NotificationPersistService,
    NotificationRepository,
    WorkerCronRepository,
  ],
})
export class QueueModule {}
