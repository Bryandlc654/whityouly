import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationCleanupService } from './notification-cleanup.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationCleanupService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
