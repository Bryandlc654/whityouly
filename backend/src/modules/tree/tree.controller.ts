import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TreeService } from './tree.service';

type AuthenticatedRequest = Request & { user: { userId: string } };

/**
 * Árbol de crecimiento: privado de cada persona. Requiere sesión; nunca expone
 * datos de otras cuentas.
 */
@ApiTags('Tree')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tree')
export class TreeController {
  constructor(private readonly treeService: TreeService) {}

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Estado de tu árbol: gotas, etapa, caminos de hoy y partes' })
  @ApiResponse({ status: 200, description: 'Crecimiento privado calculado desde tu actividad.' })
  getTree(@Req() req: AuthenticatedRequest) {
    return this.treeService.getTree(req.user.userId);
  }
}
