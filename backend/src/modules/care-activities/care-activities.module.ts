import { Module } from '@nestjs/common';
import { DiaryModule } from '../diary/diary.module';
import { TreeModule } from '../tree/tree.module';
import { CareActivitiesController } from './care-activities.controller';
import { CareActivitiesService } from './care-activities.service';

@Module({
  imports: [TreeModule, DiaryModule],
  controllers: [CareActivitiesController],
  providers: [CareActivitiesService],
  exports: [CareActivitiesService],
})
export class CareActivitiesModule {}
