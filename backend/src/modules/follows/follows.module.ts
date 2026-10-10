import { Module } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { FollowsController } from './follows.controller';
import { StoriesFollowController } from './stories-follow.controller';
import { WhatIFollowController } from './what-ifollow.controller';
import { StoriesModule } from '../stories/stories.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [StoriesModule, NotificationsModule],
  controllers: [FollowsController, StoriesFollowController, WhatIFollowController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}