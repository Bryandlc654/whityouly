import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import sharp from 'sharp';
import { PrismaService } from '../../../prisma/prisma.service';
import { env } from '../../../config/env';
import { avatarKey, keyFromPublicUrl } from '../../../common/storage/media-keys';
import { MEDIA_STORAGE, type MediaStorage } from '../../../common/storage/media-storage';
import { QuotaService } from '../../../common/quota/quota.service';

export interface AvatarUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
/** MIME declarados que aceptamos. La verificación real se hace sobre los bytes. */
export const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_MIME_TYPES = new Set(AVATAR_ALLOWED_MIME_TYPES);
const OUTPUT_MIME = 'image/webp';
// Un año: la clave cambia en cada subida, así que el contenido es inmutable.
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  /**
   * Sube y normaliza el avatar del personaje.
   *
   * La imagen se re-codifica siempre a WebP con `sharp`, lo que:
   * - ignora el `Content-Type` declarado por el cliente (nos fiamos de los bytes);
   * - neutraliza SVG/HTML incrustados y payloads polimórficos;
   * - descarta metadatos EXIF (incluida geolocalización) por defecto;
   * - fija dimensiones y tamaño, impidiendo imágenes bomba olachasmas.
   */
  async uploadAvatar(userId: string, file: AvatarUpload) {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true, avatarUrl: true },
    });

    if (!character) {
      throw new NotFoundException('Todavía no has creado tu personaje.');
    }

    // Cuota por usuario: frena el abuso de la decodificación de imágenes, que
    // es la parte cara de este endpoint.
    const quota = await this.quota.consume(
      `avatar-upload:${userId}`,
      env.avatar.uploadsPerHour,
      60 * 60_000,
    );

    if (!quota.allowed) {
      throw new HttpException(
        `Has alcanzado el límite de ${quota.limit} subidas de avatar por hora. Inténtalo en ${quota.retryAfterSeconds} s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.assertFileLooksLikeImage(file);

    const output = await this.processImage(file.buffer);
    const key = avatarKey(character.id, randomUUID());

    await this.storage.put({
      key,
      body: output,
      contentType: OUTPUT_MIME,
      cacheControl: CACHE_CONTROL,
    });

    const url = this.storage.publicUrl(key);

    try {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.mediaAsset.create({
          data: {
            userId,
            fileUrl: url,
            mimeType: OUTPUT_MIME,
            sizeBytes: BigInt(output.byteLength),
            entityType: 'AVATAR',
            entityId: character.id,
          },
        }),
        this.prisma.character.update({
          where: { id: character.id },
          data: { avatarUrl: url },
          select: { id: true, name: true, avatarUrl: true, updatedAt: true },
        }),
      ]);

      // El objeto anterior ya no se referencia: se elimina fuera de la transacción
      // para no bloquearla con una llamada de red.
      await this.deleteOwnedUrl(character.avatarUrl);

      return { ...updated, sizeBytes: output.byteLength, mimeType: OUTPUT_MIME };
    } catch (error) {
      // Si la BD falla, no dejamos el archivo huérfano en el almacenamiento.
      await this.storage.delete(key).catch(() => undefined);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Fallo de BD al guardar el avatar: ${error.code}`);
      }
      throw error;
    }
  }

  async removeAvatar(userId: string) {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true, avatarUrl: true, name: true, updatedAt: true },
    });

    if (!character) {
      throw new NotFoundException('Todavía no has creado tu personaje.');
    }

    if (!character.avatarUrl) {
      return { id: character.id, name: character.name, avatarUrl: null };
    }

    await this.prisma.character.update({
      where: { id: character.id },
      data: { avatarUrl: null },
      select: { id: true, name: true, avatarUrl: true, updatedAt: true },
    });

    await this.deleteOwnedUrl(character.avatarUrl);

    return { id: character.id, name: character.name, avatarUrl: null };
  }

  /** Criba rápida por MIME declarado; la validación real la hace sharp. */
  private assertFileLooksLikeImage(file: AvatarUpload) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('El archivo de imagen está vacío.');
    }

    if (file.size > env.avatar.maxBytes || file.buffer.length > env.avatar.maxBytes) {
      throw new PayloadTooLargeException(
        `La imagen supera el máximo de ${Math.floor(env.avatar.maxBytes / 1024)} KB.`,
      );
    }

    // Comprobación previa por MIME declarado: es una criba rápida, no la
    // validación definitiva (esa la hace sharp leyendo la cabecera real).
    if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      throw new UnsupportedMediaTypeException('Solo se aceptan imágenes JPEG, PNG o WebP.');
    }
  }

  private async processImage(buffer: Buffer): Promise<Buffer> {
    let metadata: sharp.Metadata;

    try {
      metadata = await sharp(buffer, {
        failOn: 'error',
        limitInputPixels: env.avatar.maxPixels,
        sequentialRead: true,
      }).metadata();
    } catch {
      throw new BadRequestException('El archivo no es una imagen válida o está corrupto.');
    }

    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      // Cubre SVG y cualquier formato no soportado, que son vectores de XSS.
      throw new UnsupportedMediaTypeException('Formato no permitido. Usa JPEG, PNG o WebP.');
    }

    const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
    if (pixels <= 0 || pixels > env.avatar.maxPixels) {
      throw new BadRequestException('La imagen tiene dimensiones no permitidas.');
    }

    try {
      return await sharp(buffer, { failOn: 'error', limitInputPixels: env.avatar.maxPixels })
        .rotate() // aplica la orientación EXIF y luego la descarta
        .resize(env.avatar.outputSize, env.avatar.outputSize, {
          fit: 'cover',
          position: 'centre',
          withoutEnlargement: true,
        })
        .webp({ quality: env.avatar.quality, effort: 4 })
        .toBuffer();
    } catch {
      throw new BadRequestException('No se pudo procesar la imagen.');
    }
  }

  /** Borra el objeto solo si la URL es nuestra; nunca toca recursos ajenos. */
  private async deleteOwnedUrl(url: string | null) {
    if (!url) {
      return;
    }
    const key = keyFromPublicUrl(url, env.storage.publicBaseUrl);
    if (!key) {
      // URL heredada de un dominio externo: no es nuestra, se ignora.
      return;
    }
    await this.storage.delete(key);
  }
}
