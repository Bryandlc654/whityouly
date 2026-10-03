import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { createClient } from 'redis';
import { env } from '../../config/env';

export type RedisClient = ReturnType<typeof createClient>;

/**
 * Cliente Redis compartido y opcional. Si REDIS_URL no está configurado,
 * `enabled` es false y los consumidores usan un respaldo en memoria.
 */
@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClient | null = null;

  constructor() {
    if (env.redisUrl) {
      const client = createClient({ url: env.redisUrl });
      client.on('error', (error: Error) => {
        this.logger.error(`Error de conexión con Redis: ${error.message}`);
      });
      client.connect().catch((error: Error) => {
        this.logger.error(`No se pudo conectar a Redis: ${error.message}`);
      });
      this.client = client;
      this.logger.log('Cliente Redis inicializado');
    } else {
      this.logger.warn('REDIS_URL no configurado: se usará almacenamiento en memoria');
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  getClient(): RedisClient | null {
    return this.client;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit().catch((error: Error) => {
        this.logger.warn(`No se pudo cerrar la conexión Redis: ${error.message}`);
      });
    }
  }
}
