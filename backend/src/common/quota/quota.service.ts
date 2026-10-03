import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

export interface QuotaResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Cuota por ventana y clave (p. ej. "subidas de avatar por usuario y hora").
 * Con Redis el contador es compartido entre instancias; sin Redis cae a un
 * contador en memoria (suficiente para desarrollo o despliegues de una sola
 * réplica).
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);
  private readonly memory = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly redis: RedisService) {}

  async consume(rawKey: string, limit: number, windowMs: number): Promise<QuotaResult> {
    const key = this.buildKey(rawKey);
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    const client = this.redis.getClient();

    if (client) {
      try {
        const count = await client.incr(key);
        if (count === 1) {
          await client.expire(key, windowSeconds);
        }
        if (count > limit) {
          const ttl = Math.max(1, (await client.pTTL(key)) / 1000);
          return {
            allowed: false,
            limit,
            remaining: 0,
            retryAfterSeconds: Math.ceil(ttl),
          };
        }
        return {
          allowed: true,
          limit,
          remaining: limit - count,
          retryAfterSeconds: 0,
        };
      } catch (error) {
        this.logger.warn(`No se pudo consultar la cuota en Redis: ${(error as Error).message}`);
      }
    }

    const now = Date.now();
    const entry = this.memory.get(key);
    const current =
      entry && entry.expiresAt > now ? entry : { count: 0, expiresAt: now + windowMs };
    current.count += 1;
    this.memory.set(key, current);

    if (current.count > limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds: Math.ceil((current.expiresAt - now) / 1000),
      };
    }

    return {
      allowed: true,
      limit,
      remaining: limit - current.count,
      retryAfterSeconds: 0,
    };
  }

  private buildKey(rawKey: string): string {
    const hash = createHash('sha256').update(rawKey).digest('hex');
    return `quota:${hash}`;
  }
}
