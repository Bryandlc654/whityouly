import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { env } from '../../config/env';
import { keyFromPublicUrl } from '../../common/storage/media-keys';
import { MEDIA_STORAGE, type MediaStorage } from '../../common/storage/media-storage';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Purga programada de cuentas cuya ventana de baja venció. Se ejecuta por lotes
 * para no bloquear la base con una cuenta con mucho contenido.
 *
 * La fila `User` no se borra: se anonimiza y queda como referencia para
 * auditoría y para no romper relaciones históricas. Se eliminan identidad
 * pública, contenido, datos privados, medios y sesiones. Los objetos de
 * almacenamiento se borran después de confirmar la transacción; si el storage
 * falla, el registro queda huérfano pero ya no es accesible desde la app.
 */
@Injectable()
export class AccountDeletionPurgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountDeletionPurgeService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  onModuleInit(): void {
    if (env.deletion.purgeIntervalMs <= 0) {
      return;
    }

    this.timer = setInterval(() => {
      void this.purgeExpired();
    }, env.deletion.purgeIntervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async purgeExpired(): Promise<number> {
    const now = new Date();
    const requests = await this.prisma.accountDeletionRequest.findMany({
      where: {
        completedAt: null,
        cancelledAt: null,
        eligibleAt: { lte: now },
      },
      orderBy: { eligibleAt: 'asc' },
      take: env.deletion.purgeBatchSize,
      select: { id: true },
    });

    let purged = 0;
    for (const request of requests) {
      try {
        if (await this.purgeOne(request.id)) purged += 1;
      } catch (error) {
        this.logger.error(
          `No se pudo purgar la solicitud ${request.id}: ${(error as Error).message}`,
        );
      }
    }

    if (purged > 0) {
      this.logger.log(`Cuentas purgadas: ${purged}`);
    }
    return purged;
  }

  async purgeOne(requestId: string): Promise<boolean> {
    const now = new Date();
    const request = await this.prisma.accountDeletionRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        userId: true,
        eligibleAt: true,
        cancelledAt: true,
        completedAt: true,
        user: { select: { id: true } },
      },
    });

    if (
      !request ||
      request.completedAt ||
      request.cancelledAt ||
      request.eligibleAt > now ||
      !request.user
    ) {
      return false;
    }

    const media = await this.prisma.mediaAsset.findMany({
      where: { userId: request.userId },
      select: { key: true, fileUrl: true },
    });

    const character = await this.prisma.character.findUnique({
      where: { userId: request.userId },
      select: { id: true, avatarUrl: true },
    });
    const storyIds = character
      ? (
          await this.prisma.story.findMany({
            where: { characterId: character.id },
            select: { id: true },
          })
        ).map((story) => story.id)
      : [];

    await this.prisma.$transaction(
      async (tx) => {
        if (storyIds.length > 0) {
          // Guardados de otras personas que apuntaban a relatos de esta cuenta.
          await tx.bookmark.deleteMany({
            where: { targetType: 'STORY', targetId: { in: storyIds } },
          });
        }

        await tx.bookmark.deleteMany({ where: { userId: request.userId } });
        await tx.emotionalLog.deleteMany({ where: { userId: request.userId } });
        await tx.treeDrop.deleteMany({ where: { userId: request.userId } });
        await tx.creation.deleteMany({ where: { userId: request.userId } });
        await tx.supportTicket.deleteMany({ where: { userId: request.userId } });
        await tx.notification.deleteMany({ where: { userId: request.userId } });
        await tx.appeal.deleteMany({ where: { appellantUserId: request.userId } });
        await tx.report.deleteMany({ where: { reporterUserId: request.userId } });
        await tx.oAuthIdentity.deleteMany({ where: { userId: request.userId } });
        await tx.userPreference.deleteMany({ where: { userId: request.userId } });
        await tx.session.deleteMany({ where: { userId: request.userId } });
        await tx.commentDraft.deleteMany({ where: { userId: request.userId } });

        // Al borrar el personaje caen sus relatos, etapas, comentarios,
        // seguidores y acompañamientos. Después se eliminan los medios.
        await tx.character.deleteMany({ where: { userId: request.userId } });
        await tx.mediaAsset.deleteMany({ where: { userId: request.userId } });

        await tx.user.update({
          where: { id: request.userId },
          data: {
            email: `deleted+${request.userId}@deleted.whityouly.invalid`,
            passwordHash: null,
            internalUsername: null,
            isEmailVerified: false,
            role: 'USER',
            status: 'DELETED',
          },
        });

        const completed = await tx.accountDeletionRequest.updateMany({
          where: {
            id: request.id,
            completedAt: null,
            cancelledAt: null,
            eligibleAt: { lte: now },
          },
          data: { completedAt: now },
        });

        if (completed.count === 0) {
          // Otra ejecución o una cancelación ganó la carrera: todo se revierte.
          throw new Error('La solicitud cambió de estado durante la purga.');
        }
      },
      { timeout: 60_000 },
    );

    const objectKeys = new Set<string>();
    for (const asset of media) {
      const key = asset.key ?? keyFromPublicUrl(asset.fileUrl, env.storage.publicBaseUrl);
      if (key) objectKeys.add(key);
    }
    if (character?.avatarUrl) {
      const avatarKey = keyFromPublicUrl(
        character.avatarUrl,
        env.storage.publicBaseUrl,
      );
      if (avatarKey) objectKeys.add(avatarKey);
    }

    await Promise.all(
      [...objectKeys].map((key) =>
        this.storage.deleteIfOwned(key).catch((error: Error) => {
          this.logger.warn(`No se pudo borrar el objeto ${key}: ${error.message}`);
        }),
      ),
    );

    return true;
  }
}
