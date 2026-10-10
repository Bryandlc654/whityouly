import { Module } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { FollowsController } from './follows.controller';
import { StoriesFollowController } from './stories-follow.controller';
import { WhatIFollowController } from './what-ifollow.controller';
import { StoriesModule } from '../stories/stories.module';

@Module({
  imports: [StoriesModule],
  controllers: [FollowsController, StoriesFollowController, WhatIFollowController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}