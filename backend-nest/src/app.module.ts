import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { ButchersModule } from './butchers/butchers.module';
import { ButcherApplicationsModule } from './butcher-applications/butcher-applications.module';
import { MessagesModule } from './messages/messages.module';
import { UploadModule } from './upload/upload.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';
import { GatewaySharedModule } from './gateway/gateway-shared.module';
import { SupportModule } from './support/support.module';
import { ButcherBannersModule } from './butcher-banners/butcher-banners.module';
import { SettingsModule } from './settings/settings.module';
import { DaftraModule } from './integrations/daftra/daftra.module';

/**
 * ملاحم سرح runtime graph — no livestock listings, social, MEWA, or SARH plans.
 */
@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    GatewaySharedModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    NotificationsModule,
    PaymentsModule,
    IntegrationsModule,
    DaftraModule,
    ButchersModule,
    ButcherApplicationsModule,
    MessagesModule,
    UploadModule,
    AdminModule,
    HealthModule,
    SupportModule,
    ButcherBannersModule,
  ],
})
export class AppModule {}
