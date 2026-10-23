import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { ListMyReportsQueryDto } from './dto/reports.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('mine')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Estado de los reportes que enviaste (paginado)' })
  listMine(@Req() req: AuthenticatedRequest, @Query() query: ListMyReportsQueryDto) {
    return this.reportsService.listMine(req.user.userId, query);
  }
}
