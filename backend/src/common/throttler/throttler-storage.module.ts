import { Module } from '@nestjs/common';
import { AppThrottlerStorage } from './app-throttler.storage';

@Module({
  providers: [AppThrottlerStorage],
  exports: [AppThrottlerStorage],
})
export class ThrottlerStorageModule {}
