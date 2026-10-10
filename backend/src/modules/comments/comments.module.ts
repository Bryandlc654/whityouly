import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { StoriesModule } from '../stories/stories.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [StoriesModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}