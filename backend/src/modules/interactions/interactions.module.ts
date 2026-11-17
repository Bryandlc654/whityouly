import { Module } from '@nestjs/common';
import { CompanionshipsService } from './companionships.service';
import { InteractionsController } from './interactions.controller';
import { StoriesModule } from '../stories/stories.module';
import { TreeModule } from '../tree/tree.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContentPreferencesModule } from '../content-preferences/content-preferences.module';

@Module({
  imports: [StoriesModule, NotificationsModule, TreeModule, ContentPreferencesModule],
  controllers: [InteractionsController],
  providers: [CompanionshipsService],
  exports: [CompanionshipsService],
})
export class InteractionsModule {}