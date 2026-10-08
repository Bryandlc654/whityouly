import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { env } from '../../config/env';
import { IMAGE_ALLOWED_MIME_TYPES, type ImageInput } from '../../common/media/process-image';
import { AUDIO_ALLOWED_MIME_TYPES, type AudioInput } from '../../common/media/process-audio';
import { FilesService } from './files.service';
import { ListFilesQueryDto } from './dto/list-files.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

const ALLOWED_MIME_TYPES = new Set(IMAGE_ALLOWED_MIME_TYPES);
const ALLOWED_AUDIO_MIME_TYPES = new Set(AUDIO_ALLOWED_MIME_TYPES);

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60 * 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: env.files.maxBytes,
        files: 1,
        fields: 4,
        parts: 6,
      },
      fileFilter: (_req, file, callback) => {
        // Criba rápida por MIME declarado; la decisión final la toma sharp
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
  @ApiOperation({
    summary: 'Subir una imagen a tu biblioteca (JPEG/PNG/WebP, se normaliza a WebP)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Archivo guardado en la biblioteca.' })
  @ApiResponse({ status: 409, description: 'La biblioteca ha alcanzado su cupo.' })
  @ApiResponse({ status: 413, description: 'La imagen supera el tamaño máximo permitido.' })
  @ApiResponse({ status: 415, description: 'Formato de imagen no permitido.' })
  upload(@Req() req: AuthenticatedRequest, @UploadedFile() file: ImageInput) {
    if (!file) {
      throw new BadRequestException('Falta el archivo de imagen en el campo "file".');
    }
    return this.filesService.upload(req.user.userId, file);
  }

  @Post('audio')
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: env.audio.maxBytes,
        files: 1,
        fields: 4,
        parts: 6,
      },
      fileFilter: (_req, file, callback) => {
        // Criba rápida por MIME declarado; la firma real la comprueba el servicio.
        if (!ALLOWED_AUDIO_MIME_TYPES.has((file.mimetype ?? '').toLowerCase())) {
          callback(
            new UnsupportedMediaTypeException('Solo se aceptan audios MP3, M4A, AAC, OGG, WAV o WebM.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Subir un audio a tu biblioteca (MP3/M4A/AAC/OGG/WAV/WebM)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Audio guardado en la biblioteca.' })
  @ApiResponse({ status: 409, description: 'La biblioteca ha alcanzado su cupo.' })
  @ApiResponse({ status: 413, description: 'El audio supera el tamaño máximo permitido.' })
  @ApiResponse({ status: 415, description: 'Formato de audio no permitido.' })
  uploadAudio(@Req() req: AuthenticatedRequest, @UploadedFile() file: AudioInput) {
    if (!file) {
      throw new BadRequestException('Falta el archivo de audio en el campo "file".');
    }
    return this.filesService.uploadAudio(req.user.userId, file);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tu biblioteca de archivos, paginada por cursor' })
  list(@Req() req: AuthenticatedRequest, @Query() query: ListFilesQueryDto) {
    return this.filesService.list(req.user.userId, query.cursor, query.limit);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar un archivo de tu biblioteca' })
  @ApiResponse({ status: 404, description: 'El archivo no existe en tu biblioteca.' })
  @ApiResponse({ status: 409, description: 'El archivo está en uso en un relato o creación.' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.filesService.remove(req.user.userId, id);
  }
}
