import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { env } from '../../config/env';
import { SessionsService } from './sessions.service';

/**
 * Purga periódicamente las sesiones expiradas para evitar que la tabla crezca
 * indefinidamente. Usa `setInterval` con `unref` para no impedir el apagado.
 */
@Injectable()
export class SessionCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly sessionsService: SessionsService) {}

  onModuleInit(): void {
    if (env.sessionCleanupIntervalMs <= 0) {
      return;
    }

    this.timer = setInterval(() => {
      void this.cleanup();
    }, env.sessionCleanupIntervalMs);
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
      const deleted = await this.sessionsService.deleteExpired();
      if (deleted > 0) {
        this.logger.log(`Sesiones expiradas eliminadas: ${deleted}`);
      }
    } catch (error) {
      this.logger.warn(`Error purgando sesiones expiradas: ${(error as Error).message}`);
    }
  }
}
