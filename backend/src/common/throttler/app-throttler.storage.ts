import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

type ThrottlerRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Selecciona el almacén de rate limiting según la configuración:
 * Redis si REDIS_URL está definido (recomendado en producción con varias instancias),
 * o el almacén en memoria por defecto en caso contrario.
 */
@Injectable()
export class AppThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly logger = new Logger(AppThrottlerStorage.name);
  private readonly delegate: ThrottlerStorage;

  constructor(redisService: RedisService) {
    const client = redisService.getClient();
    if (client) {
      this.delegate = new RedisThrottlerStorage(client);
      this.logger.log('Rate limiting respaldado por Redis');
    } else {
      this.delegate = new ThrottlerStorageService();
      this.logger.warn('Rate limiting en memoria (no apto para múltiples instancias)');
    }
  }

  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerRecord> {
    return this.delegate.increment(key, ttl, limit, blockDuration, throttlerName);
  }

  onApplicationShutdown(): void {
    if (this.delegate instanceof ThrottlerStorageService) {
      this.delegate.onApplicationShutdown();
    }
  }
}
