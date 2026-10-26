import { Module } from '@nestjs/common';
import { CapsulesController } from './capsules.controller';
import { CapsulesService } from './capsules.service';

@Module({
  controllers: [CapsulesController],
  providers: [CapsulesService],
  exports: [CapsulesService],
})
export class CapsulesModule {}
