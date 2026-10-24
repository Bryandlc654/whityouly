import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SupportService } from './support.service';
import {
  CreateSupportTicketDto,
  ListMySupportTicketsQueryDto,
} from './dto/support.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Enviar una solicitud de soporte' })
  @ApiResponse({ status: 409, description: 'Hay demasiadas solicitudes abiertas.' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSupportTicketDto) {
    return this.supportService.create(req.user.userId, dto);
  }

  @Get('tickets/mine')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar tus solicitudes de soporte (paginado)' })
  listMine(@Req() req: AuthenticatedRequest, @Query() query: ListMySupportTicketsQueryDto) {
    return this.supportService.listMine(req.user.userId, query);
  }

  @Get('tickets/mine/:id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ver una de tus solicitudes de soporte' })
  @ApiResponse({ status: 404, description: 'La solicitud no existe o no es tuya.' })
  getMine(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supportService.getMine(req.user.userId, id);
  }
}
