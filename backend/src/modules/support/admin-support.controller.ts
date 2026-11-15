import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SupportService } from './support.service';
import {
  ListSupportTicketsQueryDto,
  UpdateSupportTicketDto,
} from './dto/admin-support.dto';

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
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'Listar todas las solicitudes de soporte (paginado)' })
  list(@Query() query: ListSupportTicketsQueryDto) {
    return this.supportService.listAll(query);
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Actualizar el estado o la respuesta de una solicitud' })
  @ApiResponse({ status: 404, description: 'Esa solicitud no existe.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupportTicketDto) {
    return this.supportService.updateAsAdmin(id, dto);
  }
}
