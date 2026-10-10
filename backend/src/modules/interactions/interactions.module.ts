import { Module } from '@nestjs/common';
import { CompanionshipsService } from './companionships.service';
import { InteractionsController } from './interactions.controller';
import { StoriesModule } from '../stories/stories.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [StoriesModule, NotificationsModule],
  controllers: [InteractionsController],
  providers: [CompanionshipsService],
  exports: [CompanionshipsService],
})
export class InteractionsModule {}