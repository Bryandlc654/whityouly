import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { AppealsController } from './appeals.controller';
import { AdminModerationController } from './admin-moderation.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AppealsController, AdminModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
