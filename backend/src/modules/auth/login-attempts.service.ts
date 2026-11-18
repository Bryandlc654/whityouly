import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { env } from '../../config/env';
import { RedisService } from '../../common/redis/redis.service';

export interface LockStatus {
  locked: boolean;
  retryAfterSeconds: number;
  /**
   * Retardo progresivo por cuenta. No bloquea la cuenta (evita que un tercero
   * la deje fuera de servicio con cinco intentos), pero frena el fuerza bruta
   * distribuido que rota direcciones IP.
   */
  delayMs: number;
}

interface MemoryEntry {
  count: number;
  expiresAt: number;
}

/**
 * Intentos fallidos de inicio de sesión.
 *
 * - `email+IP`: 5 fallos bloquean ese par 15 minutos. Un atacante ya no puede
 *   bloquear la cuenta de otra persona desde su propia IP.
 * - `IP`: un límite más alto frena la prueba masiva de correos desde una sola
 *   dirección.
 * - `cuenta`: no hay bloqueo duro; a partir del umbral se añade un retardo
 *   progresivo. Así la cuenta sigue siendo accesible para su dueño incluso si
 *   alguien intenta dejarla bloqueada.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly logger = new Logger(LoginAttemptsService.name);
  private readonly memory = new Map<string, MemoryEntry>();

  constructor(private readonly redis: RedisService) {}

  private hash(value: string): string {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
  }

  private pairKey(email: string, ip: string): string {
    return `login:fail:pair:${this.hash(email)}:${this.hash(ip)}`;
  }

  private ipKey(ip: string): string {
    return `login:fail:ip:${this.hash(ip)}`;
  }

  private accountKey(email: string): string {
    return `login:fail:account:${this.hash(email)}`;
  }

  async getStatus(email: string, ip = 'unknown'): Promise<LockStatus> {
    const keys = {
      pair: this.pairKey(email, ip),
      ip: this.ipKey(ip),
      account: this.accountKey(email),
    };
    const client = this.redis.getClient();

    if (client) {
      try {
        const [pair, byIp, account] = await Promise.all([
          client.get(keys.pair),
          client.get(keys.ip),
          client.get(keys.account),
        ]);

        if (Number(pair ?? 0) >= env.loginMaxAttempts) {
          const ttl = await client.pTTL(keys.pair);
          return {
            locked: true,
            retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)),
            delayMs: 0,
          };
        }
        if (byIp !== null && Number(byIp) >= env.loginIpMaxAttempts) {
          const ttl = await client.pTTL(keys.ip);
          return {
            locked: true,
            retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)),
            delayMs: 0,
          };
        }

        return this.delayStatus(Number(account ?? 0));
      } catch (error) {
        this.logger.warn(`No se pudo consultar intentos en Redis: ${(error as Error).message}`);
      }
    }

    return this.getStatusFromMemory(keys);
  }

  async recordFailure(email: string, ip = 'unknown'): Promise<void> {
    const keys = [this.pairKey(email, ip), this.ipKey(ip), this.accountKey(email)];
    const client = this.redis.getClient();

    if (client) {
      try {
        for (const key of keys) {
          const count = await client.incr(key);
          if (count === 1) {
            await client.pExpire(key, env.loginLockDurationMs);
          }
        }
        return;
      } catch (error) {
        this.logger.warn(`No se pudo registrar el intento en Redis: ${(error as Error).message}`);
      }
    }

    for (const key of keys) {
      this.recordFailureInMemory(key);
    }
  }

  async reset(email: string, ip = 'unknown'): Promise<void> {
    const keys = [this.pairKey(email, ip), this.accountKey(email)];
    const client = this.redis.getClient();

    if (client) {
      try {
        await Promise.all(keys.map((key) => client.del(key)));
        return;
      } catch (error) {
        this.logger.warn(`No se pudo limpiar intentos en Redis: ${(error as Error).message}`);
      }
    }

    for (const key of keys) {
      this.memory.delete(key);
    }
  }

  private delayStatus(failures: number): LockStatus {
    if (failures < env.loginAccountDelayThreshold) {
      return { locked: false, retryAfterSeconds: 0, delayMs: 0 };
    }
    const extra = failures - env.loginAccountDelayThreshold + 1;
    return {
      locked: false,
      retryAfterSeconds: 0,
      delayMs: Math.min(extra * env.loginAccountDelayStepMs, env.loginAccountDelayMaxMs),
    };
  }

  private getStatusFromMemory(keys: {
    pair: string;
    ip: string;
    account: string;
  }): LockStatus {
    const now = Date.now();

    for (const key of [keys.pair, keys.ip]) {
      const entry = this.memory.get(key);
      if (!entry || entry.expiresAt <= now) {
        this.memory.delete(key);
        continue;
      }
      const limit =
        key === keys.pair ? env.loginMaxAttempts : env.loginIpMaxAttempts;
      if (entry.count >= limit) {
        return {
          locked: true,
          retryAfterSeconds: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
          delayMs: 0,
        };
      }
    }

    const account = this.memory.get(keys.account);
    const failures = account && account.expiresAt > now ? account.count : 0;
    return this.delayStatus(failures);
  }

  private recordFailureInMemory(key: string): void {
    const now = Date.now();
    const entry = this.memory.get(key);

    if (!entry || entry.expiresAt <= now) {
      this.memory.set(key, { count: 1, expiresAt: now + env.loginLockDurationMs });
      return;
    }

    entry.count += 1;
  }
}
