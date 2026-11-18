import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FilesService } from './files.service';
import { AdminAuditService } from '../admin/admin-audit.service';
import { ListAllFilesQueryDto } from './dto/list-files.dto';

type AdminRequest = Request & { user: { userId: string } };

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/files')
export class AdminFilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Listar los archivos de cualquier usuario (moderación)' })
  list(@Query() query: ListAllFilesQueryDto) {
    return this.filesService.listAll({
      userId: query.userId,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Borrar el archivo de cualquier usuario (moderación)' })
  @ApiResponse({ status: 409, description: 'El archivo está en uso en un relato o creación.' })
  async remove(@Req() req: AdminRequest, @Param('id') id: string) {
    const result = await this.filesService.removeAsModerator(id);
    await this.audit.log({
      actorUserId: req.user.userId,
      action: 'file.deleted',
      targetType: 'media_asset',
      targetId: id,
      ipAddress: req.ip,
    });
    return result;
  }
}
