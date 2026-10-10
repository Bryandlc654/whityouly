import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DiscoveryService } from './discovery.service';
import { UpsertFeaturedDto } from './dto/discovery.dto';

/**
 * Curación del contenido destacado. Reservado a administración: es la portada
 * editorial de la plataforma.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
@Controller('admin/featured')
export class AdminFeaturedController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get()
  @ApiOperation({ summary: 'Listar el contenido destacado curado' })
  list() {
    return this.discoveryService.listCurated();
  }

  @Put(':storyId')
  @ApiOperation({ summary: 'Destacar un relato (crea o actualiza su curación)' })
  @ApiResponse({ status: 400, description: 'El relato no está publicado.' })
  @ApiResponse({ status: 404, description: 'El relato no existe.' })
  feature(@Param('storyId', ParseUUIDPipe) storyId: string, @Body() dto: UpsertFeaturedDto) {
    return this.discoveryService.feature(storyId, dto);
  }

  @Delete(':storyId')
  @ApiOperation({ summary: 'Quitar un relato del contenido destacado' })
  unfeature(@Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.discoveryService.unfeature(storyId);
  }
}
