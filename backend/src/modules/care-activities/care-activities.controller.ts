import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CareActivitiesService } from './care-activities.service';
import { CreateCareActivityDto, UpdateCareActivityDto } from './dto/care-activity.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Care Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('care-activities')
export class CareActivitiesController {
  constructor(private readonly careActivitiesService: CareActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mis actividades de cuidado recientes' })
  list(@Req() req: AuthenticatedRequest) {
    return this.careActivitiesService.list(req.user.userId);
  }

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registrar una actividad de cuidado o un paso pendiente' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCareActivityDto) {
    return this.careActivitiesService.create(req.user.userId, dto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Completar un paso pendiente o guardar una reflexion privada' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCareActivityDto,
  ) {
    return this.careActivitiesService.update(req.user.userId, id, dto);
  }
}
