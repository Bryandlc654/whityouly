import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanionshipsService } from './companionships.service';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Interactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class InteractionsController {
  constructor(private readonly companionshipsService: CompanionshipsService) {}

  @Post('stories/:storyId/support')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Acompañar un relato ("Estoy contigo")' })
  @ApiResponse({ status: 404, description: 'El relato no es visible para ti.' })
  supportStory(@Req() req: AuthenticatedRequest, @Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.companionshipsService.supportStory(req.user.userId, storyId);
  }

  @Delete('stories/:storyId/support')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Retirar el acompañamiento de un relato' })
  unsupportStory(@Req() req: AuthenticatedRequest, @Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.companionshipsService.unsupportStory(req.user.userId, storyId);
  }

  @Post('characters/:name/support')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Acompañar a un personaje' })
  supportCharacter(@Req() req: AuthenticatedRequest, @Param('name') name: string) {
    return this.companionshipsService.supportCharacter(req.user.userId, name);
  }

  @Delete('characters/:name/support')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Retirar el acompañamiento a un personaje' })
  unsupportCharacter(@Req() req: AuthenticatedRequest, @Param('name') name: string) {
    return this.companionshipsService.unsupportCharacter(req.user.userId, name);
  }
}