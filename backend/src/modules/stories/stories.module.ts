import { Module } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { StoriesController } from './stories.controller';
import { PublicStoriesController } from './public-stories.controller';

@Module({
  // El controlador autenticado va primero para que `/me` y sus subrutas tengan
  // prioridad sobre la ruta pública `/:id`.
  controllers: [StoriesController, PublicStoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
