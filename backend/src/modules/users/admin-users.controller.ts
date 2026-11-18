import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import { AdminAuditService } from '../admin/admin-audit.service';
import {
  ListUsersQueryDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/admin-users.dto';

type AdminRequest = Request & { user: { userId: string } };

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Listar usuarios (filtros por rol, estado y correo)' })
  list(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.list(query);
  }

  @Patch(':id/role')
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Cambiar el rol de un usuario (solo SUPERADMIN)' })
  async updateRole(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const result = await this.adminUsersService.updateRole(req.user.userId, id, dto.role);
    await this.audit.log({
      actorUserId: req.user.userId,
      action: 'user.role_changed',
      targetType: 'user',
      targetId: id,
      metadata: { role: dto.role },
      ipAddress: req.ip,
    });
    return result;
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Suspender o reactivar una cuenta' })
  async updateStatus(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const result = await this.adminUsersService.updateStatus(req.user.userId, id, dto.status);
    await this.audit.log({
      actorUserId: req.user.userId,
      action: 'user.status_changed',
      targetType: 'user',
      targetId: id,
      metadata: { status: dto.status },
      ipAddress: req.ip,
    });
    return result;
  }
}
