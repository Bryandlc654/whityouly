import { Module } from '@nestjs/common';
import { InterestsController } from './interests.controller';
import { InterestsService } from './interests.service';

@Module({
  controllers: [InterestsController],
  providers: [InterestsService],
  // Exportado para que el módulo de personajes valide contra el mismo servicio.
  exports: [InterestsService],
})
export class InterestsModule {}
