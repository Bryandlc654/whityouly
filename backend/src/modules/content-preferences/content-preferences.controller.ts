import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContentPreferencesService } from './content-preferences.service';
import { CreateAuthorPreferenceDto } from './dto/content-preferences.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Content preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('content-preferences')
export class ContentPreferencesController {
  constructor(private readonly preferences: ContentPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar autores silenciados, bloqueados o con ver menos' })
  list(@Req() req: AuthenticatedRequest) {
    return this.preferences.list(req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Silenciar, bloquear o ver menos contenido de un autor' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAuthorPreferenceDto) {
    return this.preferences.create(req.user.userId, dto.authorName, dto.kind);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Quitar una preferencia de autor' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.preferences.remove(req.user.userId, id);
  }
}
