import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';

export interface CooldownResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Cooldown por clave (con TTL) para evitar el abuso de acciones sensibles
 * como el envío repetido de correos. Redis si está disponible, o memoria.
 */
@Injectable()
export class CooldownService {
  private readonly logger = new Logger(CooldownService.name);
  private readonly memory = new Map<string, number>();

  constructor(private readonly redis: RedisService) {}

  private buildKey(rawKey: string): string {
    const hash = createHash('sha256').update(rawKey).digest('hex');
    return `cooldown:${hash}`;
  }

  async consume(rawKey: string, ttlMs: number): Promise<CooldownResult> {
    const key = this.buildKey(rawKey);
    const client = this.redis.getClient();

    if (client) {
      try {
        const acquired = await client.set(key, '1', { NX: true, PX: ttlMs });
        if (acquired) {
          return { allowed: true, retryAfterSeconds: 0 };
        }
        const ttl = await client.pTTL(key);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)) };
      } catch (error) {
        this.logger.warn(`No se pudo consultar el cooldown en Redis: ${(error as Error).message}`);
      }
    }

    const now = Date.now();
    const expiresAt = this.memory.get(key);
    if (expiresAt && expiresAt > now) {
      return { allowed: false, retryAfterSeconds: Math.ceil((expiresAt - now) / 1000) };
    }
    this.memory.set(key, now + ttlMs);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
