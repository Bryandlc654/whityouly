import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { StoriesModule } from '../stories/stories.module';
import { TreeModule } from '../tree/tree.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContentPreferencesModule } from '../content-preferences/content-preferences.module';

@Module({
  imports: [StoriesModule, NotificationsModule, TreeModule, ContentPreferencesModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}