import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { env } from '../../../config/env';
import { keyFromPublicUrl } from '../../../common/storage/media-keys';
import { MEDIA_STORAGE, type MediaStorage } from '../../../common/storage/media-storage';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Purga los avatares que ya no referencia ningún personaje.
 *
 * Al reemplazar o borrar un avatar borramos el objeto de inmediato, pero un
 * fallo a medio camino (o un despliegue interrumpido) puede dejar binaries
 * huérfanos en el bucket. Este servicio los reconcilia periódicamente para que
 * el almacenamiento no crezca sin control.
 */
@Injectable()
export class MediaCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.cleanupOrphanAvatars();
    }, env.avatar.mediaCleanupIntervalMs);
    // No mantiene el proceso vivo solo por el timer.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /** Devuelve cuántas filas de `media_assets` se purgaron. */
  async cleanupOrphanAvatars(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - env.avatar.orphanTtlMs);

    // Solo se consideran avatares antiguos: da margen a que una subida en
    // curso termine su transacción antes de ser considerada huérfana.
    const candidates = await this.prisma.mediaAsset.findMany({
      where: {
        entityType: 'AVATAR',
        createdAt: { lt: cutoff },
      },
      select: { id: true, fileUrl: true },
      take: 500,
    });

    if (candidates.length === 0) {
      return 0;
    }

    const referenced = await this.prisma.character.findMany({
      where: { avatarUrl: { in: candidates.map((asset) => asset.fileUrl) } },
      select: { avatarUrl: true },
    });
    const referencedUrls = new Set(referenced.map((character) => character.avatarUrl));

    const orphans = candidates.filter((asset) => !referencedUrls.has(asset.fileUrl));
    if (orphans.length === 0) {
      return 0;
    }

    for (const orphan of orphans) {
      const key = keyFromPublicUrl(orphan.fileUrl, env.storage.publicBaseUrl);
      if (key) {
        await this.storage.delete(key);
      }
    }

    await this.prisma.mediaAsset.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
    this.logger.log(`Avatares huérfanos purgados: ${orphans.length}`);
    return orphans.length;
  }
}
