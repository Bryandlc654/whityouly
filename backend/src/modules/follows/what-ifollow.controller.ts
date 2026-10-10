import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FollowsService } from './follows.service';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Community')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('follows')
export class WhatIFollowController {
  constructor(private readonly followsService: FollowsService) {}

  @Get()
  @ApiOperation({ summary: 'Lo que sigo: personajes e historias' })
  whatIFollow(@Req() req: AuthenticatedRequest) {
    return this.followsService.whatIFollow(req.user.userId);
  }
}