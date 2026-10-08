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
import { CommentsService } from './comments.service';
import {
  CreateCommentDto,
  EditCommentDto,
  ListCommentsQueryDto,
  ReportCommentDto,
} from './dto/comment.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('story/:storyId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Comentar un relato o responder a un comentario (parentId)' })
  @ApiResponse({ status: 403, description: 'La cuenta todavía no tiene personaje.' })
  @ApiResponse({ status: 404, description: 'El relato no es visible o el comentario original no existe.' })
  create(
    @Req() req: AuthenticatedRequest,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(req.user.userId, storyId, dto);
  }

  @Get('story/:storyId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar los comentarios de un relato, paginados' })
  list(
    @Req() req: AuthenticatedRequest,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    return this.commentsService.list(req.user.userId, storyId, query);
  }

  @Patch(':commentId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Editar el propio comentario' })
  @ApiResponse({ status: 403, description: 'El comentario no es tuyo.' })
  edit(
    @Req() req: AuthenticatedRequest,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: EditCommentDto,
  ) {
    return this.commentsService.edit(req.user.userId, commentId, dto);
  }

  @Delete(':commentId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Eliminar el propio comentario (baja lógica)' })
  @ApiResponse({ status: 403, description: 'El comentario no es tuyo.' })
  remove(@Req() req: AuthenticatedRequest, @Param('commentId', ParseUUIDPipe) commentId: string) {
    return this.commentsService.remove(req.user.userId, commentId);
  }

  @Post(':commentId/report')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Reportar un comentario' })
  @ApiResponse({ status: 409, description: 'Ya reportaste ese comentario.' })
  report(
    @Req() req: AuthenticatedRequest,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: ReportCommentDto,
  ) {
    return this.commentsService.report(req.user.userId, commentId, dto);
  }
}