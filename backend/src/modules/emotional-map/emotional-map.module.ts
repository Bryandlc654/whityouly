import { Module } from '@nestjs/common';
import { EmotionalMapService } from './emotional-map.service';
import { EmotionalMapController } from './emotional-map.controller';

@Module({
  controllers: [EmotionalMapController],
  providers: [EmotionalMapService],
})
export class EmotionalMapModule {}
