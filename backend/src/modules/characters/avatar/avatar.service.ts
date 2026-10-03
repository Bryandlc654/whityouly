import { randomUUID } from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { env } from '../../../config/env';
import { avatarKey, keyFromPublicUrl } from '../../../common/storage/media-keys';
import { MEDIA_STORAGE, type MediaStorage } from '../../../common/storage/media-storage';
import { QuotaService } from '../../../common/quota/quota.service';
import {
  IMAGE_ALLOWED_MIME_TYPES,
  assertImageLooksValid,
  processImage,
  type ImageInput,
} from '../../../common/media/process-image';

export interface AvatarUpload extends ImageInput {}

/** Se reexporta para no cambiar el contrato que ya consume el controlador. */
export const AVATAR_ALLOWED_MIME_TYPES = IMAGE_ALLOWED_MIME_TYPES;

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

    assertImageLooksValid(file, env.avatar.maxBytes);

    const image = await processImage(file.buffer, {
      maxBytes: env.avatar.maxBytes,
      maxPixels: env.avatar.maxPixels,
      quality: env.avatar.quality,
      square: env.avatar.outputSize,
    });
    const key = avatarKey(character.id, randomUUID());

    await this.storage.put({
      key,
      body: image.buffer,
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
            key,
            mimeType: OUTPUT_MIME,
            sizeBytes: BigInt(image.buffer.byteLength),
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

      return { ...updated, sizeBytes: image.buffer.byteLength, mimeType: OUTPUT_MIME };
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
