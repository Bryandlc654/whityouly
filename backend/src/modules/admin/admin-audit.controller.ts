import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminAuditService } from './admin-audit.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  @Get()
  @ApiOperation({ summary: 'Historial de acciones administrativas (solo SUPERADMIN)' })
  list(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.auditService.list(limit ? Number(limit) : undefined, cursor);
  }
}
