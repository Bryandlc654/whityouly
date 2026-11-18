import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DiscoveryService } from './discovery.service';
import { AdminAuditService } from '../admin/admin-audit.service';
import { UpsertFeaturedDto } from './dto/discovery.dto';

type AdminRequest = Request & { user: { userId: string } };

/**
 * Curación del contenido destacado. Reservado a administración: es la portada
 * editorial de la plataforma.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
@Controller('admin/featured')
export class AdminFeaturedController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar el contenido destacado curado' })
  list() {
    return this.discoveryService.listCurated();
  }

  @Put(':storyId')
  @ApiOperation({ summary: 'Destacar un relato (crea o actualiza su curación)' })
  @ApiResponse({ status: 400, description: 'El relato no está publicado.' })
  @ApiResponse({ status: 404, description: 'El relato no existe.' })
  async feature(
    @Req() req: AdminRequest,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Body() dto: UpsertFeaturedDto,
  ) {
    const result = await this.discoveryService.feature(storyId, dto);
    await this.audit.log({
      actorUserId: req.user.userId,
      action: 'featured.upserted',
      targetType: 'story',
      targetId: storyId,
      metadata: { note: dto.note, expiresAt: dto.expiresAt },
      ipAddress: req.ip,
    });
    return result;
  }

  @Delete(':storyId')
  @ApiOperation({ summary: 'Quitar un relato del contenido destacado' })
  async unfeature(
    @Req() req: AdminRequest,
    @Param('storyId', ParseUUIDPipe) storyId: string,
  ) {
    const result = await this.discoveryService.unfeature(storyId);
    await this.audit.log({
      actorUserId: req.user.userId,
      action: 'featured.removed',
      targetType: 'story',
      targetId: storyId,
      ipAddress: req.ip,
    });
    return result;
  }
}
