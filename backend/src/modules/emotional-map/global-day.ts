import { env } from '../../config/env';

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Día global del diario emocional. El "día" es el mismo para toda la comunidad:
 * empieza a la hora configurada en UTC (`EMOTIONAL_DAY_START_HOUR_UTC`, por
 * defecto medianoche), no en el huso de cada persona. Así el recordatorio diario
 * aparece y desaparece a la vez para todo el mundo.
 */
export function globalDayRange(now: Date = new Date()): { start: Date; end: Date; day: string } {
  const hourMs = env.emotional.dayStartHourUtc * HOUR_MS;
  const shifted = new Date(now.getTime() - hourMs);
  const start = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) + hourMs,
  );
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end, day: start.toISOString().slice(0, 10) };
}
