import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ModerationService } from './moderation.service';
import {
  ContentVisibilityDto,
  DeleteContentDto,
  ListAdminCommentsQueryDto,
  ListAdminStoriesQueryDto,
} from './dto/admin-content.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

/**
 * Gestión directa de relatos y comentarios para SUPERADMIN. No depende de que
 * exista un reporte: busca el contenido, lo oculta, lo restaura o lo elimina, y
 * cada medida queda auditada con actor y motivo.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('stories')
  @ApiOperation({ summary: 'Listar relatos para gestión directa de contenido' })
  listStories(@Query() query: ListAdminStoriesQueryDto) {
    return this.moderationService.listAdminStories(query);
  }

  @Patch('stories/:id/visibility')
  @ApiOperation({ summary: 'Ocultar o restaurar un relato' })
  @ApiResponse({ status: 404, description: 'Ese relato no existe.' })
  @ApiResponse({ status: 409, description: 'El relato no admite esa acción en su estado actual.' })
  setStoryVisibility(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContentVisibilityDto,
  ) {
    return this.moderationService.setStoryVisibility(req.user.userId, id, dto);
  }

  @Delete('stories/:id')
  @ApiOperation({ summary: 'Eliminar definitivamente un relato (baja lógica auditada)' })
  @ApiResponse({ status: 404, description: 'Ese relato no existe.' })
  deleteStory(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteContentDto,
  ) {
    return this.moderationService.deleteStory(req.user.userId, id, dto);
  }

  @Get('comments')
  @ApiOperation({ summary: 'Listar comentarios para gestión directa de contenido' })
  listComments(@Query() query: ListAdminCommentsQueryDto) {
    return this.moderationService.listAdminComments(query);
  }

  @Patch('comments/:id/visibility')
  @ApiOperation({ summary: 'Ocultar o restaurar un comentario' })
  @ApiResponse({ status: 404, description: 'Ese comentario no existe.' })
  @ApiResponse({ status: 409, description: 'El comentario no admite esa acción en su estado actual.' })
  setCommentVisibility(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContentVisibilityDto,
  ) {
    return this.moderationService.setCommentVisibility(req.user.userId, id, dto);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Eliminar definitivamente un comentario (baja lógica auditada)' })
  @ApiResponse({ status: 404, description: 'Ese comentario no existe.' })
  deleteComment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteContentDto,
  ) {
    return this.moderationService.deleteComment(req.user.userId, id, dto);
  }
}
