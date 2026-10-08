import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StoriesService } from './stories.service';
import { ListPublicStoriesQueryDto } from './dto/story.dto';

/**
 * Rutas públicas del relato (sin autenticación): solo relatos publicados con
 * visibilidad PUBLIC. Se registra después del controlador autenticado para que
 * rutas como `/stories/me` tengan prioridad sobre `/stories/:id`.
 */
@ApiTags('Stories')
@Controller('stories')
export class PublicStoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Feed público de relatos (filtros por categoría, emoción o etiqueta)' })
  list(@Query() query: ListPublicStoriesQueryDto) {
    return this.storiesService.listPublic(query);
  }

  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ver un relato público con todas sus etapas' })
  @ApiResponse({ status: 404, description: 'El relato no existe o no es público.' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.getPublic(id);
  }
}
