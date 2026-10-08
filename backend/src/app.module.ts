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
import { MailerModule } from '@nestjs-modules/mailer';
import { env } from './config/env';
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

@Module({
  imports: [
    PrismaModule,
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
    MailerModule.forRoot({
      transport: env.mail.host
        ? {
            host: env.mail.host,
            port: env.mail.port,
            secure: env.mail.secure,
            auth: {
              user: env.mail.user,
              pass: env.mail.pass,
            },
          }
        : {
            jsonTransport: true,
          },
      defaults: {
        from: env.mail.from,
      },
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
