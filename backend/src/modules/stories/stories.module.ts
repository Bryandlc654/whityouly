import { Module } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { StoriesController } from './stories.controller';
import { PublicStoriesController } from './public-stories.controller';
import { FeedController } from './feed.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { TreeModule } from '../tree/tree.module';
import { ContentPreferencesModule } from '../content-preferences/content-preferences.module';

@Module({
  imports: [NotificationsModule, TreeModule, ContentPreferencesModule],
  // El controlador autenticado va primero para que `/me` y sus subrutas tengan
  // prioridad sobre la ruta pública `/:id`.
  controllers: [StoriesController, PublicStoriesController, FeedController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
