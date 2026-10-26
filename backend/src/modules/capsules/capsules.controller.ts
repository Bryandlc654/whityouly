import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapsulesService } from './capsules.service';
import { CreateCapsuleDto, UpdateCapsuleDto } from './dto/capsule.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Capsules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('capsules')
export class CapsulesController {
  constructor(private readonly capsulesService: CapsulesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mis cápsulas privadas' })
  list(@Req() req: AuthenticatedRequest) {
    return this.capsulesService.list(req.user.userId);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Crear una cápsula privada para el futuro' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCapsuleDto) {
    return this.capsulesService.create(req.user.userId, dto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Editar el mensaje o la fecha de una cápsula propia' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCapsuleDto,
  ) {
    return this.capsulesService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Eliminar una cápsula propia' })
  remove(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.capsulesService.remove(req.user.userId, id);
  }
}
