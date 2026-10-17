import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModerationService } from './moderation.service';
import { CreateAppealDto, ListAppealsQueryDto } from './dto/moderation.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

/**
 * Apelaciones de publicaciones moderadas, desde el lado de su autor. Solo se
 * puede apelar contenido propio que esté oculto.
 */
@ApiTags('Appeals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('appeals')
export class AppealsController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Apelar una publicación propia moderada' })
  @ApiResponse({ status: 400, description: 'El contenido no está oculto.' })
  @ApiResponse({ status: 404, description: 'El contenido no existe o no es tuyo.' })
  @ApiResponse({ status: 409, description: 'Ya tienes una apelación pendiente.' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAppealDto) {
    return this.moderationService.createAppeal(req.user.userId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Listar tus apelaciones, paginadas por cursor' })
  listMine(@Req() req: AuthenticatedRequest, @Query() query: ListAppealsQueryDto) {
    return this.moderationService.listMyAppeals(req.user.userId, query);
  }
}
