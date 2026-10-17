import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmotionalMapService } from './emotional-map.service';
import {
  CreateEmotionalLogDto,
  EmotionalSummaryQueryDto,
  ListEmotionalLogsQueryDto,
  UpdateEmotionalLogDto,
} from './dto/emotional-log.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

/**
 * Mapa Emocional: diario privado de estados de ánimo del usuario autenticado.
 * Cada persona solo ve y edita sus propios registros.
 */
@ApiTags('Emotional Map')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emotional-logs')
export class EmotionalMapController {
  constructor(private readonly emotionalMapService: EmotionalMapService) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registrar una emoción con su intensidad, fecha y notas' })
  @ApiResponse({ status: 400, description: 'La emoción no está en el catálogo o los datos no son válidos.' })
  @ApiResponse({ status: 409, description: 'Se alcanzó el máximo de registros.' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateEmotionalLogDto) {
    return this.emotionalMapService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tus registros emocionales, paginados por cursor' })
  list(@Req() req: AuthenticatedRequest, @Query() query: ListEmotionalLogsQueryDto) {
    return this.emotionalMapService.list(req.user.userId, query);
  }

  @Get('summary')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Serie agregada del mapa: por día, por emoción y racha actual' })
  summary(@Req() req: AuthenticatedRequest, @Query() query: EmotionalSummaryQueryDto) {
    return this.emotionalMapService.summary(req.user.userId, query);
  }

  @Get('today')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Si ya registraste tu estado en el día global en curso' })
  today(@Req() req: AuthenticatedRequest) {
    return this.emotionalMapService.todayStatus(req.user.userId);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Editar un registro (emoción, intensidad, fecha o notas)' })
  @ApiResponse({ status: 404, description: 'El registro no existe o no es tuyo.' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmotionalLogDto,
  ) {
    return this.emotionalMapService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Eliminar un registro' })
  @ApiResponse({ status: 404, description: 'El registro no existe o no es tuyo.' })
  remove(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.emotionalMapService.remove(req.user.userId, id);
  }
}
