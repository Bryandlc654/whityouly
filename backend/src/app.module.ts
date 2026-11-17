import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CharactersModule } from './modules/characters/characters.module';
import { InterestsModule } from './modules/interests/interests.module';
import { MailModule } from './common/mail/mail.module';
import { RedisModule } from './common/redis/redis.module';
import {
  ThrottlerStorageModule,
} from './common/throttler/throttler-storage.module';
import { AppThrottlerStorage } from './common/throttler/app-throttler.storage';
import { MediaStorageModule } from './common/storage/storage.module';
import { QuotaModule } from './common/quota/quota.module';
import { FilesModule } from './modules/files/files.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { StoriesModule } from './modules/stories/stories.module';
import { FollowsModule } from './modules/follows/follows.module';
import { CommentsModule } from './modules/comments/comments.module';
import { InteractionsModule } from './modules/interactions/interactions.module';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { EmotionalMapModule } from './modules/emotional-map/emotional-map.module';
import { CommunityModule } from './modules/community/community.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SupportModule } from './modules/support/support.module';
import { TreeModule } from './modules/tree/tree.module';
import { CapsulesModule } from './modules/capsules/capsules.module';
import { CareActivitiesModule } from './modules/care-activities/care-activities.module';
import { DiaryModule } from './modules/diary/diary.module';
import { ContentPreferencesModule } from './modules/content-preferences/content-preferences.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    RedisModule,
    MediaStorageModule,
    QuotaModule,
    UsersModule,
    AuthModule,
    CharactersModule,
    InterestsModule,
    FilesModule,
    TaxonomyModule,
    StoriesModule,
    FollowsModule,
    CommentsModule,
    InteractionsModule,
    BookmarksModule,
    NotificationsModule,
    DiscoveryModule,
    EmotionalMapModule,
    CommunityModule,
    ModerationModule,
    ReportsModule,
    SupportModule,
    TreeModule,
    CapsulesModule,
    CareActivitiesModule,
    DiaryModule,
    ContentPreferencesModule,
    AdminModule,
    ThrottlerStorageModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerStorageModule],
      inject: [AppThrottlerStorage],
      useFactory: (storage: AppThrottlerStorage) => ({
        throttlers: [
          {
            ttl: 60_000,
            limit: 100,
          },
        ],
        storage,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
