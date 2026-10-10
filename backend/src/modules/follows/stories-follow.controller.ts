import { Controller, Delete, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FollowsService } from './follows.service';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Community')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stories')
export class StoriesFollowController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':storyId/follow')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Seguir un relato (recibir sus actualizaciones)' })
  @ApiResponse({ status: 404, description: 'El relato no es visible para ti.' })
  followStory(@Req() req: AuthenticatedRequest, @Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.followsService.followStory(req.user.userId, storyId);
  }

  @Delete(':storyId/follow')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Dejar de seguir un relato' })
  unfollowStory(@Req() req: AuthenticatedRequest, @Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.followsService.unfollowStory(req.user.userId, storyId);
  }
}