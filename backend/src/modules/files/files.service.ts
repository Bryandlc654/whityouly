import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';
import { QuotaService } from '../../common/quota/quota.service';
import {
  assertImageLooksValid,
  processImage,
  type ImageInput,
} from '../../common/media/process-image';
import { assertAudioLooksValid, type AudioInput } from '../../common/media/process-audio';
import { MEDIA_STORAGE, type MediaStorage } from '../../common/storage/media-storage';
import { audioKey, keyFromPublicUrl, mediaKey } from '../../common/storage/media-keys';

const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export interface MediaFile {
  id: string;
  fileUrl: string;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  entityType: string;
  createdAt: Date;
}

export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  /**
   * Sube una imagen a la biblioteca personal y la registra en `media_assets`.
   *
   * El archivo se guarda como `entityType: NONE`: está en la biblioteca pero
   * todavía no está adjunto a ningún relato ni creación. Quien lo adjunte
   * cambia ese campo, y a partir de ahí el archivo se considera en uso.
   */
  async upload(userId: string, file: ImageInput): Promise<MediaFile> {
    assertImageLooksValid(file, env.files.maxBytes);

    // Dos frenos: cadencia y cupo total. El primero limita la decodificación
    // repetida, que es lo caro; el segundo que la biblioteca crezca sin fin.
    const quota = await this.quota.consume(
      `file-upload:${userId}`,
      env.files.uploadsPerHour,
      60 * 60_000,
    );

    if (!quota.allowed) {
      throw new HttpException(
        `Has alcanzado el límite de ${quota.limit} subidas por hora. Inténtalo en ${quota.retryAfterSeconds} s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.assertWithinStorageQuota(userId);

    const image = await processImage(file.buffer, {
      maxBytes: env.files.maxBytes,
      maxPixels: env.files.maxPixels,
      quality: env.files.quality,
      maxDimension: env.files.maxDimension,
    });

    const key = mediaKey(userId, randomUUID());

    await this.storage.put({
      key,
      body: image.buffer,
      contentType: image.mimeType,
      cacheControl: CACHE_CONTROL,
    });

    try {
      const asset = await this.prisma.mediaAsset.create({
        data: {
          userId,
          fileUrl: this.storage.publicUrl(key),
          key,
          originalName: this.sanitizeOriginalName(file.originalname),
          mimeType: image.mimeType,
          sizeBytes: BigInt(image.sizeBytes),
          width: image.width || null,
          height: image.height || null,
          entityType: 'NONE',
        },
        select: ASSET_SELECT,
      });

      return this.toFile(asset);
    } catch (error) {
      // Si la BD falla, el objeto queda huérfano en el bucket. Se borra aquí y,
      // si tampoco se puede, la limpieza periódica lo recoge.
      await this.storage.delete(key).catch(() => undefined);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Fallo de BD al guardar el archivo: ${error.code}`);
      }
      throw error;
    }
  }

  /**
   * Sube un audio a la biblioteca personal. No se re-codifica (haría falta
   * ffmpeg): se valida la firma de los bytes y el tamaño, y se guarda tal cual.
   */
  async uploadAudio(userId: string, file: AudioInput): Promise<MediaFile> {
    const { extension } = assertAudioLooksValid(file, env.audio.maxBytes);

    const quota = await this.quota.consume(
      `audio-upload:${userId}`,
      env.audio.uploadsPerHour,
      60 * 60_000,
    );

    if (!quota.allowed) {
      throw new HttpException(
        `Has alcanzado el límite de ${quota.limit} audios por hora. Inténtalo en ${quota.retryAfterSeconds} s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.assertWithinStorageQuota(userId);

    const key = audioKey(userId, randomUUID(), extension);
    const mimeType = file.mimetype ?? 'application/octet-stream';

    await this.storage.put({
      key,
      body: file.buffer,
      contentType: mimeType,
      cacheControl: CACHE_CONTROL,
    });

    try {
      const asset = await this.prisma.mediaAsset.create({
        data: {
          userId,
          fileUrl: this.storage.publicUrl(key),
          key,
          originalName: this.sanitizeOriginalName(file.originalname),
          mimeType,
          sizeBytes: BigInt(file.buffer.byteLength),
          entityType: 'NONE',
        },
        select: ASSET_SELECT,
      });

      return this.toFile(asset);
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Fallo de BD al guardar el audio: ${error.code}`);
      }
      throw error;
    }
  }

  /** Biblioteca del usuario, paginada por cursor: el offset se encarece en tablas grandes. */
  async list(userId: string, cursor?: string, limit?: number) {
    const take = Math.min(Math.max(limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.mediaAsset.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: ASSET_SELECT,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items: items.map((asset) => this.toFile(asset)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Borra un archivo de la biblioteca. Se rechaza si algo lo referencia: el
   * archivo dejaría de existir en un relato o en una creación.
   */
  async remove(userId: string, assetId: string): Promise<{ id: string }> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, userId },
      select: { id: true, key: true, fileUrl: true },
    });

    if (!asset) {
      throw new NotFoundException('Ese archivo no existe en tu biblioteca.');
    }

    await this.assertNotReferenced(asset.id);

    await this.prisma.mediaAsset.delete({ where: { id: asset.id } });
    await this.deleteStoredObject(asset.key, asset.fileUrl);

    return { id: asset.id };
  }

  /** Vista de administración: lista los archivos de cualquier usuario. */
  async listAll(options: { userId?: string; cursor?: string; limit?: number }) {
    const take = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.mediaAsset.findMany({
      where: options.userId ? { userId: options.userId } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      select: { ...ASSET_SELECT, userId: true },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items: items.map((asset) => ({ ...this.toFile(asset), userId: asset.userId })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /** Borrado de moderación: no exige ser el propietario. */
  async removeAsModerator(assetId: string): Promise<{ id: string }> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
      select: { id: true, key: true, fileUrl: true },
    });

    if (!asset) {
      throw new NotFoundException('Ese archivo no existe.');
    }

    await this.assertNotReferenced(asset.id);

    await this.prisma.mediaAsset.delete({ where: { id: asset.id } });
    await this.deleteStoredObject(asset.key, asset.fileUrl);

    return { id: asset.id };
  }

  private async assertWithinStorageQuota(userId: string) {
    const total = await this.prisma.mediaAsset.aggregate({
      where: { userId },
      _sum: { sizeBytes: true },
    });

    const used = total._sum.sizeBytes ?? 0n;
    const limit = BigInt(env.files.maxTotalBytes);

    if (used + BigInt(env.files.maxBytes) > limit) {
      const usedMb = Math.round(Number(used) / (1024 * 1024));
      const limitMb = Math.round(env.files.maxTotalBytes / (1024 * 1024));
      throw new ConflictException(
        `Tu biblioteca ocupa ${usedMb} MB y el máximo es ${limitMb} MB. Borra algún archivo para subir otro.`,
      );
    }
  }

  /**
   * Un archivo adjunto a un relato, una creación o una pista no se puede borrar.
   * Se comprueba antes de borrar la fila para poder explicar el motivo; la clave
   * ajena lo impediría, pero con un error incomprensible.
   */
  private async assertNotReferenced(assetId: string) {
    const [storyUpdate, creation, musicTrack] = await Promise.all([
      this.prisma.storyUpdate.count({ where: { mediaAssetId: assetId } }),
      this.prisma.creation.count({ where: { mediaAssetId: assetId } }),
      this.prisma.musicTrack.count({ where: { mediaAssetId: assetId } }),
    ]);

    if (storyUpdate + creation + musicTrack > 0) {
      throw new ConflictException(
        'Ese archivo está en uso en un relato, una creación o una pista. Quítalo de ahí antes de borrarlo.',
      );
    }
  }

  private async deleteStoredObject(key: string | null, fileUrl: string) {
    const resolved = key ?? keyFromPublicUrl(fileUrl, env.storage.publicBaseUrl);
    if (!resolved) {
      return;
    }
    await this.storage.delete(resolved);
  }

  /**
   * El nombre original solo se guarda para que quien lo sube lo reconozca. Se
   * recorta y se queda con el nombre de archivo: nada de rutas ni separadores.
   */
  private sanitizeOriginalName(originalName?: string): string | null {
    if (!originalName) {
      return null;
    }
    const base = originalName.split(/[\\/]/).pop()?.trim() ?? '';
    const cleaned = base.replace(/[\p{Cc}\p{Cf}]/gu, '').slice(0, 120).trim();
    return cleaned === '' ? null : cleaned;
  }

  private toFile(asset: {
    id: string;
    fileUrl: string;
    originalName: string | null;
    mimeType: string | null;
    sizeBytes: bigint | null;
    width: number | null;
    height: number | null;
    entityType: string;
    createdAt: Date;
  }): MediaFile {
    return {
      id: asset.id,
      fileUrl: asset.fileUrl,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      // BigInt no se puede serializar en JSON: sin esto la respuesta revienta.
      sizeBytes: asset.sizeBytes === null ? null : Number(asset.sizeBytes),
      width: asset.width,
      height: asset.height,
      entityType: asset.entityType,
      createdAt: asset.createdAt,
    };
  }
}

const ASSET_SELECT = {
  id: true,
  fileUrl: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  entityType: true,
  createdAt: true,
} satisfies Prisma.MediaAssetSelect;
