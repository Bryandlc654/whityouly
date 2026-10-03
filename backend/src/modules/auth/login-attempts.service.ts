import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { env } from '../../config/env';
import { RedisService } from '../../common/redis/redis.service';

export interface LockStatus {
  locked: boolean;
  retryAfterSeconds: number;
}

/**
 * Control de intentos fallidos de inicio de sesión por cuenta (no por IP).
 * Bloquea temporalmente una cuenta tras varios fallos, incluso si el atacante
 * rota direcciones IP. Respaldado por Redis si está disponible, o en memoria.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly logger = new Logger(LoginAttemptsService.name);
  private readonly memory = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly redis: RedisService) {}

  private key(identifier: string): string {
    const hash = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');
    return `login:fail:${hash}`;
  }

  async getStatus(identifier: string): Promise<LockStatus> {
    const key = this.key(identifier);
    const client = this.redis.getClient();

    if (client) {
      try {
        const count = Number((await client.get(key)) ?? 0);
        if (count < env.loginMaxAttempts) {
          return { locked: false, retryAfterSeconds: 0 };
        }
        const ttl = await client.pTTL(key);
        return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)) };
      } catch (error) {
        this.logger.warn(`No se pudo consultar intentos en Redis: ${(error as Error).message}`);
      }
    }

    return this.getStatusFromMemory(key);
  }

  async recordFailure(identifier: string): Promise<void> {
    const key = this.key(identifier);
    const client = this.redis.getClient();

    if (client) {
      try {
        const count = await client.incr(key);
        if (count === 1 || count >= env.loginMaxAttempts) {
          await client.pExpire(key, env.loginLockDurationMs);
        }
        return;
      } catch (error) {
        this.logger.warn(`No se pudo registrar el intento en Redis: ${(error as Error).message}`);
      }
    }

    this.recordFailureInMemory(key);
  }

  async reset(identifier: string): Promise<void> {
    const key = this.key(identifier);
    const client = this.redis.getClient();

    if (client) {
      try {
        await client.del(key);
        return;
      } catch (error) {
        this.logger.warn(`No se pudo limpiar intentos en Redis: ${(error as Error).message}`);
      }
    }

    this.memory.delete(key);
  }

  private getStatusFromMemory(key: string): LockStatus {
    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return { locked: false, retryAfterSeconds: 0 };
    }
    if (entry.count < env.loginMaxAttempts) {
      return { locked: false, retryAfterSeconds: 0 };
    }
    return { locked: true, retryAfterSeconds: Math.ceil((entry.expiresAt - Date.now()) / 1000) };
  }

  private recordFailureInMemory(key: string): void {
    const now = Date.now();
    const entry = this.memory.get(key);

    if (!entry || entry.expiresAt <= now) {
      this.memory.set(key, { count: 1, expiresAt: now + env.loginLockDurationMs });
      return;
    }

    entry.count += 1;
    if (entry.count >= env.loginMaxAttempts) {
      entry.expiresAt = now + env.loginLockDurationMs;
    }
  }
}
