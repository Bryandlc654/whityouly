import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { AdminFeaturedController } from './admin-featured.controller';
import { StoriesModule } from '../stories/stories.module';
import { ContentPreferencesModule } from '../content-preferences/content-preferences.module';

@Module({
  imports: [StoriesModule, ContentPreferencesModule],
  controllers: [DiscoveryController, AdminFeaturedController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
