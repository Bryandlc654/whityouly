import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Poda periódica de la bandeja: cada usuario conserva como mucho
 * `maxPerUser` avisos (los más recientes) y el resto se borra. Sin esto, la
 * tabla de notificaciones crecería sin techo: cada etapa de un relato seguido
 * genera un aviso por seguidor, y un relato popular los multiplica.
 *
 * Se hace con `row_number()` en una pasada: la ventana es barata (la tabla ya
 * está acotada por esta misma tarea) y el borrado es un único DELETE.
 */
@Injectable()
export class NotificationCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (env.notifications.cleanupIntervalMs <= 0) {
      return;
    }

    this.timer = setInterval(() => {
      void this.cleanup();
    }, env.notifications.cleanupIntervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const cap = env.notifications.maxPerUser;
      const deleted = await this.prisma.$executeRaw`
        WITH "stale" AS (
          SELECT "id",
                 row_number() OVER (
                   PARTITION BY "userId"
                   ORDER BY "createdAt" DESC, "id" DESC
                 ) AS "rn"
          FROM "notifications"
        )
        DELETE FROM "notifications" AS "n"
        USING "stale"
        WHERE "stale"."id" = "n"."id" AND "stale"."rn" > ${cap}
      `;

      if (deleted > 0) {
        this.logger.log(`Notificaciones antiguas podadas: ${deleted}`);
      }
    } catch (error) {
      this.logger.warn(`Error podando notificaciones: ${(error as Error).message}`);
    }
  }
}