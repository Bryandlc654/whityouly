import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisClient } from '../redis/redis.service';

type ThrottlerRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

// Script atómico: incrementa el contador, fija el TTL y calcula el bloqueo.
const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])
local isBlocked = 0
local blockTtl = 0
if blockDuration > 0 then
  local existing = redis.call('PTTL', KEYS[2])
  if existing > 0 then
    isBlocked = 1
    blockTtl = existing
  elseif hits > limit then
    redis.call('SET', KEYS[2], '1', 'PX', blockDuration, 'NX')
    blockTtl = redis.call('PTTL', KEYS[2])
    isBlocked = 1
  end
end
return { hits, ttl, isBlocked, blockTtl }
`;

/**
 * Almacén de rate limiting respaldado por Redis. Al compartirse entre
 * instancias, el límite es consistente en un despliegue horizontal.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly client: RedisClient) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerRecord> {
    const dataKey = `throttler:${throttlerName}:${key}`;
    const blockKey = `${dataKey}:blocked`;

    const result = (await this.client.eval(INCREMENT_SCRIPT, {
      keys: [dataKey, blockKey],
      arguments: [String(ttl), String(limit), String(blockDuration)],
    })) as [number, number, number, number];

    const totalHits = Number(result[0]);
    const ttlMs = Number(result[1]);
    const blockTtlMs = Number(result[3]);

    const isBlocked = blockDuration > 0 ? Number(result[2]) === 1 : totalHits > limit;

    return {
      totalHits,
      timeToExpire: Math.max(0, Math.ceil(ttlMs / 1000)),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.max(1, Math.ceil(blockTtlMs / 1000)) : 0,
    };
  }
}
