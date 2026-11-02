import { Module } from '@nestjs/common';
import { TreeModule } from '../tree/tree.module';
import { DiaryController } from './diary.controller';
import { DiaryService } from './diary.service';

@Module({
  imports: [TreeModule],
  controllers: [DiaryController],
  providers: [DiaryService],
  exports: [DiaryService],
})
export class DiaryModule {}
