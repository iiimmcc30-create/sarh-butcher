import { Module } from '@nestjs/common';
import { DaftraModule } from '../integrations/daftra/daftra.module';
import { EmailProcessor } from './processors/email.processor';
import { ImageProcessingProcessor } from './processors/image-processing.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { PushProcessor } from './processors/push.processor';
import { QueueModule } from './queue.module';
import { WorkerCronService } from './services/worker-cron.service';
import { WorkerHeartbeatService } from './services/worker-heartbeat.service';

/**
 * Standalone worker process graph. Kept out of queue.module.ts so
 * QueueModule does not import DaftraModule (DaftraModule already imports
 * QueueModule for EmailQueueService — a same-file cycle made QueueModule
 * undefined at DaftraModule decoration time).
 */
@Module({
  imports: [QueueModule, DaftraModule],
  providers: [
    NotificationProcessor,
    PushProcessor,
    EmailProcessor,
    ImageProcessingProcessor,
    WorkerCronService,
    WorkerHeartbeatService,
  ],
})
export class WorkerModule {}
