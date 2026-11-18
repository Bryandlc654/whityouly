import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TaxonomyService } from './taxonomy.service';
import { AdminAuditService } from '../admin/admin-audit.service';
import {
  CreateCategoryDto,
  CreateEmotionDto,
  CreateTagDto,
  UpdateCategoryDto,
  UpdateEmotionDto,
  UpdateTagDto,
} from './dto/taxonomy.dto';

type AdminRequest = Request & { user: { userId: string } };

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
  constructor(
    private readonly taxonomyService: TaxonomyService,
    private readonly audit: AdminAuditService,
  ) {}

  private log(
    req: AdminRequest,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata?: Record<string, unknown>,
  ) {
    return this.audit.log({
      actorUserId: req.user.userId,
      action,
      targetType,
      targetId,
      metadata,
      ipAddress: req.ip,
    });
  }

  @Post('categories')
  @ApiOperation({ summary: 'Crear una categoría' })
  @ApiResponse({ status: 409, description: 'Ya existe una categoría con ese nombre.' })
  async createCategory(@Req() req: AdminRequest, @Body() dto: CreateCategoryDto) {
    const result = await this.taxonomyService.createCategory(dto.name);
    await this.log(req, 'taxonomy.category_created', 'category', result.id, { name: result.name });
    return result;
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Renombrar una categoría' })
  async renameCategory(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const result = await this.taxonomyService.renameCategory(id, dto.name);
    await this.log(req, 'taxonomy.category_renamed', 'category', id, { name: dto.name });
    return result;
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Eliminar una categoría (la quita de los relatos que la usaban)' })
  async deleteCategory(@Req() req: AdminRequest, @Param('id') id: string) {
    const result = await this.taxonomyService.deleteCategory(id);
    await this.log(req, 'taxonomy.category_deleted', 'category', id);
    return result;
  }

  @Post('emotions')
  @ApiOperation({ summary: 'Crear una emoción' })
  async createEmotion(@Req() req: AdminRequest, @Body() dto: CreateEmotionDto) {
    const result = await this.taxonomyService.createEmotion(dto.name, dto.colorHex);
    await this.log(req, 'taxonomy.emotion_created', 'emotion', result.id, {
      name: result.name,
      colorHex: result.colorHex,
    });
    return result;
  }

  @Patch('emotions/:id')
  @ApiOperation({ summary: 'Actualizar una emoción (nombre y/o color)' })
  async updateEmotion(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEmotionDto,
  ) {
    const result = await this.taxonomyService.updateEmotion(id, {
      name: dto.name,
      colorHex: dto.colorHex,
    });
    await this.log(req, 'taxonomy.emotion_updated', 'emotion', id, {
      name: dto.name,
      colorHex: dto.colorHex,
    });
    return result;
  }

  @Delete('emotions/:id')
  @ApiOperation({ summary: 'Eliminar una emoción' })
  async deleteEmotion(@Req() req: AdminRequest, @Param('id') id: string) {
    const result = await this.taxonomyService.deleteEmotion(id);
    await this.log(req, 'taxonomy.emotion_deleted', 'emotion', id);
    return result;
  }

  @Post('tags')
  @ApiOperation({ summary: 'Crear una etiqueta' })
  async createTag(@Req() req: AdminRequest, @Body() dto: CreateTagDto) {
    const result = await this.taxonomyService.createTag(dto.name);
    await this.log(req, 'taxonomy.tag_created', 'tag', result.id, { name: result.name });
    return result;
  }

  @Patch('tags/:id')
  @ApiOperation({ summary: 'Renombrar una etiqueta' })
  async renameTag(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ) {
    const result = await this.taxonomyService.renameTag(id, dto.name);
    await this.log(req, 'taxonomy.tag_renamed', 'tag', id, { name: dto.name });
    return result;
  }

  @Delete('tags/:id')
  @ApiOperation({ summary: 'Eliminar una etiqueta' })
  async deleteTag(@Req() req: AdminRequest, @Param('id') id: string) {
    const result = await this.taxonomyService.deleteTag(id);
    await this.log(req, 'taxonomy.tag_deleted', 'tag', id);
    return result;
  }
}
