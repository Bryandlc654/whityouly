import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { CharactersService } from './characters.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { SearchCharactersQueryDto } from './dto/character.dto';

type OptionalAuthenticatedRequest = Request & { user?: { userId: string } };

/**
 * Rutas públicas del personaje (sin autenticación). Se registran después del
 * controlador autenticado para que las rutas estáticas (`/me`, `/availability`)
 * tengan prioridad sobre `/:name`. La ruta de búsqueda va antes de `/:name`
 * para que "search" no se tome como un seudónimo.
 */
@ApiTags('Characters')
@Controller('characters')
export class PublicCharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Get('search')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Buscar personajes públicos por prefijo del seudónimo' })
  search(@Query() query: SearchCharactersQueryDto) {
    return this.charactersService.search(query.q, query.limit);
  }

  @Get(':name')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ver el perfil público de un personaje por su nombre' })
  @ApiResponse({ status: 200, description: 'Perfil público del personaje.' })
  @ApiResponse({ status: 404, description: 'Personaje no encontrado o perfil privado.' })
  getPublicProfile(@Param('name') name: string, @Req() req: OptionalAuthenticatedRequest) {
    return this.charactersService.getPublicProfile(name, req.user?.userId);
  }
}
