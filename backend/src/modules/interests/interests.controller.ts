import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { InterestsService } from './interests.service';

/**
 * Catálogo público de intereses. No requiere autenticación: es la lista cerrada
 * que la interfaz ofrece, no información de ninguna persona.
 */
@ApiTags('Interests')
@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar los intereses disponibles' })
  @ApiOkResponse({ description: 'Nombres del catálogo, ordenados alfabéticamente.' })
  list() {
    return this.interestsService.list();
  }
}
