import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoriesService } from './stories.service';

type AuthenticatedRequest = Request & { user: { userId: string } };

/**
 * Feed principal unificado: el algoritmo mezcla lo relevante para el usuario en
 * una sola lista (seguidos, recomendado, reciente y popular), sin secciones.
 * Requiere sesión para personalizar con los intereses del personaje.
 */
@ApiTags('Feed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feed')
export class FeedController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Feed principal unificado ordenado por relevancia',
  })
  getFeed(@Req() req: AuthenticatedRequest) {
    return this.storiesService.getFeed(req.user.userId);
  }
}