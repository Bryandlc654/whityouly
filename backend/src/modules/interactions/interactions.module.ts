import { Module } from '@nestjs/common';
import { CompanionshipsService } from './companionships.service';
import { InteractionsController } from './interactions.controller';
import { StoriesModule } from '../stories/stories.module';

@Module({
  imports: [StoriesModule],
  controllers: [InteractionsController],
  providers: [CompanionshipsService],
  exports: [CompanionshipsService],
})
export class InteractionsModule {}