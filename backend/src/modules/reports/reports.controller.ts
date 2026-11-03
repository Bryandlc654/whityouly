import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { CreateGeneralReportDto, ListMyReportsQueryDto } from './dto/reports.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Enviar un reporte general desde Ayuda y seguridad' })
  createGeneral(@Req() req: AuthenticatedRequest, @Body() dto: CreateGeneralReportDto) {
    return this.reportsService.createGeneral(req.user.userId, dto.reason);
  }

  @Get('mine')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Estado de los reportes que enviaste (paginado)' })
  listMine(@Req() req: AuthenticatedRequest, @Query() query: ListMyReportsQueryDto) {
    return this.reportsService.listMine(req.user.userId, query);
  }
}
