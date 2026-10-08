import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TaxonomyService } from './taxonomy.service';
import {
  CreateCategoryDto,
  CreateEmotionDto,
  CreateTagDto,
  UpdateCategoryDto,
  UpdateEmotionDto,
  UpdateTagDto,
} from './dto/taxonomy.dto';

/**
 * Gestión del catálogo (categorías, emociones y etiquetas). Reservada a
 * administración: es la lista que el resto de la plataforma considera curada.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
@Controller('admin/taxonomy')
export class AdminTaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Post('categories')
  @ApiOperation({ summary: 'Crear una categoría' })
  @ApiResponse({ status: 409, description: 'Ya existe una categoría con ese nombre.' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.taxonomyService.createCategory(dto.name);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Renombrar una categoría' })
  renameCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.taxonomyService.renameCategory(id, dto.name);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Eliminar una categoría (la quita de los relatos que la usaban)' })
  deleteCategory(@Param('id') id: string) {
    return this.taxonomyService.deleteCategory(id);
  }

  @Post('emotions')
  @ApiOperation({ summary: 'Crear una emoción' })
  createEmotion(@Body() dto: CreateEmotionDto) {
    return this.taxonomyService.createEmotion(dto.name, dto.colorHex);
  }

  @Patch('emotions/:id')
  @ApiOperation({ summary: 'Actualizar una emoción (nombre y/o color)' })
  updateEmotion(@Param('id') id: string, @Body() dto: UpdateEmotionDto) {
    return this.taxonomyService.updateEmotion(id, { name: dto.name, colorHex: dto.colorHex });
  }

  @Delete('emotions/:id')
  @ApiOperation({ summary: 'Eliminar una emoción' })
  deleteEmotion(@Param('id') id: string) {
    return this.taxonomyService.deleteEmotion(id);
  }

  @Post('tags')
  @ApiOperation({ summary: 'Crear una etiqueta' })
  createTag(@Body() dto: CreateTagDto) {
    return this.taxonomyService.createTag(dto.name);
  }

  @Patch('tags/:id')
  @ApiOperation({ summary: 'Renombrar una etiqueta' })
  renameTag(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.taxonomyService.renameTag(id, dto.name);
  }

  @Delete('tags/:id')
  @ApiOperation({ summary: 'Eliminar una etiqueta' })
  deleteTag(@Param('id') id: string) {
    return this.taxonomyService.deleteTag(id);
  }
}
