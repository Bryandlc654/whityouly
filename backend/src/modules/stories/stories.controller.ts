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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoriesService } from './stories.service';
import {
  CreateStoryDto,
  CreateStoryUpdateDto,
  ListMyStoriesQueryDto,
  ListPublicStoriesQueryDto,
  ListWithdrawnQueryDto,
  ReportStoryDto,
  UpdateStoryDto,
  UpdateStoryUpdateDto,
} from './dto/story.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Stories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Crear un relato (borrador o publicado) con su primera etapa' })
  @ApiResponse({ status: 201, description: 'Relato creado.' })
  @ApiResponse({ status: 403, description: 'La cuenta todavía no tiene personaje.' })
  @ApiResponse({ status: 409, description: 'Se alcanzó el máximo de relatos o un valor no está en el catálogo.' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateStoryDto) {
    return this.storiesService.create(req.user.userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Listar tus relatos, paginados por cursor' })
  listMine(@Req() req: AuthenticatedRequest, @Query() query: ListMyStoriesQueryDto) {
    return this.storiesService.listMine(req.user.userId, query);
  }

  @Get('following')
  @ApiOperation({
    summary: 'Feed de los personajes que sigues (relatos públicos y para seguidores)',
  })
  listFollowing(@Req() req: AuthenticatedRequest, @Query() query: ListPublicStoriesQueryDto) {
    return this.storiesService.listFollowing(req.user.userId, query);
  }

  @Get('view/:id')
  @ApiOperation({ summary: 'Ver un relato según su visibilidad (propietario, seguidor o público)' })
  @ApiResponse({ status: 404, description: 'El relato no existe o no es visible para ti.' })
  getViewable(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.getViewable(req.user.userId, id);
  }

  @Get('me/withdrawn')
  @ApiOperation({ summary: 'Listar tus relatos retirados, paginados por cursor' })
  listWithdrawn(@Req() req: AuthenticatedRequest, @Query() query: ListWithdrawnQueryDto) {
    return this.storiesService.listWithdrawn(req.user.userId, query);
  }

  @Get('me/:id')
  @ApiOperation({ summary: 'Ver uno de tus relatos con todas sus etapas' })
  @ApiResponse({ status: 404, description: 'El relato no existe o no es tuyo.' })
  getMine(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.getOwnedDetail(req.user.userId, id);
  }

  @Patch('me/:id')
  @Throttle({ default: { limit: 60, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Editar los metadatos del relato (título, visibilidad, catálogos)' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoryDto,
  ) {
    return this.storiesService.update(req.user.userId, id, dto);
  }

  @Post('me/:id/updates')
  @Throttle({ default: { limit: 120, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Añadir una etapa (evolución) al relato' })
  addUpdate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateStoryUpdateDto,
  ) {
    return this.storiesService.addUpdate(req.user.userId, id, dto);
  }

  @Patch('me/:id/updates/:updateId')
  @Throttle({ default: { limit: 120, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Editar el texto o la imagen de una etapa' })
  updateStage(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('updateId', ParseUUIDPipe) updateId: string,
    @Body() dto: UpdateStoryUpdateDto,
  ) {
    return this.storiesService.updateStage(req.user.userId, id, updateId, dto);
  }

  @Delete('me/:id/updates/:updateId')
  @ApiOperation({ summary: 'Eliminar una etapa (nunca la última)' })
  removeStage(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('updateId', ParseUUIDPipe) updateId: string,
  ) {
    return this.storiesService.removeStage(req.user.userId, id, updateId);
  }

  @Post('me/:id/publish')
  @ApiOperation({ summary: 'Publicar un borrador' })
  publish(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.publish(req.user.userId, id);
  }

  @Post('me/:id/unpublish')
  @ApiOperation({ summary: 'Volver a borrador un relato publicado' })
  unpublish(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.unpublish(req.user.userId, id);
  }

  @Post('me/:id/feature')
  @ApiOperation({ summary: 'Destacar el relato en el perfil público' })
  feature(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.feature(req.user.userId, id);
  }

  @Delete('me/:id/feature')
  @ApiOperation({ summary: 'Quitar el relato de las destacadas' })
  unfeature(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.unfeature(req.user.userId, id);
  }

  @Post('me/:id/comments/pause')
  @ApiOperation({ summary: 'Pausar los comentarios de un relato propio' })
  @ApiResponse({ status: 409, description: 'El relato no está publicado.' })
  pauseComments(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.storiesService.pauseComments(req.user.userId, id);
  }

  @Delete('me/:id/comments/pause')
  @ApiOperation({ summary: 'Reabrir los comentarios de un relato propio' })
  @ApiResponse({ status: 409, description: 'El relato no está publicado.' })
  resumeComments(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.storiesService.resumeComments(req.user.userId, id);
  }

  @Post('me/:id/withdraw')
  @ApiOperation({ summary: 'Retirar un relato publicado (reversible)' })
  @ApiResponse({ status: 409, description: 'El relato no está publicado.' })
  withdraw(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.withdraw(req.user.userId, id);
  }

  @Post('me/:id/restore')
  @ApiOperation({ summary: 'Restaurar un relato retirado' })
  @ApiResponse({ status: 409, description: 'El relato no está retirado.' })
  restore(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.restore(req.user.userId, id);
  }

  @Delete('me/:id')
  @ApiOperation({ summary: 'Eliminar definitivamente un borrador o un relato retirado' })
  @ApiResponse({ status: 409, description: 'Primero hay que retirar un relato publicado.' })
  remove(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.remove(req.user.userId, id);
  }

  @Post(':id/report')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Reportar un relato de otra persona' })
  @ApiResponse({ status: 400, description: 'No puedes reportar tu propio relato.' })
  @ApiResponse({ status: 404, description: 'El relato no existe o ya no está disponible.' })
  @ApiResponse({ status: 409, description: 'Ya reportaste este relato.' })
  report(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportStoryDto,
  ) {
    return this.storiesService.reportStory(req.user.userId, id, dto);
  }
}
