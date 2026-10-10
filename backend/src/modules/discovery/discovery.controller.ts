import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiscoveryService } from './discovery.service';
import { ListDiscoveryQueryDto } from './dto/discovery.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

/**
 * Descubrimiento. Los destacados y las tendencias son públicos (son la portada
 * para quien aún no ha entrado); los personajes recomendados requieren sesión
 * porque se personalizan con los intereses de quien mira.
 */
@ApiTags('Discovery')
@Controller('discover')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('featured')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Contenido destacado (curado por administración)' })
  listFeatured(@Query() query: ListDiscoveryQueryDto) {
    return this.discoveryService.listFeatured(query.limit);
  }

  @Get('trends')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Relatos en tendencia por interacción reciente' })
  listTrending(@Query() query: ListDiscoveryQueryDto) {
    return this.discoveryService.listTrending(query.limit);
  }

  @Get('characters')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Personajes recomendados según los intereses y seguidos' })
  recommended(@Req() req: AuthenticatedRequest, @Query() query: ListDiscoveryQueryDto) {
    return this.discoveryService.listRecommendedCharacters(req.user.userId, query.limit);
  }
}
