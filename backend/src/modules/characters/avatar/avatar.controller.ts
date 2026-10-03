import {
  BadRequestException,
  Controller,
  Delete,
  Post,
  Req,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { env } from '../../../config/env';
import { AvatarService, AVATAR_ALLOWED_MIME_TYPES, type AvatarUpload } from './avatar.service';

type AuthenticatedRequest = Request & { user: { userId: string } };

const ALLOWED_MIME_TYPES = new Set(AVATAR_ALLOWED_MIME_TYPES);

@ApiTags('Characters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('characters')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Post('me/avatar')
  // Límite global de la API + límite por endpoint. El de uploads es el más
  // estricto porque cada petición consume CPU de decodificación.
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: env.avatar.maxBytes,
        files: 1,
        fields: 4,
        parts: 6,
      },
      fileFilter: (_req, file, callback) => {
        // Criba rápida por MIME declarado. La decisión final la toma sharp
        // leyendo los bytes, así que un MIME mentiroso no cuela.
        if (!ALLOWED_MIME_TYPES.has((file.mimetype ?? '').toLowerCase())) {
          callback(
            new UnsupportedMediaTypeException('Solo se aceptan imágenes JPEG, PNG o WebP.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Subir el avatar del personaje (JPEG/PNG/WebP, se normaliza a WebP)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Avatar actualizado.' })
  @ApiResponse({ status: 413, description: 'La imagen supera el tamaño máximo permitido.' })
  @ApiResponse({ status: 415, description: 'Formato de imagen no permitido.' })
  uploadAvatar(@Req() req: AuthenticatedRequest, @UploadedFile() file: AvatarUpload) {
    if (!file) {
      throw new BadRequestException('Falta el archivo de imagen en el campo "file".');
    }
    return this.avatarService.uploadAvatar(req.user.userId, file);
  }

  @Delete('me/avatar')
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Quitar el avatar del personaje' })
  @ApiResponse({ status: 200, description: 'Avatar eliminado.' })
  removeAvatar(@Req() req: AuthenticatedRequest) {
    return this.avatarService.removeAvatar(req.user.userId);
  }
}
