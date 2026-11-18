import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SupportService } from './support.service';
import { AdminAuditService } from '../admin/admin-audit.service';
import {
  ListSupportTicketsQueryDto,
  UpdateSupportTicketDto,
} from './dto/admin-support.dto';

type AdminRequest = Request & { user: { userId: string } };

/**
 * Bandeja de soporte para administración. El contenido de un caso puede incluir
 * datos personales, por eso queda fuera de la vista pública y de moderación.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
@Controller('admin/support')
export class AdminSupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('tickets')
  @ApiOperation({ summary: 'Listar todas las solicitudes de soporte (paginado)' })
  list(@Query() query: ListSupportTicketsQueryDto) {
    return this.supportService.listAll(query);
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Actualizar el estado o la respuesta de una solicitud' })
  @ApiResponse({ status: 404, description: 'Esa solicitud no existe.' })
  async update(
    @Req() req: AdminRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    const result = await this.supportService.updateAsAdmin(id, dto);
    await this.audit.log({
      actorUserId: req.user.userId,
      action: 'support.ticket_updated',
      targetType: 'support_ticket',
      targetId: id,
      metadata: { status: dto.status, hasNote: Boolean(dto.resolutionNote) },
      ipAddress: req.ip,
    });
    return result;
  }
}
