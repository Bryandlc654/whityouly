import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { StoriesModule } from '../stories/stories.module';
import { TreeModule } from '../tree/tree.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [StoriesModule, NotificationsModule, TreeModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}