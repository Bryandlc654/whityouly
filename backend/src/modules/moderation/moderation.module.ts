import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { AppealsController } from './appeals.controller';
import { AdminModerationController } from './admin-moderation.controller';
import { AdminContentController } from './admin-content.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AppealsController, AdminModerationController, AdminContentController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
