import { Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FollowsService } from './follows.service';
import { ListConnectionsQueryDto } from './dto/follows.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Community')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('characters')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':name/follow')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Seguir a un personaje (idempotente)' })
  @ApiResponse({ status: 403, description: 'La cuenta todavía no tiene personaje.' })
  @ApiResponse({ status: 404, description: 'El personaje no existe.' })
  follow(@Req() req: AuthenticatedRequest, @Param('name') name: string) {
    return this.followsService.follow(req.user.userId, name);
  }

  @Delete(':name/follow')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Dejar de seguir a un personaje' })
  unfollow(@Req() req: AuthenticatedRequest, @Param('name') name: string) {
    return this.followsService.unfollow(req.user.userId, name);
  }

  @Get('me/following')
  @ApiOperation({ summary: 'Listar los personajes que sigues' })
  listFollowing(@Req() req: AuthenticatedRequest) {
    return this.followsService.listFollowing(req.user.userId);
  }

  @Get(':name/followers')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar los seguidores de un personaje (paginado)' })
  @ApiResponse({ status: 404, description: 'El personaje no existe o su perfil es privado.' })
  listFollowers(
    @Req() req: AuthenticatedRequest,
    @Param('name') name: string,
    @Query() query: ListConnectionsQueryDto,
  ) {
    return this.followsService.listFollowers(req.user.userId, name, query);
  }

  @Get(':name/following')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar los personajes que sigue un perfil (paginado)' })
  @ApiResponse({ status: 403, description: 'El perfil no comparte a quién sigue.' })
  @ApiResponse({ status: 404, description: 'El personaje no existe o su perfil es privado.' })
  listFollowingOf(
    @Req() req: AuthenticatedRequest,
    @Param('name') name: string,
    @Query() query: ListConnectionsQueryDto,
  ) {
    return this.followsService.listFollowingOf(req.user.userId, name, query);
  }
}
