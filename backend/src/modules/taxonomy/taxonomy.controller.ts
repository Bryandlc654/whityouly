import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { TaxonomyService } from './taxonomy.service';

/**
 * Catálogo público de categorías, emociones y etiquetas. No requiere
 * autenticación: es la lista cerrada que ofrece el compositor, no información
 * de ninguna persona.
 */
@ApiTags('Taxonomy')
@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar el catálogo de categorías, emociones y etiquetas' })
  @ApiOkResponse({ description: 'Catálogos ordenados alfabéticamente.' })
  list() {
    return this.taxonomyService.getCatalog();
  }
}
