import { Module } from '@nestjs/common';
import { EmotionalMapService } from './emotional-map.service';
import { EmotionalMapController } from './emotional-map.controller';
import { TreeModule } from '../tree/tree.module';

@Module({
  imports: [TreeModule],
  controllers: [EmotionalMapController],
  providers: [EmotionalMapService],
})
export class EmotionalMapModule {}
