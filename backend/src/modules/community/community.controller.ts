import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityService } from './community.service';
import { CommunityPulseQueryDto } from './dto/community.dto';

/**
 * Pulso Comunitario: el estado emocional agregado de la comunidad. Nunca
 * devuelve datos individuales; solo grupos con suficientes personas distintas
 * (k-anonimato). Requiere sesión para que el agregado no quede indexable.
 */
@ApiTags('Community')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('pulse')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Estado emocional agregado y anónimo de la comunidad' })
  @ApiResponse({
    status: 200,
    description:
      'Agregados anónimos por emoción, día, franja y día de la semana. Los grupos con menos personas que el mínimo se omiten.',
  })
  pulse(@Query() query: CommunityPulseQueryDto) {
    return this.communityService.pulse(query);
  }
}
