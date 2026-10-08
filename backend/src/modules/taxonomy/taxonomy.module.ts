import { Module } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service';
import { TaxonomyController } from './taxonomy.controller';
import { AdminTaxonomyController } from './admin-taxonomy.controller';

@Module({
  controllers: [TaxonomyController, AdminTaxonomyController],
  providers: [TaxonomyService],
  // Exportado para que el módulo de historias valide contra el mismo catálogo.
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
