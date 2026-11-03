import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContentPreferencesController } from './content-preferences.controller';
import { ContentPreferencesService } from './content-preferences.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContentPreferencesController],
  providers: [ContentPreferencesService],
  exports: [ContentPreferencesService],
})
export class ContentPreferencesModule {}
