import { describe, expect, it, vi } from 'vitest';
import { LoginAttemptsService } from './login-attempts.service';
import type { RedisService } from '../../common/redis/redis.service';

const service = new LoginAttemptsService({
  getClient: () => null,
} as unknown as RedisService);

describe('LoginAttemptsService', () => {
  it('bloquea el par correo+IP tras los fallos configurados', async () => {
    const email = `pair-${Date.now()}@example.com`;
    const ip = '203.0.113.10';

    for (let i = 0; i < 5; i += 1) {
      await service.recordFailure(email, ip);
    }

    await expect(service.getStatus(email, ip)).resolves.toMatchObject({
      locked: true,
    });
    // Otra IP no queda bloqueada por los fallos de la primera.
    await expect(service.getStatus(email, '203.0.113.11')).resolves.toMatchObject({
      locked: false,
    });
  });

  it('no bloquea la cuenta tras cinco fallos desde IPs distintas', async () => {
    const email = `distributed-${Date.now()}@example.com`;

    for (let i = 0; i < 5; i += 1) {
      await service.recordFailure(email, `198.51.100.${i}`);
    }

    await expect(service.getStatus(email, '198.51.100.99')).resolves.toMatchObject({
      locked: false,
    });
  });

  it('añade un retardo progresivo tras muchos fallos de cuenta', async () => {
    const email = `delay-${Date.now()}@example.com`;

    for (let i = 0; i < 10; i += 1) {
      await service.recordFailure(email, `192.0.2.${i}`);
    }

    const status = await service.getStatus(email, '192.0.2.250');
    expect(status.locked).toBe(false);
    expect(status.delayMs).toBeGreaterThan(0);
  });
});
