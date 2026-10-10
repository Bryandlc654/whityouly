import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookmarksService } from './bookmarks.service';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Bookmarks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post('story/:storyId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guardar un relato en privado' })
  @ApiResponse({ status: 404, description: 'El relato no es visible para ti.' })
  save(@Req() req: AuthenticatedRequest, @Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.bookmarksService.saveStory(req.user.userId, storyId);
  }

  @Delete('story/:storyId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Quitar un relato de los guardados' })
  unsave(@Req() req: AuthenticatedRequest, @Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.bookmarksService.unsaveStory(req.user.userId, storyId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar mis guardados (privados)' })
  list(@Req() req: AuthenticatedRequest) {
    return this.bookmarksService.listSaved(req.user.userId);
  }
}